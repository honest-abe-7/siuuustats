import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import { readCsv } from "../scripts/lib/csv.mjs";
import { validateLedger } from "../scripts/validate.mjs";
import { join } from "node:path";
import { ROOT } from "../scripts/lib/ledger.mjs";

const raw = (name) => readCsv(join(ROOT, `data/${name}.csv`)).rows;

test("committed ledger passes schema, key, reference and rule checks", () => {
  const issues = validateLedger(loadLedger());
  assert.deepEqual(issues, []);
});

test("every table's CSV header matches its JSON Schema property order", () => {
  const l = loadLedger();
  for (const t of l.registry.tables) assert.deepEqual(l.headers[t.name], t.columns, t.name);
});

test("every match and goal row cites at least one source", () => {
  const l = loadLedger();
  for (const r of [...l.tables.matches, ...l.tables.goals]) assert.ok(r.source_ids.length >= 1);
});

test("detects a duplicate primary key", () => {
  const goals = raw("goals");
  const issues = validateLedger(loadLedger(ROOT, { goals: [...goals, goals[0]] }));
  assert.ok(issues.some((i) => /duplicate goal_id/.test(i.message)));
});

test("detects a broken foreign key", () => {
  const goals = raw("goals").map((g, i) => (i === 0 ? { ...g, match_id: "2004-06-12-portugal-atlantis" } : g));
  const issues = validateLedger(loadLedger(ROOT, { goals }));
  assert.ok(issues.some((i) => /not found in matches.match_id/.test(i.message)));
});

test("detects an unknown source_id", () => {
  const matches = raw("matches").map((m, i) => (i === 0 ? { ...m, source_ids: "made-up-source" } : m));
  const issues = validateLedger(loadLedger(ROOT, { matches }));
  assert.ok(issues.some((i) => /made-up-source/.test(i.message)));
});

test("detects schema violations (bad enum, bad date)", () => {
  const matches = raw("matches").map((m, i) => (i === 0 ? { ...m, venue: "moon", date: "2003-13-40" } : m));
  const issues = validateLedger(loadLedger(ROOT, { matches }));
  assert.ok(issues.some((i) => /venue/.test(i.message)));
  assert.ok(issues.some((i) => /date/.test(i.message)));
});

test("detects a duplicate match on the same date (the uncorrected RSSSF cap 162 case)", () => {
  const matches = raw("matches");
  const dup = { ...matches.find((m) => m.cap_number === "163"), match_id: "2019-11-14-portugal-lithuania-x" };
  const issues = validateLedger(loadLedger(ROOT, { matches: [...matches, dup] }));
  assert.ok(issues.some((i) => /duplicate match/.test(i.message)));
});

test("detects more goals than the team scored", () => {
  const goals = raw("goals");
  const g = goals.find((x) => x.match_id === "2004-06-12-portugal-greece");
  const extra = { ...g, goal_id: `${g.match_id}-g2`, score_after: "2-2", intl_goal_no: "" };
  const issues = validateLedger(loadLedger(ROOT, { goals: [...goals, extra] }));
  assert.ok(issues.some((i) => /exceeds final score|goals recorded but team scored/.test(i.message)));
});

test("editorial records need two sources", () => {
  const records = [{ record_id: "x", title: "X", scope: "world", value: "1", unit: "", compute_fn: "", shared_with: "", status: "verified", last_checked: "2026-10-22", source_ids: "wikipedia-cristiano-ronaldo", notes: "" }];
  const issues = validateLedger(loadLedger(ROOT, { records }));
  assert.ok(issues.some((i) => /at least two source_ids/.test(i.message)));
});
