#!/usr/bin/env node
// Schema validation, referential integrity, duplicate checks and ledger business rules.
// Usage: npm run validate   (exit code 1 if any error)
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { fileURLToPath } from "node:url";
import { loadLedger } from "./lib/ledger.mjs";
import { COMPUTE_FNS } from "./lib/stats.mjs";

export function validateLedger(ledger) {
  const issues = [];
  const add = (table, rowNumber, message) => issues.push({ table, row: rowNumber, message });
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  for (const f of ledger.missing ?? []) add(f, null, "file missing or unparseable");

  const pkIndex = {};
  for (const t of ledger.registry.tables) {
    const rows = ledger.tables[t.name];
    const header = ledger.headers[t.name];
    if (header.length && header.join(",") !== t.columns.join(","))
      add(t.name, 1, `header mismatch. expected: ${t.columns.join(",")} got: ${header.join(",")}`);
    const validate = ajv.compile(t.jsonSchema);
    const seen = new Map();
    rows.forEach((r, i) => {
      const rowNumber = i + 2; // 1-based incl. header
      if (!validate(r)) for (const e of validate.errors) add(t.name, rowNumber, `${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join("|")})` : ""}`);
      const pk = r[t.primaryKey];
      if (seen.has(pk)) add(t.name, rowNumber, `duplicate ${t.primaryKey} "${pk}" (first at row ${seen.get(pk)})`);
      else seen.set(pk, rowNumber);
    });
    pkIndex[t.name] = seen;
  }

  // foreign keys
  for (const t of ledger.registry.tables) {
    for (const [col, ref] of Object.entries(t.foreignKeys)) {
      const [refTable] = ref.split(".");
      ledger.tables[t.name].forEach((r, i) => {
        const vals = Array.isArray(r[col]) ? r[col] : [r[col]];
        for (const v of vals) if (v !== null && v !== undefined && !pkIndex[refTable].has(v)) add(t.name, i + 2, `${col} "${v}" not found in ${ref}`);
      });
    }
  }

  // business rules
  const { matches, goals, records } = ledger.tables;
  const matchById = new Map(matches.map((m) => [m.match_id, m]));
  const natural = new Map();
  matches.forEach((m, i) => {
    const row = i + 2;
    if (typeof m.match_id === "string" && !m.match_id.startsWith(`${m.date}-${m.team_id}-${m.opponent_id}`))
      add("matches", row, `match_id must be {date}-{team_id}-{opponent_id}`);
    if (m.team_id === m.opponent_id) add("matches", row, "team_id equals opponent_id");
    // A second leg can go to penalties with the aggregate level but the match itself won (e.g. Real Madrid 2-1 Bayern, 2012).
    if (m.shootout && m.score_for !== m.score_against && !/2nd leg/i.test(m.stage ?? "")) add("matches", row, "shootout recorded but score is not level");
    if (m.cap_number !== null && m.season !== m.date.slice(0, 4)) add("matches", row, "international matches use the calendar year as season");
    if (!m.appeared && (m.minutes || m.started)) add("matches", row, "unused substitute cannot have minutes or a start");
    const nk = `${m.date}|${m.team_id}|${m.opponent_id}`;
    if (natural.has(nk)) add("matches", row, `duplicate match (same date/team/opponent as row ${natural.get(nk)})`);
    else natural.set(nk, row);
  });

  // cap numbers: unique and contiguous 1..N in date order per national team
  const intl = matches.filter((m) => m.cap_number !== null && m.appeared).sort((a, b) => a.date.localeCompare(b.date));
  for (const [team, list] of Map.groupBy ? Map.groupBy(intl, (m) => m.team_id) : groupBy(intl, (m) => m.team_id)) {
    list.forEach((m, i) => {
      if (m.cap_number !== i + 1) add("matches", null, `${team} cap numbering: ${m.match_id} has cap ${m.cap_number}, expected ${i + 1} by date order`);
    });
  }

  const perMatch = new Map();
  goals.forEach((g, i) => {
    const row = i + 2;
    const m = matchById.get(g.match_id);
    if (!m) return; // FK error already reported
    if (typeof g.goal_id === "string" && !g.goal_id.startsWith(`${g.match_id}-g`)) add("goals", row, "goal_id must start with {match_id}-g");
    if (!m.appeared) add("goals", row, "goal in a match where appeared=false");
    if (g.team_id !== m.team_id) add("goals", row, "goal team_id differs from match team_id");
    const [f, a] = String(g.score_after).split("-").map(Number);
    if (f > m.score_for || a > m.score_against) add("goals", row, `score_after ${g.score_after} exceeds final score ${m.score_for}-${m.score_against}`);
    if (g.assist_player && !g.assist_type) add("goals", row, "assist_player set without assist_type");
    perMatch.set(g.match_id, [...(perMatch.get(g.match_id) ?? []), g]);
  });
  for (const [mid, list] of perMatch) {
    const m = matchById.get(mid);
    if (list.length > m.score_for) add("goals", null, `${mid}: ${list.length} goals recorded but team scored ${m.score_for}`);
    const scores = list.map((g) => Number(String(g.score_after).split("-")[0]));
    if (new Set(scores).size !== scores.length) add("goals", null, `${mid}: two goals share the same score_after for Ronaldo's team`);
    const nos = list.map((g) => Number(g.goal_id.split("-g").at(-1))).sort((a, b) => a - b);
    nos.forEach((n, i) => {
      if (n !== i + 1) add("goals", null, `${mid}: goal suffixes must be g1..g${list.length}`);
    });
  }
  const intlNos = goals.map((g) => g.intl_goal_no).filter((n) => n !== null);
  if (new Set(intlNos).size !== intlNos.length) add("goals", null, "duplicate intl_goal_no");

  records.forEach((r, i) => {
    if (r.compute_fn === null && r.source_ids.length < 2) add("records", i + 2, "editorial record (no compute_fn) needs at least two source_ids");
    if (r.compute_fn && !COMPUTE_FNS[r.compute_fn.split(":")[0]]) add("records", i + 2, `unknown compute_fn ${r.compute_fn}`);
  });
  return issues;
}

function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) m.set(fn(x), [...(m.get(fn(x)) ?? []), x]);
  return m;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ledger = loadLedger();
  const issues = validateLedger(ledger);
  const counts = Object.fromEntries(ledger.registry.tables.map((t) => [t.name, ledger.tables[t.name].length]));
  console.log("Rows:", JSON.stringify(counts));
  if (issues.length) {
    for (const i of issues.slice(0, 200)) console.error(`  ${i.table}${i.row ? `:${i.row}` : ""} ${i.message}`);
    console.error(`Validation failed: ${issues.length} issue(s).`);
    process.exit(1);
  }
  console.log("Validation passed: schema, keys, references and ledger rules OK.");
}
