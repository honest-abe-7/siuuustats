#!/usr/bin/env node
// Builds Portugal (senior) rows of data/matches.csv and data/goals.csv from the raw snapshots:
//   - RSSSF cap list               -> one match per cap (date, opponent, score, competition, shootout)
//   - martj42 results.csv (CC0)    -> canonical team names, venue (home/away/neutral), city, tournament
//   - data/manual/international-appearances-extra.csv -> documented caps missing from RSSSF
//   - Wikipedia goals list (CC BY-SA) -> one goal per row (cap, date, score after goal, penalty flag)
//   - martj42 goalscorers.csv (CC0)  -> minute, penalty flag and assister for competitive goals
// Offline: reads data/raw/ only. Refresh snapshots first with `npm run snapshots:refresh`.
// Usage: npm run ingest:intl
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadRegistry } from "../lib/ledger.mjs";
import { readCsv, writeCsv } from "../lib/csv.mjs";
import { parseWikiList, parseRsssf, loadMartj42 } from "../lib/sources-raw.mjs";

const TEAM = "portugal";
const issues = [];
const issue = (kind, detail) => issues.push({ kind, ...detail });

export const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const M42_TOURNAMENT = {
  Friendly: "international-friendly",
  "FIFA World Cup": "fifa-world-cup",
  "FIFA World Cup qualification": "fifa-world-cup-qualification",
  "UEFA Euro": "uefa-euro",
  "UEFA Euro qualification": "uefa-euro-qualification",
  "UEFA Nations League": "uefa-nations-league",
  "Confederations Cup": "fifa-confederations-cup",
};
const RSSSF_COMP = {
  Friendly: "international-friendly",
  "World Cup": "fifa-world-cup",
  "World Cup Qualifier": "fifa-world-cup-qualification",
  "European Champ.": "uefa-euro",
  "European Champ": "uefa-euro",
  "European Ch. Qual.": "uefa-euro-qualification",
  "Nations League": "uefa-nations-league",
  "Confederations Cup": "fifa-confederations-cup",
};
export function wikiCompetitionId(text) {
  if (/World Cup qualification/.test(text)) return "fifa-world-cup-qualification";
  if (/FIFA World Cup$/.test(text)) return "fifa-world-cup";
  if (/UEFA Euro \d{4} qualifying/.test(text)) return "uefa-euro-qualification";
  if (/UEFA Euro \d{4}$/.test(text)) return "uefa-euro";
  if (/Nations League/.test(text)) return "uefa-nations-league";
  if (/Confederations Cup/.test(text)) return "fifa-confederations-cup";
  if (/^Friendly$/.test(text)) return "international-friendly";
  return null;
}

const wiki = parseWikiList();
const rsssf = parseRsssf();
const m42 = loadMartj42();
const extras = readCsv(join(ROOT, "data/manual/international-appearances-extra.csv")).rows;

// ---- documented corrections to source data (data/manual/corrections.csv) ----
const corrections = readCsv(join(ROOT, "data/manual/corrections.csv")).rows;
const applied = [];
function applyCorrection(row, sourceId, targetKey, targetValue, field, toTyped) {
  const c = corrections.find((x) => x.source_id === sourceId && x.target === `${targetKey}=${targetValue}` && x.field === field);
  if (!c) return;
  const current = String(row[field]);
  if (current !== c.from_value) {
    issue("correction-stale", { correction_id: c.correction_id, expected_from: c.from_value, found: current });
    return;
  }
  row[field] = toTyped(c.to_value);
  applied.push(c.correction_id);
}
for (const c of rsssf.caps) applyCorrection(c, "rsssf-cronaldo-intlg", "cap", c.cap, "date", String);
for (const g of wiki.goals) applyCorrection(g, "wikipedia-cr7-intl-goals", "goal_no", g.no, "penalty", (v) => v === "true");
const appliedFor = (pred) => corrections.filter((c) => applied.includes(c.correction_id) && pred(c));

const m42ByDate = new Map();
for (const r of m42.results) {
  if (!m42ByDate.has(r.date)) m42ByDate.set(r.date, []);
  m42ByDate.get(r.date).push(r);
}
function m42Match(date, opponentHint) {
  const rows = (m42ByDate.get(date) || []).filter((r) => r.home_team === "Portugal" || r.away_team === "Portugal");
  if (rows.length === 1) return rows[0];
  if (rows.length > 1 && opponentHint) return rows.find((r) => r.home_team === opponentHint || r.away_team === opponentHint) ?? null;
  return null;
}

// ---- matches -------------------------------------------------------------
const teamNames = new Map(); // team_id -> name
const matches = [];
const capInputs = [
  ...rsssf.caps.map((c) => ({ ...c, origin: "rsssf" })),
  ...extras.map((e) => ({ cap: Number(e.cap_number), date: e.date, opponent: e.opponent, origin: "manual", extraSources: e.source_ids.split(";") })),
].sort((a, b) => a.cap - b.cap);

