import { mkdtempSync, cpSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "../lib/http.mjs";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..", "..");
export const fixture = (name) => readFileSync(join(HERE, "fixtures", name), "utf8");
export const repoFile = (rel) => readFileSync(join(REPO, rel), "utf8");

/** Temp project root with a copy of data/raw and data/matches.csv (read-only use of the real snapshots). */
export function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "siuuu-pipeline-test-"));
  mkdirSync(join(root, "data"), { recursive: true });
  cpSync(join(REPO, "data/raw"), join(root, "data/raw"), { recursive: true });
  cpSync(join(REPO, "data/matches.csv"), join(root, "data/matches.csv"));
  return root;
}

/** fetch stub: routes is [predicate(url) => boolean | RegExp, handler(url) => {status?, body, headers?}] */
export function stubFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} });
    for (const [match, handler] of routes) {
      const ok = match instanceof RegExp ? match.test(url) : match(url);
      if (ok) {
        const r = handler(String(url));
        if (r instanceof Error) throw r;
        return new Response(r.body, { status: r.status ?? 200, headers: r.headers ?? {} });
      }
    }
    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, calls };
}

/** A client with a fake clock, so throttling/backoff never really sleeps. */
export function fakeClient(fetchImpl, extra = {}) {
  let t = 0;
  const sleeps = [];
  const client = createClient({ fetchImpl, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; }, ...extra });
  return { client, sleeps, advance: (ms) => (t += ms) };
}
