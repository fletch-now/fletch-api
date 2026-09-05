import assert from "node:assert/strict";
import { test } from "node:test";
import { FletchClient, FletchError, MAX_EVENTS_PAGE, parseEventCursor, parseFrame, VERSION } from "../src/index.ts";

interface Call {
  url: string;
  headers: Record<string, string>;
}

function fakeFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  async function fetchImpl(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const call = { url: String(input), headers: { ...(init?.headers as Record<string, string>) } };
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

test("throws FletchError with the status and the server's message", async function run() {
  const { fetch: fetchImpl } = fakeFetch(function answer() {
    return jsonResponse({ error: "Too many anonymous requests" }, { "retry-after": "30" }, 429);
  });
  const client = new FletchClient({ baseUrl: "https://example.test/api/v1", fetch: fetchImpl });
  await assert.rejects(client.status(), function check(error: unknown) {
    assert.ok(error instanceof FletchError);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterSeconds, 30);
    assert.match(error.message, /429.*Too many anonymous requests/);
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
