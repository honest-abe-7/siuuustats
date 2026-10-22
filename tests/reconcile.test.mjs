import { test } from "node:test";
import assert from "node:assert/strict";
import { runReconciliation } from "../scripts/reconcile.mjs";

const rep = runReconciliation();
const byId = (id) => rep.checks.find((c) => c.check === id);

test("no reconciliation check fails", () => {
  const failed = rep.checks.filter((c) => c.status === "fail");
  assert.deepEqual(failed, []);
});

test("ledger matches Wikipedia: 146 goals and 234 caps", () => {
  assert.equal(byId("wikipedia-infobox-goals").status, "pass");
  assert.equal(byId("wikipedia-infobox-caps").status, "pass");
  assert.equal(byId("wikipedia-list-goal-rows").actual, 146);
  assert.equal(byId("wikipedia-infobox-caps").actual, 234);
});

test("ledger matches martj42: 124 competitive goals, per match", () => {
  assert.equal(byId("martj42-competitive-goals").status, "pass");
  assert.equal(byId("martj42-competitive-goals").actual, 124);
  assert.deepEqual(byId("martj42-goals-per-match").actual, []);
});

test("every Wikipedia by-year and by-competition row reconciles", () => {
  const rows = rep.checks.filter((c) => c.check.startsWith("wikipedia-by-"));
  assert.ok(rows.length >= 30);
  assert.ok(rows.every((c) => c.status === "pass"));
});

test("RSSSF differs only by the documented missing cap", () => {
  assert.equal(byId("rsssf-total-caps").status, "known_difference");
  assert.equal(byId("rsssf-record").status, "pass");
  assert.deepEqual(byId("rsssf-goals-per-cap").actual, []);
});
