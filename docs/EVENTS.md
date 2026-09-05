# The changelog

Every change the registry daemon notices becomes one authority event: a row with a
stable id, a dotted `kind`, a one-line `title`, and the numbers behind it in `detail`.
The same rows are served three ways, and a `registry_event` or `token_event` watcher
delivers them to Telegram or a signed webhook.

| Surface | URL | Shape |
|---|---|---|
| JSON | `GET /api/v1/chains/4663/events` | a page, with a cursor |
| Server-Sent Events | `GET /api/v1/chains/4663/events/stream` | one frame per event |
| Atom | `GET /registry/changes.xml` | the 100 newest, one entry each |

Kinds are added to but never renamed: they are part of the API and of every
subscriber's filter. The JSON response's `kinds` array is the list the running daemon
can emit; the table below is that list on 2026-09-05, 36 kinds.

## One event

```json
{
  "id": "ev_9f3256ce83b6dd98fedbe4ec",
  "kind": "dex.pool_new",
  "title": "New Uniswap v4 pool for MU against USDG, fee 0.99%",
  "symbol": "MU",
  "address": "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  "detail": { "fee": 9900, "hooks": "0x0000000000000000000000000000000000000000", "quote": "USDG", "venue": "uniswap_v4", "poolId": "0x8461…" },
  "block": "55096368",
  "txHash": null,
  "occurredAt": "2026-09-05T11:50:43.475Z",
  "observedAt": "2026-09-05T11:50:43.476Z"
}
```

