// A thin client for the Fletch v1 API (https://fletch.now/api/v1). Every
// response type comes from src/generated/openapi.ts, which openapi-typescript
// writes from spec/openapi.json; regenerate rather than edit. The client adds
// URL building, the bearer header, an ETag cache so a poll that sees a 304
// costs no bytes, and cursor and stream helpers for the changelog.

import { createRequire } from "node:module";
import type { paths } from "./generated/openapi.ts";
import type { Freshness } from "./freshness.ts";

export type { paths } from "./generated/openapi.ts";
export type * from "./freshness.ts";
export { isOverallVerdict, OVERALL_VERDICTS } from "./freshness.ts";

const packageJson = createRequire(import.meta.url)("../package.json") as { version: string };

export const VERSION: string = packageJson.version;
export const DEFAULT_BASE_URL = "https://fletch.now/api/v1";
export const MAINNET_CHAIN_ID = 4663;
// The most rows /chains/{chainId}/events returns per page (docs/EVENTS.md).
export const MAX_EVENTS_PAGE = 500;

// The paths in the spec that have a GET operation; the client reads only.
export type GetPath = { [P in keyof paths]: paths[P] extends { get: object } ? P : never }[keyof paths];
type Operation<P extends GetPath> = paths[P] extends { get: infer O } ? O : never;
export type Query<P extends GetPath> = Operation<P> extends { parameters: { query?: infer Q } } ? Exclude<Q, undefined> : never;
export type Body<P extends GetPath> = Operation<P> extends { responses: { 200: { content: { "application/json": infer B } } } } ? B : unknown;

export type EventsBody = Body<"/chains/{chainId}/events">;
export type AuthorityEvent = NonNullable<EventsBody["events"]>[number];

export interface FletchClientOptions {
  // Defaults to https://fletch.now/api/v1.
  baseUrl?: string;
  // An flk_ key. Registry reads need none; watchers and webhooks do. Sent as a
  // bearer token and only over https, so a key never crosses the wire in clear.
  apiKey?: string;
  fetch?: typeof fetch;
  // Appended to the default user-agent so Fletch can tell integrations apart.
  userAgent?: string;
  // How many URLs the ETag cache remembers; default 200.
  cacheEntries?: number;
}

export interface RequestOptions<P extends GetPath> {
  path?: Record<string, string | number>;
  query?: Query<P>;
  signal?: AbortSignal;
}

export interface FletchResponse<T> {
  body: T;
  etag: string | null;
  // 304 when the server confirmed the cached body is still current.
  status: 200 | 304;
  fromCache: boolean;
}

export class FletchError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;
  // Seconds to wait when the answer was 429, if the server said.
  readonly retryAfterSeconds: number | null;

  constructor(status: number, url: string, body: unknown, retryAfterSeconds: number | null) {
    super(FletchError.describe(status, url, body));
    this.name = "FletchError";
    this.status = status;
    this.url = url;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static describe(status: number, url: string, body: unknown): string {
    const detail = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? `: ${body.error}` : "";
    return `HTTP ${status} from ${url}${detail}`;
  }

  static async from(response: Response, url: string): Promise<FletchError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    return new FletchError(response.status, url, body, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }
}

interface CacheEntry {
  etag: string;
  body: unknown;
}

// Insertion-ordered Map as a small LRU: a hit is re-inserted, the oldest key is
// dropped past the cap. A long-running poller cannot grow it without bound.
class EtagCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }
}

export interface EventCursor {
  observedAt: Date;
  id: string | null;
}

// `${observedAt}|${id}` as the API returns it; a bare instant is also accepted.
export function parseEventCursor(cursor: string): EventCursor | null {
  const [instant, id] = cursor.split("|");
  const observedAt = new Date(instant ?? "");
  if (Number.isNaN(observedAt.getTime())) {
    return null;
  }
  return { observedAt, id: id ?? null };
}

export interface StreamFrame {
  // The event's cursor; pass it as `since` (or Last-Event-ID) to resume.
  id: string;
  // The event kind, e.g. "multiplier.applied".
  event: string;
  data: AuthorityEvent;
}

export interface StreamOptions {
  // A cursor or ISO instant to resume from; default now.
  since?: string;
  signal?: AbortSignal;
}

