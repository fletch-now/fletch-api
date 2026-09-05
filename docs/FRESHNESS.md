# Reading /api/v1/status

`GET /api/v1/status` (alias `GET /api/v1/chains/4663/status`) says whether the registry
is live, in one read: the daemon's heartbeat, every job against the cadence it runs on,
the scanners still reading history, and the age of every published figure. It always
answers 200; the verdict is in the body, so a stale registry is a fact you read, not an
error you retry. Cached for ten seconds. The body carries `checkedAt`, so its `ETag`
changes on every fresh read.

Registry reads need no key and every figure on the site is judged from the same rows,
so "live" on a page means what this route says.

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
`dex-pools`, `dex-pools-v3`, `dex-swaps`, `bridge-flows`. Names carry a `:4663` suffix
for the chain.

### Cadences

What each job reads, and how often, as published in `cadenceSeconds`:

| Job | Every | Reads |
|---|---|---|
| `control-plane` | 10 s | the AccessControlsRegistry's events: pauses, blocklist, roles, upgrades |
| `authority-match` | 10 s | new authority events, fanned out to watchers |
| `chain-health` | 30 s | head block, block time, base fee, batches, status page |
| `feeds` | 1 min | every Chainlink feed's latest round and staleness |
| `supply-events` | 1 min | mints and burns |
| `transfer-ledger` | 1 min | every transfer, into per-holder balances |
| `dex-swaps` | 1 min | swaps on the pools it knows |
| `bridge-flows` | 1 min | deposits and withdrawals on the token bridge |
| `multiplier-events` | 5 min | multiplier changes and schedules |
| `token-state` | 5 min | each token's multiplier, pauses and supply, from its contract |
| `api-prices` | 5 min | Robinhood's own bid, ask and halt flag |
| `dex-state` | 5 min | each pool's price, depth and liquidity |
| `dex-pools` | 10 min | new Uniswap v4 pools |
| `dex-pools-v3` | 10 min | new Uniswap v3 pools |
| `bridge-escrow` | 10 min | L1 escrow against L2 supply for bridged assets |
| `feed-history` | 10 min | Chainlink round history |
| `corporate-actions` | 1 h | corporate actions from the issuer's API |
| `holder-labels` | 1 h | which holders are pools, contracts, the issuer or the bridge |
| `issuer-pages` | 1 h | the issuer's watched pages |
| `second-source` | 1 h | Blockscout's holders, transfers and supply per token |
| `state-daily` | 1 h | the current UTC day's row of every per-asset figure |
| `canonical` | 6 h | the beacon proof for every token |
| `bridged` | 6 h | the GatewayRouter proof for bridged assets |
| `issuer-docs` | 6 h | the PDFs on the issuer's legal hub |
| `lookalikes` | 6 h | ERC-20s borrowing a listed ticker or name |
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

- Gate on `verdict === "live"` when freshness matters, and read `summary` when it is
  not.
- To judge one number, find its figure and read `ageSeconds` against `cadenceSeconds`
  rather than trusting the overall word.
- While a scanner is `filling`, figures that depend on it (holders, concentration,
  swaps) describe a partial ledger; `hoursLeft` on its checkpoint says how long.
- The verdict is not a rate: a `degraded` registry still answers every read, with each
  figure as old as its own job's last success.
