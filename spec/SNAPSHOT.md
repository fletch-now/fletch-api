# Snapshot

Fetched 2026-09-14T17:44:46.963Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 17:44:46 GMT | 202150 | `2837ffaddd9e37844a4d300e63adc321bfc295591a26f5a3ad646ce24d678478` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 17:44:47 GMT | 23215 | `45c04e070f237e49b90fdf99aaab0b6aa196e06c24a6049a07c8cfb821409012` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
