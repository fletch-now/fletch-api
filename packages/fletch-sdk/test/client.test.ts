import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { FletchClient, FletchError, MAX_EVENTS_PAGE, parseEventCursor, parseFrame, VERSION } from "../src/index.ts";

interface Call {
  url: string;
  headers: Record<string, string>;
  redirect: RequestRedirect | undefined;
}

function fakeFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  async function fetchImpl(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const call = { url: String(input), headers: { ...(init?.headers as Record<string, string>) }, redirect: init?.redirect };
    calls.push(call);
    return handler(call);
  }
  return { fetch: fetchImpl as typeof fetch, calls };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

test("builds the URL from path and query parameters", function run() {
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1/" });
  assert.equal(client.url("/chains/{chainId}/assets/{symbol}", { path: { chainId: 4663, symbol: "BRK.B" } }), "https://example.test/api/v1/chains/4663/assets/BRK.B");
  assert.equal(client.url("/chains/{chainId}/events", { path: { chainId: 4663 }, query: { kind: "registry.", limit: 5 } }), "https://example.test/api/v1/chains/4663/events?kind=registry.&limit=5");
  assert.throws(function missing() {
    client.url("/chains/{chainId}/assets/{symbol}", { path: { chainId: 4663 } });
  }, /symbol/);
});

