# Snapshot

Fetched 2026-09-14T16:41:43.756Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 16:41:43 GMT | 194983 | `de3aa2679c1f77001853e75584a1728fea69433dd0e9a7bff7bd0a16b9e31d87` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 16:41:43 GMT | 22367 | `af4b2d96a2842429ca62f4f32e930ef6b3612fafe91dcef1bd3cfdd599a86b89` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
