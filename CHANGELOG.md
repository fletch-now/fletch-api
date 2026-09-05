# Changelog

## 0.1.0 - 2026-09-05

First public snapshot.

- `spec/`: `openapi.json` and `llms.txt` as served on 2026-09-05, with hashes in `SNAPSHOT.md`.
- `docs/API.md`: the written reference for the registry, changelog, watcher and webhook routes.
- `docs/EVENTS.md`: the 36 event kinds, the `observedAt|id` cursor, SSE resume and the Atom mapping.
- `docs/FRESHNESS.md`: how to read `/api/v1/status`.
- `webhooks/`: `X-Fletch-Signature` verifiers in TypeScript, Python and Go over one fixture of 25 vectors.
- `packages/fletch-sdk` 0.1.0 (in this repository; not published to npm): generated types, `FletchClient` with ETag revalidation, `eventsAfter` and `streamEvents`.
