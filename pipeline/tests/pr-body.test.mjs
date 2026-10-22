import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBody } from "../pr-body.mjs";

test("PR body states it is never auto-merged and lists sources, candidates and checks", () => {
  const body = renderBody({
    refresh: {
      decision: "accepted",
      groups: { intl: { outcome: "success" }, club: { outcome: "failure" } },
      files: [
        { file: "data/raw/martj42-portugal-results.csv", group: "intl", status: "updated", revision: "abc", metrics: { m42results_rows: 11 }, previous_metrics: { m42results_rows: 10 } },
        { file: "data/raw/kaggle.csv", group: "club", status: "unchanged", revision: "v1", metrics: { kaggle_goals: 5 }, previous_metrics: { kaggle_goals: 5 }, error: "HTTP 500 | x" },
      ],
      errors: [{ group: "club", reason: "npm run snapshots:refresh -- --only=club failed; previous snapshots kept" }],
    },
    detect: { candidates: [{ key: "2026-10-04-portugal", date: "2026-10-04", home_team: "Portugal", away_team: "Norway", score: "2-1", competition: "UEFA Nations League", sources: ["martj42-results"] }], new_candidates: ["2026-10-04-portugal"], notes: [], errors: [] },
    ingest: "failure",
    check: "success",
    ingestLog: "line1\nboom",
  });
  assert.match(body, /never merged or published automatically/);
  assert.match(body, /martj42-portugal-results\.csv/);
  assert.match(body, /m42results_rows 10 → 11/);
  assert.match(body, /club ❌ failure/);
  assert.match(body, /Guard decision: \*\*accepted\*\*/);
  assert.match(body, /HTTP 500 \\\| x/); // pipes escaped for the table
  assert.match(body, /Portugal vs Norway \| 2-1/);
  assert.match(body, /ingest:intl`: ❌ failure/);
  assert.match(body, /boom/);
  assert.match(body, /--only=club failed/);
});

test("PR body copes with missing reports", () => {
  assert.match(renderBody({}), /Refresh report missing/);
});
