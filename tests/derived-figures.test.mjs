// M3c derived summary figures. Each figure is recomputed here straight from the CSVs (no stats.mjs) and pinned
// to the value summary.json publishes, so a change to either the ledger or the derivation shows up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readCsv } from "../scripts/lib/csv.mjs";
import { ROOT, loadLedger } from "../scripts/lib/ledger.mjs";
import { buildApi } from "../scripts/build-api.mjs";

const csv = (t) => readCsv(join(ROOT, "data", `${t}.csv`)).rows;
const matches = csv("matches").filter((m) => m.appeared === "true");
const goals = csv("goals");
const trophies = csv("trophies");
const comps = csv("competitions");
const matchById = new Map(csv("matches").map((m) => [m.match_id, m]));
const team = (g) => matchById.get(g.match_id).team_id;
const counted = trophies.filter((t) => t.counted_in_total === "true");

const files = buildApi(loadLedger(), "2026-10-22T00:00:00.000Z");
const S = files["summary.json"].data;
const known = new Set(files["sources.json"].data.map((s) => s.source_id));
const cites = (path) => {
  const ids = S.citations[path];
  assert.ok(Array.isArray(ids) && ids.length > 0, `${path} has no citation`);
  for (const id of ids) assert.ok(known.has(id), `${path} cites unknown ${id}`);
  return ids;
};

test("non-penalty goals and share (career and international)", () => {
  const np = goals.filter((g) => g.method !== "penalty").length;
  assert.equal(S.career.non_penalty_goals, np);
  assert.equal(S.career.non_penalty_share_pct, Math.round((np / goals.length) * 1000) / 10);
  assert.equal(S.career.non_penalty_share_pct, 81.2);
  const intl = goals.filter((g) => team(g) === "portugal");
  const intlNp = intl.filter((g) => g.method !== "penalty").length;
  assert.equal(S.international.non_penalty_goals, intlNp);
  assert.equal(S.international.non_penalty_goals, S.international.goals - S.international.penalty_goals);
  assert.equal(S.international.non_penalty_share_pct, Math.round((intlNp / intl.length) * 1000) / 10);
  for (const p of ["career.non_penalty_goals", "career.non_penalty_share_pct", "international.non_penalty_goals", "international.non_penalty_share_pct"]) cites(p);
});

test("career without Al-Nassr", () => {
  const x = S.career.excluding_al_nassr;
  assert.equal(x.goals, goals.filter((g) => team(g) !== "al-nassr").length);
  assert.equal(x.apps, matches.filter((m) => m.team_id !== "al-nassr").length);
  assert.equal(x.goals, S.career.goals - S.club.clubs.find((c) => c.team_id === "al-nassr").goals);
  cites("career.excluding_al_nassr");
});

test("Manchester United spells (2003-09 and 2021-22): apps, goals, trophies", () => {
  const sp = S.club.manchester_united_spells;
  assert.deepEqual(sp.map((s) => s.spell), ["2003-09", "2021-22"]);
  const mu = matches.filter((m) => m.team_id === "manchester-united");
  const inSpell = (m, s) => m.date >= s.from && m.date <= s.to;
  const muTrophies = trophies.filter((t) => t.team_id === "manchester-united");
  for (const [s, [y0, y1]] of sp.map((s, i) => [s, i === 0 ? [2003, 2008] : [2021, 2022]])) {
    const ms = mu.filter((m) => inSpell(m, s));
    const ids = new Set(ms.map((m) => m.match_id));
    assert.equal(s.apps, ms.length, s.spell);
    assert.equal(s.goals, goals.filter((g) => ids.has(g.match_id)).length, s.spell);
    const tr = muTrophies.filter((t) => Number(t.season.slice(0, 4)) >= y0 && Number(t.season.slice(0, 4)) <= y1);
    assert.equal(s.trophies, tr.filter((t) => t.counted_in_total === "true").length, s.spell);
    assert.equal(s.trophies_incl_not_in_squad, tr.length, s.spell);
    assert.equal(s.by_season.reduce((a, r) => a + r.apps, 0), s.apps);
    assert.ok(s.source_ids.length > 0 && s.source_ids.every((id) => known.has(id)));
    cites(`club.manchester_united_spells.${s.spell}`);
  }
  // Spells partition the club total, and the historical spells are fixed.
  assert.equal(sp[0].apps + sp[1].apps, mu.length);
  assert.equal(sp[0].goals + sp[1].goals, S.club.clubs.find((c) => c.team_id === "manchester-united").goals);
  assert.deepEqual(sp.map((s) => [s.apps, s.goals, s.trophies, s.trophies_incl_not_in_squad]), [[292, 118, 9, 10], [54, 27, 0, 0]]);
  assert.equal(sp[0].trophies + sp[1].trophies, S.honours.trophies_by_team["manchester-united"]);
  cites("club.manchester_united_spells");
});

test("league titles by country, from trophies.csv", () => {
  const country = new Map(comps.filter((c) => c.type === "league").map((c) => [c.competition_id, c.country]));
  const want = {};
  for (const t of counted.filter((t) => country.has(t.competition_id))) want[country.get(t.competition_id)] = (want[country.get(t.competition_id)] ?? 0) + 1;
  const got = S.honours.league_titles_by_country;
  for (const [c, n] of Object.entries(want)) assert.equal(got[c], n, c);
  for (const [c, n] of Object.entries(got)) assert.equal(n, want[c] ?? 0, c);
  assert.deepEqual({ England: got.England, Spain: got.Spain, Italy: got.Italy, "Saudi Arabia": got["Saudi Arabia"], Portugal: got.Portugal }, { England: 3, Spain: 2, Italy: 2, "Saudi Arabia": 1, Portugal: 0 });
  assert.equal(Object.values(got).reduce((a, n) => a + n, 0), S.honours.league_titles);
  cites("honours.league_titles_by_country");
});

test("Real Madrid Champions League and Club World Cup titles", () => {
  const n = (c) => counted.filter((t) => t.team_id === "real-madrid" && t.competition_id === c).length;
  assert.equal(S.honours.real_madrid_titles.champions_league, n("uefa-champions-league"));
  assert.equal(S.honours.real_madrid_titles.club_world_cup, n("fifa-club-world-cup"));
  assert.deepEqual(S.honours.real_madrid_titles, { champions_league: 4, club_world_cup: 3 });
  for (const p of ["honours.real_madrid_titles", "honours.real_madrid_titles.champions_league", "honours.real_madrid_titles.club_world_cup"]) cites(p);
});

test("headers: international body part is not in the ledger, so no headed-goal totals are published", () => {
  const intl = goals.filter((g) => team(g) === "portugal");
  assert.equal(intl.filter((g) => g.body_part).length, 0, "if international body parts are added, publish career/Euro header totals and update this test");
  const bp = files["body-parts.json"].data;
  assert.equal(bp.find((r) => r.scope === "international").unknown, intl.length);
  assert.equal(bp.find((r) => r.scope === "club").head, goals.filter((g) => team(g) !== "portugal" && g.body_part === "head").length);
  assert.equal(S.career.headers, undefined);
});
