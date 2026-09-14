// The usage example from README.md, compiled by `npm run typecheck` (through
// tsconfig.test.json) so the snippet cannot drift from the client's types. The
// README imports from "fletch-sdk"; here the same names come from the source.
// Nothing runs this file.

import { FletchClient } from "../src/index.ts";

export async function readmeExample(): Promise<void> {
  const fletch = new FletchClient();

  const apps = await fletch.publishedApps({ q: "counter", page: 1 });
  for (const listed of apps.apps) {
    const app = await fletch.publishedApp(listed.slug);
    console.log(app.title, app.liveUrl, app.token?.checkedAt);
  }

  const status = await fletch.status();
  console.log(status.verdict, status.summary);

  const catalog = await fletch.appCatalog(4663, { q: "FRONG", limit: 10 });
  console.log(catalog.items[0]?.status, catalog.source, catalog.ageSeconds, catalog.stale);
  const markets = await fletch.tokenMarkets(4663, { q: "FRONG" });
  console.log(markets.items?.[0]?.robinhoodApp?.status, markets.catalogMatches);

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

  const holders = await fletch.get("/chains/{chainId}/assets/{symbol}/holders", { path: { chainId: 4663, symbol: "TSLA" }, query: { limit: 25 } });
  console.log(holders.body, holders.etag, holders.fromCache);
}
