# Stock and community pools

Read every discovered pool for NVDA:

```sh
curl -fsS 'https://fletch.now/api/v1/chains/4663/stock-pairings?address=0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec&limit=50&offset=0'
```

`address` optionally matches the stock contract, its canonical stock address or
the community counterparty. `limit` is 1–100 (default 50). Follow `nextOffset` as
`offset` until null. Each page carries `total` and a `summary` of the full filter,
including pool count, distinct counterparties, pending metadata, observed swaps,
ranking and `asOf`. Pages read current observations; new pools or swaps can move
rows between requests. Deduplicate using stable `id` when collecting several pages.

```ts
import { FletchClient } from "fletch-sdk";

const client = new FletchClient();
const address = "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec";
let offset: number | null = 0;
const seen = new Set<string>();
while (offset !== null) {
  const page = await client.stockPairings(4663, { address, limit: 50, offset });
  for (const pair of page.items) {
    if (seen.has(pair.id)) continue;
    seen.add(pair.id);
    console.log(pair.poolId, pair.communityAddress, pair.communitySymbol, pair.metadataStatus);
  }
  offset = page.nextOffset;
}
```

The token/Markets response includes at most three grouped examples in
`stockPairings` and complete filtered counts in `stockPairingSummary`. A missing
symbol remains null and includes `metadataStatus`, age and error. A pool without
an observed swap is discovered inventory, not proof of current trading. Ranking
uses the latest recorded swap, resolved metadata, creation block and pool ID.
Pool discovery and metadata observations have their own times; `asOf` does not
freshen them. A canonical stock side verifies that contract's identity, not the
community token or the pool's value.
