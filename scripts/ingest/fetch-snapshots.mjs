#!/usr/bin/env node
// Refreshes the raw source snapshots in data/raw/ and rewrites data/raw/MANIFEST.json.
// Network access only happens here; every other script works offline from the snapshots.
// Usage: npm run snapshots:refresh [-- --only=intl|club]
//   intl: Wikipedia international list + article, RSSSF, martj42
//   club: Spanish Wikipedia club match list, the club career table of the pinned English article revision, Kaggle seed
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7) || null;
const want = (group) => !only || only === group;
const manifestPath = join(ROOT, "data/raw/MANIFEST.json");
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")).entries : [];

if (want("intl")) {
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

}

if (want("club")) {
  // Spanish Wikipedia: every official club match (CC BY-SA 4.0). Only the match table is kept.
  const esTitle = "Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes";
  const es = await get(`https://es.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(esTitle)}`);
  const cheerio = await import("cheerio");
  const $es = cheerio.load(es.text);
  const matchTable = $es("table.wikitable").filter((_, t) => /Minuto\.G/.test($es(t).find("tr").first().text())).first();
  if (!matchTable.length) throw new Error("eswiki match table not found");
  // Slim the snapshot: drop images and Parsoid ids; keep text and data-mw (sub on/off and flag templates).
  matchTable.find("img").remove();
  matchTable.find("*").each((_, el) => {
    for (const a of ["id", "about", "typeof", "rel", "class", "resource", "srcset", "title"]) $es(el).removeAttr(a);
    const mw = $es(el).attr("data-mw");
    if (mw && !/"(bandera|subon|suboff|Subon|Suboff)"/.test(mw)) $es(el).removeAttr("data-mw");
  });
  save(RAW.eswikiClub, `<!doctype html><meta charset="utf-8"><body>${$es.html(matchTable)}</body>\n`, {
    source_id: "eswiki-cr7-club-matches",
    url: `https://es.wikipedia.org/wiki/${esTitle}`,
    revision: es.headers.get("content-revision-id"),
    licence: "CC BY-SA 4.0",
    note: "Only the 'Detalle de cada partido' table is kept.",
  });

  // English Wikipedia: club career table from the SAME revision as the pinned article snapshot.
  const articleEntry = [...entries, ...previous].find((e) => e.source_id === "wikipedia-cristiano-ronaldo" && e.file === RAW.wikiArticle);
  const rev = articleEntry?.revision;
  if (!rev) throw new Error("No pinned revision for wikipedia-cristiano-ronaldo; refresh intl first");
  const en = await get(`https://en.wikipedia.org/api/rest_v1/page/html/Cristiano_Ronaldo/${rev}`);
  const $en = cheerio.load(en.text);
  const clubTable = $en("table.wikitable").filter((_, t) => /Appearances and goals by club/.test($en(t).find("caption").text())).first();
  if (!clubTable.length) throw new Error("enwiki club career table not found");
  save(RAW.wikiClubTable, `<!doctype html><meta charset="utf-8"><body>${$en.html(clubTable)}</body>\n`, {
    source_id: "wikipedia-cristiano-ronaldo",
    url: `https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=${rev}`,
    revision: rev,
    licence: "CC BY-SA 4.0",
    note: "Only the 'Appearances and goals by club, season and competition' table is kept.",
  });

  // English Wikipedia club season articles linked from the career table: keep only date-anchored snippets
  // (the text around every "D Month YYYY"), enough to verify match dates, opponents and scorers offline.
  const seasonTitles = [...new Set(clubTable.find("a").map((_, a) => $en(a).attr("href")).get().filter((h) => /season$/.test(h)).map((h) => decodeURIComponent(h.replace(/^\.\//, ""))))];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dateRe = new RegExp(`\\b(\\d{1,2}) (${MONTHS.join("|")}) (\\d{4})\\b`, "g");
  const pages = [];
  for (const title of seasonTitles) {
    let page = null;
    for (let attempt = 0; attempt < 4 && !page; attempt++) {
      try {
        page = await get(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`);
      } catch (e) {
        if (!/^429/.test(e.message) || attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      }
    }
    const $p = cheerio.load(page.text);
    $p("style, script").remove();
    const text = $p("body").text().replace(/\s+/g, " ");
    const snippets = [];
    for (const m of text.matchAll(dateRe)) {
      const iso = `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      snippets.push({ date: iso, text: text.slice(Math.max(0, m.index - 80), m.index + 360) });
    }
    pages.push({ title, url: `https://en.wikipedia.org/wiki/${title}`, revision: page.headers.get("content-revision-id"), snippets });
    await new Promise((r) => setTimeout(r, 750));
  }
  save(RAW.wikiClubSeasons, JSON.stringify({ pages }, null, 1) + "\n", {
    source_id: "wikipedia-club-season-articles",
    url: "https://en.wikipedia.org/wiki/Cristiano_Ronaldo#Club",
    revision: pages.map((p) => `${p.title}@${p.revision}`).join(" "),
    licence: "CC BY-SA 4.0",
    note: "Date-anchored text snippets only (80 chars before, 360 after each date).",
  });

  // Kaggle seed (CC BY-SA 4.0). Public datasets download anonymously; no account or API key is used.
  const ref = "sigmaborov/ronaldo-cr7-all-goals-goat";
  const meta = JSON.parse((await get(`https://www.kaggle.com/api/v1/datasets/view/${ref}`)).text);
  const res = await fetch(`https://www.kaggle.com/api/v1/datasets/download/${ref}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} Kaggle download`);
  const zipPath = join(tmpdir(), "siuuustats-kaggle.zip");
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const csvText = execFileSync("unzip", ["-p", zipPath, "ronaldo_goals_kaggle_ready.csv"]).toString("utf8");
  save(RAW.kaggleGoals, csvText, {
    source_id: "kaggle-sigmaborov-cr7-goals",
    url: `https://www.kaggle.com/datasets/${ref}`,
    revision: `version ${meta.currentVersionNumber} (${meta.lastUpdated})`,
    licence: meta.licenseName,
    note: "Seed only: every season must reconcile with Wikipedia before rows are accepted.",
  });
}

const merged = [...previous.filter((p) => !entries.some((e) => e.file === p.file)), ...entries].sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(manifestPath, JSON.stringify({ generated_by: "scripts/ingest/fetch-snapshots.mjs", entries: merged }, null, 2) + "\n");
console.log(`Saved ${entries.length} snapshots. Update revision/accessed_at in data/sources.csv if they changed:`);
for (const e of entries) console.log(`  ${e.source_id}: ${e.revision}`);
