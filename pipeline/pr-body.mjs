#!/usr/bin/env node
// Compose the pull-request / issue body for the daily refresh from the reports written by
// snapshot-guard.mjs and detect-matches.mjs. Writes reports/pipeline/pr-body.md.
// Env: INGEST_OUTCOME, INGEST_CLUB_OUTCOME, CHECK_OUTCOME (success|failure|skipped), RUN_URL.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../scripts/lib/ledger.mjs";
import { REPORT_DIR } from "./config.mjs";
import { readJson, readIfExists, atomicWrite, parseArgs } from "./lib/util.mjs";

const ICON = { updated: "🔄", unchanged: "✅", reverted: "↩️", invalid: "🛑", success: "✅", failure: "❌", cancelled: "❌", skipped: "⏭️" };
const tail = (t, n = 40) => (t ? t.trimEnd().split("\n").slice(-n).join("\n") : "");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");

export function renderBody({ refresh, detect, ingest = "skipped", ingestClub = "skipped", check = "skipped", ingestLog = "", ingestClubLog = "", checkLog = "", runUrl = "" }) {
  const L = [];
  L.push("## Daily source refresh — needs human review", "");
  L.push("> Opened automatically by `.github/workflows/daily-refresh.yml`. **It is never merged or published automatically.** Review the diff against the sources, then merge (which triggers the deploy) or close.", "");
  if (runUrl) L.push(`Workflow run: ${runUrl}`, "");

  L.push("### Snapshots (`npm run snapshots:refresh -- --only=intl|club`, checked by `pipeline/snapshot-guard.mjs`)", "");
  if (!refresh) L.push("Refresh report missing.", "");
  else {
    const g = refresh.groups ?? {};
    L.push(`Refresh steps: intl ${ICON[g.intl?.outcome] ?? ""} ${g.intl?.outcome ?? "?"}, club ${ICON[g.club?.outcome] ?? ""} ${g.club?.outcome ?? "?"}. Guard decision: **${refresh.decision}**.`, "");
    L.push("| File | Group | Status | Revision | Totals (before → after) | Note |", "|---|---|---|---|---|---|");
    for (const f of refresh.files ?? []) {
      const totals = Object.entries(f.metrics ?? {})
        .map(([k, v]) => (f.previous_metrics?.[k] != null && f.previous_metrics[k] !== v ? `${k} ${f.previous_metrics[k]} → ${v}` : `${k} ${v}`))
        .join("; ");
      L.push(`| \`${f.file}\` | ${f.group} | ${ICON[f.status] ?? ""} ${f.status} | ${esc(f.revision ?? "")} | ${esc(totals)} | ${esc(f.error ?? "")} |`);
    }
    L.push("");
    if (refresh.errors?.length) {
      L.push("**Problems (previous snapshots were kept where noted):**");
      for (const e of refresh.errors) L.push(`- ${esc(e.group ?? e.file)}: ${esc(e.reason)}`);
      L.push("");
    }
  }

  L.push("### New-match candidates", "");
  const cands = detect?.candidates ?? [];
  if (!cands.length) L.push("None.", "");
  else {
    L.push("| Date | Match | Score | Competition | Found via | New? | Hint |", "|---|---|---|---|---|---|---|");
    for (const c of cands)
      L.push(`| ${c.date} | ${esc(c.home_team)} vs ${esc(c.away_team)} | ${c.score ?? "?"} | ${esc(c.competition)} | ${c.sources.join(", ")} | ${detect.new_candidates?.includes(c.key) ? "🆕" : ""} | ${esc(detect.hints?.[c.key] ?? "")} |`);
    L.push("", "Check each one: was Ronaldo in the squad / did he play? Then add it through the ingest with citations, or dismiss it in `pipeline/config/dismissed-candidates.json`.", "");
  }
  for (const n of detect?.notes ?? []) L.push(`- note: ${n}`);
  for (const e of detect?.errors ?? []) L.push(`- detect error: ${e.source} ${e.url ?? ""} — ${e.error}`);
  if (detect?.notes?.length || detect?.errors?.length) L.push("");

  L.push("### Ledger checks (run in the scheduled job)", "");
  L.push(`- \`npm run ingest:intl\`: ${ICON[ingest] ?? ""} ${ingest}`);
  L.push(`- \`node scripts/ingest/club.mjs\`: ${ICON[ingestClub] ?? ""} ${ingestClub}`);
  L.push(`- \`npm run check\`: ${ICON[check] ?? ""} ${check}`, "");
  if (ingest === "failure" && ingestLog) L.push("<details><summary>ingest output (tail)</summary>", "", "```", tail(ingestLog), "```", "</details>", "");
  if (ingestClub === "failure" && ingestClubLog) L.push("<details><summary>club ingest output (tail)</summary>", "", "```", tail(ingestClubLog), "```", "</details>", "");
  if (check === "failure" && checkLog) L.push("<details><summary>check output (tail)</summary>", "", "```", tail(checkLog), "```", "</details>", "");

  L.push("### Reviewer checklist", "");
  L.push("- [ ] Diff of `data/raw/` matches the live sources (revision ids above)");
  L.push("- [ ] Ingest disagreements resolved via `data/manual/*` (never by hand-editing generated CSVs)");
  L.push("- [ ] `revision` / `accessed_at` updated in `data/sources.csv` for changed sources");
  L.push("- [ ] `data/reconciliation/expectations.json` updated only for a real new goal/cap, citing the source");
  L.push("- [ ] `npm run check` passes (CI may need a close/reopen of this PR if it was opened with `GITHUB_TOKEN`)");
  return L.join("\n") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ?? ROOT;
  const dir = join(root, REPORT_DIR);
  const body = renderBody({
    refresh: readJson(join(dir, "refresh.json"), null),
    detect: readJson(join(dir, "detect.json"), null),
    ingest: process.env.INGEST_OUTCOME || "skipped",
    ingestClub: process.env.INGEST_CLUB_OUTCOME || "skipped",
    ingestClubLog: readIfExists(join(dir, "ingest-club.log")) ?? "",
    check: process.env.CHECK_OUTCOME || "skipped",
    ingestLog: readIfExists(join(dir, "ingest.log")) ?? "",
    checkLog: readIfExists(join(dir, "check.log")) ?? "",
    runUrl: process.env.RUN_URL || "",
  });
  atomicWrite(join(dir, "pr-body.md"), body);
  console.log(body);
}
