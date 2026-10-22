#!/usr/bin/env node
// Daily snapshot refresh (online). Fail-safe: every source is fetched, parsed with the same parsers
// the ingest uses and guarded against regressions BEFORE anything is written. A source that fails
// keeps its old snapshot and old MANIFEST entry. Files are only rewritten when their data changed.
//
// Usage: node pipeline/refresh-snapshots.mjs [--root DIR] [--only id,id] [--strict]
//   --strict  exit 1 if any source failed (default: exit 0 and report; the workflow decides)
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../scripts/lib/ledger.mjs";
import { SOURCES } from "./lib/sources.mjs";
import { createClient } from "./lib/http.mjs";
import { REPORT_DIR } from "./config.mjs";
import { sha256, atomicWrite, readIfExists, readJson, writeJson, parseArgs, setGithubOutput } from "./lib/util.mjs";

/**
 * @returns {Promise<{results: object[], changed: string[], errors: object[]}>}
 */
export async function runRefresh({ root = ROOT, client = createClient({ log: (m) => console.warn(m) }), sources = SOURCES, now = () => new Date(), log = console.log } = {}) {
  const ctx = { client, warn: (m) => log(`warning: ${m}`) };
  const results = [];
  const staged = [];

  for (const src of sources) {
    const path = join(root, src.file);
    const oldText = readIfExists(path);
    const res = { id: src.id, file: src.file, status: "unchanged", revision: null, error: null };
    try {
      const { text, entry } = await src.fetch(ctx);
      res.revision = entry.revision ?? null;
      const newDigest = src.digest(text); // throws on parse/validation failure
      let oldDigest = null;
      if (oldText !== null) {
        try {
          oldDigest = src.digest(oldText);
        } catch {
          oldDigest = null; // old snapshot unreadable by current parser -> replace it
        }
      }
      if (oldText !== null && oldDigest === newDigest) {
        res.status = "unchanged";
      } else {
        if (oldText !== null && oldDigest !== null && src.guard) src.guard(oldText, text);
        res.status = oldText === null ? "added" : "updated";
        staged.push({ src, text, entry: { file: src.file, sha256: sha256(text), fetched_at: now().toISOString(), ...entry } });
      }
    } catch (e) {
      res.status = /refusing update/.test(e.message) ? "rejected" : "error";
      res.error = e.message;
    }
    log(`${res.status.padEnd(9)} ${src.id}${res.revision ? ` @ ${res.revision}` : ""}${res.error ? ` -- ${res.error}` : ""}`);
    results.push(res);
  }

  // Commit phase: snapshots first, then manifests (merge by file; untouched entries are kept verbatim).
  const byManifest = new Map();
  for (const s of staged) {
    atomicWrite(join(root, s.src.file), s.text);
    if (!byManifest.has(s.src.manifest)) byManifest.set(s.src.manifest, []);
    byManifest.get(s.src.manifest).push(s.entry);
  }
  for (const [manifestRel, entries] of byManifest) {
    const mpath = join(root, manifestRel);
    writeJson(mpath, mergeManifest(readJson(mpath, null), entries, "pipeline/refresh-snapshots.mjs"));
  }

  const errors = results.filter((r) => r.status === "error" || r.status === "rejected");
  const report = { generated_at: now().toISOString(), requests: client.stats?.().requests ?? null, results, changed: staged.map((s) => s.src.file), errors };
  writeJson(join(root, REPORT_DIR, "refresh.json"), report);
  return report;
}

/** Merge new entries into a MANIFEST ({generated_by, entries[]}) keyed by `file`, preserving order. */
export function mergeManifest(old, entries, generatedBy) {
  const list = [...(old?.entries ?? [])];
  for (const e of entries) {
    const i = list.findIndex((x) => x.file === e.file);
    if (i >= 0) list[i] = e;
    else list.push(e);
  }
  // Keep an existing generated_by (data/raw/MANIFEST.json is shared with scripts/ingest/fetch-snapshots.mjs).
  return { generated_by: old?.generated_by ?? generatedBy, entries: list };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const only = typeof args.only === "string" ? new Set(args.only.split(",")) : null;
  const report = await runRefresh({ root: args.root ?? ROOT, sources: only ? SOURCES.filter((s) => only.has(s.id)) : SOURCES });
  console.log(`\n${report.changed.length} snapshot(s) changed, ${report.errors.length} error(s), ${report.requests} request(s).`);
  setGithubOutput({ changed: report.changed.length, errors: report.errors.length, data_raw_changed: report.changed.some((f) => f.startsWith("data/raw/")) });
  if (args.strict && report.errors.length) process.exitCode = 1;
}
