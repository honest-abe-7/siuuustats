import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import { buildApi } from "../scripts/build-api.mjs";

const files = buildApi(loadLedger(), "2026-10-22T00:00:00.000Z");

test("builds the documented /api/v1 files", () => {
  for (const f of ["index.json", "summary.json", "goals.json", "matches.json", "goals-by-competition.json", "goals-by-year.json", "goals-by-opponent.json", "records.json", "sources.json", "goals-by-club.json", "goals-by-season.json"])
    assert.ok(files[f], f);
});

test("every response has the envelope fields and attribution", () => {
  for (const [name, body] of Object.entries(files)) {
    assert.equal(body.api_version, "v1", name);
    assert.equal(body.licence, "CC BY-SA 4.0", name);
    assert.ok(body.data_as_of, name);
    if (name !== "index.json") assert.ok(body.attribution.length > 0, name);
  }
});

test("aggregates add up to the totals, per scope", () => {
  const sum = (arr, k, scope) => arr.filter((r) => !scope || r.scope === scope).reduce((a, r) => a + r[k], 0);
  assert.equal(files["goals.json"].data.length, 981);
  for (const f of ["goals-by-competition.json", "goals-by-year.json", "goals-by-opponent.json", "goals-by-age.json"]) {
    assert.equal(sum(files[f].data, "goals"), 981, f);
    assert.equal(sum(files[f].data, "goals", "international"), 146, f);
    assert.equal(sum(files[f].data, "goals", "club"), 835, f);
    assert.ok(files[f].data.every((r) => r.scope === "club" || r.scope === "international"), f);
  }
  assert.equal(sum(files["goals-by-year.json"].data, "apps", "international"), 234);
  assert.equal(sum(files["goals-by-year.json"].data, "apps", "club"), 1107);
  assert.equal(sum(files["goals-by-club.json"].data, "goals"), 835);
  assert.equal(sum(files["goals-by-season.json"].data, "goals"), 835);
  assert.equal(sum(files["goals-by-season.json"].data, "apps"), 1107);
});

test("summary has international, club and career blocks with per-number citations", () => {
  const d = files["summary.json"].data;
  assert.equal(d.international.goals, 146);
  assert.equal(d.club.goals, 835);
  assert.equal(d.club.apps, 1107);
  assert.equal(d.club.champions_league.goals, 140);
  assert.equal(d.club.champions_league.goals_incl_qualifiers, 141);
  assert.equal(d.career.goals, 981);
  assert.equal(d.career.apps, 1341);
  const known = new Set(files["sources.json"].data.map((s) => s.source_id));
  for (const [path, ids] of Object.entries(d.citations)) {
    assert.ok(ids.length > 0, path);
    for (const id of ids) assert.ok(known.has(id), `${path} cites unknown ${id}`);
  }
});

test("new M3 files exist and are consistent", () => {
  for (const f of ["goals-by-club.json", "goals-by-season.json", "multi-goal-matches.json", "goals-by-age.json", "streaks.json", "big-games.json", "reconciliation.json", "corrections.json"]) assert.ok(files[f], f);
  assert.equal(files["reconciliation.json"].data.counts.fail, 0);
  assert.equal(files["multi-goal-matches.json"].data.filter((m) => m.goals >= 3).length, 66);
  const ucl = files["goals.json"].data.filter((g) => g.competition_id === "uefa-champions-league" && !/qualif/i.test(g.stage ?? ""));
  assert.equal(ucl.length, 140);
  assert.equal(ucl.filter((g) => g.method === "penalty").length, 19);
});

test("records.json computed values equal the stored values", () => {
  for (const r of files["records.json"].data) if (r.compute_fn) assert.equal(r.computed_value, r.value, r.record_id);
});
