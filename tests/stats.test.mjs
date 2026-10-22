import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import * as s from "../scripts/lib/stats.mjs";

const ledger = loadLedger();

// Golden numbers: each is cited in data/sources.csv / data/reconciliation/expectations.json
test("headline international figures", () => {
  const sum = s.internationalSummary(ledger);
  assert.equal(sum.caps, 234);
  assert.equal(sum.goals, 146);
  assert.equal(sum.competitive.goals, 124);
  assert.equal(sum.friendly.goals, 22);
  assert.equal(sum.penalty_goals, 23);
  assert.equal(sum.hat_tricks, 10);
  assert.equal(sum.first_cap, "2003-08-20");
});

test("goals per competition match Wikipedia's by-competition table", () => {
  assert.equal(s.goalsInCompetition(ledger, "fifa-world-cup"), 11);
  assert.equal(s.goalsInCompetition(ledger, "fifa-world-cup-qualification"), 41);
  assert.equal(s.goalsInCompetition(ledger, "uefa-euro"), 14);
  assert.equal(s.goalsInCompetition(ledger, "uefa-euro-qualification"), 41);
  assert.equal(s.goalsInCompetition(ledger, "uefa-nations-league"), 15);
  assert.equal(s.goalsInCompetition(ledger, "fifa-confederations-cup"), 2);
});

test("ageOn handles birthdays", () => {
  assert.equal(s.ageOn("2026-02-04"), 40);
  assert.equal(s.ageOn("2026-02-05"), 41);
  assert.equal(s.ageOn("2026-07-02"), 41);
});

// Synthetic ledger: unit-level behaviour independent of the real data
const tiny = {
  tables: {
    competitions: [{ competition_id: "c", name: "C" }],
    matches: [
      { match_id: "m1", date: "2020-01-01", season: "2020", competition_id: "c", team_id: "portugal", opponent_id: "a", appeared: true, score_for: 3, score_against: 0 },
      { match_id: "m2", date: "2020-02-01", season: "2020", competition_id: "c", team_id: "portugal", opponent_id: "b", appeared: true, score_for: 1, score_against: 1 },
      { match_id: "m3", date: "2021-01-01", season: "2021", competition_id: "c", team_id: "portugal", opponent_id: "a", appeared: false, score_for: 0, score_against: 2 },
    ],
    goals: [
      { goal_id: "m1-g1", match_id: "m1", method: "penalty" },
      { goal_id: "m1-g2", match_id: "m1", method: "open_play" },
      { goal_id: "m1-g3", match_id: "m1", method: "open_play" },
      { goal_id: "m2-g1", match_id: "m2", method: "open_play" },
    ],
  },
};

test("record() ignores unused-sub matches and counts level scores as draws", () => {
  assert.deepEqual(s.record(tiny), { played: 2, won: 1, drawn: 1, lost: 0 });
});

test("multiGoalMatches finds hat-tricks", () => {
  assert.deepEqual(s.multiGoalMatches(tiny, 3), [{ match_id: "m1", date: "2020-01-01", opponent_id: "a", goals: 3 }]);
  assert.equal(s.multiGoalMatches(tiny, 2).length, 1);
});

test("splitBy groups apps and goals, sorted by goals", () => {
  assert.deepEqual(s.splitBy(tiny, (m) => m.opponent_id), [
    { key: "a", apps: 1, goals: 3 },
    { key: "b", apps: 1, goals: 1 },
  ]);
  assert.equal(s.penaltyGoals(tiny), 1);
});

test("evaluateComputeFn resolves names and arguments", () => {
  assert.equal(s.evaluateComputeFn(ledger, "intlGoals"), 146);
  assert.equal(s.evaluateComputeFn(ledger, "goalsInCompetition:uefa-euro"), 14);
  assert.throws(() => s.evaluateComputeFn(ledger, "nope"));
});
