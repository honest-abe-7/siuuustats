// Parsers for the raw source snapshots in data/raw/. Pure functions over file contents,
// shared by the ingest script (to build rows) and the reconciliation suite (to read expected totals).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadHtml, findTable, wikiDate } from "./wikitable.mjs";
import { readCsv } from "./csv.mjs";
import { ROOT } from "./ledger.mjs";

export const RAW = {
  wikiList: "data/raw/wikipedia-cr7-international-goals.html",
  wikiArticle: "data/raw/wikipedia-cristiano-ronaldo.json",
  rsssf: "data/raw/rsssf-cronaldo-intlg.html",
  m42results: "data/raw/martj42-portugal-results.csv",
  m42goals: "data/raw/martj42-portugal-goalscorers.csv",
  m42shootouts: "data/raw/martj42-portugal-shootouts.csv",
};

const read = (rel, root = ROOT) => readFileSync(join(root, rel), "utf8");
const firstScore = (s) => {
  const m = dash(s).match(/(\d+)\s*-\s*(\d+)/);
  if (!m) throw new Error(`No score in "${s}"`);
  return `${m[1]}-${m[2]}`;
};
const dash = (s) => s.replace(/[\u2013\u2014\u2212]/g, "-");

/** Wikipedia list page: senior goals table, hat-tricks, by-year, by-competition. */
export function parseWikiList(root = ROOT) {
  const $ = loadHtml(read(RAW.wikiList, root));
  const goalsT = findTable($, ["No.", "Cap", "Date", "Venue", "Opponent", "Score", "Result", "Competition"], ["Team"]);
  const idx = (n) => goalsT.header.indexOf(n);
  const goals = goalsT.rows.map((r) => {
    const scoreRaw = r[idx("Score")];
    return {
      no: Number(r[idx("No.")]),
      cap: Number(r[idx("Cap")]),
      date: wikiDate(r[idx("Date")]),
      venue: r[idx("Venue")],
      opponent: r[idx("Opponent")],
      score: firstScore(scoreRaw),
      penalty: scoreRaw.includes("\u2021"),
      result: firstScore(r[idx("Result")]),
      competition: r[idx("Competition")],
    };
  });
  const hatT = findTable($, ["No.", "Date", "Opponent", "Goals", "Result"]);
  const hatTricks = hatT.rows.map((r) => ({
    date: wikiDate(r[hatT.header.indexOf("Date")]),
    opponent: r[hatT.header.indexOf("Opponent")],
    goals: Number(r[hatT.header.indexOf("Goals")].match(/^\d+/)[0]),
  }));
  const yearT = findTable($, ["Year", "Competitive / Apps", "Competitive / Goals"]);
  const yh = yearT.header;
  const num = (v) => (/^\d+$/.test(v) ? Number(v) : 0);
  const byYear = yearT.rows
    .filter((r) => /^\d{4}$/.test(r[0]))
    .map((r) => ({
      year: r[0],
      competitiveApps: num(r[yh.indexOf("Competitive / Apps")]),
      competitiveGoals: num(r[yh.indexOf("Competitive / Goals")]),
      friendlyApps: num(r[yh.indexOf("Friendly / Apps")]),
      friendlyGoals: num(r[yh.indexOf("Friendly / Goals")]),
      totalApps: num(r[yh.indexOf("Total / Apps")]),
      totalGoals: num(r[yh.indexOf("Total / Goals")]),
    }));
  const yearTotal = yearT.rows.find((r) => r[0] === "Total");
  const compT = findTable($, ["Competition", "Caps", "Goals"]);
  const byCompetition = compT.rows
    .filter((r) => r[0] !== "Total")
    .map((r) => ({ name: r[0], caps: Number(r[1]), goals: Number(r[2]) }));
  const compTotal = compT.rows.find((r) => r[0] === "Total");
  return {
    goals,
    hatTricks,
    byYear,
    byCompetition,
    totals: {
      caps: Number(compTotal[1]),
      goals: Number(compTotal[2]),
      competitiveApps: Number(yearTotal[yh.indexOf("Competitive / Apps")]),
      competitiveGoals: Number(yearTotal[yh.indexOf("Competitive / Goals")]),
      friendlyApps: Number(yearTotal[yh.indexOf("Friendly / Apps")]),
      friendlyGoals: Number(yearTotal[yh.indexOf("Friendly / Goals")]),
    },
  };
}

