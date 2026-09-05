// Two reads against the live API. Set FLETCH_OFFLINE=1 to skip them. Each test
// makes at most three requests; the anonymous limit is 120 a minute.

import assert from "node:assert/strict";
import { test } from "node:test";
import { FletchClient, isOverallVerdict, MAINNET_CHAIN_ID, parseEventCursor } from "../src/index.ts";

const offline = process.env.FLETCH_OFFLINE === "1";
const client = new FletchClient({ userAgent: "(fletch-api live test)" });

test("GET /status answers a verdict and one row per job", { skip: offline }, async function run() {
  const status = await client.status();
  assert.equal(status.chainId, MAINNET_CHAIN_ID);
  assert.ok(isOverallVerdict(status.verdict), `verdict ${String(status.verdict)}`);
  assert.equal(typeof status.summary, "string");
  assert.ok(!Number.isNaN(Date.parse(status.checkedAt)));
  assert.ok(status.jobs.length > 0);
  for (const job of status.jobs) {
    assert.ok(job.verdict in status.verdicts, `${job.job}: ${job.verdict}`);
    assert.ok(job.cadenceSeconds > 0);
  }
  assert.equal(typeof status.verdicts.live, "string");
});

test("GET /events pages by cursor and revalidates by ETag", { skip: offline }, async function run() {
  const first = await client.get("/chains/{chainId}/events", { path: { chainId: MAINNET_CHAIN_ID }, query: { limit: 2 } });
  assert.equal(first.status, 200);
  assert.ok(first.etag, "the changelog answers with an ETag");
  const events = first.body.events ?? [];
  assert.ok(events.length <= 2);
  for (const event of events) {
    assert.match(String(event.id), /^ev_[0-9a-f]{24}$/);
    assert.match(String(event.kind), /^[a-z]+\.[a-z_]+$/);
    assert.ok(!Number.isNaN(Date.parse(String(event.observedAt))));
  }
  const kinds = (first.body as { kinds?: string[] }).kinds ?? [];
  assert.ok(kinds.includes("registry.paused"), "kinds lists every kind the daemon can emit");
  const cursor = parseEventCursor(String(first.body.nextCursor));
  assert.ok(cursor?.id, `nextCursor is observedAt|id, got ${String(first.body.nextCursor)}`);

  const again = await client.get("/chains/{chainId}/events", { path: { chainId: MAINNET_CHAIN_ID }, query: { limit: 2 } });
  assert.ok(again.status === 304 || again.status === 200, "a repeat is a 304, or a 200 when a new event landed between the two");
  if (again.status === 304) {
    assert.deepEqual(again.body, first.body);
  }

  const after = await client.events(MAINNET_CHAIN_ID, { cursor: String(first.body.nextCursor), limit: 5 });
  assert.equal(typeof after.nextCursor, "string");
  const newer = after.events ?? [];
  for (let index = 1; index < newer.length; index += 1) {
    assert.ok(String(newer[index - 1]?.observedAt) <= String(newer[index]?.observedAt), "catch-up pages are oldest first");
  }
});