function buildPath(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, function substitute(_match: string, name: string): string {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) {
    return "";
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// exactOptionalPropertyTypes forbids `query: undefined`, so absent parts are
// left out rather than set to undefined.
function requestOptions<P extends GetPath>(path: Record<string, string | number>, query?: Query<P>, signal?: AbortSignal): RequestOptions<P> {
  const built: RequestOptions<P> = { path };
  if (query !== undefined) {
    built.query = query;
  }
  if (signal !== undefined) {
    built.signal = signal;
  }
  return built;
}

export class FletchClient {
  readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly cache: EtagCache;

  constructor(options: FletchClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? null;
    if (this.apiKey && !this.baseUrl.startsWith("https://")) {
      throw new Error("An API key is sent as a bearer token and only over https");
    }
    this.fetchImpl = options.fetch ?? fetch;
    this.userAgent = options.userAgent ? `fletch-sdk/${VERSION} ${options.userAgent}` : `fletch-sdk/${VERSION}`;
    this.cache = new EtagCache(options.cacheEntries ?? 200);
  }

  url<P extends GetPath>(path: P, options: RequestOptions<P> = {}): string {
    return `${this.baseUrl}${buildPath(path, options.path ?? {})}${buildQuery(options.query as Record<string, unknown> | undefined)}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { accept: "application/json", "user-agent": this.userAgent, ...extra };
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // One GET. A cached ETag is sent as If-None-Match; a 304 answers from the
  // cache with `fromCache: true`. Anything but 200 or 304 throws FletchError.
  async get<P extends GetPath>(path: P, options: RequestOptions<P> = {}): Promise<FletchResponse<Body<P>>> {
    const url = this.url(path, options);
    const cached = this.cache.get(url);
    const headers = this.headers(cached ? { "if-none-match": cached.etag } : {});
    const init: RequestInit = options.signal ? { headers, signal: options.signal } : { headers };
    const response = await this.fetchImpl(url, init);
    if (response.status === 304 && cached) {
      return { body: cached.body as Body<P>, etag: cached.etag, status: 304, fromCache: true };
    }
    if (!response.ok) {
      throw await FletchError.from(response, url);
    }
    const body = (await response.json()) as Body<P>;
    const etag = response.headers.get("etag");
    if (etag) {
      this.cache.set(url, { etag, body });
    }
    return { body, etag, status: 200, fromCache: false };
  }

  // Whether the registry is live. Always 200; read `verdict` (docs/FRESHNESS.md).
  async status(chainId: number = MAINNET_CHAIN_ID): Promise<Freshness> {
    const result = await this.get("/chains/{chainId}/status", { path: { chainId } });
    return result.body as unknown as Freshness;
  }

  async assets(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/assets">): Promise<Body<"/chains/{chainId}/assets">> {
    return (await this.get("/chains/{chainId}/assets", requestOptions({ chainId }, query))).body;
  }

  async asset(symbol: string, chainId: number = MAINNET_CHAIN_ID): Promise<Body<"/chains/{chainId}/assets/{symbol}">> {
    return (await this.get("/chains/{chainId}/assets/{symbol}", { path: { chainId, symbol } })).body;
  }

  async holders(symbol: string, chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/assets/{symbol}/holders">): Promise<Body<"/chains/{chainId}/assets/{symbol}/holders">> {
    return (await this.get("/chains/{chainId}/assets/{symbol}/holders", requestOptions({ chainId, symbol }, query))).body;
  }

  async history(symbol: string, chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/assets/{symbol}/history">): Promise<Body<"/chains/{chainId}/assets/{symbol}/history">> {
    return (await this.get("/chains/{chainId}/assets/{symbol}/history", requestOptions({ chainId, symbol }, query))).body;
  }

  async pools(symbol: string, chainId: number = MAINNET_CHAIN_ID): Promise<Body<"/chains/{chainId}/assets/{symbol}/pools">> {
    return (await this.get("/chains/{chainId}/assets/{symbol}/pools", { path: { chainId, symbol } })).body;
  }

  async feedRounds(symbol: string, chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/assets/{symbol}/feed/rounds">): Promise<Body<"/chains/{chainId}/assets/{symbol}/feed/rounds">> {
    return (await this.get("/chains/{chainId}/assets/{symbol}/feed/rounds", requestOptions({ chainId, symbol }, query))).body;
  }

  async controlPlane(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/control-plane">): Promise<Body<"/chains/{chainId}/control-plane">> {
    return (await this.get("/chains/{chainId}/control-plane", requestOptions({ chainId }, query))).body;
  }

  async health(chainId: number = MAINNET_CHAIN_ID): Promise<Body<"/chains/{chainId}/health">> {
    return (await this.get("/chains/{chainId}/health", { path: { chainId } })).body;
  }

  async lookalikes(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/lookalikes">): Promise<Body<"/chains/{chainId}/lookalikes">> {
    return (await this.get("/chains/{chainId}/lookalikes", requestOptions({ chainId }, query))).body;
  }

  async corporateActions(chainId: number = MAINNET_CHAIN_ID): Promise<Body<"/chains/{chainId}/corporate-actions">> {
    return (await this.get("/chains/{chainId}/corporate-actions", { path: { chainId } })).body;
  }

  async bridge(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/bridge">): Promise<Body<"/chains/{chainId}/bridge">> {
    return (await this.get("/chains/{chainId}/bridge", requestOptions({ chainId }, query))).body;
  }

  async dex(chainId: number = MAINNET_CHAIN_ID): Promise<Body<"/chains/{chainId}/dex">> {
    return (await this.get("/chains/{chainId}/dex", { path: { chainId } })).body;
  }

  async issuer(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/issuer">): Promise<Body<"/chains/{chainId}/issuer">> {
    return (await this.get("/chains/{chainId}/issuer", requestOptions({ chainId }, query))).body;
  }

  // Newest first without a cursor (with `kinds` and a `nextCursor` to resume
  // from); oldest first after `since` or `cursor`. See docs/EVENTS.md.
  async events(chainId: number = MAINNET_CHAIN_ID, query?: Query<"/chains/{chainId}/events">): Promise<EventsBody> {
    return (await this.get("/chains/{chainId}/events", requestOptions({ chainId }, query))).body;
  }

  // Every event after `cursor`, oldest first, page by page until the server
  // has nothing newer. Keep the last yielded event's cursor to resume later.
  async *eventsAfter(cursor: string, chainId: number = MAINNET_CHAIN_ID, paging: { limit?: number; signal?: AbortSignal } = {}): AsyncGenerator<AuthorityEvent, string, void> {
    // The server clamps `limit` to 500; asking for more would make a full page
    // look short and end the walk after one request.
    const limit = Math.min(paging.limit ?? 200, MAX_EVENTS_PAGE);
    let position = cursor;
    for (;;) {
      const page = await this.get("/chains/{chainId}/events", requestOptions({ chainId }, { cursor: position, limit }, paging.signal));
      const events = page.body.events ?? [];
      for (const event of events) {
        yield event;
      }
      const next = page.body.nextCursor;
      if (events.length < limit || !next || next === position) {
        return next ?? position;
      }
      position = next;
    }
  }

  // The changelog as Server-Sent Events, one frame per event. The server closes
  // a stream after half an hour; reconnect with the last frame's id as `since`.
  async *streamEvents(chainId: number = MAINNET_CHAIN_ID, options: StreamOptions = {}): AsyncGenerator<StreamFrame, void, void> {
    const url = `${this.baseUrl}${buildPath("/chains/{chainId}/events/stream", { chainId })}${buildQuery(options.since ? { since: options.since } : undefined)}`;
    const headers = this.headers({ accept: "text/event-stream" });
    const init: RequestInit = options.signal ? { headers, signal: options.signal } : { headers };
    const response = await this.fetchImpl(url, init);
    if (!response.ok || !response.body) {
      throw await FletchError.from(response, url);
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffered = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          return;
        }
        buffered += value;
        let boundary = buffered.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = parseFrame(buffered.slice(0, boundary));
          buffered = buffered.slice(boundary + 2);
          if (frame) {
            yield frame;
          }
          boundary = buffered.indexOf("\n\n");
        }
      }
    } finally {
      await reader.cancel().catch(function ignore() {
        return undefined;
      });
    }
  }
}

// One SSE block. Comment lines (": keepalive") and blocks without data are
// skipped; `data` is the JSON event the server wrote on a single line.
export function parseFrame(block: string): StreamFrame | null {
  let id = "";
  let event = "";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "id") {
      id = value;
    } else if (field === "event") {
      event = value;
    } else if (field === "data") {
      data.push(value);
    }
  }
  if (data.length === 0) {
    return null;
  }
  return { id, event, data: JSON.parse(data.join("\n")) as AuthorityEvent };
}
