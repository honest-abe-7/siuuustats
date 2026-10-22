// The guard runs after `npm run snapshots:refresh` has (possibly) rewritten data/raw. These tests
// simulate what fetch-snapshots.mjs does to the files and check what the guard keeps or restores.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { tempRoot } from "./helpers.mjs";
import { saveBackup, verify } from "../snapshot-guard.mjs";
import { CHECKS } from "../lib/checks.mjs";
import { RAW } from "../../scripts/lib/sources-raw.mjs";

const MANIFEST = "data/raw/MANIFEST.json";
const read = (root, f) => readFileSync(join(root, f), "utf8");

function setup() {
  const root = tempRoot();
  const backup = mkdtempSync(join(tmpdir(), "siuuu-backup-"));
  saveBackup(root, backup);
  return { root, backup };
}

/** Mimic fetch-snapshots: rewrite a file and bump its MANIFEST entry. */
function refreshed(root, file, text, revision = "new-rev") {
  writeFileSync(join(root, file), text);
  const m = JSON.parse(read(root, MANIFEST));
  const e = m.entries.find((x) => x.file === file);
  Object.assign(e, { fetched_at: "2026-10-23T06:17:00.000Z", revision, sha256: "x" });
  writeFileSync(join(root, MANIFEST), JSON.stringify(m, null, 2) + "\n");
}

function touchAll(root) {
  // A successful refresh with no data change still rewrites fetched_at for every entry.
  const m = JSON.parse(read(root, MANIFEST));
  for (const e of m.entries) e.fetched_at = "2026-10-23T06:17:00.000Z";
  writeFileSync(join(root, MANIFEST), JSON.stringify(m, null, 2) + "\n");
}

const addPortugalRow = (root) => {
  const [h, ...rows] = parse(read(root, RAW.m42results));
  return stringify([h, ...rows, ["2026-11-14", "Portugal", "Ireland", "3", "0", "UEFA Euro qualification", "Porto", "Portugal", "FALSE"]]);
};

test("every data/raw snapshot of the committed ledger passes its check", () => {
  const { root, backup } = setup();
  const r = verify({ root, backup, outcomes: { intl: "success", club: "success" } });
  assert.equal(r.decision, "unchanged");
  assert.deepEqual(r.files.filter((f) => f.error), []);
  assert.equal(r.files.length, CHECKS.length);
  const metrics = Object.assign({}, ...r.files.map((f) => f.metrics));
  assert.equal(metrics.intl_goals_wikipedia_list, 146);
  assert.ok(metrics.club_career_goals >= 835);
});

test("a refresh with no semantic change restores MANIFEST byte-for-byte (no daily noise PR)", () => {
  const { root, backup } = setup();
  const before = read(root, MANIFEST);
  touchAll(root);
  const art = JSON.parse(read(root, RAW.wikiArticle));
  art.query.pages[0].revisions[0].revid += 1; // unrelated edit: new revision, same infobox + career table
  refreshed(root, RAW.wikiArticle, JSON.stringify(art));
  const r = verify({ root, backup, outcomes: { intl: "success", club: "success" } });
  assert.equal(r.decision, "unchanged");
  assert.equal(read(root, MANIFEST), before);
  assert.equal(read(root, RAW.wikiArticle), read(backup, RAW.wikiArticle));
  assert.equal(r.intl_changed, false);
});

test("a real change is accepted and kept with fetch-snapshots' MANIFEST entry", () => {
  const { root, backup } = setup();
  refreshed(root, RAW.m42results, addPortugalRow(root), "sha-new");
  const r = verify({ root, backup, outcomes: { intl: "success", club: "success" } });
  assert.equal(r.decision, "accepted");
  assert.deepEqual(r.changed, [RAW.m42results]);
  assert.equal(r.intl_changed, true);
  assert.equal(r.club_changed, false);
  assert.match(read(root, RAW.m42results), /2026-11-14,Portugal,Ireland/);
  assert.equal(JSON.parse(read(root, MANIFEST)).entries.find((e) => e.file === RAW.m42results).revision, "sha-new");
  const row = r.files.find((f) => f.file === RAW.m42results);
  assert.equal(row.metrics.m42results_rows, row.previous_metrics.m42results_rows + 1);
});

test("a failed club step restores club files and entries but keeps a good intl update", () => {
  const { root, backup } = setup();
  refreshed(root, RAW.m42results, addPortugalRow(root));
  writeFileSync(join(root, RAW.kaggleGoals), "partial download"); // club script died half-way
  const r = verify({ root, backup, outcomes: { intl: "success", club: "failure" } });
  assert.equal(r.decision, "accepted");
  assert.equal(read(root, RAW.kaggleGoals), read(backup, RAW.kaggleGoals));
  assert.equal(r.groups.club.status, "failed");
  assert.ok(r.errors.some((e) => e.group === "club"));
  assert.deepEqual(r.changed, [RAW.m42results]);
});

test("a snapshot that no longer parses rejects the whole refresh", () => {
  const { root, backup } = setup();
  const before = read(root, MANIFEST);
  refreshed(root, RAW.m42results, addPortugalRow(root));
  refreshed(root, RAW.wikiList, "<html><body>Service temporarily unavailable</body></html>");
  const r = verify({ root, backup, outcomes: { intl: "success", club: "success" } });
  assert.equal(r.decision, "rejected");
  assert.ok(r.errors.some((e) => e.file === RAW.wikiList && /does not parse/.test(e.reason)));
  assert.equal(read(root, RAW.m42results), read(backup, RAW.m42results));
  assert.equal(read(root, RAW.wikiList), read(backup, RAW.wikiList));
  assert.equal(read(root, MANIFEST), before);
});

test("totals going down (e.g. vandalised table, truncated download) reject the refresh", () => {
  const { root, backup } = setup();
  const [h, ...rows] = parse(read(root, RAW.m42shootouts));
  refreshed(root, RAW.m42shootouts, stringify([h, ...rows.slice(1)]));
  const r = verify({ root, backup, outcomes: { intl: "success", club: "success" } });
  assert.equal(r.decision, "rejected");
  assert.ok(r.errors.some((e) => /m42shootouts_rows decreased/.test(e.reason)));
  assert.equal(read(root, RAW.m42shootouts), read(backup, RAW.m42shootouts));
});

test("verify refuses to run without a backup", () => {
  assert.throws(() => verify({ root: tempRoot(), backup: join(tmpdir(), "does-not-exist-siuuu"), outcomes: {} }), /No backup/);
});
