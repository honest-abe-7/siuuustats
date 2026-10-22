import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { newPortugalMatches, rowCount } from "../lib/martj42.mjs";

test("rowCount counts data rows", () => {
  assert.equal(rowCount(fixture("martj42-results-mixed.csv")), 3);
  assert.equal(rowCount("date,home_team\n"), 0);
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