test("sends the key as a bearer token and refuses to send it over http", async function run() {
  const { fetch: fetchImpl, calls } = fakeFetch(function answer() {
    return jsonResponse({ chains: [] });
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", apiKey: "flk_test", fetch: fetchImpl });
  await client.get("/chains");
  assert.equal(calls[0]?.headers.authorization, "Bearer flk_test");
  assert.equal(calls[0]?.redirect, "error");
  assert.equal(calls[0]?.headers["user-agent"], `fletch-sdk/${VERSION}`);
  assert.throws(function plain() {
    new FletchClient({ baseUrl: "http://example.test/api/v1", apiKey: "flk_test" });
  }, /https/);
});

test("revalidates with If-None-Match and answers a 304 from the cache", async function run() {
  const { fetch: fetchImpl, calls } = fakeFetch(function answer(call) {
    if (call.headers["if-none-match"] === 'W/"one"') {
      return new Response(null, { status: 304, headers: { etag: 'W/"one"' } });
    }
    return jsonResponse({ events: [], nextCursor: "2026-09-05T00:00:00.000Z" }, { etag: 'W/"one"' });
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  const first = await client.get("/chains/{chainId}/events", { path: { chainId: 4663 } });
  const second = await client.get("/chains/{chainId}/events", { path: { chainId: 4663 } });
  assert.equal(first.status, 200);
  assert.equal(first.fromCache, false);
  assert.equal(calls[1]?.headers["if-none-match"], 'W/"one"');
  assert.equal(second.status, 304);
  assert.equal(second.fromCache, true);
  assert.deepEqual(second.body, first.body);
});

test("throws FletchError with status, retry timing and safe guidance", async function run() {
  const { fetch: fetchImpl } = fakeFetch(function answer() {
    return jsonResponse({ error: "Too many anonymous requests" }, { "retry-after": "30" }, 429);
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  await assert.rejects(client.status(), function check(error: unknown) {
    assert.ok(error instanceof FletchError);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterSeconds, 30);
    assert.match(error.message, /429.*Rate limit reached/);
    assert.deepEqual(error.body, { error: "Rate limit reached; wait before retrying." });
    return true;
  });
});

test("eventsAfter follows nextCursor until a short page", async function run() {
  const pages: Record<string, unknown> = {
    "c0": { events: [{ id: "ev_1" }, { id: "ev_2" }], nextCursor: "c2" },
    "c2": { events: [{ id: "ev_3" }], nextCursor: "c3" },
  };
  const { fetch: fetchImpl } = fakeFetch(function answer(call) {
    const cursor = new URL(call.url).searchParams.get("cursor") ?? "";
    return jsonResponse(pages[cursor]);
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  const seen: string[] = [];
  const iterator = client.eventsAfter("c0", 4663, { limit: 2 });
  for (;;) {
    const step = await iterator.next();
    if (step.done) {
      assert.equal(step.value, "c3");
      break;
    }
    seen.push(String(step.value.id));
  }
  assert.deepEqual(seen, ["ev_1", "ev_2", "ev_3"]);
});

test("eventsAfter never asks for more than the server's page cap", async function run() {
  const full = Array.from({ length: MAX_EVENTS_PAGE }, function row(_value, index) {
    return { id: `ev_${index}` };
  });
  const pages: Record<string, unknown> = {
    "c0": { events: full, nextCursor: "c1" },
    "c1": { events: [{ id: "ev_last" }], nextCursor: "c2" },
  };
  const { fetch: fetchImpl, calls } = fakeFetch(function answer(call) {
    const cursor = new URL(call.url).searchParams.get("cursor") ?? "";
    return jsonResponse(pages[cursor]);
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  let count = 0;
  for await (const event of client.eventsAfter("c0", 4663, { limit: 1000 })) {
    count += Number(event.id !== undefined);
  }
  assert.equal(new URL(calls[0]?.url ?? "").searchParams.get("limit"), String(MAX_EVENTS_PAGE));
  assert.equal(calls.length, 2);
  assert.equal(count, MAX_EVENTS_PAGE + 1);
});

test("parses a cursor and an SSE frame", function run() {
  const cursor = parseEventCursor("2026-09-05T11:50:43.476Z|ev_9f3256ce83b6dd98fedbe4ec");
  assert.equal(cursor?.id, "ev_9f3256ce83b6dd98fedbe4ec");
  assert.equal(cursor?.observedAt.toISOString(), "2026-09-05T11:50:43.476Z");
  assert.equal(parseEventCursor("not a time"), null);
  assert.equal(parseFrame(": keepalive"), null);
  const frame = parseFrame('id: 2026-09-05T11:10:24.254Z|ev_b6\nevent: lookalike.found\ndata: {"id":"ev_b6","kind":"lookalike.found"}');
  assert.equal(frame?.event, "lookalike.found");
  assert.equal(frame?.id, "2026-09-05T11:10:24.254Z|ev_b6");
  assert.equal(frame?.data.kind, "lookalike.found");
});

test("streamEvents yields frames as they arrive", async function run() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': fletch registry events, chain 4663\n\nid: a|ev_1\nevent: feed.stale\ndata: {"id":"ev_1","kind":"feed.stale"}\n\nid: b|ev_2\nevent: feed.fresh\nda'));
      controller.enqueue(encoder.encode('ta: {"id":"ev_2","kind":"feed.fresh"}\n\n'));
      controller.close();
    },
  });
  const { fetch: fetchImpl, calls } = fakeFetch(function answer() {
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  const kinds: string[] = [];
  for await (const frame of client.streamEvents(4663, { since: "a|ev_1" })) {
    kinds.push(frame.event);
  }
  assert.deepEqual(kinds, ["feed.stale", "feed.fresh"]);
  assert.equal(calls[0]?.url, "https://example.test/api/v1/chains/4663/events/stream?since=a%7Cev_1");
});

test("pool search keeps stale nulls and pages only when explicitly requested", async function run() {
  const pool = { poolId: "fixture", stateCurrent: false, stateCheckedAt: "2026-09-05T00:00:00Z", pricePublished: false, priceUsd: null, depthUsd: null };
  const { fetch: fetchImpl, calls } = fakeFetch(function answer() {
    return jsonResponse({ pools: [pool], total: 900000, sort: "volume" });
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  const response = await client.get("/chains/{chainId}/dex/pools", { path: { chainId: 4663 }, query: { sort: "volume", limit: 5, offset: 10 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://example.test/api/v1/chains/4663/dex/pools?sort=volume&limit=5&offset=10");
  assert.equal(response.body.pools?.[0]?.stateCurrent, false);
  assert.equal(response.body.pools?.[0]?.priceUsd, null);
  assert.deepEqual(response.body.pools?.[0], pool);
});


test("native fetch refuses same-origin redirects for JSON and SSE without a second request", async function run() {
  const requests: string[] = [];
  const server = createServer(function redirect(request, response) {
    requests.push(request.url ?? "");
    response.writeHead(302, { location: "/should-not-receive-credentials" });
    response.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const client = new FletchClient({ baseUrl: `http://127.0.0.1:${address.port}/api/v1` });
  try {
    await assert.rejects(client.get("/chains"), /refused redirect/);
    await assert.rejects(client.streamEvents().next(), /refused redirect/);
    assert.deepEqual(requests, ["/api/v1/chains", "/api/v1/chains/4663/events/stream"]);
  } finally {
    await new Promise<void>(function close(resolve, reject) {
      server.close(function closed(error) { if (error) reject(error); else resolve(); });
    });
  }
});

test("HTTP failures discard echoed credentials and private bodies while cancelling the stream", async function run() {
  for (const status of [401, 403, 429, 500]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"error":"PRIVATE_UPSTREAM flk_fixture_only"}')); },
      cancel() { cancelled = true; },
    });
    const { fetch: fetchImpl } = fakeFetch(function answer() {
      return new Response(stream, { status, headers: { "retry-after": "17" } });
    });
    const client = new FletchClient({ baseUrl: "https://example.test/api/v1", apiKey: "flk_fixture_only", fetch: fetchImpl });
    await assert.rejects(client.get("/chains"), function check(error: unknown) {
      assert.ok(error instanceof FletchError);
      assert.equal(error.status, status);
      assert.equal(error.retryAfterSeconds, 17);
      assert.doesNotMatch(error.message + JSON.stringify(error), /PRIVATE_UPSTREAM|flk_fixture_only/);
      return true;
    });
    assert.equal(cancelled, true);
  }
});

test("malformed successes and transport failures expose no upstream content or credential", async function run() {
  for (const kind of ["json", "network", "stream"]) {
    const fetchImpl = async function read(): Promise<Response> {
      if (kind === "network") throw new Error("PRIVATE_UPSTREAM flk_fixture_only");
      if (kind === "stream") return new Response('data: PRIVATE_UPSTREAM flk_fixture_only\n\n');
      return new Response('PRIVATE_UPSTREAM flk_fixture_only');
    };
    const client = new FletchClient({ baseUrl: "https://example.test/api/v1", apiKey: "flk_fixture_only", fetch: fetchImpl });
    const result = kind === "stream" ? client.streamEvents().next() : client.get("/chains");
    await assert.rejects(result, function check(error: unknown) {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message + JSON.stringify(error), /PRIVATE_UPSTREAM|flk_fixture_only/);
      return true;
    });
  }
});

test("configured credentials are redacted from successful JSON, cached reads and streamed data", async function run() {
  const { fetch: fetchImpl, calls } = fakeFetch(function answer(call) {
    if (call.url.includes("/stream")) return new Response('event: feed.fresh\ndata: {"id":"ev_1","title":"Bearer flk_fixture_only"}\n\n');
    if (call.headers["if-none-match"]) return new Response(null, { status: 304 });
    return jsonResponse({ chains: [], echoed: "Bearer flk_fixture_only" }, { etag: '"safe"' });
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", apiKey: "flk_fixture_only", fetch: fetchImpl });
  const first = await client.get("/chains");
  const cached = await client.get("/chains");
  assert.equal(cached.fromCache, true);
  for (const result of [first, cached]) {
    assert.doesNotMatch(JSON.stringify(result), /flk_fixture_only/);
    assert.match(JSON.stringify(result), /Bearer \[redacted\]/);
  }
  const stream = client.streamEvents();
  const frame = await stream.next();
  await stream.return(undefined);
  assert.match(JSON.stringify(frame), /Bearer \[redacted\]/);
  assert.doesNotMatch(JSON.stringify(frame), /flk_fixture_only/);
  assert.ok(calls.every(function secured(call) { return call.redirect === "error" && call.headers.authorization === "Bearer flk_fixture_only"; }));
});

test("caller abort keeps AbortError without exposing its custom reason", async function run() {
  const controller = new AbortController();
  controller.abort(new Error("PRIVATE_UPSTREAM flk_fixture_only"));
  for (const duringBody of [false, true]) {
    const fetchImpl = async function aborted(): Promise<Response> {
      if (!duringBody) throw controller.signal.reason;
      return new Response(new ReadableStream({ start(stream) { stream.error(controller.signal.reason); } }));
    };
    const client = new FletchClient({ baseUrl: "https://example.test/api/v1", apiKey: "flk_fixture_only", fetch: fetchImpl });
    await assert.rejects(client.get("/chains", { signal: controller.signal }), function check(error: unknown) {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      assert.doesNotMatch(error.message, /PRIVATE_UPSTREAM|flk_fixture_only/);
      return true;
    });
  }
});

test("token market helpers preserve combined filters, zero threshold and pagination", async function markets() {
  const { fetch: fetchImpl, calls } = fakeFetch(function answer() { return jsonResponse({ items: [], total: 0 }); });
  const client = new FletchClient({ fetch: fetchImpl });
  await client.marketFilters();
  assert.equal(new URL(calls[0]!.url).pathname, "/api/v1/chains/4663/markets/filters");
  await client.tokenMarkets(4663, { kind: "community", trust: "community", sort: "swaps", activity: "traded", data: "volume", depth: "v3_10k", identity: "same_name", minVolumeUsd: 0, page: 2, pageSize: 25, q: "A&B" });
  const url = new URL(calls[1]!.url);
  assert.equal(url.pathname, "/api/v1/chains/4663/markets");
  assert.equal(url.searchParams.get("minVolumeUsd"), "0");
  assert.equal(url.searchParams.get("q"), "A&B");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("sort"), "swaps");
  assert.equal(url.searchParams.get("identity"), "same_name");
});
