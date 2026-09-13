# App catalog, markets and listing events


```sh
curl -fsS 'https://fletch.now/api/v1/chains/4663/app-catalog?q=FRONG'
curl -fsS 'https://fletch.now/api/v1/chains/4663/markets?q=FRONG'
curl -fsS 'https://fletch.now/api/v1/chains/4663/events?kind=listing.&limit=10'
```

The source scope is `crypto_currency_pairs`. It covers the public Robinhood crypto
currency-pairs catalog; it cannot establish whether a Stock Token appears elsewhere
in Robinhood. Stock Tokens return `robinhoodApp.status: "not_covered"` with a reason.
The legacy `not_in_app` value means absent from this crypto source only. Inspect
`stockToken` separately for Stock Token list membership, verified address and its
own source/observation time. NVDA can be a verified Stock Token while this crypto
source does not cover it.

The separate Stock Token list sync targets 15 minutes; `stockToken.observedAt`
dates that source observation. The `canonical` job checks listed tokens’ beacon
dependencies and code on a six-hour cadence. That contract check is separate from
list membership, crypto availability and token price freshness; keep
`observedAt`, `verifiedAt` and per-metric timestamps distinct.

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

Markets returns `robinhoodApp`, `stockToken`, `stockPairingSummary`, `stockPairings`
and `catalogMatches`. A shared ticker does not verify a contract. Each pairing
records its stock side as `canonical`, `lookalike` or `unconfirmed`; economic
dominance remains separate. The token response contains at most three grouped
pairing examples. Follow the [pairing endpoint](STOCK-PAIRINGS.md) for every pool.

Use `/api/v1/chains/4663/events/stream` for SSE. The stream carries all event kinds;
listen for `listing.added`, `listing.changed` and `listing.removed`. Retain each
processed cursor for reconnects. `listing.observed` is the initial baseline and
does not trigger alerts. Account watchers use `kind: "listing_event"` with an
owned webhook endpoint or a connected Telegram account. Respect `Retry-After`
on HTTP 429 and preserve null values and unavailable reasons.
