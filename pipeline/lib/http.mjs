// Polite HTTP client: identifying User-Agent, per-host minimum interval, serial use,
// bounded retries with exponential backoff on network errors / 429 / 5xx (honours Retry-After).
import { MIN_INTERVAL_MS, USER_AGENT } from "../config.mjs";

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.url = url;
  }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(ms:number)=>Promise<void>} [opts.sleep]
 * @param {()=>number} [opts.now]
 */
export function createClient({
  userAgent = USER_AGENT,
  intervals = MIN_INTERVAL_MS,
  retries = 3,
  timeoutMs = 30_000,
  maxRetryAfterMs = 65_000, // TheSportsDB: "wait another minute" after a 429
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  now = Date.now,
  log = () => {},
} = {}) {
  const lastRequestAt = new Map();
  const cache = new Map();
  let requests = 0;

  async function throttle(host) {
    const gap = intervals[host] ?? intervals.default ?? 1000;
    const last = lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = last + gap - now();
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt.set(host, now());
  }

  /** GET a URL. Returns { status, headers, text, url }. Throws HttpError / Error after retries. */
  async function get(url, { headers = {}, encoding = "utf8", memo = true } = {}) {
    if (memo && cache.has(url)) return cache.get(url);
    const host = new URL(url).host;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await throttle(host);
      requests++;
      let res;
      try {
        res = await fetchImpl(url, {
          headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent, ...headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        lastErr = e;
        log(`network error (${e.message}) for ${url}, attempt ${attempt + 1}`);
        if (attempt < retries) await sleep(backoff(attempt));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, url);
        if (attempt < retries) {
          const ra = retryAfterMs(res.headers.get("retry-after"));
          const wait = Math.min(ra ?? backoff(attempt), maxRetryAfterMs);
          log(`HTTP ${res.status} for ${url}, retrying in ${wait} ms`);
          await sleep(wait);
        }
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      const buf = Buffer.from(await res.arrayBuffer());
      const text = encoding === "latin1" ? new TextDecoder("latin1").decode(buf) : buf.toString("utf8");
      const out = { status: res.status, headers: res.headers, text, url };
      if (memo) cache.set(url, out);
      return out;
    }
    throw lastErr ?? new Error(`GET failed: ${url}`);
  }

  async function getJson(url, opts) {
    const r = await get(url, opts);
    try {
      return { ...r, json: JSON.parse(r.text) };
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  }

  return { get, getJson, stats: () => ({ requests }) };
}

export const backoff = (attempt) => 2000 * 2 ** attempt; // 2s, 4s, 8s

export function retryAfterMs(h) {
  if (!h) return null;
  if (/^\d+$/.test(h.trim())) return Number(h) * 1000;
  const t = Date.parse(h);
  return Number.isNaN(t) ? null : Math.max(0, t - Date.now());
}
