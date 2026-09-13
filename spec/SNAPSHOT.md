# Snapshot

Fetched 2026-09-13T23:05:19.293Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Sun, 13 Sep 2026 23:05:18 GMT | 188124 | `cc19eb2ecc3ada79da35898b38f65796b15e88b959120cc1108015ed66503cfe` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Sun, 13 Sep 2026 23:05:19 GMT | 20836 | `08581db149ebd1d44be2f51571e73cac3c051a9771dedfcbde10ad7268ac8682` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
