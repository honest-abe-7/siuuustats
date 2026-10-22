// Snapshot source definitions. Each source knows how to fetch itself, how to compute a *semantic*
// digest (via the same parsers the M2 ingest uses, so a snapshot only changes when its data does),
// and an optional guard that rejects suspicious regressions (e.g. vandalism lowering totals).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { RAW, parseWikiList, parseWikiArticle, parseRsssf } from "../../scripts/lib/sources-raw.mjs";
import { WIKI, MARTJ42, RSSSF_URL, PIPELINE_SNAPSHOT_DIR } from "../config.mjs";
import { mediawikiRevision, extractCareerStatsTable, parseCareerTotal, revisionUrl } from "./wikitext.mjs";
import { portugalOnly, rowCount } from "./martj42.mjs";
import { sha256, digestOf } from "./util.mjs";

/** Run an M2 parser (which reads `<root>/<rel>`) against in-memory text. */
export function parseAs(relPath, text, parser) {
  const dir = mkdtempSync(join(tmpdir(), "siuuu-parse-"));
  try {
    mkdirSync(dirname(join(dir, relPath)), { recursive: true });
    writeFileSync(join(dir, relPath), text, "utf8");
    return parser(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const notDecreasing = (label, before, after) => {
  if (before != null && after != null && after < before)
    throw new Error(`${label} decreased from ${before} to ${after}; refusing update (possible vandalism or parse drift)`);
};

const listParsed = (text) => {
  const p = parseAs(RAW.wikiList, text, parseWikiList);
  if (!p.goals.length || !(p.totals.goals > 0) || !(p.totals.caps > 0)) throw new Error("wiki list: goals table empty");
  return p;
};

const articleParsed = (text) => {
  const rev = mediawikiRevision(JSON.parse(text));
  const a = parseAs(RAW.wikiArticle, text, parseWikiArticle);
  if (a.infoboxCaps == null || a.infoboxGoals == null) throw new Error("wiki article: infobox national caps/goals not found");
  const table = extractCareerStatsTable(rev.content);
  return { infobox: a, table, career: parseCareerTotal(table), revid: rev.revid };
};

const rsssfParsed = (text) => {
  const r = parseAs(RAW.rsssf, text, parseRsssf);
  if (!r.caps.length) throw new Error("RSSSF: no caps parsed");
  return r;
};

/** martj42 commit sha (best effort, optional GITHUB_TOKEN for rate limits). */
async function martj42Revision(ctx) {
  if (ctx.martj42Sha !== undefined) return ctx.martj42Sha;
  try {
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const r = await ctx.client.getJson(MARTJ42.commitApi, { headers });
    ctx.martj42Sha = typeof r.json.sha === "string" ? r.json.sha : null;
  } catch (e) {
    ctx.warn(`martj42 commit sha unavailable: ${e.message}`);
    ctx.martj42Sha = null;
  }
  return ctx.martj42Sha;
}

const martj42Source = (key, file, sourceId) => ({
  id: sourceId,
  file: RAW[key],
  manifest: "data/raw/MANIFEST.json",
  async fetch(ctx) {
    const url = `${MARTJ42.raw}/${file}`;
    const r = await ctx.client.get(url);
    return {
      text: portugalOnly(r.text, file),
      entry: { source_id: sourceId, url, revision: await martj42Revision(ctx), licence: "CC0 1.0", note: "Filtered to matches involving Portugal." },
    };
  },
  digest: (text) => sha256(text),
  guard: (oldText, newText) => notDecreasing(`martj42 ${file} Portugal rows`, rowCount(oldText), rowCount(newText)),
});

export const SOURCES = [
  {
    id: "wikipedia-cr7-intl-goals",
    file: RAW.wikiList,
    manifest: "data/raw/MANIFEST.json",
    async fetch(ctx) {
      const url = WIKI.restHtml(WIKI.intlList);
      const r = await ctx.client.get(url);
      ctx.intlListRevision = r.headers.get("content-revision-id");
      return { text: r.text, entry: { source_id: "wikipedia-cr7-intl-goals", url, revision: ctx.intlListRevision, licence: "CC BY-SA 4.0" } };
    },
    digest: (text) => digestOf(listParsed(text)),
    guard(oldText, newText) {
      const [a, b] = [listParsed(oldText), listParsed(newText)];
      notDecreasing("International goals (Wikipedia list)", a.totals.goals, b.totals.goals);
      notDecreasing("International caps (Wikipedia list)", a.totals.caps, b.totals.caps);
    },
  },
  {
    // Raw wikitext of the same list page (same revision as the HTML when known): readable diffs in PRs.
    id: "wikipedia-cr7-intl-goals-wikitext",
    file: `${PIPELINE_SNAPSHOT_DIR}/wikipedia-cr7-international-goals.wikitext`,
    manifest: `${PIPELINE_SNAPSHOT_DIR}/MANIFEST.json`,
    async fetch(ctx) {
      const url = revisionUrl(WIKI.api, ctx.intlListRevision ? { revid: ctx.intlListRevision } : { title: WIKI.intlList });
      const r = await ctx.client.getJson(url);
      const rev = mediawikiRevision(r.json);
      return {
        text: rev.content.endsWith("\n") ? rev.content : rev.content + "\n",
        entry: { source_id: "wikipedia-cr7-intl-goals", url: `https://en.wikipedia.org/w/index.php?title=${WIKI.intlList}&oldid=${rev.revid}`, revision: String(rev.revid), licence: "CC BY-SA 4.0", note: "Raw wikitext via the MediaWiki Action API." },
      };
    },
    digest(text) {
      if (!/\{\|[\s\S]*\|\}/.test(text) || text.length < 1000) throw new Error("intl goals wikitext: no table");
      return sha256(text);
    },
  },
  {
    id: "wikipedia-cristiano-ronaldo",
    file: RAW.wikiArticle,
    manifest: "data/raw/MANIFEST.json",
    async fetch(ctx) {
      const url = revisionUrl(WIKI.api, { title: WIKI.article });
      const r = await ctx.client.get(url);
      const rev = mediawikiRevision(JSON.parse(r.text));
      ctx.articleWikitext = rev.content;
      ctx.articleRevision = String(rev.revid);
      // Stored as the raw API body, same shape as scripts/ingest/fetch-snapshots.mjs writes.
      return { text: r.text, entry: { source_id: "wikipedia-cristiano-ronaldo", url: "https://en.wikipedia.org/wiki/Cristiano_Ronaldo", revision: ctx.articleRevision, licence: "CC BY-SA 4.0" } };
    },
    // Only infobox numbers, lead win count and the career table matter to the ledger; other edits are ignored.
    digest(text) {
      const p = articleParsed(text);
      const { infoboxCaps, infoboxGoals, leadWins } = p.infobox;
      return digestOf({ infoboxCaps, infoboxGoals, leadWins, table: p.table });
    },
    guard(oldText, newText) {
      const [a, b] = [articleParsed(oldText), articleParsed(newText)];
      notDecreasing("Infobox national caps", a.infobox.infoboxCaps, b.infobox.infoboxCaps);
      notDecreasing("Infobox national goals", a.infobox.infoboxGoals, b.infobox.infoboxGoals);
      notDecreasing("Club career total apps", a.career.apps, b.career.apps);
      notDecreasing("Club career total goals", a.career.goals, b.career.goals);
    },
  },
  {
    // The club career statistics table, cut out of the article wikitext fetched above (no extra request).
    id: "wikipedia-cr7-career-stats-wikitext",
    file: `${PIPELINE_SNAPSHOT_DIR}/wikipedia-cr7-career-stats.wikitext`,
    manifest: `${PIPELINE_SNAPSHOT_DIR}/MANIFEST.json`,
    async fetch(ctx) {
      if (!ctx.articleWikitext) throw new Error("article wikitext not available (article fetch failed)");
      return {
        text: extractCareerStatsTable(ctx.articleWikitext),
        entry: { source_id: "wikipedia-cristiano-ronaldo", url: `https://en.wikipedia.org/w/index.php?title=${WIKI.article}&oldid=${ctx.articleRevision}#Career_statistics`, revision: ctx.articleRevision, licence: "CC BY-SA 4.0", note: "Club career statistics table, raw wikitext." },
      };
    },
    digest(text) {
      parseCareerTotal(text);
      return sha256(text);
    },
    guard(oldText, newText) {
      const [a, b] = [parseCareerTotal(oldText), parseCareerTotal(newText)];
      notDecreasing("Club career total apps", a.apps, b.apps);
      notDecreasing("Club career total goals", a.goals, b.goals);
    },
  },
  {
    id: "rsssf-cronaldo-intlg",
    file: RAW.rsssf,
    manifest: "data/raw/MANIFEST.json",
    async fetch(ctx) {
      const r = await ctx.client.get(RSSSF_URL, { encoding: "latin1" });
      return {
        text: r.text,
        entry: { source_id: "rsssf-cronaldo-intlg", url: RSSSF_URL, revision: (r.text.match(/Last updated:\s*([^<\n]+)/) || [])[1]?.trim() ?? null, licence: "Free with acknowledgement (RSSSF)" },
      };
    },
    digest(text) {
      const { lastUpdated, ...data } = rsssfParsed(text); // a new "Last updated" stamp alone is not a change
      return digestOf({ ...data, caps: [...data.caps], totalLine: data.caps.totalLine ?? null });
    },
    guard: (oldText, newText) => notDecreasing("RSSSF caps", rsssfParsed(oldText).caps.length, rsssfParsed(newText).caps.length),
  },
  martj42Source("m42results", "results.csv", "martj42-results"),
  martj42Source("m42goals", "goalscorers.csv", "martj42-goalscorers"),
  martj42Source("m42shootouts", "shootouts.csv", "martj42-shootouts"),
];
