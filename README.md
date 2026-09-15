<img src="assets/wordmark.png" alt="Fletch" width="160">

# fletch-api

OpenAPI 3.1 spec, written reference, event vocabulary, webhook verification and a
generated TypeScript client for the Fletch v1 API: Stock Tokens, community token markets and Robinhood app status on
Robinhood Chain, the changelog, and watchers that record dashboard matches with optional
Telegram or signed webhook notifications.

The public app directory adds `GET /apps` and `GET /apps/{slug}`, with typed SDK
helpers `publishedApps()` and `publishedApp()`. Listings include creator-provided
descriptions and optional token metadata checks. Public results follow owner
consent, admin review and the currently published app version.
Use the returned `app.slug` for links to `/published/{slug}`. Owners can change
that listing address without changing the hosted app URL. Old directory links
redirect after approval, and API reads using an old slug return the current
record only while the listing remains public.

Link a token's human-readable market page at
`https://fletch.now/registry/markets/{address}`. JSON remains at
`GET /tokens/{address}`. [The agent guide](https://fletch.now/skill.md)
explains network selection, freshness checks and bounded requests.

The TypeScript client lives in `packages/fletch-sdk`. npm publication is pending.
Build an installable package from this checkout:

```bash
npm ci --ignore-scripts
npm pack --workspace fletch-sdk
```

This writes `fletch-sdk-0.3.2.tgz`. In your application, run
`npm install /absolute/path/to/fletch-sdk-0.3.2.tgz`, then import
`FletchClient` from `fletch-sdk`. See [the release guide](docs/RELEASING.md)
for package checks and npm publishing.

[fletch.now/developers](https://fletch.now/developers) ·
[fletch.now/api/v1/docs](https://fletch.now/api/v1/docs) ·
[fletch.now/registry](https://fletch.now/registry) ·
[fletch.now/llms.txt](https://fletch.now/llms.txt)

## What is here

| Path | Contents |
|---|---|
| `spec/openapi.json`, `spec/llms.txt` | The two public documents as served, unmodified; `spec/SNAPSHOT.md` records when and their hashes |
| `docs/API.md` | The written reference: keys, scopes, idempotency, watchers, webhooks, every registry read |
| `docs/EVENTS.md` | The changelog: event kinds with their plain labels, the `observedAt\|id` cursor, resuming a stream, the Atom feed |
| `docs/FRESHNESS.md` | Reading `/api/v1/status`: the four overall verdicts, the six job states, what each threshold is |
| `webhooks/` | `X-Fletch-Signature` verifiers in TypeScript, Python and Go, tested against one fixture of positive and negative vectors |
| `packages/fletch-sdk` | `FletchClient`: typed reads generated from the spec, ETag revalidation, cursor paging and SSE for the changelog |

The base URL is `https://fletch.now/api/v1`. Registry reads need no key; anonymous
callers get 120 requests a minute per address, and a key has its own budget of 600 an
hour. Every registry response carries an `ETag`; send `If-None-Match` and an unchanged
answer is a 304 with no body.

## App catalog and live listings

```sh
curl -fsS 'https://fletch.now/api/v1/chains/4663/app-catalog?q=FRONG'
curl -fsS 'https://fletch.now/api/v1/chains/4663/markets?q=FRONG'
curl -fsS 'https://fletch.now/api/v1/chains/4663/events?kind=listing.&limit=10'
```

The catalog includes every observed symbol, including those with no known on-chain
contract. `display_only` means a price feed without app trading; `tradable` follows
the catalog's trading fields. Account-specific availability remains in `pairs`.
Check `source`, `observedAt`, `ageSeconds`, `stale` and `error` before using a status.
Follow `nextOffset` with `offset` until null; `limit` is 1 to 200. Pages read the
current snapshot, which may change between requests.

Crypto-catalog observation targets 15 seconds. Pool discovery, contract scouting
and lookalike work run in bounded minute-level passes. A successful pass does not
mean the whole catalog has been searched or every token refreshed; page cursors,
pending counts and per-record observation times show the remaining coverage.
`/api/v1/status` exposes pending searches, contract checks and metadata backlogs.

Markets returns `robinhoodApp`, separate `stockToken` identity, `stockPairingSummary`,
at most three grouped `stockPairings` examples and `catalogMatches`. A shared ticker
does not verify a contract. Each pairing records its stock side as `canonical`,
`lookalike` or `unconfirmed`; economic dominance remains separate.

Use `/api/v1/chains/4663/events/stream` for SSE. The stream carries all event kinds;
listen for `listing.added`, `listing.changed` and `listing.removed`. Retain each
processed cursor for reconnects. `listing.observed` is the initial baseline and
does not trigger alerts. Account watchers use `kind: "listing_event"`. Select an
owned webhook endpoint or connect Telegram for notifications. Respect `Retry-After`
on HTTP 429 and preserve null values and unavailable reasons.

`lastDelivery.createdAt` is when Fletch saved the latest match. `lastDelivery.sentAt`
is null until a notification is sent. Status `held` means the match is saved in the
dashboard and its notification is held. A first watcher can record matches
before linking a notification channel; additional watchers require Telegram or a webhook.

Webhook connection tests and watcher alert attempts have separate reporting:
`lastTestAt`, `lastTestStatus`, `lastTestError` and `lastAlertAt`, `lastAlertStatus`,
`lastAlertError`. A test ping has `watcher: null`; HTTP 2xx confirms receiver
acknowledgement. Read `/api/v1/watchers/{id}/runs` for matched event delivery
history. Separate reporting starts with the 14 September release; historical
`lastDeliveredAt` includes both tests and alerts. Disabled endpoints retain queued
notifications without consuming attempts. Choosing a new webhook queues held
matches from the last 24 hours.

## Working on it

```bash
npm ci
npm run typecheck
npm run test:offline          # fixtures and fakes only
npm run test:package          # installs the tarball and checks runtime/types
npm test                      # adds the live reads in packages/fletch-sdk/test/live.test.ts
npm run snapshot && npm run generate   # refetch spec/ and rewrite the SDK's types
```

Python and Go verifiers run with `python -m unittest` in `webhooks/python` and
`go test ./...` in `webhooks/go`. CI runs all three.

The spec is authored beside the server and served at `/api/v1/openapi.json`; this
repository holds a dated copy and the material built on it. A daily workflow validates changed documents and attempts a pull request. If
repository policy blocks PR creation, it uploads the checked files as a 14-day
artifact and explicitly records that manual publication is required.

Fletch is not affiliated with Robinhood Markets, Inc.

MIT, see `LICENSE`.

Use [the freshness guide](docs/FRESHNESS.md) for `stateCurrent`, metadata backlog
and field timestamps. A live job verdict alone does not establish fresh prices.
[Full agent reference](https://fletch.now/llms-full.txt).

The SDK also exports structured metric observation and selection types. Markets
can be read one filtered page at a time; inspect each metric's expiry and inputs,
and each Status job's `metricCoverage`, independently from scheduler health.

Stock/community pools have [complete paginated reads](docs/STOCK-PAIRINGS.md). Crypto-catalog non-coverage and separate verified Stock Token identity are explained in [source scope](docs/APP-CATALOG.md).
