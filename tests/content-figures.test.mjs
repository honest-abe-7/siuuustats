// Every ledger-derivable figure stated in docs/content/*.md, checked against the /api/v1 file a frontend would read.
// If a write-up changes a number, change it here too (and vice versa). Figures that cannot be derived from the
// ledger (cited-only claims) are listed in CONTRACTS.md §6 "Content figures not in the API".
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import { buildApi } from "../scripts/build-api.mjs";

const api = buildApi(loadLedger(), "2026-10-22T00:00:00.000Z");
const d = (f) => api[f].data;
const S = d("summary.json");
const goals = d("goals.json");
const comp = (scope, id) => d("goals-by-competition.json").find((r) => r.scope === scope && r.competition_id === id) ?? { apps: 0, goals: 0 };
const season = (team, s, c) => d("goals-by-season.json").find((r) => r.team_id === team && r.season === s && r.competition_id === c);
const cst = (team, s) => d("club-season-totals.json").find((r) => r.team_id === team && r.season === s);
const club = (t) => d("goals-by-club.json").find((r) => r.team_id === t);
const clutch = (scope) => d("clutch.json").find((r) => r.scope === scope);
const band = (scope, b) => d("goals-by-age-band.json").bands.find((r) => r.scope === scope && r.band === b);
const from = (scope, age) => d("goals-by-age-band.json").thresholds.find((r) => r.scope === scope && r.from_age === age);
const ms = (k) => d("milestones.json").find((r) => r.key === k);
const nt = d("national-teams.json");
const ntGoals = (id) => (nt.scored.find((r) => r.opponent_id === id) ?? nt.never_scored.find((r) => r.opponent_id === id)).goals;
const co = d("club-opponents.json");
const ucl = d("champions-league.json");
const stage = (s) => ucl.by_stage.find((r) => r.stage_class === s);
const onDate = (date) => goals.filter((g) => g.date === date);
const rec = (id) => d("records.json").find((r) => r.record_id === id);
const leagueTotal = (team, c) => d("goals-by-season.json").filter((r) => r.team_id === team && r.competition_id === c).reduce((a, r) => ({ apps: a.apps + r.apps, goals: a.goals + r.goals }), { apps: 0, goals: 0 });

test("headline totals (all pages)", () => {
  assert.equal(S.career.goals, 981);
  assert.equal(S.career.apps, 1341);
  assert.equal(S.club.apps, 1107);
  assert.equal(S.club.goals, 835);
  assert.equal(S.international.caps, 234);
  assert.equal(S.international.goals, 146);
  assert.equal(S.career.goals_per_game, 0.73);
  assert.equal(S.international.goals_per_game, 0.62);
  assert.equal(1000 - S.career.goals, 19);
});

test("myths: penalties, free kicks, non-FIFA", () => {
  assert.equal(S.career.penalty_goals, 184);
  assert.equal(S.career.non_penalty_goals, 797);
  assert.equal(Math.round((S.career.non_penalty_goals / S.career.goals) * 100), 81);
  assert.equal(S.international.penalty_goals, 23);
  assert.equal(S.international.goals - S.international.penalty_goals, 123);
  assert.equal(ucl.penalty_goals, 19);
  assert.equal(ucl.non_penalty_goals, 121);
  assert.equal(S.career.free_kick_goals, 55);
  assert.equal(d("body-parts.json").find((r) => r.scope === "club").known, 563);
  assert.equal(S.career.goals_excluding_non_fifa, 975);
  assert.equal(S.club.goals_excluding_non_fifa, 829);
  assert.equal(comp("club", "arab-club-champions-cup").goals, 6);
  assert.equal(S.career.goals - club("al-nassr").goals, 847);
});

