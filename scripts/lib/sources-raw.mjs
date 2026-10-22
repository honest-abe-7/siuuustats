// Parsers for the raw source snapshots in data/raw/. Pure functions over file contents,
// shared by the ingest script (to build rows) and the reconciliation suite (to read expected totals).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadHtml, findTable, wikiDate, parseTable as parseTableImported } from "./wikitable.mjs";
import { readCsv } from "./csv.mjs";
import { ROOT } from "./ledger.mjs";

export const RAW = {
  wikiList: "data/raw/wikipedia-cr7-international-goals.html",
  wikiArticle: "data/raw/wikipedia-cristiano-ronaldo.json",
  rsssf: "data/raw/rsssf-cronaldo-intlg.html",
  m42results: "data/raw/martj42-portugal-results.csv",
  m42goals: "data/raw/martj42-portugal-goalscorers.csv",
  m42shootouts: "data/raw/martj42-portugal-shootouts.csv",
  eswikiClub: "data/raw/eswiki-cr7-club-matches.html",
  wikiClubTable: "data/raw/wikipedia-cr7-club-career-table.html",
  kaggleGoals: "data/raw/kaggle-sigmaborov-ronaldo-goals.csv",
  wikiClubSeasons: "data/raw/wikipedia-club-season-snippets.json",
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

// ---------------------------------------------------------------------------------------------
// Club sources (M3)
// ---------------------------------------------------------------------------------------------

const templatesIn = ($, el) => {
  const out = [];
  $(el)
    .find("[data-mw]")
    .addBack("[data-mw]")
    .each((_, e) => {
      try {
        for (const p of JSON.parse($(e).attr("data-mw")).parts || [])
          if (p.template) out.push({ name: p.template.target.wt.trim().toLowerCase(), params: Object.fromEntries(Object.entries(p.template.params || {}).map(([k, v]) => [k, v.wt])) });
      } catch {
        /* not a template */
      }
    });
  return out;
};

/**
 * Spanish Wikipedia "Partidos oficiales de Cristiano Ronaldo en clubes": one row per official club match.
 * Returns raw-but-typed rows; interpretation (orientation, stages, ids) happens in the ingest script.
 */
export function parseEswikiClub(root = ROOT) {
  const $ = loadHtml(read(RAW.eswikiClub, root));
  const table = $("table").first();
  const header = table.find("tr").first().children().map((_, c) => $(c).text().trim()).get();
  const want = ["N", "Fecha", "Rival", "Estadio", "Ciudad", "Res.", "G", "Minuto.G", "AP", "A", "Minuto.A", "BA", "Competencia", "Notas", "PR", "MJ", "Temporada"];
  if (want.some((w, i) => header[i] !== w)) throw new Error(`eswiki header changed: ${header.join("|")}`);
  // Temporada is a rowspan cell; carry it down.
  let season = null;
  const rows = [];
  table
    .find("tr")
    .slice(1)
    .each((_, tr) => {
      const tds = $(tr).children("td");
      if (!tds.length) return;
      const cells = tds.map((_, td) => cellTextLocal($, td)).get();
      if (cells.length === 17) season = cells[16];
      if (!/^\d+$/.test(cells[0] || "")) return;
      const [d, mo, y] = cells[1].split("/");
      const notasTemplates = templatesIn($, tds[13]).map((t) => t.name);
      const flag = templatesIn($, tds[2]).find((t) => t.name === "bandera")?.params["1"] ?? null;
      rows.push({
        n: Number(cells[0]),
        date: `${y}-${mo}-${d}`,
        opponent: cells[2].replace(/\*+$/, "").trim(),
        opponentFlag: flag,
        stadium: cells[3],
        venueCode: (cells[3].match(/\(([LVN])\)\s*$/) || [])[1] ?? null,
        city: cells[4],
        result: cells[5],
        goals: /^\d+$/.test(cells[6]) ? Number(cells[6]) : 0,
        goalCell: cells[7],
        assistedBy: cells[8],
        assists: /^\d+$/.test(cells[9]) ? Number(cells[9]) : 0,
        competition: cells[12],
        notes: cells[13],
        subOn: notasTemplates.includes("subon"),
        subOff: notasTemplates.includes("suboff"),
        keeper: cells[14],
        minutes: /^\d+$/.test(cells[15]) ? Number(cells[15]) : null,
        season: (cells.length === 17 ? cells[16] : season)?.replace(".", "-") ?? null,
      });
    });
  return rows;
}

function cellTextLocal($, td) {
  const c = $(td).clone();
  c.find("sup, style").remove();
  return c.text().replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

/** English Wikipedia club career table: apps/goals per club, season and competition column. */
export function parseWikiClubTable(root = ROOT) {
  const $ = loadHtml(read(RAW.wikiClubTable, root));
  const { header, rows } = (() => {
    const t = $("table").first();
    return { ...parseTableLocal($, t) };
  })();
  const cats = ["league", "national_cup", "league_cup", "continental", "other", "total"];
  const num = (s) => (s === "—" || s === "" ? null : Number(s.replace(/,/g, "")));
  const out = [];
  for (const r of rows) {
    const [club, season, division, ...vals] = r;
    const rec = { club, season: season.replace("–", "-"), division };
    cats.forEach((c, i) => (rec[c] = { apps: num(vals[i * 2]), goals: num(vals[i * 2 + 1]) }));
    rec.kind = club === "Career total" ? "career" : season === "Total" ? "club_total" : "season";
    out.push(rec);
  }
  if (!header.includes("Continental / Apps")) throw new Error("enwiki club table header changed");
  return out;
}

function parseTableLocal($, t) {
  return parseTableImported($, t);
}

/** Kaggle "Ronaldo CR7 All Goals GOAT" (sigmaborov, CC BY-SA 4.0): one row per goal. */
export function loadKaggleGoals(root = ROOT) {
  return readCsv(join(root, RAW.kaggleGoals)).rows.map((r, i) => {
    const [d, m, y] = r.match_date.split("/");
    const minute = r.goal_minute.match(/^(\d+)'(?:\+(\d+))?/);
    return {
      row: i + 2,
      competition: r.competition.trim(),
      stage: r.stage.trim(),
      date: `${Number(y) > 50 ? "19" : "20"}${y}-${m}-${d}`,
      homeAway: r.home_away,
      team: r.team,
      opponent: r.opponent,
      finalScore: r.final_score,
      minute: minute ? Number(minute[1]) : null,
      addedTime: minute && minute[2] ? Number(minute[2]) : null,
      scoreAfter: r.score_after_goal,
      method: r.goal_method.trim(),
      assist: r.assist_player && r.assist_player !== "Not Applicable" ? r.assist_player.trim() : null,
    };
  });
}

/** Date-anchored snippets from the English Wikipedia club season articles. */
export function loadClubSeasonSnippets(root = ROOT) {
  return JSON.parse(read(RAW.wikiClubSeasons, root)).pages;
}

/** Wikipedia article "Honours" section: team honours per club/country and individual awards (display labels). */
export function parseWikiHonours(root = ROOT) {
  const json = JSON.parse(read(RAW.wikiArticle, root));
  const text = json.query.pages[0].revisions[0].slots.main.content;
  const start = text.search(/==\s*Honours\s*==/);
  if (start < 0) throw new Error("Wikipedia article: no Honours section");
  const rest = text.slice(start + 5);
  const section = rest.slice(0, rest.search(/\n==[^=]/)).replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<!--[\s\S]*?-->/g, "");
  const label = (s) => s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").trim();
  const team = [];
  const individual = [];
  let heading = null;
  for (const line of section.split("\n")) {
    const h = line.match(/^'''(.+?)'''\s*$/);
    if (h) {
      heading = h[1];
      continue;
    }
    const m = line.match(/^\*\s*(.+?):\s*(.+)$/);
    if (!m || !heading || heading === "Orders") continue;
    const editions = label(m[2]).replace(/\(shared\)/, "").split(",").map((x) => x.trim().replace(/–/g, "-")).filter(Boolean);
    const item = { heading, name: label(m[1]), editions };
    (heading === "Individual" ? individual : team).push(item);
  }
  return { team, individual };
}
