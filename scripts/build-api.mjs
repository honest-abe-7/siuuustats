#!/usr/bin/env node
// Builds the static read API (the /api/v1 contract in CONTRACTS.md) from the ledger.
// Usage: npm run build:api [-- --out <dir>]   (default: dist/api/v1)
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadLedger } from "./lib/ledger.mjs";
import * as stats from "./lib/stats.mjs";

export const API_VERSION = "v1";

export function buildApi(ledger, generatedAt = new Date().toISOString()) {
  const { matches, teams, competitions, sources, records } = ledger.tables;
  const teamName = new Map(teams.map((t) => [t.team_id, t.name]));
  const compName = new Map(competitions.map((c) => [c.competition_id, c.name]));
  const isPor = (m) => m.team_id === stats.NATIONAL_TEAM;
  const dataAsOf = matches.map((m) => m.date).sort().at(-1) ?? null;
  const usedSources = new Set();
  const envelope = (endpoint, data, sourceIds) => {
    const ids = [...new Set(sourceIds)].sort();
    ids.forEach((s) => usedSources.add(s));
    return {
      api_version: API_VERSION,
      endpoint,
      generated_at: generatedAt,
      data_as_of: dataAsOf,
      licence: "CC BY-SA 4.0",
      attribution: ids.map((id) => {
        const s = sources.find((x) => x.source_id === id);
        return { source_id: id, title: s?.title, publisher: s?.publisher, url: s?.url, licence: s?.licence };
      }),
      data,
    };
  };
  const goals = stats.goalsWithMatch(ledger);
  const goalRows = goals
    .map((g) => ({
      goal_id: g.goal_id,
      match_id: g.match_id,
      date: g.match.date,
      season: g.match.season,
      team_id: g.team_id,
      opponent_id: g.match.opponent_id,
      opponent: teamName.get(g.match.opponent_id),
      competition_id: g.match.competition_id,
      competition: compName.get(g.match.competition_id),
      venue: g.match.venue,
      minute: g.minute,
      added_time: g.added_time,
      method: g.method,
      body_part: g.body_part,
      assist_player: g.assist_player,
      assist_type: g.assist_type,
      score_after: g.score_after,
      result: `${g.match.score_for}-${g.match.score_against}`,
      age: stats.ageOn(g.match.date),
      intl_goal_no: g.intl_goal_no,
      source_ids: g.source_ids,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.goal_id.localeCompare(b.goal_id, "en", { numeric: true }));
  const allSrc = (rows) => rows.flatMap((r) => r.source_ids);
  const intlMatches = matches.filter(isPor);
  const out = {};
  out["summary.json"] = envelope("summary", { international: stats.internationalSummary(ledger) }, allSrc(intlMatches).concat(allSrc(ledger.tables.goals)));
  out["goals.json"] = envelope("goals", goalRows, allSrc(goalRows));
  out["matches.json"] = envelope(
    "matches",
    matches.map((m) => ({ ...m, opponent: teamName.get(m.opponent_id), competition: compName.get(m.competition_id) })),
    allSrc(matches)
  );
  const withNames = (rows, nameMap, keyName) => rows.map((r) => ({ [keyName]: r.key, name: nameMap ? nameMap.get(r.key) : undefined, apps: r.apps, goals: r.goals }));
  out["goals-by-competition.json"] = envelope("goals-by-competition", withNames(stats.splitBy(ledger, (m) => m.competition_id), compName, "competition_id"), allSrc(matches).concat(allSrc(ledger.tables.goals)));
  out["goals-by-year.json"] = envelope(
    "goals-by-year",
    stats
      .splitBy(ledger, (m) => m.date.slice(0, 4))
      .map((r) => ({ year: r.key, apps: r.apps, goals: r.goals }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    allSrc(matches).concat(allSrc(ledger.tables.goals))
  );
  out["goals-by-opponent.json"] = envelope("goals-by-opponent", withNames(stats.splitBy(ledger, (m) => m.opponent_id), teamName, "opponent_id"), allSrc(matches).concat(allSrc(ledger.tables.goals)));
  out["records.json"] = envelope(
    "records",
    records.map((r) => ({ ...r, computed_value: r.compute_fn ? String(stats.evaluateComputeFn(ledger, r.compute_fn)) : null })),
    allSrc(records)
  );
  out["sources.json"] = envelope("sources", sources.filter((s) => usedSources.has(s.source_id)), [...usedSources]);
  out["index.json"] = envelope(
    "index",
    Object.keys(out).map((f) => ({ path: `/api/${API_VERSION}/${f}`, items: Array.isArray(out[f].data) ? out[f].data.length : null })),
    []
  );
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--out");
  const outDir = i > 0 ? resolve(process.argv[i + 1]) : join(ROOT, "dist", "api", API_VERSION);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const files = buildApi(loadLedger());
  for (const [name, body] of Object.entries(files)) writeFileSync(join(outDir, name), JSON.stringify(body, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(files).length} files to ${outDir}`);
}