test("myths: international opponents and competitions", () => {
  for (const [id, n] of Object.entries({ luxembourg: 11, hungary: 9, sweden: 7, armenia: 7, lithuania: 7, spain: 4, netherlands: 4, belgium: 3, croatia: 3, france: 2, germany: 2, argentina: 1, brazil: 0, england: 0, italy: 0 }))
    assert.equal(ntGoals(id), n, id);
  for (const [id, caps] of Object.entries({ brazil: 3, england: 3, italy: 2 })) assert.equal(nt.never_scored.find((r) => r.opponent_id === id).caps, caps, id);
  assert.equal(S.international.competitive.goals, 124);
  assert.equal(S.international.friendly.goals, 22);
  assert.equal(comp("international", "uefa-euro").goals, 14);
  assert.equal(comp("international", "fifa-world-cup").goals, 11);
  assert.equal(comp("international", "uefa-nations-league").goals, 15);
  assert.equal(comp("international", "fifa-confederations-cup").goals, 2);
  assert.equal(rec("most-goals-euro-finals").computed_value, "14");
  assert.equal(rec("most-goals-world-cup-qualifying").computed_value, "41");
  assert.equal(nt.scored_against, 49);
  assert.equal(nt.scored.at(-1).opponent_id, "uzbekistan");
  assert.equal(nt.scored.at(-1).first_goal, "2026-06-23");
  assert.equal(S.international.hat_tricks, 10);
  assert.deepEqual(S.international.record, { played: 234, won: 142, drawn: 54, lost: 38 });
});

test("myths: club opponents, Clásico, derby, Champions League opponents", () => {
  const top = co.top_club_opponents.slice(0, 5).map((r) => [r.opponent_id, r.apps, r.goals]);
  assert.deepEqual(top, [["sevilla", 18, 27], ["atletico-madrid", 37, 25], ["getafe", 14, 23], ["barcelona", 34, 20], ["celta-vigo", 13, 20]]);
  assert.deepEqual(co.el_clasico.for_real_madrid, { apps: 30, goals: 18 });
  assert.deepEqual(co.el_clasico.all_clubs, { apps: 34, goals: 20 });
  assert.deepEqual(onDate("2020-12-08").map((g) => [g.opponent_id, g.method]), [["barcelona", "penalty"], ["barcelona", "penalty"]]);
  assert.deepEqual(co.madrid_derby.for_real_madrid, { apps: 31, goals: 22 });
  const cl = (id) => co.champions_league_opponents.find((r) => r.opponent_id === id);
  assert.equal(cl("juventus").goals, 10);
  assert.equal(co.champions_league_opponents[0].opponent_id, "juventus");
  assert.deepEqual([cl("bayern-munich").apps, cl("bayern-munich").goals], [8, 9]);
  assert.equal(comp("club", "la-liga").goals, 311);
});

test("Champions League: totals, stages, finals, milestones", () => {
  assert.deepEqual([ucl.goals, ucl.apps], [140, 183]);
  assert.deepEqual([ucl.incl_qualifying.goals, ucl.incl_qualifying.apps], [141, 187]);
  assert.deepEqual([stage("group_or_league").goals], [73]);
  assert.deepEqual([stage("round_of_16").apps, stage("round_of_16").goals], [36, 25]);
  assert.deepEqual([stage("quarter_final").apps, stage("quarter_final").goals], [22, 25]);
  assert.deepEqual([stage("semi_final").apps, stage("semi_final").goals], [21, 13]);
  assert.deepEqual([stage("final").apps, stage("final").goals, stage("final").matches_scored_in], [6, 4, 3]);
  assert.deepEqual([ucl.knockout.apps, ucl.knockout.goals], [85, 67]);
  assert.equal(onDate("2008-05-21").length, 1);
  assert.equal(onDate("2009-05-27").length, 0);
  assert.deepEqual(onDate("2014-05-24").map((g) => [g.minute, g.method]), [[120, "penalty"]]);
  assert.equal(onDate("2017-06-03").length, 2);
  assert.equal(onDate("2018-05-26").length, 0);
  assert.equal(onDate("2016-04-12").length, 3);
  assert.equal(onDate("2017-04-12").length, 2);
  assert.equal(onDate("2017-04-18").length, 3);
  assert.equal(onDate("2017-05-02").length, 3);
  assert.equal(onDate("2018-04-03").length, 2);
  assert.equal(onDate("2019-03-12").length, 3);
  assert.equal(ms("ucl-goal-100").date, "2017-04-18");
  assert.equal(d("awards.json").filter((a) => a.award_id.startsWith("ucl-top-scorer-")).length, 7);
});