for (const c of capInputs) {
  const r = m42Match(c.date, c.origin === "manual" ? c.opponent : null);
  if (!r) {
    issue("match-not-in-martj42", { cap: c.cap, date: c.date, opponent: c.opponent });
    continue;
  }
  const home = r.home_team === "Portugal";
  const opponent = home ? r.away_team : r.home_team;
  const sf = Number(home ? r.home_score : r.away_score);
  const sa = Number(home ? r.away_score : r.home_score);
  const competition_id = M42_TOURNAMENT[r.tournament];
  if (!competition_id) issue("unknown-tournament", { cap: c.cap, tournament: r.tournament });
  if (c.origin === "rsssf") {
    if (c.scoreFor !== sf || c.scoreAgainst !== sa)
      issue("score-mismatch-rsssf-vs-martj42", { cap: c.cap, date: c.date, rsssf: `${c.scoreFor}-${c.scoreAgainst}`, martj42: `${sf}-${sa}` });
    if (RSSSF_COMP[c.competition] !== competition_id)
      issue("competition-mismatch-rsssf-vs-martj42", { cap: c.cap, date: c.date, rsssf: c.competition, martj42: r.tournament });
  }
  const shootoutText = c.footnote ? rsssf.footnotes[c.footnote] ?? null : null;
  const so = m42.shootouts.find((s) => s.date === c.date && (s.home_team === "Portugal" || s.away_team === "Portugal"));
  if (Boolean(so) !== Boolean(shootoutText)) issue("shootout-presence-mismatch", { cap: c.cap, date: c.date, rsssf: shootoutText, martj42: so?.winner ?? null });
  else if (so && (so.winner === "Portugal") !== shootoutText.startsWith("won"))
    issue("shootout-winner-mismatch", { cap: c.cap, date: c.date, rsssf: shootoutText, martj42: so.winner });

  const opponent_id = slug(opponent);
  teamNames.set(opponent_id, opponent);
  const source_ids =
    c.origin === "rsssf" ? ["rsssf-cronaldo-intlg", "martj42-results"] : [...new Set([...c.extraSources, "martj42-results"])];
  for (const corr of appliedFor((x) => x.target === `cap=${c.cap}`)) source_ids.push(...corr.evidence_source_ids.split(";"));
  if (shootoutText) source_ids.push("martj42-shootouts");
  matches.push({
    match_id: `${c.date}-${TEAM}-${opponent_id}`,
    date: c.date,
    season: c.date.slice(0, 4),
    competition_id,
    stage: null,
    team_id: TEAM,
    opponent_id,
    venue: r.neutral === "TRUE" ? "neutral" : home ? "home" : "away",
    city: r.city || null,
    country: r.country || null,
    score_for: sf,
    score_against: sa,
    extra_time: c.origin === "rsssf" ? Boolean(c.aet || shootoutText) : null,
    shootout: shootoutText,
    appeared: true,
    started: null,
    minutes: null,
    captain: null,
    cap_number: c.cap,
    source_ids: [...new Set(source_ids)],
    _rsssfGoals: c.origin === "rsssf" ? c.goals : null,
  });
}
const matchByCap = new Map(matches.map((m) => [m.cap_number, m]));

