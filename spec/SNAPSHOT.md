# Snapshot

Fetched 2026-09-13T20:26:01.998Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Sun, 13 Sep 2026 20:26:01 GMT | 168661 | `74fb9f155be55e3a35ba0eceb356e992da70a45d7d3a9dbbc8b63ca3aeab5228` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Sun, 13 Sep 2026 20:26:02 GMT | 19452 | `f874c0fd1210698d1f33ac64730589dc370b9da3c5199f1f4d71dd11063ff48b` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
