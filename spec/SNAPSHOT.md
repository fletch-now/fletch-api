# Snapshot

Fetched 2026-09-14T16:14:29.866Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Mon, 14 Sep 2026 16:14:29 GMT | 194781 | `3048476dee787a76d36f76e875fac2f54cd96cda9f07d6884efb9b8f704141e8` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Mon, 14 Sep 2026 16:14:29 GMT | 22124 | `40570010cf97edde23c6cca9d01889ab29bc1b529c5ebbffeb352bfd6cc01372` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
