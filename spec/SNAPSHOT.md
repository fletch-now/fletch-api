# Snapshot

Fetched 2026-09-05T11:59:43Z with curl (the same bytes `scripts/snapshot.mjs` writes). Each
file is the response body exactly as served; the hash is over those bytes. The live
documents change when Fletch deploys, so compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
| `spec/openapi.json` | https://fletch.now/api/v1/openapi.json | Sat, 05 Sep 2026 11:59:43 GMT | 75944 | `4f6df16263b2b230d549f58b2ae7b178ca370089c4db935cee5568f7340e72a4` |
| `spec/llms.txt` | https://fletch.now/llms.txt | Sat, 05 Sep 2026 11:59:43 GMT | 10100 | `08d7e40e661c29c39ba9685224b53144e347ff311fb4f00e09d58af56afe78d6` |

To refresh: `npm run snapshot && npm run generate`, then commit `spec/` and
`packages/fletch-sdk/src/generated/` together.

Known gap in this snapshot: the served spec still types `/chains/{chainId}/events` rows as
bare objects and its `cursor` parameter as a date-time. The source now carries an
`AuthorityEvent` schema and a string cursor (see `docs/EVENTS.md`); the next refresh after
that deploys will pick them up, and the SDK's event types with it.
