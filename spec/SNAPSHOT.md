# Snapshot

Fetched 2026-09-13T22:16:01.168Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Sun, 13 Sep 2026 22:16:00 GMT | 185178 | `ac32cf073664bd5a46c3b9616304cae83da0549733eb3677554be355b3152bd4` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Sun, 13 Sep 2026 22:16:01 GMT | 20836 | `08581db149ebd1d44be2f51571e73cac3c051a9771dedfcbde10ad7268ac8682` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
