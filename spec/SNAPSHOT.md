# Snapshot

Fetched 2026-09-15T08:54:04.244Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Tue, 15 Sep 2026 08:54:04 GMT | 219044 | `a1c4ef1c3df25a16627a7eb607f28bf15c7d1c654bd8431f3843ec0c4abfd758` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Tue, 15 Sep 2026 08:54:04 GMT | 28995 | `dbf5f7517fde8e7807fca5529848af7a00918c8da30a5349936f977df1230fbd` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
