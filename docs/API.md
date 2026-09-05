# Fletch API v1

The HTTP API behind fletch.now: the Robinhood Chain registry, its changelog, and
watchers that deliver to Telegram or a signed webhook. The dashboard reads the same
routes, so a script and a browser tab never disagree. Registry reads need no key.

This file is the written reference for the routes in `spec/openapi.json`. It is derived
from the reference kept beside the server and covers the registry, the changelog,
watchers and webhooks; `docs/EVENTS.md` describes the changelog in detail and
`docs/FRESHNESS.md` the status verdict.

Base URL: `https://fletch.now/api/v1`

Machine-readable spec: `GET /api/v1/openapi.json` (OpenAPI 3.1, covers exactly the
routes that exist). A dated copy is in `spec/openapi.json`.

## Getting a key

Sign in with your wallet, open **Settings → API keys**, name the key and pick its
scopes. The token (`flk_...`) is shown exactly once; store it then. The same page
lists and revokes keys. Each key is limited to 600 requests an hour.

Every v1 request after that carries the key as a bearer token:

```bash
curl https://fletch.now/api/v1/chains \
  -H "Authorization: Bearer flk_..."
```

A signed-in browser session also authenticates a v1 request and carries every
scope, because it is the account owner acting directly. That is for the dashboard's
own use; a script should use a key.

## Scopes

Registry reads are public. `registry:read` is the scope a key needs to make them
under the key's own rate budget in place of the anonymous per-address one. Watcher
and webhook routes always need a scope, checked when the request authenticates with
a key. Request only what you use: a key limited to reading cannot create or delete
anything.

| Scope | Grants |
|---|---|
| `registry:read` | `GET /chains`, and the `GET /chains/:chainId/...` reads under a key |
| `watchers:read` | `GET /watchers`, `GET /watchers/:id`, `GET /watchers/:id/runs`, `GET /webhooks` |
| `watchers:write` | `POST /watchers`, `PATCH /watchers/:id`, `DELETE /watchers/:id`, `POST /webhooks`, `PATCH /webhooks/:id`, `DELETE /webhooks/:id`, `POST /webhooks/:id/test` |

Two further scopes, `projects:read` and `builds:read`, cover account routes this
document does not describe.

On `/chains`, `/watchers` and `/webhooks`, a request with no key and no session gets
`401`; the `/chains/{chainId}/...` registry reads answer anonymously and check
`registry:read` only when a key is presented. A key missing the route's scope gets
`403` with `{"error": "Missing scope: <scope>"}`.

## Idempotency

`POST /watchers` accepts an `Idempotency-Key` header. Send the same key on a
retried request (a timeout, a dropped connection) and you get back the watcher
that request already created, with a `200` in place of a second `201`. The key is
scoped to your account. Reusing a key for a different watcher returns the first
one, so give each logical creation its own key.

## Examples

**List Stock Tokens on mainnet:**

```bash
curl "https://fletch.now/api/v1/chains/4663/assets"
```

**Get AAPL:**

```bash
curl "https://fletch.now/api/v1/chains/4663/assets/AAPL"
```

**Create a large-transfer watcher on AAPL, transfers over 1000 tokens:**

```bash
AAPL_ASSET_ID=$(curl -s "https://fletch.now/api/v1/chains/4663/assets/AAPL" | jq -r .asset.id)

curl -X POST https://fletch.now/api/v1/watchers \
  -H "Authorization: Bearer flk_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aapl-watch-1" \
  -d "{\"assetId\": \"$AAPL_ASSET_ID\", \"threshold\": \"1000\"}"
```

A watcher is only created if the target asset is in the registry — v1 has no
free-text address field for the asset, same as the dashboard's create form. The
watched **wallet** is different: it is a filter on the logs rather than a contract
Fletch trusts, so any address is allowed there.

**Create a wallet-activity watcher: alert on every AAPL transfer touching one wallet:**

```bash
curl -X POST https://fletch.now/api/v1/watchers \
  -H "Authorization: Bearer flk_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aapl-wallet-watch-1" \
  -d "{\"assetId\": \"$AAPL_ASSET_ID\", \"kind\": \"wallet_activity\", \"wallet\": \"0x1234567890123456789012345678901234567890\", \"threshold\": \"0\"}"
```

