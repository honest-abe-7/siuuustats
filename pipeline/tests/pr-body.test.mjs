import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBody } from "../pr-body.mjs";

test("PR body states it is never auto-merged and lists sources, candidates and checks", () => {
  const body = renderBody({
    refresh: { results: [{ id: "martj42-results", file: "data/raw/x.csv", status: "updated", revision: "abc" }, { id: "rsssf", file: "f", status: "error", error: "HTTP 500 | x" }], errors: [{}] },
    detect: { candidates: [{ key: "2026-10-04-portugal", date: "2026-10-04", home_team: "Portugal", away_team: "Norway", score: "2-1", competition: "UEFA Nations League", sources: ["martj42-results"] }], new_candidates: ["2026-10-04-portugal"], notes: [], errors: [] },
    ingest: "failure",
    check: "success",
    ingestLog: "line1\nboom",
  });
  assert.match(body, /never merged or published automatically/);
  assert.match(body, /martj42-results/);
  assert.match(body, /HTTP 500 \\\| x/); // pipes escaped for the table
  assert.match(body, /Portugal vs Norway \| 2-1/);
  assert.match(body, /ingest:intl`: ❌ failure/);
  assert.match(body, /boom/);
  assert.match(body, /previous snapshots were kept/);
});

test("PR body copes with missing reports", () => {
  assert.match(renderBody({}), /refresh report missing/);
});
