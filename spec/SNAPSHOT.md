# Snapshot

Fetched 2026-09-15T00:42:44.927Z by `scripts/snapshot.mjs`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Tue, 15 Sep 2026 00:42:44 GMT | 216062 | `db2705727309e1b6e149a5382c1247a2ff39eb49db09593b6f289685bb9b86ae` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Tue, 15 Sep 2026 00:42:45 GMT | 28557 | `5e99e84429d673de7ece341a991b6c67c07f1e91f3d6d1b5275491e947ee19d4` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.