`threshold` can be `"0"` here — the one place a watcher fires on every transfer
rather than only above an amount. Set it above zero to only hear about transfers
at or above that many tokens, same units as `large_transfer`. Each delivery's
payload carries `direction`: `"out"` when the watched wallet sent it, `"in"` when
it received it.

**List a watcher's run history:**

```bash
curl "https://fletch.now/api/v1/watchers/wt_.../runs?limit=20" \
  -H "Authorization: Bearer flk_..."
```

Each run's `status` is `pending`, `sent`, `failed`, `retracted` or `held`. `retracted`
means the block it matched in was reorged out and the alert no longer applies; `held`
means a Telegram delivery is waiting for you to link Telegram, and is sent once you do.
Every alert is sequencer-confirmed, not final on Ethereum; nothing in v1 changes
that.

## Webhooks

A watcher delivers to Telegram by default. Register an endpoint and it can post the
same alert to your own server instead, signed.

```bash
curl -X POST https://fletch.now/api/v1/webhooks \
  -H "Authorization: Bearer flk_..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/fletch", "name": "prod"}'
```

The response carries `webhook.secret` — a `whsec_…` string shown exactly once, here.
Store it then; the row keeps it encrypted and no route ever returns it again.
`PATCH /webhooks/{id}` with `{"rotateSecret": true}` mints a new one (and shows it
once), `{"enabled": false}` turns an endpoint off, and `DELETE /webhooks/{id}` removes
it — that also pauses every watcher that was delivering to it, and says how many in
`pausedWatchers`. Deleting also fails the alerts already queued for those watchers,
with `the webhook endpoint this alert was queued for was deleted` as the reason.

Disabling an endpoint pauses its watchers too, rather than leaving them running while
their alerts are dropped; enabling it again resumes exactly those. Deliveries queued
before the endpoint went off keep retrying on the normal backoff, up to 8 attempts
spanning at most about eight and a half minutes; a disable longer than that fails them
with `webhook endpoint disabled` as the reason. A disabled endpoint refuses a test
with 400: enable it first.

A watcher whose endpoint was deleted keeps `delivery: "webhook"` with `webhookId:
null` and cannot be resumed — `PATCH /watchers/{id}` with `{"enabled": true}` answers
400 saying so. Re-point it instead:

```bash
curl -X PATCH https://fletch.now/api/v1/watchers/wt_... \
  -H "Authorization: Bearer flk_..." \
  -H "Content-Type: application/json" \
  -d '{"webhookId": "wh_...", "enabled": true}'
```

`{"webhookId": null}` sends the watcher back to Telegram. The endpoint has to be
yours and enabled.

The URL must be `https://` on a public host: a private or link-local address is
rejected with a message saying so. Five endpoints per account.

**Point a watcher at it:**

```bash
curl -X POST https://fletch.now/api/v1/watchers \
  -H "Authorization: Bearer flk_..." \
  -H "Content-Type: application/json" \
  -d "{\"assetId\": \"$AAPL_ASSET_ID\", \"threshold\": \"1000\", \"webhookId\": \"wh_...\"}"
```

**Test it now:** `POST /webhooks/{id}/test` sends a signed `ping` immediately and
answers with what your endpoint said — `{ "ok": true, "status": 200, "error": null }`.
It is always HTTP 200: the request succeeded, and your endpoint's own answer is the
body. A test is not queued, so a failing one is not retried afterwards.

### What arrives

```
POST /your/path
content-type: application/json
x-fletch-event: large_transfer
x-fletch-delivery: dl_9f0c…
x-fletch-signature: t=1789200000,v1=8b1a…
```

```json
{
  "id": "dl_9f0c…",
  "kind": "large_transfer",
  "payload": { "kind": "large_transfer", "symbol": "AAPL", "amount": "1500", "txHash": "0x…" },
  "watcher": { "id": "wt_…", "name": "AAPL transfers over 1000", "kind": "large_transfer" },
  "queuedAt": "2026-09-04T17:59:58.000Z",
  "attempt": 1,
  "sentAt": "2026-09-04T18:00:00.000Z"
}
```

`kind` is the payload's own kind — `large_transfer`, `wallet_activity`, `authority`
(a registry or token event) — or `ping` for a test, whose `watcher` is `null`.
`payload` is the same object `GET /watchers/{id}/runs` returns.

`queuedAt` is when Fletch matched the event (UTC, ISO 8601); `sentAt` is when this
attempt was posted — on a retry they differ, by hours if the endpoint was down.
`attempt` is 1 on the first try. The same `id` can arrive more than once: treat it as
an idempotency key.

