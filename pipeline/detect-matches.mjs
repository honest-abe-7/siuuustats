#!/usr/bin/env node
// Detect Al-Nassr / Portugal matches that are not in the ledger yet (online: TheSportsDB free API;
// offline: martj42 Portugal results snapshot). Maintains a persistent review queue in
// pipeline/state/new-match-candidates.json: a candidate stays until the match is in
// data/matches.csv or a human dismisses it in pipeline/config/dismissed-candidates.json.
// Reviewed matches that should become ledger rows (e.g. unused-substitute appeared=false rows) are
// listed in pipeline/config/ledger-additions.json and stay in the queue, marked with the action and a
// suggested row, until the data owner adds them. Nothing here edits the ledger.
//
// Usage: node pipeline/detect-matches.mjs [--root DIR] [--today YYYY-MM-DD] [--offline]
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../scripts/lib/ledger.mjs";
import { readCsv } from "../scripts/lib/csv.mjs";
import { RAW, parseRsssf } from "../scripts/lib/sources-raw.mjs";
import { THESPORTSDB, CANDIDATES_FILE, DISMISSED_FILE, ADDITIONS_FILE, REPORT_DIR } from "./config.mjs";
import { createClient } from "./lib/http.mjs";
import { eventsOf, normalizeEvent, inLedger, plannedRequests, publicUrl } from "./lib/thesportsdb.mjs";
import { newPortugalMatches } from "./lib/martj42.mjs";
import { readIfExists, readJson, writeJson, parseArgs, setGithubOutput } from "./lib/util.mjs";

