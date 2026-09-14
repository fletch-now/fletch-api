# Snapshot

Fetched 2026-09-14T11:34:33.615Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 11:34:33 GMT | 189558 | `7e24fab094b528e3bdaed501d08d64b4df82f51f89232367e62aa8d07d1c55ff` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 11:34:33 GMT | 20836 | `08581db149ebd1d44be2f51571e73cac3c051a9771dedfcbde10ad7268ac8682` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