test("big games: club finals and named finals", () => {
  const f = d("big-games.json").find((r) => r.scope === "club" && r.stage_class === "final");
  assert.deepEqual([f.apps, f.goals, f.matches_scored_in, f.apps - f.matches_scored_in], [37, 24, 19, 18]);
  assert.deepEqual(onDate("2004-05-22").map((g) => [g.opponent_id, g.score_after]), [["millwall", "1-0"]]);
  assert.deepEqual(onDate("2006-02-26").map((g) => g.score_after), ["3-0"]);
  assert.deepEqual(onDate("2011-04-20").map((g) => [g.opponent_id, g.body_part, g.winning_goal, g.minute > 90]), [["barcelona", "head", true, true]]);
  assert.equal(onDate("2014-08-12").length, 2);
  assert.deepEqual(onDate("2016-12-18").map((g) => [g.minute, g.method, g.score_after]), [[60, "penalty", "2-2"], [97, "non_penalty_unspecified", "3-2"], [104, "non_penalty_unspecified", "4-2"]]);
  assert.deepEqual(onDate("2017-12-16").map((g) => [g.opponent_id, g.result]), [["gremio", "1-0"]]);
  assert.equal(comp("club", "fifa-club-world-cup").goals, 7);
  assert.deepEqual(onDate("2019-01-16").map((g) => [g.opponent_id, g.body_part, g.result]), [["ac-milan", "head", "1-0"]]);
  assert.deepEqual(onDate("2023-08-12").map((g) => g.minute), [74, 98]);
  assert.deepEqual(onDate("2026-05-21").map((g) => [g.opponent_id, g.minute, g.method, g.result]), [["damac", 63, "direct_free_kick", "4-1"], ["damac", 81, "non_penalty_unspecified", "4-1"]]);
});

test("Portugal tournament goals in the write-ups", () => {
  assert.deepEqual(onDate("2004-06-30").map((g) => [g.opponent_id, g.score_after, g.result]), [["netherlands", "1-0", "2-1"]]);
  assert.deepEqual(onDate("2012-06-21").map((g) => [g.minute, g.result, g.winning_goal]), [[79, "1-0", true]]);
  assert.deepEqual(onDate("2016-07-06").map((g) => [g.opponent_id, g.winning_goal]), [["wales", true]]);
  assert.equal(onDate("2013-11-15").length + onDate("2013-11-19").length, 4);
  assert.deepEqual(onDate("2013-11-19").map((g) => g.minute), [50, 77, 79]);
  assert.equal(onDate("2013-11-19").at(-1).score_after, "3-2");
  assert.deepEqual(onDate("2018-06-15").map((g) => [g.minute, g.equaliser]).at(-1), [88, true]);
  assert.equal(onDate("2018-06-15").length, 3);
  assert.deepEqual(onDate("2018-06-20").map((g) => [g.opponent_id, g.result]), [["morocco", "1-0"]]);
  assert.deepEqual(onDate("2019-06-05").map((g) => g.minute), [25, 88, 90]);
  assert.deepEqual(onDate("2025-06-04").map((g) => [g.opponent_id, g.minute, g.winning_goal]), [["germany", 68, true]]);
  assert.deepEqual(onDate("2025-06-08").map((g) => [g.opponent_id, g.equaliser, g.score_after]), [["spain", true, "2-2"]]);
  assert.equal(onDate("2026-06-23").length, 2);
  assert.deepEqual(onDate("2026-07-02").map((g) => [g.opponent_id, g.method]), [["croatia", "penalty"]]);
  assert.equal(goals.filter((g) => g.competition_id === "uefa-euro" && g.date.startsWith("2024")).length, 0);
  // winning goals listed on Big Games
  for (const [date, min] of [["2008-06-11", 63], ["2012-06-17", 74], ["2012-06-21", 79], ["2014-06-26", 80], ["2016-07-06", 50], ["2018-06-20", 4], ["2019-06-05", 88], ["2025-06-04", 68], ["2026-06-23", 6]])
    assert.ok(onDate(date).some((g) => g.minute === min && g.winning_goal), `${date} ${min}'`);
  assert.deepEqual(onDate("2021-09-01").map((g) => [g.minute, g.intl_goal_no]), [[89, 110], [90, 111]]);
  const spainEq = goals.filter((g) => g.scope === "international" && g.opponent_id === "spain" && g.equaliser);
  assert.deepEqual(spainEq.map((g) => [g.date, g.method === "penalty"]), [["2018-06-15", false], ["2025-06-08", false]]);
  const wc = new Set(goals.filter((g) => g.competition_id === "fifa-world-cup").map((g) => g.date.slice(0, 4)));
  assert.deepEqual([...wc], ["2006", "2010", "2014", "2018", "2022", "2026"]);
  const ed = nt.tournament_editions;
  assert.equal(ed.filter((r) => r.competition_id === "fifa-world-cup").length, 6);
  assert.equal(ed.filter((r) => r.competition_id === "uefa-euro").length, 6);
});

