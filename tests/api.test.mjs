import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import { buildApi } from "../scripts/build-api.mjs";

const files = buildApi(loadLedger(), "2026-10-22T00:00:00.000Z");

test("builds the documented /api/v1 files", () => {
  for (const f of ["index.json", "summary.json", "goals.json", "matches.json", "goals-by-competition.json", "goals-by-year.json", "goals-by-opponent.json", "records.json", "sources.json"])
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

test("aggregates add up to the totals", () => {
  const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
  assert.equal(files["goals.json"].data.length, 146);
  assert.equal(sum(files["goals-by-competition.json"].data, "goals"), 146);
  assert.equal(sum(files["goals-by-year.json"].data, "goals"), 146);
  assert.equal(sum(files["goals-by-opponent.json"].data, "goals"), 146);
  assert.equal(sum(files["goals-by-year.json"].data, "apps"), 234);
});

test("records.json computed values equal the stored values", () => {
  for (const r of files["records.json"].data) if (r.compute_fn) assert.equal(r.computed_value, r.value, r.record_id);
});
