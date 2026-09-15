# Snapshot

Fetched 2026-09-15T10:36:25.668Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Tue, 15 Sep 2026 10:36:22 GMT | 219440 | `4ed664a102b19bc4445511bea885998d906b40e6b236c9c71dea1b54195422b4` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Tue, 15 Sep 2026 10:36:25 GMT | 32122 | `f225fa6db9c27ca9bef0c35151ad32045b31e370cdcc5ac539f31f924448c941` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
