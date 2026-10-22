import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tempRoot, stubFetch, fakeClient, fixture, REPO } from "./helpers.mjs";
import { runDetect, rsssfDate } from "../detect-matches.mjs";
import { CANDIDATES_FILE, DISMISSED_FILE } from "../config.mjs";

const quiet = () => {};
// A finished Al-Nassr away match that is not in the ledger (built from the saved eventsnext fixture).
const playedAway = () => {
  const j = JSON.parse(fixture("tsdb-eventsnext-136022.json"));
  j.events[0] = { ...j.events[0], intHomeScore: "1", intAwayScore: "2", strStatus: "FT" };
  return JSON.stringify(j);
};
const tsdbRoutes = ({ away = false } = {}) => [
  [/eventslast\.php\?id=136022/, () => ({ body: fixture("tsdb-eventslast-136022.json") })],
  [/eventsnext\.php\?id=136022/, () => ({ body: away ? playedAway() : fixture("tsdb-eventsnext-136022.json") })],
  [/eventsday\.php\?d=2026-10-20&l=4668/, () => ({ body: fixture("tsdb-eventsday-2026-10-20-4668.json") })],
  [/thesportsdb/, () => ({ body: fixture("tsdb-null.json") })],
];
const withDismissed = (root) => {
  mkdirSync(join(root, "pipeline/config"), { recursive: true });
  cpSync(join(REPO, DISMISSED_FILE), join(root, DISMISSED_FILE));
  return root;
};

test("Al-Nassr 1-0 Neom (2026-10-20) is in the M3 ledger and is no longer flagged", async () => {
  const root = withDismissed(tempRoot());
  assert.match(readFileSync(join(root, "data/matches.csv"), "utf8"), /^2026-10-20-al-nassr-neom,/m);
  const { fetchImpl, calls } = stubFetch(tsdbRoutes());
  const rep = await runDetect({ root, client: fakeClient(fetchImpl).client, today: "2026-10-21", log: quiet });
  assert.ok(!rep.candidates.some((c) => c.key === "2026-10-20-al-nassr"));
  assert.equal(calls.length, 12);
  assert.ok(rep.notes.some((n) => /free-tier cap 3/.test(n)));
});

test("the owner's dismissals suppress the three October Portugal matches", async () => {
  const root = withDismissed(tempRoot());
  const rep = await runDetect({ root, offline: true, today: "2026-10-22", log: quiet });
  for (const k of ["2026-09-27-portugal", "2026-10-01-portugal", "2026-10-04-portugal"]) assert.ok(!rep.candidates.some((c) => c.key === k), k);
  assert.deepEqual(rep.candidates, []);
  const d = JSON.parse(readFileSync(join(REPO, DISMISSED_FILE), "utf8")).dismissed;
  assert.ok(d.every((x) => x.reason && x.sources.length === 3));
});

test("without dismissals the same matches would be flagged from martj42, with RSSSF hints", async () => {
  const root = tempRoot();
  const rep = await runDetect({ root, offline: true, today: "2026-10-22", log: quiet });
  assert.deepEqual(rep.candidates.map((c) => c.key), ["2026-09-27-portugal", "2026-10-01-portugal", "2026-10-04-portugal"]);
  for (const c of rep.candidates) assert.match(rep.hints[c.key], /probably not played/);
  assert.equal(rsssfDate("7 Oct 2026"), "2026-10-07");
  assert.equal(rsssfDate("12 September 2025"), "2025-09-12");
  assert.equal(rsssfDate("soon"), null);
});

test("a new Al-Nassr match is queued, persists across runs, and leaves once in the ledger or dismissed", async () => {
  const root = withDismissed(tempRoot());
  const r1 = await runDetect({ root, client: fakeClient(stubFetch(tsdbRoutes({ away: true })).fetchImpl).client, today: "2026-10-24", log: quiet });
  const c = r1.candidates.find((x) => x.team_id === "al-nassr");
  assert.equal(c.key, "2026-10-23-al-nassr");
  assert.equal(c.opponent, "Al-Faisaly");
  assert.deepEqual(r1.new_candidates, ["2026-10-23-al-nassr"]);
  assert.deepEqual(JSON.parse(readFileSync(join(root, CANDIDATES_FILE), "utf8")).candidates, r1.candidates);

  // TheSportsDB no longer shows it, but it stays queued.
  const r2 = await runDetect({ root, offline: true, today: "2026-10-26", log: quiet });
  assert.ok(r2.candidates.some((x) => x.key === c.key));
  assert.deepEqual(r2.new_candidates, []);

  // Once the club ingest adds it, it disappears.
  const m = readFileSync(join(root, "data/matches.csv"), "utf8");
  writeFileSync(join(root, "data/matches.csv"), m + "2026-10-23-al-nassr-al-faisaly,2026-10-23,2026-27,saudi-pro-league,,al-nassr,al-faisaly,away,,,2,1,false,,true,,,,,,wikipedia-cristiano-ronaldo\n");
  const r3 = await runDetect({ root, offline: true, today: "2026-10-26", log: quiet });
  assert.ok(!r3.candidates.some((x) => x.key === c.key));
});

test("TheSportsDB errors are reported but do not abort detection", async () => {
  const root = tempRoot();
  const { fetchImpl } = stubFetch([[/thesportsdb/, () => ({ status: 404, body: "no" })]]);
  const rep = await runDetect({ root, client: fakeClient(fetchImpl).client, today: "2026-10-21", log: quiet });
  assert.equal(rep.errors.length, 12);
  assert.ok(rep.errors.every((e) => e.url.includes("{key}")));
});
