#!/usr/bin/env node
// Safety net around `npm run snapshots:refresh` (scripts/ingest/fetch-snapshots.mjs owns fetching,
// pinning and data/raw/MANIFEST.json). The daily workflow runs:
//
//   node pipeline/snapshot-guard.mjs save   --backup DIR          # copy data/raw before refreshing
//   npm run snapshots:refresh -- --only=intl                     # (continue-on-error)
//   npm run snapshots:refresh -- --only=club                     # (continue-on-error)
//   node pipeline/snapshot-guard.mjs verify --backup DIR --intl <outcome> --club <outcome>
//
// verify then, per group:
//   * refresh step failed      -> restore that group's files and MANIFEST entries (fetch-snapshots
//                                 writes files as it goes, so a failure can leave a partial update)
//   * any file fails to parse  -> reject the whole refresh (restore everything)
//   * any total went down      -> reject the whole refresh (vandalism / upstream breakage guard)
//   * nothing changed semantically -> restore everything, so a new fetched_at, a re-render or an
//                                 unrelated wiki edit does not produce a daily PR
// Whole-refresh rejection keeps the article snapshot and the club career table (fetched at the
// article's pinned revision) consistent with each other.
import { cpSync, rmSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../scripts/lib/ledger.mjs";
import { CHECKS, GROUPS, inspectAll, regressions } from "./lib/checks.mjs";
import { REPORT_DIR } from "./config.mjs";
import { readJson, writeJson, parseArgs, setGithubOutput, readIfExists, atomicWrite } from "./lib/util.mjs";

const RAW_DIR = "data/raw";
const MANIFEST = "data/raw/MANIFEST.json";

export function saveBackup(root, backup) {
  rmSync(backup, { recursive: true, force: true });
  mkdirSync(backup, { recursive: true });
  cpSync(join(root, RAW_DIR), join(backup, RAW_DIR), { recursive: true });
}

/** Restore the given data/raw files (and their MANIFEST entries) from the backup. */
function restore(root, backup, files, manifest, oldManifest) {
  for (const f of files) {
    const old = readIfExists(join(backup, f));
    if (old === null) rmSync(join(root, f), { force: true });
    else atomicWrite(join(root, f), old);
    const i = manifest.entries.findIndex((e) => e.file === f);
    const oldEntry = oldManifest.entries.find((e) => e.file === f);
    if (i >= 0 && oldEntry) manifest.entries[i] = oldEntry;
    else if (i >= 0) manifest.entries.splice(i, 1);
    else if (oldEntry) manifest.entries.push(oldEntry);
  }
  manifest.entries.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * @param {{root?:string, backup:string, outcomes:Record<string,string>, checks?:object[]}} opts
 */
export function verify({ root = ROOT, backup, outcomes = {}, checks = CHECKS, now = () => new Date() }) {
  if (!existsSync(join(backup, RAW_DIR))) throw new Error(`No backup at ${backup}; run "save" first`);
  const oldManifest = readJson(join(backup, MANIFEST), { entries: [] });
  const manifest = readJson(join(root, MANIFEST), { entries: [] });
  const filesOf = (g) => checks.filter((c) => c.group === g).map((c) => c.file);
  const groups = {};
  const errors = [];

  // 1) Failed refresh steps: restore their files.
  for (const g of GROUPS) {
    const outcome = outcomes[g] ?? "skipped";
    groups[g] = { outcome, status: outcome === "success" ? "refreshed" : outcome === "skipped" ? "skipped" : "failed" };
    if (groups[g].status !== "refreshed") restore(root, backup, filesOf(g), manifest, oldManifest);
    if (groups[g].status === "failed") errors.push({ group: g, reason: `npm run snapshots:refresh -- --only=${g} failed; previous snapshots kept` });
  }

  // 2) Validate + compare.
  const before = inspectAll(backup, checks);
  const after = inspectAll(root, checks);
  const invalid = Object.entries(after).filter(([, v]) => v.error).map(([file, v]) => ({ file, error: v.error }));
  const regress = regressions(before, after);
  const changed = checks.filter((c) => !after[c.file].error && after[c.file].digest !== before[c.file]?.digest).map((c) => c.file);

  let decision;
  const allFiles = checks.map((c) => c.file);
  if (invalid.length || regress.length) {
    decision = "rejected";
    restore(root, backup, allFiles, manifest, oldManifest);
    for (const i of invalid) errors.push({ file: i.file, reason: `does not parse: ${i.error}` });
    for (const r of regress) errors.push({ file: r.file, reason: `${r.metric} decreased from ${r.before} to ${r.after}` });
  } else if (!changed.length) {
    decision = "unchanged";
    restore(root, backup, allFiles, manifest, oldManifest);
  } else {
    decision = "accepted";
  }
  if (decision === "accepted") writeJson(join(root, MANIFEST), manifest);
  else atomicWrite(join(root, MANIFEST), readIfExists(join(backup, MANIFEST)) ?? "{}\n"); // byte-identical

  const kept = decision === "accepted" ? changed : [];
  const files = checks.map((c) => ({
    file: c.file,
    group: c.group,
    status: after[c.file].error ? "invalid" : kept.includes(c.file) ? "updated" : changed.includes(c.file) ? "reverted" : "unchanged",
    revision: (decision === "accepted" ? manifest : oldManifest).entries.find((e) => e.file === c.file)?.revision ?? null,
    metrics: after[c.file].metrics ?? null,
    previous_metrics: before[c.file]?.metrics ?? null,
    error: after[c.file].error ?? null,
  }));
  const report = {
    generated_at: now().toISOString(),
    decision,
    groups,
    files,
    changed: kept,
    errors,
    intl_changed: kept.some((f) => checks.find((c) => c.file === f)?.group === "intl"),
    club_changed: kept.some((f) => checks.find((c) => c.file === f)?.group === "club"),
  };
  writeJson(join(root, REPORT_DIR, "refresh.json"), report);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const root = args.root ?? ROOT;
  if (typeof args.backup !== "string") throw new Error("--backup DIR is required");
  if (cmd === "save") {
    saveBackup(root, args.backup);
    console.log(`Backed up ${readdirSync(join(root, RAW_DIR)).length} files from ${RAW_DIR} to ${args.backup}`);
  } else if (cmd === "verify") {
    const r = verify({ root, backup: args.backup, outcomes: { intl: args.intl, club: args.club } });
    console.log(`decision: ${r.decision}`);
    for (const f of r.files) console.log(`  ${f.status.padEnd(9)} ${f.file}${f.error ? ` -- ${f.error}` : ""}`);
    for (const e of r.errors) console.log(`  error: ${e.group ?? e.file}: ${e.reason}`);
    setGithubOutput({ decision: r.decision, changed: r.changed.length, errors: r.errors.length, intl_changed: r.intl_changed, club_changed: r.club_changed });
  } else {
    console.error("usage: snapshot-guard.mjs save|verify --backup DIR [--intl outcome] [--club outcome] [--root DIR]");
    process.exitCode = 2;
  }
}
