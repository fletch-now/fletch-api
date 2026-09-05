// The body of GET /status, as docs/FRESHNESS.md describes it. The served spec
// types this route as a bare object, so these names are kept by hand until the
// spec carries a Freshness schema; the runtime checks in the live test are what
// hold them to the real answer.

export type JobVerdict = "fresh" | "late" | "failing" | "filling" | "stalled" | "never";
export type FigureVerdict = JobVerdict | "unread";
export type OverallVerdict = "live" | "degraded" | "stale" | "never";

export interface CheckpointProgress {
  name: string;
  block: string;
  head: string | null;
  behind: string | null;
  updatedAt: string;
  blocksPerHour: number | null;
  hoursLeft: number | null;
}

export interface JobFreshness {
  job: string;
  cadenceSeconds: number;
  verdict: JobVerdict;
  lastRunAt: string | null;
  lastOkAt: string | null;
  ageSeconds: number | null;
  rows: number | null;
  error: string | null;
  running: boolean;
  checkpoints: CheckpointProgress[];
}

export interface FigureFreshness {
  figure: string;
  what: string;
  job: string;
  cadenceSeconds: number;
  verdict: FigureVerdict;
  newestAt: string | null;
  ageSeconds: number | null;
  count: number;
  unit: string;
}

export interface Freshness {
  chainId: number;
  checkedAt: string;
  verdict: OverallVerdict;
  summary: string;
  daemon: {
    name: string;
    alive: boolean;
    lastBeatAt: string | null;
    ageSeconds: number | null;
    jobsReported: number | null;
    failing: string[];
  };
  head: { block: string; readAt: string; ageSeconds: number } | null;
  jobs: JobFreshness[];
  figures: FigureFreshness[];
  verdicts: Record<JobVerdict | OverallVerdict | "unread", string>;
}

export const OVERALL_VERDICTS: readonly OverallVerdict[] = ["live", "degraded", "stale", "never"];

export function isOverallVerdict(value: unknown): value is OverallVerdict {
  return typeof value === "string" && (OVERALL_VERDICTS as readonly string[]).includes(value);
}
