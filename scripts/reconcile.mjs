#!/usr/bin/env node
// Reconciliation: compares ledger-derived totals with values read from the raw source snapshots
// and with pinned expectations. Writes reports/reconciliation.json.
// Status per check: pass | known_difference | fail. Exit code 1 if any fail.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadLedger } from "./lib/ledger.mjs";
import * as stats from "./lib/stats.mjs";
import { parseWikiList, parseWikiArticle, parseRsssf, loadMartj42 } from "./lib/sources-raw.mjs";

const WIKI_COMP = {
  "UEFA European Championship qualifying": "uefa-euro-qualification",
  "FIFA World Cup qualification": "fifa-world-cup-qualification",
  Friendlies: "international-friendly",
  "UEFA European Championship": "uefa-euro",
  "UEFA Nations League": "uefa-nations-league",
  "FIFA World Cup": "fifa-world-cup",
  "FIFA Confederations Cup": "fifa-confederations-cup",
};

export function runReconciliation(root = ROOT, ledger = loadLedger(root)) {
  const checks = [];
  const known = JSON.parse(readFileSync(join(root, "data/reconciliation/known-differences.json"), "utf8")).differences;
  const add = (check, source_id, expected, actual, description) => {
    const same = JSON.stringify(expected) === JSON.stringify(actual);
    const k = !same && known.find((d) => d.check === check && JSON.stringify(d.expected) === JSON.stringify(expected) && JSON.stringify(d.actual) === JSON.stringify(actual));
    checks.push({ check, source_id, description, expected, actual, status: same ? "pass" : k ? "known_difference" : "fail", note: k ? k.reason : undefined });
  };
  const isPor = (m) => m.team_id === stats.NATIONAL_TEAM;
  const summary = stats.internationalSummary(ledger);

  // 1. pinned expectations
  const exp = JSON.parse(readFileSync(join(root, "data/reconciliation/expectations.json"), "utf8"));
  for (const e of exp.expectations) {
    const [fn, field] = e.fn.split(".");
    const v = field ? stats[fn](ledger)[field] : stats[fn](ledger);
    add(`pinned-${e.id}`, e.source_id, e.expected, v, `Pinned figure ${e.id} (as of ${exp.as_of})`);
  }

  // 2. Wikipedia list page
  const wl = parseWikiList(root);
  add("wikipedia-list-goal-rows", "wikipedia-cr7-intl-goals", wl.goals.length, summary.goals, "Rows in Wikipedia's senior goals table vs ledger goals");
  add("wikipedia-list-total-caps", "wikipedia-cr7-intl-goals", wl.totals.caps, summary.caps, "By-competition table total caps");
  add("wikipedia-list-total-goals", "wikipedia-cr7-intl-goals", wl.totals.goals, summary.goals, "By-competition table total goals");
  add("wikipedia-list-competitive-goals", "wikipedia-cr7-intl-goals", wl.totals.competitiveGoals, summary.competitive.goals, "By-year table competitive goals");
  add("wikipedia-list-friendly-caps", "wikipedia-cr7-intl-goals", wl.totals.friendlyApps, summary.friendly.caps, "By-year table friendly apps");
  const byComp = new Map(stats.splitBy(ledger, (m) => m.competition_id, isPor).map((r) => [r.key, r]));
  for (const c of wl.byCompetition) {
    const id = WIKI_COMP[c.name];
    const ours = byComp.get(id) ?? { apps: 0, goals: 0 };
    add(`wikipedia-by-competition:${id ?? c.name}`, "wikipedia-cr7-intl-goals", { caps: c.caps, goals: c.goals }, { caps: ours.apps, goals: ours.goals }, `Caps and goals in ${c.name}`);
  }
  const yearSplit = (pred) => new Map(stats.splitBy(ledger, (m) => m.season, (m) => isPor(m) && pred(m)).map((r) => [r.key, r]));
  const yAll = yearSplit(() => true);
  const yComp = yearSplit((m) => m.competition_id !== "international-friendly");
  for (const y of wl.byYear) {
    const a = yAll.get(y.year) ?? { apps: 0, goals: 0 };
    const c = yComp.get(y.year) ?? { apps: 0, goals: 0 };
    add(
      `wikipedia-by-year:${y.year}`,
      "wikipedia-cr7-intl-goals",
      { apps: y.totalApps, goals: y.totalGoals, competitiveApps: y.competitiveApps, competitiveGoals: y.competitiveGoals },
      { apps: a.apps, goals: a.goals, competitiveApps: c.apps, competitiveGoals: c.goals },
      `Apps and goals in ${y.year}`
    );
  }
  const ours3 = stats.multiGoalMatches(ledger, 3, isPor).map((h) => `${h.date}:${h.goals}`);
  add("wikipedia-hat-tricks", "wikipedia-cr7-intl-goals", wl.hatTricks.map((h) => `${h.date}:${h.goals}`).sort(), ours3.sort(), "Hat-trick matches (date:goals)");

  // 3. Wikipedia article
  const wa = parseWikiArticle(root);
  add("wikipedia-infobox-caps", "wikipedia-cristiano-ronaldo", wa.infoboxCaps, summary.caps, "Infobox national_caps");
  add("wikipedia-infobox-goals", "wikipedia-cristiano-ronaldo", wa.infoboxGoals, summary.goals, "Infobox national_goals");
  if (wa.leadWins !== null) add("wikipedia-lead-intl-wins", "wikipedia-cristiano-ronaldo", wa.leadWins, summary.record.won, "Lead section: most international victories");

  // 4. martj42 (CC0)
  const m42 = loadMartj42(root);
  const crRows = m42.goals.filter((r) => r.scorer === "Cristiano Ronaldo" && r.own_goal !== "TRUE");
  add("martj42-competitive-goals", "martj42-goalscorers", crRows.length, summary.competitive.goals, "Ronaldo rows in goalscorers.csv (competitive matches only) vs ledger competitive goals");
  const m42PerDate = {};
  for (const r of crRows) m42PerDate[r.date] = (m42PerDate[r.date] ?? 0) + 1;
  const oursPerDate = {};
  for (const g of stats.goalsWithMatch(ledger)) if (g.match && isPor(g.match) && g.match.competition_id !== "international-friendly") oursPerDate[g.match.date] = (oursPerDate[g.match.date] ?? 0) + 1;
  const diffs = [...new Set([...Object.keys(m42PerDate), ...Object.keys(oursPerDate)])].filter((d) => m42PerDate[d] !== oursPerDate[d]).sort();
  add("martj42-goals-per-match", "martj42-goalscorers", [], diffs, "Dates where martj42 and the ledger disagree on Ronaldo's competitive goals");
  const m42pens = crRows.filter((r) => r.penalty === "TRUE").length;
  const ourCompPens = stats.penaltyGoals(ledger, (m) => isPor(m) && m.competition_id !== "international-friendly");
  add("martj42-competitive-penalties", "martj42-goalscorers", m42pens, ourCompPens, "Penalty goals in competitive matches");

  // 5. RSSSF
  const rs = parseRsssf(root);
  add("rsssf-total-caps", "rsssf-cronaldo-intlg", rs.totals?.caps ?? rs.caps.length, summary.caps, "RSSSF total caps");
  add("rsssf-total-goals", "rsssf-cronaldo-intlg", rs.totals?.goals ?? null, summary.goals, "RSSSF total goals");
  const maxCap = Math.max(...rs.caps.map((c) => c.cap));
  if (rs.record) {
    const r = stats.record(ledger, (m) => isPor(m) && m.cap_number <= maxCap);
    add("rsssf-record", "rsssf-cronaldo-intlg", rs.record, { matches: r.played, won: r.won, drawn: r.drawn, lost: r.lost }, `W/D/L over caps 1-${maxCap}`);
  }
  const goalsByCap = {};
  for (const g of stats.goalsWithMatch(ledger)) if (g.match?.cap_number) goalsByCap[g.match.cap_number] = (goalsByCap[g.match.cap_number] ?? 0) + 1;
  const capDiffs = rs.caps.filter((c) => (goalsByCap[c.cap] ?? 0) !== c.goals).map((c) => `cap ${c.cap}: rsssf ${c.goals} vs ledger ${goalsByCap[c.cap] ?? 0}`);
  add("rsssf-goals-per-cap", "rsssf-cronaldo-intlg", [], capDiffs, "Caps where RSSSF and the ledger disagree on goals scored");

  // 6. records.csv values
  for (const rec of ledger.tables.records) {
    if (!rec.compute_fn) continue;
    add(`record-value:${rec.record_id}`, rec.source_ids[0], rec.value, String(stats.evaluateComputeFn(ledger, rec.compute_fn)), `records.csv value for ${rec.title}`);
  }

  const counts = { pass: 0, known_difference: 0, fail: 0 };
  for (const c of checks) counts[c.status]++;
  return { generated_at: new Date().toISOString(), counts, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rep = runReconciliation();
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(join(ROOT, "reports/reconciliation.json"), JSON.stringify(rep, null, 2) + "\n");
  for (const c of rep.checks.filter((c) => c.status !== "pass"))
    console.log(`  [${c.status}] ${c.check}: expected ${JSON.stringify(c.expected)} got ${JSON.stringify(c.actual)}${c.note ? ` (${c.note})` : ""}`);
  console.log(`Reconciliation: ${rep.counts.pass} pass, ${rep.counts.known_difference} known difference(s), ${rep.counts.fail} fail. Report: reports/reconciliation.json`);
  if (rep.counts.fail) process.exit(1);
}
