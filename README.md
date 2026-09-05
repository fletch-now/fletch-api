<img src="assets/wordmark.png" alt="Fletch" width="160">

# fletch-api

OpenAPI 3.1 spec, written reference, event vocabulary, webhook verification and a
generated TypeScript client for the Fletch v1 API: the registry of Stock Tokens on
Robinhood Chain, its changelog, and watchers that deliver to Telegram or a signed webhook.

The TypeScript client lives in `packages/fletch-sdk`; it is not on npm yet. Until it
is, build it from this repository and import the result:

```bash
npm ci && npm run build --workspace fletch-sdk
```

[fletch.now/developers](https://fletch.now/developers) ·
[fletch.now/api/v1/docs](https://fletch.now/api/v1/docs) ·
[fletch.now/registry](https://fletch.now/registry) ·
[fletch.now/llms.txt](https://fletch.now/llms.txt)

## What is here

| Path | Contents |
|---|---|
| `spec/openapi.json`, `spec/llms.txt` | The two public documents as served, unmodified; `spec/SNAPSHOT.md` records when and their hashes |
| `docs/API.md` | The written reference: keys, scopes, idempotency, watchers, webhooks, every registry read |
| `docs/EVENTS.md` | The changelog: 36 event kinds with their plain labels, the `observedAt\|id` cursor, resuming a stream, the Atom feed |
| `docs/FRESHNESS.md` | Reading `/api/v1/status`: the four overall verdicts, the six job states, what each threshold is |
| `webhooks/` | `X-Fletch-Signature` verifiers in TypeScript, Python and Go, tested against one fixture of positive and negative vectors |
| `packages/fletch-sdk` | `FletchClient`: typed reads generated from the spec, ETag revalidation, cursor paging and SSE for the changelog |

The base URL is `https://fletch.now/api/v1`. Registry reads need no key; anonymous
callers get 120 requests a minute per address, and a key has its own budget of 600 an
hour. Every registry response carries an `ETag`; send `If-None-Match` and an unchanged
answer is a 304 with no body.

## Working on it

```bash
npm ci
npm run typecheck
npm run test:offline          # fixtures and fakes only
npm test                      # adds the live reads in packages/fletch-sdk/test/live.test.ts
npm run snapshot && npm run generate   # refetch spec/ and rewrite the SDK's types
```

Python and Go verifiers run with `python -m unittest` in `webhooks/python` and
`go test ./...` in `webhooks/go`. CI runs all three.

The spec is authored beside the server and served at `/api/v1/openapi.json`; this
repository holds a dated copy and the material built on it. A weekly workflow opens a
pull request when the live documents change.

Fletch is not affiliated with Robinhood Markets, Inc.

MIT, see `LICENSE`.