Answer with any 2xx and the delivery is marked sent. Anything else, or no answer
within 10 seconds, is retried with the same full-jitter backoff Telegram delivery
uses, up to 8 attempts, and the endpoint's `lastError` records the reason with
`lastErrorAt` saying when — it is the most recent failure whenever it happened, and
the next success clears both. `lastDeliveredAt` is the last 2xx of any kind, test
pings included, so it is not on its own proof that alerts are flowing.

A reorg cancels alerts still queued — those rows become `retracted` and never leave.
One already delivered is not retracted: Fletch sends no follow-up. If a reorg matters
to you, re-read `GET /watchers/{id}/runs` (or the block in the payload) before acting
irreversibly.

### Verifying the signature

`X-Fletch-Signature` is `t=<unix seconds>,v1=<hex>`, where the hex is
HMAC-SHA256 over the exact string `"<t>.<raw request body>"` keyed with your
secret. Sign the raw bytes, not a re-serialized object. Reject a timestamp more
than a few minutes old, and compare in constant time.

Verifiers in TypeScript, Python and Go, with shared test vectors, are in `webhooks/`
in this repository.

Deliveries are not ordered and can repeat if your endpoint answers slowly: treat
`id` as the idempotency key.

## Trust on asset responses

Every asset carries a derived `trust` object alongside the stored row:

```json
"trust": { "level": "confirmed", "label": "confirmed on chain", "detail": "The contract answers with the symbol and decimals Robinhood published." }
```

`level` is one of `confirmed` (listed, bytecode found, contract agrees), `code-only`
(bytecode found, contract not yet read), `listed` (address published, no bytecode seen),
or `mismatch` (the contract answers a different symbol or decimals; `detail` says which).
The fields it derives from are on the row: `verifiedAt`, `metadataCheckedAt`,
`onchainSymbol`, `onchainDecimals`, and `firstSeenAt`, the moment Fletch first saw the
token. `GET /registry/feed.xml` is the RSS of new listings and `GET /llms.txt` the plain-text
summary for agents; neither needs a key. `GET /registry/changes.xml` is the changelog as Atom.

## Registry authority (public)

