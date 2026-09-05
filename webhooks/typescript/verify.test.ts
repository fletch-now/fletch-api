import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { signWebhookBody, verifyFletchSignature } from "./verify.ts";

interface Vector {
  name: string;
  secret: string;
  header: string;
  body: string;
  now: number;
  toleranceSeconds: number;
  valid: boolean;
  reason: string;
}

const vectors = JSON.parse(readFileSync(new URL("../fixtures/vectors.json", import.meta.url), "utf8")) as { vectors: Vector[] };

for (const vector of vectors.vectors) {
  test(`${vector.valid ? "accepts" : "rejects"}: ${vector.name}`, function run() {
    const result = verifyFletchSignature(vector.secret, vector.header, vector.body, { now: vector.now, toleranceSeconds: vector.toleranceSeconds });
    assert.equal(result, vector.valid, vector.reason);
  });
}

test("signs the way Fletch does", function run() {
  const header = signWebhookBody("whsec_test", '{"id":"dl_1"}', 1789200000);
  assert.ok(verifyFletchSignature("whsec_test", header, '{"id":"dl_1"}', { now: 1789200010 }));
  assert.ok(!verifyFletchSignature("whsec_test", header, '{"id":"dl_2"}', { now: 1789200010 }));
});

test("signs the raw bytes, not a re-encoded string", function run() {
  const body = new TextEncoder().encode('{"symbol":"AAPL","note":"€"}');
  const header = signWebhookBody("whsec_test", body, 1789200000);
  assert.ok(verifyFletchSignature("whsec_test", header, body, { now: 1789200000 }));
  assert.ok(verifyFletchSignature("whsec_test", header, '{"symbol":"AAPL","note":"€"}', { now: 1789200000 }));
});
