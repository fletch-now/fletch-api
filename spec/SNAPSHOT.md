# Snapshot

Fetched 2026-09-14T12:27:41.586Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 12:27:41 GMT | 193944 | `7b653fdd8a44db5d3c440601f585b6bc7aae5a4b378c566ae8b87a25b98ebf82` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 12:27:41 GMT | 21630 | `8db2e84abcbb3b2f2d762ab97963ba17ec8f16c642cd8da4a6616b0d878fabf6` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