// ---- goals -----------------------------------------------------------------
const goals = [];
const wikiByCap = new Map();
for (const g of wiki.goals) {
  if (!wikiByCap.has(g.cap)) wikiByCap.set(g.cap, []);
  wikiByCap.get(g.cap).push(g);
}
let enriched = 0;
for (const [cap, list] of [...wikiByCap.entries()].sort((a, b) => a[0] - b[0])) {
  list.sort((a, b) => a.no - b.no);
  const m = matchByCap.get(cap);
  if (!m) {
    issue("goal-cap-without-match", { cap, wikiNos: list.map((g) => g.no) });
    continue;
  }
  if (list[0].date !== m.date) issue("goal-date-mismatch-wikipedia-vs-match", { cap, wikipedia: list[0].date, match: m.date });
  if (list[0].result !== `${m.score_for}-${m.score_against}`)
    issue("result-mismatch-wikipedia-vs-match", { cap, date: m.date, wikipedia: list[0].result, match: `${m.score_for}-${m.score_against}` });
  if (wikiCompetitionId(list[0].competition) !== m.competition_id)
    issue("competition-mismatch-wikipedia-vs-match", { cap, date: m.date, wikipedia: list[0].competition, match: m.competition_id });
  if (m._rsssfGoals !== null && m._rsssfGoals !== list.length)
    issue("goals-in-match-mismatch-wikipedia-vs-rsssf", { cap, date: m.date, wikipedia: list.length, rsssf: m._rsssfGoals });

  const m42Rows = m42.goals.filter((r) => r.date === m.date && (r.home_team === "Portugal" || r.away_team === "Portugal"));
  const crRows = m42Rows
    .map((r, i) => ({ ...r, _i: i }))
    .filter((r) => r.scorer === "Cristiano Ronaldo" && r.own_goal !== "TRUE")
    .sort((a, b) => Number(a.minute) - Number(b.minute) || a._i - b._i);
  const usable = crRows.length === list.length;
  if (crRows.length && !usable) issue("martj42-goal-count-differs", { cap, date: m.date, wikipedia: list.length, martj42: crRows.length });

  list.forEach((g, i) => {
    const e = usable ? crRows[i] : null;
    const source_ids = ["wikipedia-cr7-intl-goals"];
    for (const corr of appliedFor((x) => x.target === `goal_no=${g.no}`)) source_ids.push(...corr.evidence_source_ids.split(";"));
    let minute = null;
    let assist = null;
    if (e) {
      enriched++;
      if (!source_ids.includes("martj42-goalscorers")) source_ids.push("martj42-goalscorers");
      minute = /^\d+$/.test(e.minute) ? Number(e.minute) : null;
      assist = e.assist && e.assist !== "NA" ? e.assist : null;
      if ((e.penalty === "TRUE") !== g.penalty)
        issue("penalty-flag-mismatch", { cap, date: m.date, wikiNo: g.no, wikipedia: g.penalty, martj42: e.penalty === "TRUE", minute });
      const before = m42Rows.filter((r, j) => r.team === "Portugal" && (Number(r.minute) < Number(e.minute) || (Number(r.minute) === Number(e.minute) && j <= e._i))).length;
      const wikiFor = Number(g.score.split("-")[0]);
      if (before !== wikiFor) issue("score-progression-mismatch", { cap, date: m.date, wikiNo: g.no, wikipediaScore: g.score, martj42PortugalGoalsSoFar: before, minute });
    }
    goals.push({
      goal_id: `${m.match_id}-g${i + 1}`,
      match_id: m.match_id,
      team_id: TEAM,
      minute,
      added_time: null,
      method: g.penalty ? "penalty" : "non_penalty_unspecified",
      body_part: null,
      location: null,
      assist_player: assist,
      assist_type: assist ? "source_unspecified" : null,
      score_after: g.score,
      intl_goal_no: g.no,
      source_ids: [...new Set(source_ids)],
      verified_by: null,
      verified_at: null,
    });
  });
  if (!m.source_ids.includes("wikipedia-cr7-intl-goals")) m.source_ids.push("wikipedia-cr7-intl-goals");
}

// ---- write -------------------------------------------------------------------
const reg = loadRegistry();
const cols = (n) => reg.tables.find((t) => t.name === n).columns;
const keepOther = (file, pred) => (existsSync(join(ROOT, file)) ? readCsv(join(ROOT, file)).rows.filter(pred) : []);

const teamsExisting = readCsv(join(ROOT, "data/teams.csv")).rows;
const known = new Set(teamsExisting.map((t) => t.team_id));
const newTeams = [...teamNames.entries()]
  .filter(([id]) => !known.has(id))
  .map(([team_id, name]) => ({ team_id, name, kind: "national", country: name, confederation: null, wikidata_id: null }));
writeCsv(
  join(ROOT, "data/teams.csv"),
  cols("teams"),
  [...teamsExisting, ...newTeams].sort((a, b) => (a.team_id === TEAM ? -1 : b.team_id === TEAM ? 1 : a.team_id.localeCompare(b.team_id)))
);

const otherMatches = keepOther("data/matches.csv", (r) => r.team_id !== TEAM);
writeCsv(join(ROOT, "data/matches.csv"), cols("matches"), [...otherMatches, ...matches].sort((a, b) => a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id)));
const otherGoals = keepOther("data/goals.csv", (r) => r.team_id !== TEAM);
writeCsv(join(ROOT, "data/goals.csv"), cols("goals"), [...otherGoals, ...goals].sort((a, b) => a.goal_id.localeCompare(b.goal_id, "en", { numeric: true })));

mkdirSync(join(ROOT, "reports"), { recursive: true });
const report = {
  generated_at: new Date().toISOString(),
  matches: matches.length,
  goals: goals.length,
  goals_enriched_from_martj42: enriched,
  new_teams: newTeams.length,
  corrections_applied: applied,
  issues,
};
writeFileSync(join(ROOT, "reports/ingest-international.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`International ingest: ${matches.length} matches, ${goals.length} goals (${enriched} enriched from martj42), ${newTeams.length} new teams.`);
console.log(`Corrections applied: ${applied.join(", ") || "none"}`);
console.log(`${issues.length} source disagreement(s) logged to reports/ingest-international.json`);
for (const i of issues) console.log("  -", JSON.stringify(i));
