// Per-snapshot checks layered on top of scripts/ingest/fetch-snapshots.mjs (which owns fetching,
// pinning and the MANIFEST). For every data/raw file we know:
//   group   which `--only=` group refreshes it
//   digest  a *semantic* digest computed with the same parsers the ingest uses, so a re-render,
//           an unrelated wiki edit or a new "Last updated" stamp is not treated as a change
//   metrics totals that must never go down (vandalism / upstream breakage guard)
// Parsing failures are validation failures.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RAW,
  parseWikiList,
  parseWikiArticle,
  parseRsssf,
  parseEswikiClub,
  parseWikiClubTable,
  loadKaggleGoals,
  loadClubSeasonSnippets,
} from "../../scripts/lib/sources-raw.mjs";
import { mediawikiRevision, extractCareerStatsTable } from "./wikitext.mjs";
import { rowCount } from "./martj42.mjs";
import { sha256, digestOf } from "./util.mjs";

const text = (root, rel) => readFileSync(join(root, rel), "utf8");

const martj42 = (key) => ({
  file: RAW[key],
  group: "intl",
  inspect(root) {
    const t = text(root, RAW[key]);
    const n = rowCount(t);
    if (!t.startsWith("date,home_team,away_team")) throw new Error(`${RAW[key]}: unexpected header`);
    if (n === 0) throw new Error(`${RAW[key]}: no rows`);
    return { digest: sha256(t), metrics: { [`${key}_rows`]: n } };
  },
});

export const CHECKS = [
  {
    file: RAW.wikiList,
    group: "intl",
    inspect(root) {
      const p = parseWikiList(root);
      if (!p.goals.length || !(p.totals.goals > 0) || !(p.totals.caps > 0)) throw new Error("Wikipedia list: goals table empty");
      return { digest: digestOf(p), metrics: { intl_goals_wikipedia_list: p.totals.goals, intl_caps_wikipedia_list: p.totals.caps } };
    },
  },
  {
    file: RAW.wikiArticle,
    group: "intl",
    inspect(root) {
      const rev = mediawikiRevision(JSON.parse(text(root, RAW.wikiArticle)));
      const a = parseWikiArticle(root);
      if (a.infoboxCaps == null || a.infoboxGoals == null) throw new Error("Wikipedia article: infobox national caps/goals not found");
      const table = extractCareerStatsTable(rev.content);
      return {
        digest: digestOf({ infoboxCaps: a.infoboxCaps, infoboxGoals: a.infoboxGoals, leadWins: a.leadWins, table }),
        metrics: { infobox_caps: a.infoboxCaps, infobox_goals: a.infoboxGoals },
      };
    },
  },
  {
    file: RAW.rsssf,
    group: "intl",
    inspect(root) {
      const { lastUpdated, ...r } = parseRsssf(root);
      if (!r.caps.length) throw new Error("RSSSF: no caps parsed");
      return { digest: digestOf({ ...r, caps: [...r.caps] }), metrics: { rsssf_caps: r.caps.length } };
    },
  },
  martj42("m42results"),
  martj42("m42goals"),
  martj42("m42shootouts"),
  {
    file: RAW.eswikiClub,
    group: "club",
    inspect(root) {
      const rows = parseEswikiClub(root);
      if (!rows.length) throw new Error("eswiki: no club matches parsed");
      return { digest: digestOf(rows), metrics: { eswiki_club_matches: rows.length, eswiki_club_goals: rows.reduce((s, r) => s + r.goals, 0) } };
    },
  },
  {
    file: RAW.wikiClubTable,
    group: "club",
    inspect(root) {
      const rows = parseWikiClubTable(root);
      const career = rows.find((r) => r.kind === "career");
      if (!career?.total?.apps || !career?.total?.goals) throw new Error("enwiki club table: no career total");
      return { digest: digestOf(rows), metrics: { club_career_apps: career.total.apps, club_career_goals: career.total.goals } };
    },
  },
  {
    file: RAW.kaggleGoals,
    group: "club",
    inspect(root) {
      const goals = loadKaggleGoals(root);
      if (!goals.length) throw new Error("Kaggle: no goals");
      return { digest: sha256(text(root, RAW.kaggleGoals)), metrics: { kaggle_goals: goals.length } };
    },
  },
  {
    file: RAW.wikiClubSeasons,
    group: "club",
    inspect(root) {
      const pages = loadClubSeasonSnippets(root);
      if (!Array.isArray(pages) || !pages.length) throw new Error("club season snippets: no pages");
      // A new revision id alone is not a change; the date-anchored text is.
      return { digest: digestOf(pages.map(({ revision, ...p }) => p)), metrics: { club_season_pages: pages.length } };
    },
  },
];

export const GROUPS = ["intl", "club"];

/** Inspect every snapshot under root. Returns { [file]: {digest, metrics} | {error} }. */
export function inspectAll(root, checks = CHECKS) {
  const out = {};
  for (const c of checks) {
    try {
      out[c.file] = c.inspect(root);
    } catch (e) {
      out[c.file] = { error: e.message };
    }
  }
  return out;
}

/** Names of metrics that went down between two inspections. */
export function regressions(before, after) {
  const out = [];
  for (const [file, a] of Object.entries(after)) {
    const b = before[file];
    if (!b?.metrics || !a?.metrics) continue;
    for (const [k, v] of Object.entries(a.metrics)) if (b.metrics[k] != null && v < b.metrics[k]) out.push({ file, metric: k, before: b.metrics[k], after: v });
  }
  return out;
}
