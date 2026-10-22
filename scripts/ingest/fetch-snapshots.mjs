#!/usr/bin/env node
// Refreshes the raw source snapshots in data/raw/ and rewrites data/raw/MANIFEST.json.
// Network access only happens here; every other script works offline from the snapshots.
// Usage: npm run snapshots:refresh
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { ROOT } from "../lib/ledger.mjs";
import { RAW } from "../lib/sources-raw.mjs";

const UA = "siuuustats-ingest/0.1 (https://siuuustats.pages.dev; open-source fan stats project)";
const M42 = "https://raw.githubusercontent.com/martj42/international_results/master";

async function get(url, { latin1 = false } = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { text: latin1 ? new TextDecoder("latin1").decode(buf) : buf.toString("utf8"), headers: res.headers };
}

function portugalOnly(csvText) {
  const [header, ...rows] = parse(csvText, { bom: true });
  const h = header.indexOf("home_team");
  const a = header.indexOf("away_team");
  return stringify([header, ...rows.filter((r) => r[h] === "Portugal" || r[a] === "Portugal")]);
}

const sha = (s) => createHash("sha256").update(s).digest("hex");
const entries = [];
const save = (rel, text, meta) => {
  writeFileSync(join(ROOT, rel), text, "utf8");
  entries.push({ file: rel, sha256: sha(text), fetched_at: new Date().toISOString(), ...meta });
};

const list = await get("https://en.wikipedia.org/api/rest_v1/page/html/List_of_international_goals_scored_by_Cristiano_Ronaldo");
save(RAW.wikiList, list.text, {
  source_id: "wikipedia-cr7-intl-goals",
  url: "https://en.wikipedia.org/api/rest_v1/page/html/List_of_international_goals_scored_by_Cristiano_Ronaldo",
  revision: list.headers.get("content-revision-id"),
  licence: "CC BY-SA 4.0",
});

const art = await get(
  "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&titles=Cristiano_Ronaldo&format=json&formatversion=2"
);
save(RAW.wikiArticle, art.text, {
  source_id: "wikipedia-cristiano-ronaldo",
  url: "https://en.wikipedia.org/wiki/Cristiano_Ronaldo",
  revision: String(JSON.parse(art.text).query.pages[0].revisions[0].revid),
  licence: "CC BY-SA 4.0",
});

const rsssf = await get("https://www.rsssf.org/miscellaneous/cronaldo-intlg.html", { latin1: true });
save(RAW.rsssf, rsssf.text, {
  source_id: "rsssf-cronaldo-intlg",
  url: "https://www.rsssf.org/miscellaneous/cronaldo-intlg.html",
  revision: (rsssf.text.match(/Last updated:\s*([^<\n]+)/) || [])[1]?.trim() ?? null,
  licence: "Free with acknowledgement (RSSSF)",
});

let commit = null;
try {
  const c = await get("https://api.github.com/repos/martj42/international_results/commits/master");
  commit = JSON.parse(c.text).sha;
} catch (e) {
  console.warn("Could not read martj42 commit sha:", e.message);
}
for (const [key, file, id] of [
  ["m42results", "results.csv", "martj42-results"],
  ["m42goals", "goalscorers.csv", "martj42-goalscorers"],
  ["m42shootouts", "shootouts.csv", "martj42-shootouts"],
]) {
  const r = await get(`${M42}/${file}`);
  save(RAW[key], portugalOnly(r.text), {
    source_id: id,
    url: `${M42}/${file}`,
    revision: commit,
    licence: "CC0 1.0",
    note: "Filtered to matches involving Portugal.",
  });
}

writeFileSync(join(ROOT, "data/raw/MANIFEST.json"), JSON.stringify({ generated_by: "scripts/ingest/fetch-snapshots.mjs", entries }, null, 2) + "\n");
console.log(`Saved ${entries.length} snapshots. Update revision/accessed_at in data/sources.csv if they changed:`);
for (const e of entries) console.log(`  ${e.source_id}: ${e.revision}`);
