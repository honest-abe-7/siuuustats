import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { portugalOnly, newPortugalMatches, rowCount } from "../lib/martj42.mjs";

test("portugalOnly keeps the header and Portugal rows only", () => {
  const out = portugalOnly(fixture("martj42-results-mixed.csv"), "results.csv");
  assert.equal(rowCount(out), 2);
  assert.ok(!out.includes("Spain"));
  assert.ok(out.startsWith("date,home_team,away_team"));
});

test("portugalOnly fails on a changed header or an empty/unrelated file", () => {
  assert.throws(() => portugalOnly("date,home,away\n2020-01-01,Portugal,Spain\n", "results.csv"), /missing columns/);
  assert.throws(() => portugalOnly("date,home_team,away_team,home_score,away_score,tournament,city,country,neutral\n", "results.csv"), /empty/);
  assert.throws(() => portugalOnly("date,home_team,away_team,home_score,away_score,tournament,city,country,neutral\n2020-01-01,Spain,Italy,1,1,F,M,S,FALSE\n", "results.csv"), /no Portugal rows/);
});

test("newPortugalMatches lists played matches after the latest ledger cap", () => {
  const ledger = [
    { date: "2026-09-24", team_id: "portugal" },
    { date: "2026-10-01", team_id: "al-nassr" }, // other team's rows are ignored
  ];
  const got = newPortugalMatches(fixture("martj42-portugal-results-tail.csv"), ledger, { today: "2026-10-22" });
  assert.deepEqual(got.map((m) => m.key), ["2026-09-27-portugal", "2026-10-01-portugal", "2026-10-04-portugal"]);
  assert.equal(got[0].opponent, "Norway");
  assert.equal(got[0].score, "1-2"); // home-away order as in the source
});

test("newPortugalMatches skips unplayed (NA) fixtures and future dates", () => {
  const got = newPortugalMatches(fixture("martj42-results-mixed.csv"), [{ date: "2026-01-01", team_id: "portugal" }], { today: "2026-12-31" });
  assert.deepEqual(got.map((m) => m.date), ["2026-10-04"]);
  assert.deepEqual(newPortugalMatches(fixture("martj42-results-mixed.csv"), [], { today: "2026-10-03" }), []);
});
