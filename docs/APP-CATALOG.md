# App catalog, markets and listing events


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

Catalog observation targets 15 seconds. Pool discovery and catalog contract
scouting run each minute in bounded batches. Each value carries its own
observation age and coverage.
`/api/v1/status` exposes pending searches, contract checks and metadata backlogs.

Markets returns `robinhoodApp`, `stockPairings` and `catalogMatches`. A shared
ticker does not verify a contract. Each pairing records its stock side as
`canonical`, `lookalike` or `unconfirmed`; economic dominance remains separate.

Use `/api/v1/chains/4663/events/stream` for SSE. The stream carries all event kinds;
listen for `listing.added`, `listing.changed` and `listing.removed`. Retain each
processed cursor for reconnects. `listing.observed` is the initial baseline and
does not trigger alerts. Account watchers use `kind: "listing_event"` with an
owned webhook endpoint or a connected Telegram account. Respect `Retry-After`
on HTTP 429 and preserve null values and unavailable reasons.