Registry reads need no key: anonymous callers get 120 requests a minute per address;
a key or a session uses its own budget.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/chains/4663/assets` | every asset with `trust` and `state` (multiplier, pending multiplier, pauses, supply, canonical, feed, quote, divergence) |
| `GET /api/v1/chains/4663/assets/{symbol}` | one asset with `state`, `multiplierHistory`, `supplyEvents`, `supplySnapshots`, `corporateActions`, `controlEvents` |
| `GET /api/v1/chains/4663/control-plane?limit=50` | the issuer's registry contract: `paused`, `implementation`, `blockedAddresses`, and its latest events |
| `GET /api/v1/chains/4663/health` | head block, block time, base fee, L1 block, batch count, delayed messages, batch-poster balance, status page |
| `GET /api/v1/chains/4663/corporate-actions` | actions in progress, each tied to its token |
| `GET /api/v1/chains/4663/events?kind=&symbol=&since=&limit=` | the changelog: every authority event, newest first; with `since`/`cursor` only newer rows oldest first, plus `nextCursor` |
| `GET /api/v1/chains/4663/assets?symbols=TSLA,AAPL&fields=lookalikes,corporateActions,multiplierHistory,feedRounds,concentration` | bulk: exact tickers, with the per-asset blocks attached (up to 50 assets when `fields` is set). `concentration` attaches each asset's latest reading, so "which Stock Tokens have the least float" is one request |
| `GET /api/v1/chains/4663/assets/{symbol}/feed/rounds?since=&limit=` | the Chainlink feed's round history for one asset, newest first, up to 2000 |
| `GET /api/v1/chains/4663/assets/{symbol}/history?from=&to=&days=&at=&fields=` | one row per UTC day of every per-asset number the registry publishes: multiplier, pause and halt flags, feed price and staleness, bid and ask, divergence, DEX price, premium and liquidity, supply, Blockscout holders, ledger holders and lookalike count. Default the last 90 days; `at=YYYY-MM-DD` returns that one day; `fields` narrows each row (an unknown key is a 400, as is a malformed `from`, `to` or `days`). `coverage` says how many days are on record and the first of them — there is nothing before the day the daily snapshot began. Each row is one reading taken at `takenAt`, the last of that day, not an open, close or average; the current day's row is rewritten each hour. A null is a figure that was not read that day, never a zero, and `stateCheckedAt`/`feedCheckedAt`/`apiCheckedAt`/`dexCheckedAt`/`blockscoutCheckedAt` say when each group of figures was last read. Rows are flat versions of the live `state` block: `feedPrice`/`feedStale` are `state.feed.price`/`.stale`, `bid`/`ask`/`tradingHalt` are `state.quote.bid`/`.ask`/`.tradingHalt`, `dexPriceUsd`/`dexPremiumPct`/`dexLiquidity` are `state.dex.priceUsd`/`.premiumPct`/`.liquidity`, `blockscoutHolders` is `state.secondSource.holders`, `multiplier` is `state.multiplier` |
| `GET /api/v1/chains/4663/assets/{symbol}/holders?limit=` | holders largest first with share of supply, holder count, the latest concentration reading, and ledger progress. `sits` is always one of `float`, `pools`, `issuer`, `bridge`, `contracts`, `unknown` and names the concentration share the address's balance counts towards; `unknown` means the code probe has not checked this address yet. `label` and `labelKind` (`pool_manager`, `dex_pool`, `issuer`, `bridge_gateway`, `locker`, `contract`, `exchange`, `eoa`) are null for an address the registry has nothing to say about. `rawBalance` is in base units; divide by 10^`decimals`. `sharePct` is that balance over `totalSupplyRaw`, read live, while the concentration shares are over the sum of every positive balance the ledger held at `concentration.asOfBlock`, so the two can differ slightly while the ledger trails the chain. `concentration` carries top 1, top 10, Gini and the six shares that say where the supply sits — `floatPct` (ordinary wallets), `poolsPct`, `issuerPct`, `bridgePct`, `contractsPct`, `unknownPct` — which add to 100. `unknownPct` is the share held by addresses the code probe has not checked: it checks every holder above a ten-thousandth of a token's supply, so a tail of small holdings stays there permanently and `floatPct` is always a floor. `issuerPct` is the share of every wallet labelled `issuer`, written only for Stock Tokens, whose mints are the issuer creating inventory; `issuerAddress` is this asset's largest mint recipient whatever the asset type. `concentration.day` is the UTC day of the reading, `takenAt` when the job wrote it, `asOfBlock` the ledger block it was computed at, and `concentration.holders` the address count at that moment, while the top-level `holderCount` is read live and can differ. The job runs every 24 h, and `concentration` is null until the transfer ledger reaches the chain head, because the daily job that writes it does not run before then |
| `GET /api/v1/chains/4663/assets/{symbol}/activity?days=` | one row per UTC day: transfers, volume, mints, burns, transfers settled against USDG in the same transaction, transfers outside US market hours |
| `GET /api/v1/chains/4663/assets/{symbol}/pools` | pools trading the asset on every DEX the registry reads, deepest first by `depthUsd`: `venue` (`uniswap_v4` or `uniswap_v3`), price in quote and USD, depth, liquidity, fee, hooks, swaps and volume. `depthUsd` is how many dollars of the quote token it takes to move the pool's price by 1%: a ceiling, since a move that leaves the position's range runs out of liquidity first, and not the pool's token balance. `liquidity` is the pool's in-range Uniswap liquidity L in raw units, not a dollar figure, and is comparable only between pools of the same pair (its scale follows the two tokens' decimals) — `depthUsd`, `volumeUsd24h` and `priceUsd` are the dollar figures. `swaps24h` and `volumeUsd24h` cover the current UTC day and the one before it and are null for a pool discovered inside that window, whose earlier swaps the scan never read. A v4 pool is an id inside the one PoolManager and its `poolAddress` is null; a v3 pool is a contract and carries its address. A pool is recorded when one side is this asset and the other is a listed quote (USDG, WETH or another Stock Token). `best` names the pool behind `state.dex` — the deepest pool in dollars of any venue — with its venue and depth. `discovery` gives each venue's scan position: while `readingHistory` is true, a pool created in blocks the scan has not reached is not listed yet, and while `scanned` is false the venue has not been read at all |
| `GET /api/v1/chains/4663/dex` | what each DEX venue contributes chain-wide, one row per venue read whether or not it has a pool yet, so `venues` and `discovery` name the same set: pools trading a listed asset, how many carry a dollar price, `depthUsd` (the dollars it takes to move each priced pool's price 1%, added up), swaps and volume, and `assetsPricedHere`, the assets whose deepest pool in dollars sits on that venue. `swaps24h` and `volumeUsd24h` cover the current UTC day and the one before it — swaps are tallied per UTC day, so the window is between 24 and 48 hours, not a rolling day — and a swap near midnight is attributed from the last block of the scan window that held it, so it can land on the neighbouring day. `checkedAt` is when the state read last priced a pool on that venue, `headAt` inside `discovery` when the chain head there was read. `discovery` carries each venue's scan position against that head; while `readingHistory` is true the counts are a floor, and while `scanned` is false the venue has not been read at all. The Pons launchpad creates its pools on the Uniswap v3 factory, so they are counted as `uniswap_v3` |
| `GET /api/v1/chains/4663/bridge?symbol=&limit=` | the token bridge: each bridged asset's L1 escrow against L2 supply (`inFlightRaw` is the gap), recent deposits and withdrawals seen on L2, and withdrawals past their seven-day window |
| `GET /api/v1/chains/4663/status` (alias `GET /api/v1/status`) | whether the registry is live: daemon heartbeat, every job against its cadence with a verdict, the scanners still reading history with blocks-per-hour and hours left, and the age of every published figure. Always 200; the verdict is in the body |
| `GET /api/v1/chains/4663/issuer?kind=` | the issuer's paperwork: every PDF the legal hub lists with ETag, Last-Modified and the token it maps to; the watched pages and when their text changed |
| `GET /api/v1/chains/4663/lookalikes?symbol=` | every ERC-20 borrowing a listed ticker or exact name at another address: holders, `kind` (`impostor` when it copies the listed name or calls itself Robinhood, `same_ticker` when it only shares the ticker, `unlisted_stock` when its beacon is the issuer's registry, or `unverified` for a second contract on a bridged coin's ticker, since the Arbitrum gateway is one bridge among several), `exactName`, `beacon` |
| `GET /api/v1/chains/4663/events/stream` | the changelog as Server-Sent Events; `Last-Event-ID` or `?since=` resumes without gaps |

`health.finality` carries the latest assertion Ethereum has confirmed and its age in
seconds (about the confirm period, 6.4 days, when the rollup is healthy: that is the
distance between the sequencer's word and Ethereum's); `health.arbosVersion` and `health.chainOwners` say what runs the chain and who
may change it.

`state.dex` on every asset is the deepest pool in dollars of any venue read (Uniswap v4 or v3): `venue`,
`priceUsd`, `depthUsd`, `liquidity` and `premiumPct` against the Chainlink feed (which already includes
the multiplier). `depthUsd` is how many dollars of the quote token move that pool's price by 1% and is what
the deepest pool is chosen by — a ceiling, and not the pool's token balance; `liquidity` is Uniswap's raw
in-range L, which compares two pools only when they hold the same pair. `poolId` is a 32-byte pool id when that pool is on Uniswap v4 and a 20-byte pool
address when it is on Uniswap v3; `/assets/{symbol}/pools` names the venue of every pool, that one included.

`state.secondSource` on every asset is what Blockscout's indexer counts for the same
contract (holders, transfers, total supply) and `supplyAgreement` says whether that
supply agrees with the contract's own answer: `agree`, `close` (within 0.1%, timing),
`differ` or `unknown`. An asset response also carries `lookalikes`.

Assets carry `assetType` of `stock_token`, `stablecoin`, `wrapped_native` or `bridged`.
A bridged row is listed only after proof: its address is what the L2 GatewayRouter
computes for the L1 token, and code was found there.

Watchers (`POST /api/v1/watchers`) accept `kind` of `large_transfer`, `wallet_activity`,
`token_event` (needs `assetId`; every authority event about that token) or
`registry_event` (no `assetId`; registry pauses, upgrades, blocks, listings, chain
status). The event kinds need no `threshold`.

Every registry GET answers with an `ETag` and a `Cache-Control` that follows the job that
writes the data (10 s for the control plane and events, 60 s for assets, an hour for
corporate actions). Send `If-None-Match` and an unchanged answer is a 304 with no body.

Raw amounts (`totalSupplyRaw`, `valueRaw`, `*Wei`) are strings, exact as on chain.
Prices and multipliers are numbers. Timestamps are ISO 8601. Fields are added, never
renamed.

