// Helpers for the MediaWiki API snapshot of the article (data/raw/wikipedia-cristiano-ronaldo.json).

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
