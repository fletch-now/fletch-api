// Verifies the X-Fletch-Signature header on a webhook delivery from Fletch.
// The header is `t=<unix seconds>,v1=<hex>` where the hex is HMAC-SHA256 over
// the exact string "<t>.<raw body>" keyed with the endpoint's whsec_ secret.
// The timestamp is inside the signed string, so a captured body cannot be
// replayed later with a fresh header; `toleranceSeconds` bounds how old (or
// how far in the future) a delivery may be. Node only: node:crypto.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyOptions {
  // Seconds either side of `now` that a timestamp is accepted; default 300.
  toleranceSeconds?: number;
  // Unix seconds to judge the timestamp against; default the clock.
  now?: number;
}

export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

const SIGNATURE_HEX_LENGTH = 64;

// Unknown fields are ignored so a later scheme (v2=…) can be added beside v1
// without breaking receivers on this version.
export function parseSignatureHeader(header: string): ParsedSignature | null {
  let timestamp: string | null = null;
  let signature: string | null = null;
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signature = value;
    }
  }
  if (timestamp === null || signature === null) {
    return null;
  }
  if (!/^\d+$/.test(timestamp) || !/^[0-9a-fA-F]+$/.test(signature) || signature.length !== SIGNATURE_HEX_LENGTH) {
    return null;
  }
  return { timestamp: Number(timestamp), signature: signature.toLowerCase() };
}

export function signWebhookBody(secret: string, body: string | Uint8Array, timestampSeconds: number): string {
  const digest = createHmac("sha256", secret).update(`${timestampSeconds}.`).update(body).digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

// `body` must be the raw request bytes (or the exact string they decode to),
// never a re-serialized object: a reordered key or a changed space changes
// the digest.
export function verifyFletchSignature(secret: string, header: string, body: string | Uint8Array, options: VerifyOptions = {}): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return false;
  }
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.`).update(body).digest();
  const given = Buffer.from(parsed.signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
