# fletch-sdk

A TypeScript client for the Fletch v1 API: the Robinhood Chain Stock Token registry,
its changelog and the status verdict. Response types are generated from the OpenAPI
snapshot in `../../spec/openapi.json` with openapi-typescript; the client itself is a
thin fetch wrapper that builds URLs, sends a key when you have one, and keeps an ETag
cache so a poll that sees a 304 costs no bytes.

Node 22.18 or later (the tests run the `.ts` sources directly).

The package is not on npm yet. Until it is, build it from this repository and import
the result:

```bash
npm ci && npm run build --workspace fletch-sdk
# packages/fletch-sdk/dist/index.js, with its .d.ts beside it
```

```ts
import { FletchClient } from "fletch-sdk";

const fletch = new FletchClient();

const status = await fletch.status();
console.log(status.verdict, status.summary);

const { asset, state } = await fletch.asset("AAPL");
console.log(asset?.address, state?.multiplier);

// The changelog: newest first, with a cursor to resume from.
const page = await fletch.events(4663, { kind: "multiplier.", limit: 20 });
let cursor: string = page.nextCursor ?? new Date().toISOString();

// Later: everything since, oldest first, page by page.
for await (const event of fletch.eventsAfter(cursor)) {
  console.log(event.kind, event.title);
}

// Or as a stream. The server closes it after half an hour; reconnect with the last id.
for await (const frame of fletch.streamEvents(4663, { since: cursor })) {
  cursor = frame.id;
  console.log(frame.event, frame.data.title);
}
```

`asset` and `nextCursor` are optional in the current snapshot of the spec, which is
why the example narrows them. The same code is compiled by `npm run typecheck` from
`examples/readme.ts`, so it stays in step with the generated types.

Every read is `get(path, { path, query })`, typed by the spec:

```ts
const holders = await fletch.get("/chains/{chainId}/assets/{symbol}/holders", { path: { chainId: 4663, symbol: "TSLA" }, query: { limit: 25 } });
holders.body;      // typed from the spec
holders.etag;      // W/"…"
holders.fromCache; // true when the server answered 304
```

Registry reads need no key. Watchers and webhooks need an `flk_` key with the right
scope; pass it as `apiKey` and it is sent as a bearer token, over https only. Anything
but a 200 or 304 throws `FletchError` with `status`, the server's `error` string and, on
a 429, `retryAfterSeconds`.

`eventsAfter` asks for 200 rows a page by default and never more than 500, the most
the server returns for one request.

`status()` returns the hand-kept `Freshness` type from `src/freshness.ts` because the
served spec types that route as a bare object; the other reads use the generated types
unchanged. `npm run generate` rewrites `src/generated/openapi.ts` from the snapshot, and
`npm run build` compiles it into `dist/` together with the client, so the published
declarations resolve without the source tree.

Fletch is not affiliated with Robinhood Markets, Inc.

## Credential and error handling

Registry reads need no key. If configured, an API key is attached to this client's
API reads over HTTPS; use only a trusted base URL. JSON and SSE reads reject all
redirects, including same-origin redirects. Returned JSON and event data redact an
exact echo of the configured key. HTTP errors retain their status, numeric
Retry-After and safe guidance; `FletchError.body` contains that guidance, never the
upstream response body. Network and malformed-response errors omit upstream text.
Caller cancellation keeps the `AbortError` name without exposing a custom reason.

## Token markets

`client.marketFilters()` reads the public catalog shared with the Markets page.
`client.tokenMarkets(4663, { kind: "community", activity: "traded", sort: "volume", page: 1, pageSize: 25 })`
returns one token page. Query types come from OpenAPI; filters combine with AND.
Preserve each metric's source, observation time and unavailable reason. Numeric
sorts put missing readings last. V3 quote holdings and V4 1% depth are separate.

## Reading current metric evidence

Start with one address or one bounded page. A response's fetch time does not
refresh its inputs, and an economic selection does not verify issuer origin.
The generated `MetricObservation`, `MetricInput`, `MarketSelection` and
`TokenMarket` exports retain the API's structured evidence without recomputing
values. Status jobs expose nullable `metricCoverage`; `current` and `failed`
counts may overlap when a failed refresh retains an older usable observation.

```ts
const page = await fletch.tokenMarkets(4663, { q: "TSLA", pageSize: 25 });
for (const token of page.items) {
  const metric = token.marketCapUsd;
  const { expiresAt, status, readStatus, inputs } = metric.observation;
  const current = status === "current" && expiresAt !== null
    && Date.now() <= Date.parse(expiresAt);
  console.log(token.address, current ? metric.value : null, readStatus, inputs);
}
```

Inspect source time, fetch time, block/hash, computation method and coverage.
Market cap expires with its earliest required supply, burn, decimals or price
input. An expired value stays unavailable; a zero stays zero. See the repository's
[metric freshness contract](../../docs/FRESHNESS.md).

## App catalog

```ts
const catalog = await fletch.appCatalog(4663, { q: "FRONG", limit: 10 });
console.log(catalog.items[0]?.status, catalog.source, catalog.ageSeconds, catalog.stale);
const markets = await fletch.tokenMarkets(4663, { q: "FRONG" });
console.log(markets.items?.[0]?.robinhoodApp?.status, markets.catalogMatches);
```

Use `catalog.nextOffset` for the next page. Each pair retains per-account trading
availability. Catalog status is separate from on-chain trust. The SDK exports
`AppCatalogPage`, `AppCatalogStatus` and `StockPairing` from the live schema snapshot.
Read [the catalog guide](../../docs/APP-CATALOG.md) for SSE and watcher delivery.

### Stock and community pools

`client.stockPairings(4663, { address, limit: 50, offset: 0 })` returns a typed
`StockPairingPage`. Follow `nextOffset` until null; token responses include only
three grouped examples. See [pagination and source semantics](../../docs/STOCK-PAIRINGS.md).
`robinhoodApp.scope` is `crypto_currency_pairs`: `not_covered` applies to Stock
Tokens, while legacy `not_in_app` means absent from this crypto source only.
Inspect `stockToken` for separate list membership and its own verification time.
`client.status()` exposes measured `lookalikes` and `scouting` coverage.


## Sorting and bounded reads

Markets accepts `sort=price|volume|market_cap|pools` and `order=asc|desc`, alongside
its existing sorts. Sorting covers every matching token before pagination;
unavailable numeric values remain last in either direction and equal values use
contract address ascending. Numeric sorts default descending; `sort=name`
defaults ascending when `order` is omitted.

```ts
await client.tokenMarkets(4663, { sort: "price", order: "asc", page: 1, pageSize: 25 });
await client.assets(4663, { type: "stock_token", verified: "1", sort: "price", order: "desc", limit: 25, offset: 0 });
```

Asset reads support `type`, `verified`, `state`, `sort` and `order`. Supplying
`limit` (1–50) or `offset` enables pagination with `total` and `nextOffset`; omit
both to preserve the complete collection. Follow `nextOffset` until null.

Markets shares raw observations for at most ten seconds across nearby requests.
Each response recomputes metric expiry, source ages, filters and ordering. Pairing
summary `asOf` retains its actual measurement time; neither navigation nor sorting
refreshes the source data. Requests that fail are not retained in this cache.
