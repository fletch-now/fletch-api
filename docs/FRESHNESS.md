# Reading /api/v1/status

`lookalikes` reports completed, pending and failed searches at its own `measuredAt`,
plus the last completed local collision sweep and unread/failed beacon checks.
A successful bounded worker pass can leave pending searches; persisted errors
remain visible. `scouting.measuredAt` dates worker-published catalog aggregates. Its
`receiptStatus` becomes stale after 120 seconds; no receipt means `scouting: null`.
Swap tier counts retain `catalogMeasuredAt` and `catalogStatus`; an unavailable
receipt produces an empty `tiers` array, not measured zero counts. Live-tail state
and selected-pool counts are read separately, and live-tail expiry is recomputed
when reused. The existing minute-level membership job publishes the durable
receipts, which survive web restarts. The `swaps` figure counts events in complete current
24-hour windows for selected canonical pools; its unit and description disclose
that scope. It is not the total historical event ledger.

`GET /api/v1/status` (alias `GET /api/v1/chains/4663/status`) says whether the registry
is live, in one read: the daemon's heartbeat, every job against the cadence it runs on,
the scanners still reading history, and the age of every published figure. It always
answers 200; the verdict is in the body, so a stale registry is a fact you read, not an
error you retry. Cached for ten seconds. The body carries `checkedAt`, so its `ETag`
changes on every fresh read.

Registry reads need no key. This route reports scheduler health and measured
coverage; each page metric also retains its own source time, expiry and read status.

## The body

```json
{
  "chainId": 4663,
  "checkedAt": "2026-09-05T11:59:44.120Z",
  "verdict": "degraded",
  "summary": "5 of 27 jobs are not current (failing: supply-events, canonical; late: control-plane, chain-health, bridge-flows).",
  "daemon": { "name": "registry-daemon", "alive": true, "lastBeatAt": "…", "ageSeconds": 4, "jobsReported": 27, "failing": ["supply-events", "canonical"] },
  "head": { "block": "55101176", "readAt": "…", "ageSeconds": 6 },
  "jobs": [ { "job": "control-plane", "cadenceSeconds": 10, "verdict": "late", "lastRunAt": "…", "lastOkAt": "…", "ageSeconds": 281, "rows": 0, "error": null, "running": true, "checkpoints": [ … ] } ],
  "figures": [ { "figure": "state", "what": "Multiplier, pending multiplier, pause flags and supply, read from each token's contract", "job": "token-state", "cadenceSeconds": 300, "verdict": "fresh", "newestAt": "…", "ageSeconds": 288, "count": 207, "unit": "tokens" } ],
  "verdicts": { "fresh": "the last run succeeded within twice the job's cadence", … }
}
```

`verdicts` is a dictionary of every verdict word to its meaning, sent with every answer
so a reader never has to guess. Ages are seconds; block numbers are decimal strings.

## The overall verdict

| `verdict` | Meaning |
|---|---|
| `live` | the daemon is beating and every job is fresh or filling |
| `degraded` | the daemon is beating but at least one job is late, failing, stalled, or has never completed |
| `stale` | the daemon has not beaten for a minute; every figure is as old as its last run |
| `never` | the daemon has not completed a run against this database |

Decided in this order: every job `never` gives `never`; no heartbeat within 60 seconds
(four missed beats at 15 seconds each) gives `stale`; any job `failing`, `late`,
`stalled` or `never` gives `degraded`; otherwise `live`. `summary` names the jobs behind
a `degraded`, or the scanners still filling behind a `live`.

## Job verdicts

Each entry in `jobs` is one daemon job judged against its own cadence.

| `verdict` | Meaning |
|---|---|
| `fresh` | the last run succeeded within twice the job's cadence |
| `late` | the last successful run is older than twice the cadence |
| `failing` | the last run ended in an error; the previous answer stands |
| `filling` | a first pass over history is in progress; the checkpoint trails head by more than 10,000 blocks |
| `stalled` | a scanner still reading history whose checkpoint has not moved in far longer than its cadence: the backfill is stuck, not slow |
| `never` | the job has not completed a run against this database |

Decided in this order:

1. No run recorded: `never`.
2. The last run ended in an error: `failing`, whatever else is true.
3. The job's checkpoint is more than 10,000 blocks behind head: `filling`, unless the
   checkpoint has not moved for longer than twice the cadence or 30 minutes, whichever
   is longer, in which case `stalled`. A scanner mid-history can run for hours without
   finishing a run, but every window it commits moves its checkpoint; a moving
   checkpoint is progress.
4. No successful run yet: `never`.
5. The last success is older than twice the cadence, with a floor of 60 seconds: `late`.
   A ten-second job whose run takes fifteen seconds is not late.
6. Otherwise `fresh`.

