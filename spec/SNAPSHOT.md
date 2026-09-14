# Snapshot

Fetched 2026-09-14T19:07:44.056Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 19:07:43 GMT | 202216 | `c24ec88d9df261585e89f9af3c536c53dc713266f9931adb47411637dcee1f3b` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 19:07:44 GMT | 24851 | `a6dd05fc740720bc45a7162098742e7592a7643b262b140e25b3369deb84d34c` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