/** Wikipedia article: infobox national caps/goals and lead-section win count. */
export function parseWikiArticle(root = ROOT) {
  const json = JSON.parse(read(RAW.wikiArticle, root));
  const rev = json.query.pages[0].revisions[0];
  const text = rev.slots.main.content;
  const pick = (re) => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    revision: String(rev.revid),
    timestamp: rev.timestamp,
    infoboxCaps: pick(/\|\s*national_caps6\s*=\s*(?:\[\[[^\]|]*\|)?(\d+)/),
    infoboxGoals: pick(/\|\s*national_goals6\s*=\s*(?:\[\[[^\]|]*\|)?(\d+)/),
    leadWins: pick(/most international victories \((\d+)\)/),
  };
}

/** RSSSF cap list. */
export function parseRsssf(root = ROOT) {
  const text = read(RAW.rsssf, root)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
  const caps = [];
  const footnotes = {};
  let lastUpdated = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+(?:(\d+)\s+)?(?:(\d+)\s+)?(\d{1,2})-\s?(\d{1,2})-(\d{2})\s+(.*)$/);
    if (m) {
      const [, cap, a, b, d, mo, yy, rest] = m;
      const goalsInMatch = b !== undefined ? Number(a) : 0; // one number = running total only
      const t = rest.match(/^(.+?)\s+(\d+)-(\d+)(\s+aet)?(?:\s*\[(\d+)\])?\s*(.*)$/);
      if (!t) throw new Error(`RSSSF: cannot parse score in line: ${line}`);
      const parts = t[1].trim().split(/\t+| {2,}/).map((x) => x.trim()).filter(Boolean);
      if (parts.length < 2) throw new Error(`RSSSF: cannot split venue/opponent in line: ${line}`);
      const venue = parts[0];
      const opponent = parts.slice(1).join(" ");
      caps.push({
        cap: Number(cap),
        goals: goalsInMatch,
        date: `20${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
        venue,
        opponent,
        scoreFor: Number(t[2]),
        scoreAgainst: Number(t[3]),
        aet: Boolean(t[4]),
        footnote: t[5] ? Number(t[5]) : null,
        competition: t[6].trim() || "Friendly",
      });
      continue;
    }
    const f = line.match(/^\[(\d+)\] Portugal (won|lost) (\d+)-(\d+) on penalty kicks/);
    if (f) footnotes[f[1]] = `${f[2]} ${f[3]}-${f[4]}`;
    const u = line.match(/Last updated:\s*(.+)$/);
    if (u) lastUpdated = u[1].trim();
    const tot = line.match(/^Total caps \/ goals:\s*(\d+)\s+(\d+)/);
    if (tot) caps.totalLine = { caps: Number(tot[1]), goals: Number(tot[2]) };
  }
  const rec = text.match(/Matches\s+Won\s+Draw\s+Lost[^\n]*\n\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
  return {
    caps,
    footnotes,
    lastUpdated,
    totals: caps.totalLine ?? null,
    record: rec ? { matches: Number(rec[1]), won: Number(rec[2]), drawn: Number(rec[3]), lost: Number(rec[4]) } : null,
  };
}

export function loadMartj42(root = ROOT) {
  return {
    results: readCsv(join(root, RAW.m42results)).rows,
    goals: readCsv(join(root, RAW.m42goals)).rows,
    shootouts: readCsv(join(root, RAW.m42shootouts)).rows,
  };
}