Fields on a job: `lastRunAt` and `lastOkAt` (the last run of any outcome, and the last
success), `ageSeconds` (since `lastOkAt`), `rows` (what the last run wrote), `error`
(the last run's message, null on success), `running` (a run is in progress now), and
`checkpoints` for the log scanners.

### Checkpoints

A scanner reads the chain's logs in windows and commits a checkpoint after each. Each
entry gives `name`, `block` (the checkpoint), `head` (the chain head when read),
`behind` (the difference), `updatedAt`, and two rates measured over recent samples:
`blocksPerHour` and `hoursLeft` until the scanner reaches head, both null when there
are not enough samples yet. Jobs with a checkpoint: `control-plane`, `supply-events`
(two rows, `supply-mint` and `supply-burn`), `multiplier-events`, `transfer-ledger`,
`dex-pools`, `dex-pools-v3`, `dex-swaps`, `stock-pair-history` and `bridge-flows`.
Names carry a `:4663` suffix
for the chain.

### Cadences

Nominal cadences in the 14 September 2026 candidate. Always use the response's current `cadenceSeconds`; jobs schedule their next run after completion, so a one-minute cadence plus 45 seconds of work is roughly 105 seconds between starts.

| Job | Every | Reads |
|---|---|---|
| `app-catalog` | 15 s | public crypto currency-pairs catalog |
| `explorer-scouting` | 1 min | bounded contract search pages and bytecode checks |
| `stock-pair-history` | 1 min | bounded historical stock/community pool discovery |
| `priority-universe` | 1 min | selected token/pool membership and measured catalog receipts |
| `priority-holders` | 1 min | bounded holder observations |
| `priority-supply` | 1 min | bounded supply and burn observations |
| `dex-token-discovery` | 1 min | bounded due contract metadata |
| `control-plane` | 20 s | the AccessControlsRegistry's events: pauses, blocklist, roles, upgrades |
| `authority-match` | 10 s | new authority events, fanned out to watchers |
| `chain-health` | 1 min | head block, block time, base fee, batches, status page |
| `feeds` | 1 min | every Chainlink feed's latest round and staleness |
| `supply-events` | 2 min | mints and burns |
| `transfer-ledger` | 1 min | every transfer, into per-holder balances |
| `dex-swaps` | 45 s | live swap tail |
| `dex-swap-backfill` | 1 min | bounded older swap windows |
| `market-refresh` | 15 s | selected-pool rolling metrics |
| `bridge-flows` | 2 min | deposits and withdrawals on the token bridge |
| `multiplier-events` | 5 min | multiplier changes and schedules |
| `token-state` | 5 min | each token's multiplier, pauses and supply, from its contract |
| `api-prices` | 5 min | Robinhood's own bid, ask and halt flag |
| `dex-tokens` | 1 min | bounded due metadata, preserving per-token read times |
| `dex-prices` | 1 min | selected-pool price samples |
| `dex-tiers` | 1 h | pool activity tiers |
| `new-pool-match` | 1 min | new-pool watcher matching |
| `dex-state` | 45 s | bounded selected-pool price, depth and liquidity reads |
| `dex-pools` | 1 min | bounded new Uniswap v4 pool windows |
| `dex-pools-v3` | 1 min | bounded new Uniswap v3 pool windows |
| `bridge-escrow` | 30 min | L1 escrow against L2 supply for bridged assets |
| `feed-history` | 30 min | Chainlink round history |
| `corporate-actions` | 1 h | corporate actions from the issuer's API |
| `holder-labels` | 1 h | which holders are pools, contracts, the issuer or the bridge |
| `issuer-pages` | 1 h | the issuer's watched pages |
| `second-source` | 1 h | The chain explorer's holders, transfers and supply per token |
| `state-daily` | 1 h | the current UTC day's row of every per-asset figure |
| `canonical` | 6 h | beacon dependency and code observations for listed Stock Tokens |
| `bridged` | 6 h | the GatewayRouter proof for bridged assets |
| `issuer-docs` | 6 h | the PDFs on the issuer's legal hub |
| `lookalikes` | 1 min | bounded ticker/name search pages, local collision slices and beacon checks; complete searches revisited after 6 h |
| `concentration` | 24 h | top-holder shares and float, from the ledger |
| `supply-snapshot` | 24 h | the daily supply reconciliation |

## Figure verdicts

`figures` turns the same judgement toward the numbers a reader sees: for each
published figure, which job writes it, the newest timestamp on a row carrying it,
how many rows (`count`, in `unit`), and a verdict. A figure's verdict is its job's,
with two additions:

| `verdict` | Meaning |
|---|---|
| `unread` | no row carries this figure yet |
| `late` | also given when the job is fresh, the figure is one every run rewrites, and its newest row is older than twice the cadence |

The second case catches a job that runs on time but writes nothing.

## Using it

- Read job verdicts for process health, then check the actual row timestamp and
  coverage for every number. `live` includes incomplete `filling` jobs.
- To judge one number, find its figure and read `ageSeconds` against `cadenceSeconds`
  rather than trusting the overall word.
- While a scanner is `filling`, figures that depend on it (holders, concentration,
  swaps) describe a partial ledger; `hoursLeft` is an estimate from observed scan rates, not a promised completion time.
- The verdict is not a rate: a `degraded` registry still answers every read, with each
  figure as old as its own job's last success.

## Pool state and metadata coverage

A pool's `stateCurrent` requires an actual state observation within three minutes,
with no future timestamp and a current independently observed quote conversion when recorded. Stale, unread or future state suppresses current price,
quote price, depth, raw liquidity/sqrt/tick and price-derived valuations/changes;
`pricePublished` is false. `stateCheckedAt` retains the original read time. Current
state alone does not guarantee a publishable price: quote support and depth also
matter. A missing field or null means unknown/unpublished, never zero.

`jobs[].metadataBacklog` is null until a successful batch reports its queue; otherwise
it contains `total`, `due`, `visibleDue`, `neverRead`, `errors`, `oldestCheckedAt` and
`measuredAt`. Its timestamp belongs to that measurement. A successful small batch
does not refresh the remaining rows or establish full discovery. New records can
make a backlog grow while work progresses. Trust and provenance remain separate
from activity, listing prominence and price availability.

On 8 September at 17:45:33 UTC, live status was 28 fresh jobs plus three filling
jobs. That observation is historical, not a current health assertion. Historical
transfer coverage and legacy two-UTC-day swap fields remain incomplete; never infer
exact rolling 24-hour activity or historical USD from a current pool price.

## Metric observations and coverage

Token Markets and a token's `reading` return `observation` alongside every
metric. The generated SDK exports `MetricObservation`, `MetricInput`,
`MarketSelection` and `TokenMarket` from that schema. `sourceId` identifies the
source; `blockNumber` and `blockHash` retain the pinned block when recorded.
`sourceAt` describes the upstream observation, while `fetchedAt` describes when
it was obtained. Unknown timestamps stay null; explorer snapshots may have a
fetch time without an upstream source time.

`expiresAt` is an inclusive freshness boundary. Compare it with the current
clock even when a cached response retains `status: current`. `status` describes
age/validity; `readStatus` independently reports `ok`, `partial`, `failed` or
`unread`. A retained current value may have a failed latest refresh. Preserve
that failure, the original source time, nulls and the stated coverage.

`method`, `parameters` and recursive `inputs` describe computations. Market cap
uses supply, burn balances, decimals and price and expires with its earliest
expiring required input. Volume retains its selected-pool scope and quote
valuation inputs; nominal USDG and historical oracle estimates have distinct
methods. Supply and burn observations expire after five minutes. A price time
cannot stand in for their reading time.

`selection` carries `selectedAt`, `expiresAt`, `status` and a versioned `policy`.
An expired selection withholds `dominantAddress`; economic comparison establishes
no issuer identity. A matching beacon records a dependency, and legacy
`unlisted_stock` lookalikes are returned as `unverified`.

Each Status job includes nullable `metricCoverage`, a metric-name map of
`eligible`, `current`, `failed`, `unread`, `oldestInputAgeSeconds` and `measuredAt`.
Current and failed counts may overlap after a failed refresh. Null coverage
means no measurement is recorded. Age the counts from `measuredAt`; successful
scheduling cannot refresh those observations. `swapIndexer` separately reports
indexed progress and complete/valued priority-pool coverage.

## Catalog and scouting

The separate Stock Token list sync targets 15 minutes; `stockToken.observedAt`
dates that source observation. The `canonical` job checks listed tokens’ beacon
dependencies and code on a six-hour cadence. That contract check is separate from
list membership, crypto availability and token price freshness; keep
`observedAt`, `verifiedAt` and per-metric timestamps distinct.

App catalog observation targets 15 seconds and becomes stale after 60 seconds.
Inspect `source`, `observedAt`, `ageSeconds`, `stale` and `error` on catalog reads.
`scouting.explorer` reports completed and due searches, discovered candidate
contracts, pending contract checks, last search time and provider response age.
These counts describe coverage at `measuredAt`; they do not verify token identity.
Contract searches retain page cursors and resume in minute-level passes. This is
a work cadence, not a promise to refresh every catalog entry each minute. Completed
searches are revisited after six hours, while changed catalog entries become due
earlier. Read completed/pending/failed counts alongside each measurement time.
Holder work runs each minute in bounded batches; each holder reading keeps its
fetch time and explicitly unknown source index time where unpublished.
