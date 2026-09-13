# Changelog

## 0.3.2 - 2026-09-14 (prepared)

Add ascending and descending price, volume, market-cap and pool-count sorting across complete filtered Markets results. Expose asset filters and optional pagination through SDK/MCP reads. Shared raw observations retain their source times; expiry and filtering are recomputed on every request. npm publication remains pending.

## 0.3.1 - 2026-09-14 (prepared)

Clarify crypto-catalog scope, `not_covered` Stock Token status and separate verified stock membership. Add paginated stock/community pairing reads with stable IDs, metadata coverage and complete filtered counts. Expose measured lookalike backfill coverage and preserve source ages. npm publication remains pending.

## 0.3.0 - 2026-09-13

Add Robinhood app catalog reads with pagination, account trading availability,
source age and stale/error flags. Market responses include app status and stock
pairing verdicts. Refresh the public schema and agent examples; document listing
events, watcher baseline suppression and continuous-stream cursor handling.


## Unreleased

- Add typed `tokenMarkets` and `marketFilters` reads for the shared Markets filter contract. Refresh the live specification, agent reference and generated types on 10 September 2026. npm publication remains pending.


## 0.2.0 — 2026-09-08 (prepared)

- Reject redirects on JSON and SSE reads; retain safe status/retry guidance rather than upstream error bodies, and redact configured credentials from returned data.
- Refresh the deployed public spec and generated SDK types; document token resolution, pool search, freshness and metadata backlog.
- Preserve a checked artifact and an explicit manual-publication notice when repository policy prevents automated PR creation.
- Retain legacy metric caveats and pending npm publication.


## 0.1.0 - 2026-09-05

First public snapshot.

- `spec/`: `openapi.json` and `llms.txt` as served on 2026-09-05, with hashes in `SNAPSHOT.md`.
- `docs/API.md`: the written reference for the registry, changelog, watcher and webhook routes.
- `docs/EVENTS.md`: the 36 event kinds, the `observedAt|id` cursor, SSE resume and the Atom mapping.
- `docs/FRESHNESS.md`: how to read `/api/v1/status`.
- `webhooks/`: `X-Fletch-Signature` verifiers in TypeScript, Python and Go over one fixture of 25 vectors.
- `packages/fletch-sdk` 0.1.0 (in this repository; not published to npm): generated types, `FletchClient` with ETag revalidation, `eventsAfter` and `streamEvents`.
