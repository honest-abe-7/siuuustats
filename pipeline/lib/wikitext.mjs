// Helpers for MediaWiki API responses (action=query&prop=revisions&rvslots=main&formatversion=2)
// and for the raw wikitext of Ronaldo's club career statistics table.

/** Validate a MediaWiki query response and return { title, revid, timestamp, content }. Throws on anything odd. */
export function mediawikiRevision(json) {
  if (!json || typeof json !== "object") throw new Error("MediaWiki: empty response");
  if (json.error) throw new Error(`MediaWiki API error ${json.error.code}: ${json.error.info}`);
  const page = json.query?.pages?.[0];
  if (!page) throw new Error("MediaWiki: no page in response");
  if (page.missing || page.invalid) throw new Error(`MediaWiki: page missing/invalid (${page.title})`);
  const rev = page.revisions?.[0];
  const content = rev?.slots?.main?.content;
  if (!rev?.revid || typeof content !== "string") throw new Error("MediaWiki: no revision content");
  if (content.length < 1000) throw new Error(`MediaWiki: suspiciously short content (${content.length} chars)`);
  if (/^#REDIRECT/i.test(content.trim())) throw new Error("MediaWiki: page is a redirect");
  return { title: page.title, revid: rev.revid, timestamp: rev.timestamp, content };
}

export const CAREER_TABLE_CAPTION = "Appearances and goals by club, season and competition";

/** Return the full `{| ... |}` wikitext table whose caption is the club career statistics caption. */
export function extractCareerStatsTable(wikitext, caption = CAREER_TABLE_CAPTION) {
  const at = wikitext.indexOf(caption);
  if (at < 0) throw new Error(`Career statistics table not found (caption "${caption}")`);
  const start = wikitext.lastIndexOf("{|", at);
  if (start < 0) throw new Error("Career statistics table: no opening {|");
  // Walk forward balancing nested {| |} table markers (only at line starts, as MediaWiki does).
  const re = /^[ \t]*(\{\||\|\})/gm;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(wikitext))) {
    if (m.index < start) continue;
    depth += m[1] === "{|" ? 1 : -1;
    if (depth === 0) return wikitext.slice(start, m.index + m[0].length).trim() + "\n";
  }
  throw new Error("Career statistics table: unbalanced {| |}");
}

const toInt = (s) => {
  const n = Number(String(s).replace(/<[^>]*>|\{\{[^}]*\}\}|[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Parse the "Career total" row: { apps, goals } (last two numeric cells). Throws if absent. */
export function parseCareerTotal(table) {
  const lines = table.split("\n");
  const i = lines.findIndex((l) => /Career total/i.test(l));
  if (i < 0) throw new Error("Career statistics table: no 'Career total' row");
  // Cells may sit on the same line or on following lines until the next row separator.
  const rowText = [lines[i].replace(/^.*Career total[^\n]*?(?=!!|\|\||$)/i, "")];
  for (let j = i + 1; j < lines.length && !/^\s*\|-|^\s*\|\}/.test(lines[j]); j++) rowText.push(lines[j]);
  const cells = rowText
    .join("!!")
    .split(/!!|\|\||\n[!|]/)
    .map((c) => c.replace(/^[!|]/, "").split("|").pop().trim())
    .filter((c) => c !== "");
  const nums = cells.map(toInt).filter((n) => n !== null);
  if (nums.length < 2) throw new Error("Career statistics table: cannot read career totals");
  return { apps: nums[nums.length - 2], goals: nums[nums.length - 1] };
}

/** Build a MediaWiki API URL for the latest (or a specific) revision's raw wikitext. */
export function revisionUrl(api, { title, revid } = {}) {
  const p = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
  if (revid) p.set("revids", String(revid));
  else p.set("titles", title);
  return `${api}?${p.toString().replace(/%7C/g, "|")}`;
}
