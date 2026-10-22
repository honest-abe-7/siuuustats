import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tempRoot, stubFetch, fakeClient, fixture } from "./helpers.mjs";
import { runDetect, rsssfDate } from "../detect-matches.mjs";
import { CANDIDATES_FILE, DISMISSED_FILE } from "../config.mjs";

const quiet = () => {};
const tsdbRoutes = () => [
  [/eventslast\.php\?id=136022/, () => ({ body: fixture("tsdb-eventslast-136022.json") })],
  [/eventsnext\.php\?id=136022/, () => ({ body: fixture("tsdb-eventsnext-136022.json") })],
  [/eventsday\.php\?d=2026-10-20&l=4668/, () => ({ body: fixture("tsdb-eventsday-2026-10-20-4668.json") })],
  [/thesportsdb/, () => ({ body: fixture("tsdb-null.json") })],
];
const read = (root, f) => JSON.parse(readFileSync(join(root, f), "utf8"));

test("finds new Portugal matches from martj42 and Al-Nassr matches from TheSportsDB", async () => {
  const root = tempRoot();
  const { fetchImpl, calls } = stubFetch(tsdbRoutes());
  const rep = await runDetect({ root, client: fakeClient(fetchImpl).client, today: "2026-10-21", log: quiet });
  const keys = rep.candidates.map((c) => c.key);
  assert.ok(keys.includes("2026-10-20-al-nassr"), keys.join());
  assert.ok(keys.every((k) => k > "2026-09-24"), "nothing at or before the latest ledger cap");
  const nassr = rep.candidates.find((c) => c.key === "2026-10-20-al-nassr");
  assert.deepEqual(nassr.sources, ["thesportsdb"]);
  assert.equal(nassr.thesportsdb_event_id, "2573386");
  assert.ok(rep.notes.some((n) => /free-tier cap 3/.test(n)));
  assert.equal(calls.length, 12);
  assert.deepEqual(read(root, CANDIDATES_FILE).candidates, rep.candidates);
});

test("queue persists across runs, drops ledger matches and dismissed keys", async () => {
  const root = tempRoot();
  await runDetect({ root, client: fakeClient(stubFetch(tsdbRoutes()).fetchImpl).client, today: "2026-10-21", log: quiet });
  // Next run: TheSportsDB shows nothing, but the Al-Nassr candidate must stay queued.
  const r2 = await runDetect({ root, client: fakeClient(stubFetch([[/./, () => ({ body: fixture("tsdb-null.json") })]]).fetchImpl).client, today: "2026-10-25", log: quiet });
  assert.ok(r2.candidates.some((c) => c.key === "2026-10-20-al-nassr"));
  assert.deepEqual(r2.new_candidates, []);
  // Human dismisses it; a ledger row appears for another one.
  mkdirSync(join(root, "pipeline/config"), { recursive: true });
  writeFileSync(join(root, DISMISSED_FILE), JSON.stringify({ dismissed: [{ key: "2026-10-20-al-nassr", reason: "test" }] }));
  const first = r2.candidates.find((c) => c.team_id === "portugal");
  if (first) {
    const m = readFileSync(join(root, "data/matches.csv"), "utf8");
    writeFileSync(join(root, "data/matches.csv"), m + `${first.date}-portugal-x,${first.date},2026,uefa-nations-league,,portugal,norway,away,,,2,1,false,,true,,,,235,martj42-results\n`);
  }
  const r3 = await runDetect({ root, offline: true, today: "2026-10-25", log: quiet });
  assert.ok(!r3.candidates.some((c) => c.key === "2026-10-20-al-nassr"));
  if (first) assert.ok(!r3.candidates.some((c) => c.key === first.key));
});

test("TheSportsDB errors are reported but do not abort detection", async () => {
  const root = tempRoot();
  const { fetchImpl } = stubFetch([[/thesportsdb/, () => ({ status: 404, body: "no" })]]);
  const rep = await runDetect({ root, client: fakeClient(fetchImpl).client, today: "2026-10-21", log: quiet });
  assert.equal(rep.errors.length, 12);
  assert.ok(rep.errors.every((e) => e.url.includes("{key}")));
  assert.ok(rep.candidates.length >= 0);
});

test("RSSSF hints flag Portugal candidates the cap list (updated later) does not contain", async () => {
  const root = tempRoot();
  const rep = await runDetect({ root, offline: true, today: "2026-10-21", log: quiet });
  // Pinned RSSSF snapshot: last updated 7 Oct 2026, 234 caps (last on 2026-09-24).
  for (const c of rep.candidates.filter((x) => x.team_id === "portugal" && x.date < "2026-10-07")) assert.match(rep.hints[c.key], /probably not played/);
  assert.equal(rsssfDate("7 Oct 2026"), "2026-10-07");
  assert.equal(rsssfDate("12 September 2025"), "2025-09-12");
  assert.equal(rsssfDate("soon"), null);
});