| Field | Meaning |
|---|---|
| `id` | `ev_` and 24 hex characters: the first 24 of SHA-256 over `chainId\|kind\|subject\|moment`, where the subject is the asset id, else the address, else `chain`, and the moment is the event's own key when the job gives one, else the transaction hash, else `occurredAt`. A job that runs twice over the same block writes the row once. |
| `kind` | One of the kinds below. |
| `title` | The change as a changelog line, built from `detail`. |
| `symbol`, `address` | The token or account concerned; null for a chain-wide event that has none. |
| `detail` | The figures the title was built from, and sometimes more; fields depend on the kind. Null when there are none. |
| `block` | Block number as a decimal string; null when the source is not a block (a feed read, the issuer's site). |
| `txHash` | Null for the same reason. |
| `occurredAt` | When the change happened at its source. |
| `observedAt` | When the daemon recorded it. Ordering and the cursor use this. |

## Kinds

Labels are the plain-English names the site shows for each kind; the raw kind is what
the API and the filters use. "Chain-wide" kinds are the ones a `registry_event` watcher
receives; a `token_event` watcher receives every kind about its one token, whatever the
kind. The detail column lists the fields the title reads; the row can carry others.

| Kind | Label | Chain-wide | Written when | Detail fields the title reads |
|---|---|---|---|---|
| `registry.paused` | All trading paused | yes | the issuer's AccessControlsRegistry pauses every Stock Token | |
| `registry.unpaused` | Trading resumed | yes | that pause is lifted | |
| `registry.upgraded` | Registry upgraded | yes | the Stock Token implementation behind the registry's beacon changes | `implementation` |
| `registry.blocked` | Address blocked | yes | an address is added to the registry's blocklist | `account` |
| `registry.unblocked` | Address unblocked | yes | an address is removed from it | `account` |
| `registry.role` | Issuer role changed | yes | a role is granted or revoked on the registry | `event`, `account` |
| `token.paused` | Token paused | | the issuer pauses one token | |
| `token.unpaused` | Token unpaused | | that token is unpaused | |
| `oracle.paused` | Price oracle paused | | the token's price oracle is paused | |
| `oracle.unpaused` | Price oracle resumed | | it resumes | |
| `token.halted` | Trading halted | | Robinhood's own quote reports a trading halt for the token | |
| `token.resumed` | Trading resumed | | the halt clears | |
| `multiplier.scheduled` | Stock split scheduled | | a pending multiplier is set with an effective time | `from`, `to`, `effectiveAt` |
| `multiplier.applied` | Stock split applied | | the token's multiplier changes | `from`, `to` |
| `feed.stale` | Price feed stale | | the Chainlink feed is past its heartbeat | |
| `feed.fresh` | Price feed fresh again | | the feed updates again | |
| `supply.residual` | Supply audit residual | | total supply differs from mints minus burns | `residual` |
| `supply.reconciled` | Supply audit matched | | it reconciles again | |
| `token.noncanonical` | Verification failed | | the token's proxy no longer points at the registry beacon | |
| `token.canonical` | Verification restored | | it points there again | |
| `listing.new` | New listing | yes | a new asset appears in the registry | `assetType` |
| `lookalike.found` | Fake asset flagged | yes | an ERC-20 borrowing a listed ticker or name is found at another address; `address` is the lookalike's | `name`, `holders`, `exactName` |
| `dex.pool_new` | New trading pool | | a Uniswap v4 or v3 pool trading the token appears | `venue`, `quote`, `fee` |
| `dex.premium` | Exchange price difference | | the deepest pool's price departs from the feed | `premiumPct` |
| `bridge.deposit` | Bridge deposit | | a bridged asset arrives from Ethereum | `amountRaw`, `decimals`, `to` |
| `bridge.withdrawal` | Bridge withdrawal | | a withdrawal to Ethereum starts | `amountRaw`, `decimals`, `from`, `claimableAt` |
| `issuer.document_new` | Issuer document published | yes | a PDF appears on the issuer's legal hub | `kind`, `title` |
| `issuer.document_changed` | Issuer document revised | yes | a listed PDF's ETag or Last-Modified changes | `kind`, `title` |
| `issuer.document_gone` | Issuer document removed | yes | a listed PDF disappears | `kind`, `title` |
| `issuer.page_changed` | Issuer page changed | yes | a watched page's text changes | `page` |
| `chain.notice_changed` | Chain notice changed | yes | the chain's notices and upgrades page changes | |
| `chain.upgrade` | Chain upgrade | yes | the ArbOS version changes | `from`, `to` |
| `chain.owners_changed` | Chain owners changed | yes | the set of chain owners changes | `count` |
| `corporate.action` | Corporate action | | a corporate action is recorded for the token | `actionType`, `effectiveDate` |
| `chain.degraded` | Chain degraded | yes | the chain's status page reports anything but operational | `status` |
| `chain.operational` | Chain operational | yes | it reports operational again | |

Two kinds share the label "Trading resumed": `registry.unpaused` for the whole registry
and `token.resumed` for one token's halt.

## JSON: pages and the cursor

`GET /api/v1/chains/4663/events` has two modes.

Without `since` or `cursor` it answers newest first, with:

- `events`: up to `limit` rows (default 100, at most 500);
- `kinds`: every kind the daemon can emit;
- `nextCursor`: the cursor of the newest row, or the current instant when there are none.

`kind` filters here, exactly (`feed.stale`) or by prefix (`registry.`, `multiplier.`);
`symbol` narrows to one token. This answer carries an `ETag` and a ten-second
`Cache-Control`; poll it with `If-None-Match` and an unchanged page is a 304.

With `since` or `cursor` (the same parameter; `since` wins if both are sent) it answers
only rows after that position, oldest first, with `nextCursor` set to the last row's
cursor, or to the position you sent when nothing is newer. Rows are ordered by
`(observedAt, id)`, so a consumer that keeps passing `nextCursor` back reads every event
once and misses none, however many share an instant. `kind` and `symbol` are not
applied in this mode: filter on the client. This answer has no `ETag`.

The cursor is `observedAt|id`, for example
`2026-09-05T11:50:43.476Z|ev_9f3256ce83b6dd98fedbe4ec`. Pass it back verbatim. A bare
ISO instant is also accepted and means "everything observed after this instant".

```bash
# Take a position.
CURSOR=$(curl -s "https://fletch.now/api/v1/chains/4663/events?limit=1" | jq -r .nextCursor)

# Later: everything since.
curl -s "https://fletch.now/api/v1/chains/4663/events?cursor=$CURSOR&limit=500" | jq '.events[] | [.kind, .title]'
```

## Server-Sent Events

`GET /api/v1/chains/4663/events/stream` is the same rows as `text/event-stream`. The
server polls the table every two seconds. Each frame is:

```
id: 2026-09-05T11:10:24.254Z|ev_b675a8c6a19e7b21aa31574a
event: lookalike.found
data: {"id":"ev_b675a8c6a19e7b21aa31574a","kind":"lookalike.found",…}
```

- `id` is the event's cursor, `event` its kind, `data` the JSON event on one line.
- The stream opens with a comment line and sends `: keepalive` every twenty seconds.
- Without `since` or `Last-Event-ID` it starts at now and sends no backlog.
- The server closes every stream after thirty minutes. Reconnect with the last `id` as
  `Last-Event-ID` (what `EventSource` does on its own) or as `?since=`, and nothing is
  missed.
- Five open streams per address, 200 in total; past that the answer is a 429 with a
  message suggesting the cursor endpoint.

There is no kind or symbol filter on the stream; read `event` and drop what you do not
want.

```bash
curl -N "https://fletch.now/api/v1/chains/4663/events/stream?since=$CURSOR"
```

## Atom

`GET /registry/changes.xml` is the 100 newest events as an Atom feed, with the same
`kind` and `symbol` query filters as the newest-first JSON read. Entries map as:

| Atom | From |
|---|---|
| `<id>` | `urn:fletch:event:` and the event `id` |
| `<title>` | `title` |
| `<link href>` | `https://fletch.now/registry/{symbol}` when the event has a symbol, else `https://fletch.now/registry/changes` |
| `<updated>` | `observedAt` |
| `<published>` | `occurredAt` |
| `<category term>` | `kind` |
| `<summary>` | `kind`, then `tx {txHash}` and `block {block}` when present |

The feed's own `<updated>` is the newest event's `observedAt`. It is cached for sixty
seconds.

`GET /registry/feed.xml` is a different feed: RSS 2.0 of new listings, one item per
token Fletch first saw, dated by `firstSeenAt`.

## Watchers

A watcher of kind `registry_event` receives every chain-wide event above; one of kind
`token_event` receives every event whose asset is the one it was created with. Each
delivery's payload has `kind: "authority"` and carries `eventId`, `eventKind`, `title`,
`symbol`, `address`, `detail`, `txHash`, `blockNumber`, `occurredAt`, `explorerUrl` and
`registryUrl`. `docs/API.md` covers creating watchers and receiving webhooks;
`webhooks/` verifies the signature.
