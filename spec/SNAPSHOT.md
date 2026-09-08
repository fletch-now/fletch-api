# Snapshot

Fetched 2026-09-08T18:27:17.277Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Tue, 08 Sep 2026 18:27:16 GMT | 102696 | `3f624e624ca29c36b622bb45a71971b9d1c567bc37696b089e70a08dbd451b2f` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Tue, 08 Sep 2026 18:27:17 GMT | 12063 | `35ccc52495d15b12561f1e9601fda5a33b7eba980fecd9592109a7c22f2ca5a2` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
