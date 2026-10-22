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

// ---- M3: club + career ------------------------------------------------------------------------
test("club and career headline figures (reconciled to enwiki per season and competition)", () => {
  assert.equal(s.clubGoals(ledger), 835);
  assert.equal(s.clubApps(ledger), 1107);
  assert.equal(s.careerGoals(ledger), 981);
  assert.equal(s.careerPenaltyGoals(ledger), 184);
  assert.equal(s.uclGoalsMain(ledger), 140);
  assert.equal(s.uclGoalsInclQualifiers(ledger), 141);
  assert.equal(s.uclAppsMain(ledger), 183);
  assert.equal(s.goalsForClub(ledger, "real-madrid"), 450);
  assert.equal(s.goalsForClub(ledger, "al-nassr"), 134);
  assert.equal(s.nationalTeamsScoredAgainst(ledger), 49);
  assert.equal(s.careerSummary(ledger).goals_excluding_non_fifa, 975);
});

test("Champions League splits requested by content (#5)", () => {
  const ucl = s.goalsWithMatch(ledger).filter((g) => g.match.competition_id === s.UCL && !/qualif/i.test(g.match.stage ?? ""));
  const cls = (g) => s.stageClass(g.match.stage);
  assert.equal(ucl.filter((g) => !["group_or_league", "qualifying"].includes(cls(g))).length, 67);
  assert.equal(ucl.filter((g) => cls(g) === "quarter_final").length, 25);
  assert.equal(ucl.filter((g) => cls(g) === "semi_final").length, 13);
  assert.deepEqual(ucl.filter((g) => cls(g) === "final").map((g) => g.match.date), ["2008-05-21", "2014-05-24", "2017-06-03", "2017-06-03"]);
});

test("winningGoals / equalisers definitions", () => {
  const t = {
    tables: {
      competitions: [{ competition_id: "c" }],
      matches: [
        { match_id: "w", date: "2020-01-01", competition_id: "c", team_id: "x", appeared: true, score_for: 3, score_against: 1, notes: null },
        { match_id: "d", date: "2020-01-02", competition_id: "c", team_id: "x", appeared: true, score_for: 2, score_against: 2, notes: null },
        { match_id: "a", date: "2020-01-03", competition_id: "c", team_id: "x", appeared: true, score_for: 3, score_against: 0, notes: "Awarded 3-0; played 1-2 on the pitch." },
      ],
      goals: [
        { goal_id: "w1", match_id: "w", score_after: "1-1" }, // equaliser
        { goal_id: "w2", match_id: "w", score_after: "2-1" }, // winner (against 1 + 1)
        { goal_id: "w3", match_id: "w", score_after: "3-1" },
        { goal_id: "d1", match_id: "d", score_after: "2-2" }, // equaliser, no winner in a draw
        { goal_id: "a1", match_id: "a", score_after: "1-0" }, // awarded result: never a winner
      ],
    },
  };
  assert.deepEqual(s.winningGoals(t).map((g) => g.goal_id), ["w2"]);
  assert.deepEqual(s.equalisers(t).map((g) => g.goal_id), ["w1", "d1"]);
});

test("stageClass normalises stage labels", () => {
  assert.equal(s.stageClass("Final"), "final");
  assert.equal(s.stageClass("Semi-final 2nd leg"), "semi_final");
  assert.equal(s.stageClass("Qualifying round 3 1st leg"), "qualifying");
  assert.equal(s.stageClass("Group E, matchday 2"), "group_or_league");
  assert.equal(s.stageClass(null), "unknown");
});