test("clutch table (Big Games §5, Myths)", () => {
  const exp = {
    career: [981, 322, 107, 63, 99, 180, 959],
    club: [835, 270, 85, 55, 81, 155, 835],
    international: [146, 52, 22, 8, 18, 25, 124],
  };
  for (const [scope, v] of Object.entries(exp)) {
    const r = clutch(scope);
    assert.deepEqual([r.goals, r.winning_goals, r.winning_goals_in_one_goal_wins, r.winning_goals_penalties, r.equalisers, r.goals_80_plus, r.goals_with_minute], v, scope);
  }
  assert.equal(S.career.winning_goals, 322);
  assert.equal(S.career.equalisers, 99);
});

test("longevity: ages, years, seasons, milestones", () => {
  assert.equal(S.career.goals_from_age_30, 518);
  assert.equal(from("career", 30).goals_before, 463);
  assert.deepEqual([from("career", 35).goals], [259]);
  assert.deepEqual([from("career", 38).goals, from("career", 38).apps], [161, 193]);
  assert.deepEqual([from("career", 40).goals, from("career", 40).apps], [58, 80]);
  assert.deepEqual([from("international", 30).goals, from("international", 35).goals], [94, 47]);
  assert.deepEqual([from("international", 38).goals, from("international", 38).apps], [28, 38]);
  const bands = { career: [[17, 24, 407, 160, 0.39], [25, 29, 311, 303, 0.97], [30, 34, 277, 259, 0.94], [35, 41, 346, 259, 0.75]], international: [[18, 24, 68, 22, 0.32], [25, 29, 50, 30, 0.6], [30, 34, 46, 47, 1.02], [35, 41, 70, 47, 0.67]] };
  for (const [scope, rows] of Object.entries(bands))
    ["under_25", "25_29", "30_34", "35_plus"].forEach((b, i) => {
      const r = band(scope, b);
      assert.deepEqual([r.min_age, r.max_age, r.apps, r.goals, r.goals_per_game], rows[i], `${scope} ${b}`);
    });
  const st = d("season-totals.json");
  assert.deepEqual(st.scoring_years.career, { from: 2002, to: 2026, years: 25 });
  assert.deepEqual(st.scoring_years.international, { from: 2004, to: 2026, years: 23 });
  const y2023 = st.by_year.find((r) => r.year === "2023");
  assert.deepEqual([y2023.goals, y2023.apps], [54, 59]);
  assert.equal(ms("first-senior-match").date, "2002-08-14");
  assert.equal(ms("first-senior-match").age, 17);
  assert.deepEqual([ms("latest-goal").date, ms("latest-goal").opponent_id, ms("latest-goal").age], ["2026-10-12", "neftchi-fergana", 41]);
  assert.deepEqual([ms("first-international-goal").date, ms("first-international-goal").opponent_id, ms("first-international-goal").age], ["2004-06-12", "greece", 19]);
  assert.deepEqual([ms("latest-international-goal").date, ms("latest-international-goal").opponent_id, ms("latest-international-goal").age], ["2026-07-02", "croatia", 41]);
  assert.deepEqual([S.international.first_cap, S.international.last_cap], ["2003-08-20", "2026-09-24"]);
  assert.equal(ms("goals-from-30-500").date, "2026-02-21");
  assert.equal(goals.filter((g) => g.age >= 30 && g.date <= "2026-02-21").length, 501);
  const clubSeasons = [["real-madrid", "2015-16", 51], ["real-madrid", "2016-17", 42], ["real-madrid", "2017-18", 44], ["juventus", "2018-19", 28], ["juventus", "2019-20", 37], ["juventus", "2020-21", 36], ["manchester-united", "2021-22", 24], ["manchester-united", "2022-23", 3], ["al-nassr", "2022-23", 14], ["al-nassr", "2023-24", 50], ["al-nassr", "2024-25", 35], ["al-nassr", "2025-26", 30], ["al-nassr", "2026-27", 5]];
  for (const [t, s, g] of clubSeasons) assert.equal(cst(t, s).goals, g, `${t} ${s}`);
  assert.deepEqual([season("juventus", "2020-21", "serie-a").goals], [29]);
  assert.deepEqual([season("al-nassr", "2023-24", "saudi-pro-league").goals, season("al-nassr", "2023-24", "saudi-pro-league").apps], [35, 31]);
  assert.equal(season("al-nassr", "2025-26", "saudi-pro-league").goals, 28);
});

