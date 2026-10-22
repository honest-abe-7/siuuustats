import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tempRoot, stubFetch, fakeClient, fixture, REPO } from "./helpers.mjs";
import { runDetect, rsssfDate } from "../detect-matches.mjs";
import { CANDIDATES_FILE, DISMISSED_FILE, ADDITIONS_FILE } from "../config.mjs";
import { renderBody } from "../pr-body.mjs";
import { toCsvLine } from "../detect-matches.mjs";

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
  cpSync(join(REPO, ADDITIONS_FILE), join(root, ADDITIONS_FILE));
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

test("owner review: Oct 1 and Oct 4 dismissed; Sep 27 surfaced as an appeared=false row to add", async () => {
  const root = withDismissed(tempRoot());
  const rep = await runDetect({ root, offline: true, today: "2026-10-22", log: quiet });
  assert.deepEqual(rep.candidates.map((c) => c.key), ["2026-09-27-portugal"]);
  const c = rep.candidates[0];
  assert.equal(c.ledger_action, "add_unused_squad_row");
  assert.equal(c.home_team, "Norway");
  assert.equal(c.score, "1-2");
  assert.equal(rep.hints[c.key], undefined, "no 'probably not played' hint for a reviewed addition");
  assert.equal(rep.ledger_additions.length, 1);
  const line = rep.ledger_additions[0].suggested_csv;
  const header = readFileSync(join(root, "data/matches.csv"), "utf8").split("\n")[0];
  assert.equal(line.split(",").length, header.split(",").length);
  assert.match(line, /^2026-09-27-portugal-norway,2026-09-27,2026,uefa-nations-league,,portugal,norway,away,Oslo,Norway,2,1,,,false,,,,,/);
  const body = renderBody({ detect: rep });
  assert.match(body, /Reviewed: add to the ledger/);
  assert.match(body, /add_unused_squad_row/);
  assert.match(body, /bbc\.com\/sport\/football\/live\/cvrl6660y8w3t/);
  assert.match(body, /```csv/);

  // Once the data owner adds the row, it leaves the queue.
  writeFileSync(join(root, "data/matches.csv"), readFileSync(join(root, "data/matches.csv"), "utf8") + line + "\n");
  const r2 = await runDetect({ root, offline: true, today: "2026-10-22", log: quiet });
  assert.deepEqual(r2.candidates, []);
  assert.deepEqual(r2.ledger_additions, []);
});

test("an addition is surfaced from the config even when no upstream source shows it any more", async () => {
  const root = withDismissed(tempRoot());
  // Simulate a later Portugal cap so martj42 detection no longer reaches back to 27 Sep.
  writeFileSync(join(root, "data/matches.csv"), readFileSync(join(root, "data/matches.csv"), "utf8") + "2026-11-14-portugal-ireland,2026-11-14,2026,uefa-euro-qualification,,portugal,ireland,home,,,3,0,,,true,,,,235,martj42-results,\n");
  const rep = await runDetect({ root, offline: true, today: "2026-11-15", log: quiet });
  const c = rep.candidates.find((x) => x.key === "2026-09-27-portugal");
  assert.deepEqual(c.sources, ["owner-review"]);
  assert.equal(c.home_team, "Norway");
});

test("reviewed config files: evidence URLs present, no key both dismissed and added, AFP link not used", () => {
  const dismissed = JSON.parse(readFileSync(join(REPO, DISMISSED_FILE), "utf8")).dismissed;
  const additions = JSON.parse(readFileSync(join(REPO, ADDITIONS_FILE), "utf8")).additions;
  assert.deepEqual(dismissed.map((d) => d.key), ["2026-10-01-portugal", "2026-10-04-portugal"]);
  assert.deepEqual(additions.map((a) => a.key), ["2026-09-27-portugal"]);
  for (const e of [...dismissed, ...additions].flatMap((x) => x.evidence)) {
    assert.match(e.url, /^https:\/\/www\.(bbc\.com|aljazeera\.com)\//);
    assert.ok(e.publisher && e.title && e.published);
  }
  assert.ok(!JSON.stringify([dismissed, additions]).includes("afp.com"), "AFP URL returned 404");
  assert.equal(additions[0].suggested_row.appeared, false);
  assert.equal(additions[0].suggested_row.cap_number, null);
});

test("toCsvLine follows the header and quotes when needed", () => {
  assert.equal(toCsvLine(["a", "b", "c"], { a: 1, b: null, c: 'x,"y"' }), 'a'.replace("a", "1") + ',,"x,""y"""');
  assert.throws(() => toCsvLine(["a", "b"], { a: 1 }), /missing columns: b/);
});

test("without the review files the three matches would be flagged from martj42, with RSSSF hints", async () => {
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
  assert.ok(r1.new_candidates.includes("2026-10-23-al-nassr"));
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
