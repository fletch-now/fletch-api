# Verifying Fletch webhook deliveries

A watcher that delivers to a webhook posts JSON to the HTTPS URL you registered under
`POST /api/v1/webhooks`. Every request carries:

```
content-type: application/json
user-agent: fletch-webhooks/1
x-fletch-event: large_transfer
x-fletch-delivery: dl_9f0c…
x-fletch-signature: t=1789200000,v1=8b1a…
```

`X-Fletch-Signature` is `t=<unix seconds>,v1=<hex>`. The hex is HMAC-SHA256, keyed with
the endpoint's `whsec_…` secret (shown once when the endpoint is created or its secret
rotated), over the exact bytes `"<t>." + body`. Sign the raw request body as received;
parsing and re-serializing it changes the bytes. Reject a timestamp more than a few
minutes from your clock, and compare digests in constant time.

Three verifiers, each standard-library only, each run against `fixtures/vectors.json`:

| Language | File | Test |
|---|---|---|
| TypeScript (Node 22.18+) | `typescript/verify.ts` | `cd typescript && node --test verify.test.ts` |
| Python 3.9+ | `python/fletch_webhook.py` | `cd python && python -m unittest` |
| Go 1.22+ | `go/verify.go` | `cd go && go test ./...` |

The fixture holds positive vectors (a delivery, a ping, a body with non-ASCII text, the
timestamp at the tolerance bound, an unknown extra field, uppercase hex) and negative
ones (wrong secret, one byte changed, re-serialized body, expired and future timestamps,
a header timestamp that differs from the signed one, missing or malformed fields, a
truncated digest). Every vector fixes `now` and the tolerance so the result does not
depend on the clock. The secrets in it exist only for these vectors.

What each verifier accepts:

- `t` is digits only; `v1` is 64 hex characters in either case.
- Fields are split on `,` and the first `=`; surrounding spaces are trimmed; unknown
  fields are ignored so a later scheme can be added beside `v1`.
- The timestamp passes when `|now - t| <= tolerance` (default 300 seconds).
- The digest is compared as bytes in constant time.

Deliveries are retried on anything but a 2xx, up to 8 attempts with backoff, and the
same `id` (`x-fletch-delivery`, and `id` in the body) can arrive more than once: treat it
as the idempotency key. Redirects are not followed; answer at the registered URL.