test("proven in every league: per-country table and season facts", () => {
  const table = { "sporting-cp": ["primeira-liga", 25, 3, 31, 5], "manchester-united": ["premier-league", 236, 103, 346, 145], "real-madrid": ["la-liga", 292, 311, 438, 450], juventus: ["serie-a", 98, 81, 134, 101], "al-nassr": ["saudi-pro-league", 115, 106, 158, 134] };
  for (const [t, [c, la, lg, a, g]] of Object.entries(table)) {
    const l = leagueTotal(t, c);
    assert.deepEqual([l.apps, l.goals, club(t).apps, club(t).goals], [la, lg, a, g], t);
  }
  const spell = (from_, to) => d("goals-by-season.json").filter((r) => r.team_id === "manchester-united" && r.competition_id === "premier-league" && r.season >= from_ && r.season <= to).reduce((a, r) => [a[0] + r.apps, a[1] + r.goals], [0, 0]);
  assert.deepEqual(spell("2003-04", "2008-09"), [196, 84]);
  assert.deepEqual(spell("2021-22", "2022-23"), [40, 19]);
  assert.deepEqual([season("manchester-united", "2007-08", "premier-league").goals, season("manchester-united", "2007-08", "premier-league").apps], [31, 34]);
  assert.deepEqual([cst("manchester-united", "2021-22").goals, season("manchester-united", "2021-22", "premier-league").goals], [24, 18]);
  assert.equal(season("real-madrid", "2010-11", "la-liga").goals, 40);
  assert.equal(season("real-madrid", "2014-15", "la-liga").goals, 48);
  const liga30 = ["2010-11", "2011-12", "2012-13", "2013-14", "2014-15", "2015-16"].every((s) => season("real-madrid", s, "la-liga").goals >= 30);
  assert.ok(liga30, "30+ La Liga goals in six consecutive seasons");
  assert.deepEqual([ms("la-liga-goal-300").date, ms("la-liga-goal-300").apps_to_date], ["2018-03-03", 286]);
  assert.deepEqual([season("juventus", "2020-21", "serie-a").goals, season("juventus", "2020-21", "serie-a").apps], [29, 33]);
  assert.equal(ms("first-match-al-nassr").date, "2023-01-22");
  assert.equal(ms("club-goal-100-al-nassr").date, "2025-08-23");
  for (const t of ["manchester-united", "real-madrid", "juventus", "al-nassr"]) assert.ok(club(t).goals >= 100, t);
  assert.deepEqual(onDate("2002-10-07").map((g) => g.opponent_id), ["moreirense", "moreirense"]);
  assert.equal(ms("first-goal").date, "2002-10-07");
  assert.deepEqual([season("sporting-cp", "2002-03", "taca-de-portugal").goals], [2]);
  // "15 goals in 19 AFC Champions League matches" = the top-tier competition only (ACL Two: 1 goal in 4, not included).
  assert.deepEqual([comp("club", "afc-champions-league").goals, comp("club", "afc-champions-league").apps], [15, 19]);
  const h = S.honours;
  assert.equal(h.league_titles, 8);
  assert.deepEqual(h.trophies_by_team.portugal, 3);
});
