// martj42/international_results (CC0) Portugal snapshot: row counts and new-match detection.
import { parse } from "csv-parse/sync";

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
