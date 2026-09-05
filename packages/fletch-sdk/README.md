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