export async function runDetect({ root = ROOT, client = createClient({ log: (m) => console.warn(m) }), today = new Date().toISOString().slice(0, 10), offline = false, cfg = THESPORTSDB, log = console.log } = {}) {
  const matchesCsv = readCsv(join(root, "data/matches.csv"));
  const ledger = matchesCsv.rows.map((r) => ({ date: r.date, team_id: r.team_id }));
  const teamsPath = join(root, "data/teams.csv");
  const teamName = new Map(readIfExists(teamsPath) === null ? [] : readCsv(teamsPath).rows.map((t) => [t.team_id, t.name]));
  const dismissed = new Set((readJson(join(root, DISMISSED_FILE), { dismissed: [] }).dismissed ?? []).map((d) => d.key));
  const additions = readJson(join(root, ADDITIONS_FILE), { additions: [] }).additions ?? [];
  const additionByKey = new Map(additions.map((a) => [a.key, a]));
  const found = [];
  const notes = [];
  const errors = [];

  // 1) martj42 (complete fixture list for Portugal, home and away).
  const m42 = readIfExists(join(root, RAW.m42results));
  if (m42) found.push(...newPortugalMatches(m42, ledger, { today }));
  else errors.push({ source: "martj42", error: `${RAW.m42results} missing` });

  // 2) TheSportsDB free API (hints; free tier truncates results).
  if (!offline) {
    for (const req of plannedRequests(today, cfg)) {
      try {
        const { json } = await client.getJson(req.url);
        const evs = eventsOf(json);
        const limit = cfg.freeLimits[req.kind];
        if (req.kind === "eventsday" && limit && evs.length >= limit)
          notes.push(`eventsday ${req.day} league ${req.league}: ${evs.length} events returned (free-tier cap ${limit}); other matches that day may be missing.`);
        for (const e of evs) {
          const n = normalizeEvent(e, cfg.teams);
          if (n && n.score !== null && n.date <= today) found.push(n);
        }
      } catch (e) {
        errors.push({ source: "thesportsdb", url: publicUrl(req.url), error: e.message });
      }
    }
  }

  // 3) Reviewed additions are always surfaced until the ledger has the row.
  for (const a of additions) {
    const r = a.suggested_row ?? {};
    const [team, opp] = [teamName.get(r.team_id) ?? r.team_id, teamName.get(r.opponent_id) ?? r.opponent_id];
    found.push({ key: a.key, team_id: r.team_id, date: r.date, home_team: r.venue === "away" ? opp : team, away_team: r.venue === "away" ? team : opp, opponent: opp, score: r.venue === "away" ? `${r.score_against}-${r.score_for}` : `${r.score_for}-${r.score_against}`, competition: r.competition_id, source: "owner-review" });
  }

  // Merge with the existing queue; drop anything now in the ledger or dismissed.
  const old = readJson(join(root, CANDIDATES_FILE), { candidates: [] }).candidates ?? [];
  const byKey = new Map();
  for (const c of [...old, ...found]) {
    if (dismissed.has(c.key) || inLedger(c, ledger)) continue;
    const prev = byKey.get(c.key);
    const sources = [...new Set([...(prev?.sources ?? []), ...(c.sources ?? []), c.source].filter(Boolean))].sort();
    // First sighting wins for shared fields; later sources only fill in what is missing (e.g. TheSportsDB event id).
    byKey.set(c.key, { ...c, ...(prev ?? {}), sources });
  }
  const candidates = [...byKey.values()]
    .map(({ source, ledger_action, ...c }) => (additionByKey.has(c.key) ? { ...c, ledger_action: additionByKey.get(c.key).action } : c))
    .sort((a, b) => a.date.localeCompare(b.date) || a.team_id.localeCompare(b.team_id));

  const out = {
    note: "Matches found upstream but missing from data/matches.csv. Verify whether Ronaldo was in the squad, then add the match through the ingest, dismiss it in pipeline/config/dismissed-candidates.json, or (unused substitute) record it in pipeline/config/ledger-additions.json as an appeared=false row for the data owner to add. Generated by pipeline/detect-matches.mjs.",
    candidates,
  };
  const before = readIfExists(join(root, CANDIDATES_FILE));
  const after = JSON.stringify(out, null, 2) + "\n";
  if (before !== after) writeJson(join(root, CANDIDATES_FILE), out);

  const hints = rsssfHints(root, candidates.filter((c) => !c.ledger_action));
  const ledger_additions = additions
    .filter((a) => candidates.some((c) => c.key === a.key))
    .map((a) => ({ ...a, suggested_csv: a.suggested_row ? toCsvLine(matchesCsv.header, a.suggested_row) : null }));
  const newKeys = candidates.filter((c) => !old.some((o) => o.key === c.key)).map((c) => c.key);
  const report = { generated_at: new Date().toISOString(), today, offline, candidates, new_candidates: newKeys, hints, ledger_additions, notes, errors, requests: client.stats?.().requests ?? null };
  writeJson(join(root, REPORT_DIR, "detect.json"), report);
  log(`${candidates.length} candidate(s) (${newKeys.length} new), ${errors.length} error(s).`);
  for (const c of candidates) log(`  ${c.date} ${c.home_team} ${c.score ?? "?"} ${c.away_team} [${c.competition}] via ${c.sources.join(", ")}${c.ledger_action ? ` -> ${c.ledger_action}` : ""}`);
  for (const e of errors) log(`  error: ${e.source} ${e.url ?? ""} ${e.error}`);
  return report;
}

/** One data/matches.csv line in the ledger's column order (null -> empty, booleans as true/false). */
export function toCsvLine(header, row) {
  const missing = header.filter((h) => !(h in row));
  if (missing.length) throw new Error(`suggested_row is missing columns: ${missing.join(", ")}`);
  return header
    .map((h) => {
      const v = row[h];
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** "7 Oct 2026" -> "2026-10-07" (RSSSF "Last updated" stamp), or null. */
export function rsssfDate(s) {
  const m = String(s ?? "").match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  const mo = m && MONTHS[m[2].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Report-only hints for Portugal candidates: RSSSF's cap list is updated after the match but has no cap that day. */
export function rsssfHints(root, candidates) {
  const hints = {};
  let r;
  try {
    r = parseRsssf(root);
  } catch {
    return hints;
  }
  const updated = rsssfDate(r.lastUpdated);
  const capDates = new Set(r.caps.map((c) => c.date));
  for (const c of candidates)
    if (c.team_id === "portugal" && updated && updated > c.date && !capDates.has(c.date))
      hints[c.key] = `RSSSF cap list (updated ${r.lastUpdated}) has no cap on this date: probably not played; verify, then dismiss.`;
  return hints;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runDetect({ root: args.root ?? ROOT, today: typeof args.today === "string" ? args.today : undefined, offline: Boolean(args.offline) });
  setGithubOutput({ candidates: report.candidates.length, new_candidates: report.new_candidates.length, detect_errors: report.errors.length });
}
