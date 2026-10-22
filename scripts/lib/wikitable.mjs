// Minimal, dependency-light parser for Wikipedia (Parsoid) HTML tables.
// Expands rowspan/colspan into a rectangular grid of cell texts.
import * as cheerio from "cheerio";

export function loadHtml(html) {
  return cheerio.load(html);
}

export function cellText($, cell) {
  const c = $(cell).clone();
  c.find("sup.mw-ref, sup.reference, .reference, style, .sortkey, [style*='display:none']").remove();
  return c
    .text()
    .replace(/\[[a-z0-9 ]{1,6}\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns { header: string[] (joined multi-row header labels), rows: string[][] } */
export function parseTable($, table) {
  const grid = [];
  const isHeader = [];
  const trs = $(table).children("thead, tbody, tfoot").children("tr").add($(table).children("tr"));
  trs.each((r, tr) => {
    grid[r] ??= [];
    let c = 0;
    let allTh = true;
    $(tr)
      .children("th, td")
      .each((_, cell) => {
        if (cell.tagName !== "th") allTh = false;
        while (grid[r][c] !== undefined) c++;
        const rs = Number($(cell).attr("rowspan") || 1);
        const cs = Number($(cell).attr("colspan") || 1);
        const text = cellText($, cell);
        for (let i = 0; i < rs; i++) {
          grid[r + i] ??= [];
          for (let j = 0; j < cs; j++) grid[r + i][c + j] = text;
        }
        c += cs;
      });
    isHeader[r] = allTh;
  });
  let h = 0;
  while (h < grid.length && isHeader[h]) h++;
  const width = Math.max(...grid.map((r) => r.length));
  const header = [];
  for (let c = 0; c < width; c++) {
    const parts = [];
    for (let r = 0; r < h; r++) {
      const v = grid[r][c] ?? "";
      if (v && parts[parts.length - 1] !== v) parts.push(v);
    }
    header.push(parts.join(" / "));
  }
  return { header, rows: grid.slice(h).filter((r) => r && r.length) };
}

/** Find the first wikitable whose header contains all `mustHave` labels and none of `mustNotHave`. */
export function findTable($, mustHave, mustNotHave = []) {
  let found = null;
  $("table.wikitable").each((_, t) => {
    if (found) return;
    const parsed = parseTable($, t);
    const hs = parsed.header;
    if (mustHave.every((m) => hs.includes(m)) && !mustNotHave.some((m) => hs.includes(m))) found = parsed;
  });
  if (!found) throw new Error(`Table with headers [${mustHave.join(", ")}] not found`);
  return found;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "12 June 2004" -> "2004-06-12" */
export function wikiDate(s) {
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  if (!m) throw new Error(`Unparseable date: ${s}`);
  const mon = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (!mon) throw new Error(`Unknown month in ${s}`);
  return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
