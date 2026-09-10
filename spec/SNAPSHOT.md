# Snapshot

Fetched 2026-09-10T21:33:57.437Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Thu, 10 Sep 2026 21:33:57 GMT | 147155 | `cc2babef24ba0c1a43421d28808b3f998366e4830727a74e8b5561dbd554985e` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Thu, 10 Sep 2026 21:33:57 GMT | 17566 | `e666769e5ff5fcf758e6be9988338f757a863a93627c43118dbd776738b70209` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
