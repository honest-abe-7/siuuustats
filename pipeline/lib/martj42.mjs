// martj42/international_results (CC0): filtering, header validation, new-match detection.
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export const EXPECTED_COLUMNS = {
  "results.csv": ["date", "home_team", "away_team", "home_score", "away_score", "tournament", "city", "country", "neutral"],
  "goalscorers.csv": ["date", "home_team", "away_team", "team", "scorer", "minute", "own_goal", "penalty"],
  "shootouts.csv": ["date", "home_team", "away_team", "winner"],
};

/** Keep the header plus rows where Portugal is home or away (same output as scripts/ingest/fetch-snapshots.mjs). */
export function portugalOnly(csvText, file = "results.csv", team = "Portugal") {
  const records = parse(csvText, { bom: true });
  if (records.length < 2) throw new Error(`martj42 ${file}: empty CSV`);
  const [header, ...rows] = records;
  const missing = (EXPECTED_COLUMNS[file] ?? []).filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`martj42 ${file}: missing columns ${missing.join(", ")}`);
  const h = header.indexOf("home_team");
  const a = header.indexOf("away_team");
  const kept = rows.filter((r) => r[h] === team || r[a] === team);
  if (kept.length === 0) throw new Error(`martj42 ${file}: no ${team} rows`);
  return stringify([header, ...kept]);
}

/** Count data rows in a CSV text. */
export const rowCount = (csvText) => Math.max(0, parse(csvText, { bom: true }).length - 1);

/**
 * Portugal matches in martj42 results that are newer than the latest ledger match for `teamId`
 * and not in the ledger. These are matches to check (did Ronaldo play?).
 * @param {string} resultsCsv Portugal-filtered results.csv text
 * @param {{date:string, team_id:string}[]} ledgerMatches
 */
export function newPortugalMatches(resultsCsv, ledgerMatches, { teamId = "portugal", team = "Portugal", today } = {}) {
  const ours = ledgerMatches.filter((m) => m.team_id === teamId);
  const latest = ours.reduce((d, m) => (m.date > d ? m.date : d), "");
  const known = new Set(ours.map((m) => m.date));
  const rows = parse(resultsCsv, { bom: true, columns: true });
  return rows
    .filter((r) => r.home_team === team || r.away_team === team)
    .filter((r) => r.date > latest && !known.has(r.date) && (!today || r.date <= today))
    .filter((r) => r.home_score !== "NA" && r.home_score !== "" && r.away_score !== "NA" && r.away_score !== "")
    .map((r) => {
      const home = r.home_team === team;
      return {
        key: `${r.date}-${teamId}`,
        team_id: teamId,
        date: r.date,
        home_team: r.home_team,
        away_team: r.away_team,
        opponent: home ? r.away_team : r.home_team,
        score: `${r.home_score}-${r.away_score}`,
        competition: r.tournament,
        source: "martj42-results",
      };
    });
}
