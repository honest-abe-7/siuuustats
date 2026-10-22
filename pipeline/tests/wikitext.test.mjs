import { test } from "node:test";
import assert from "node:assert/strict";
import { repoFile } from "./helpers.mjs";
import { mediawikiRevision, extractCareerStatsTable, parseCareerTotal, revisionUrl, CAREER_TABLE_CAPTION } from "../lib/wikitext.mjs";

// Saved fixture: the pinned MediaWiki API snapshot of the article (data/raw, read-only).
const article = JSON.parse(repoFile("data/raw/wikipedia-cristiano-ronaldo.json"));

test("mediawikiRevision reads revid, timestamp and content", () => {
  const r = mediawikiRevision(article);
  assert.equal(r.revid, 1381391040);
  assert.ok(r.content.includes("==Career statistics=="));
});

test("mediawikiRevision rejects API errors, missing pages, redirects and stubs", () => {
  assert.throws(() => mediawikiRevision({ error: { code: "maxlag", info: "Waiting" } }), /maxlag/);
  assert.throws(() => mediawikiRevision({ query: { pages: [{ title: "X", missing: true }] } }), /missing/);
  const page = (content) => ({ query: { pages: [{ title: "X", revisions: [{ revid: 1, slots: { main: { content } } }] }] } });
  assert.throws(() => mediawikiRevision(page("short")), /short/);
  assert.throws(() => mediawikiRevision(page("#REDIRECT [[Y]]" + " ".repeat(2000))), /redirect/);
});

test("extracts the club career statistics table and its career total", () => {
  const table = extractCareerStatsTable(mediawikiRevision(article).content);
  assert.ok(table.startsWith("{|"));
  assert.ok(table.trimEnd().endsWith("|}"));
  assert.ok(table.includes(CAREER_TABLE_CAPTION));
  assert.ok(table.includes("Al Nassr") || table.includes("Al-Nassr"));
  assert.deepEqual(parseCareerTotal(table), { apps: 1109, goals: 835 });
});

test("handles nested tables and inline total rows", () => {
  const t = [
    "intro",
    '{| class="wikitable"',
    `|+ ${CAREER_TABLE_CAPTION}`,
    "|-",
    "| a ||",
    "{| class=inner",
    "| nested",
    "|}",
    "|-",
    '!colspan="3"|Career total!!10!!2!!1,234!!987',
    "|}",
    "after",
  ].join("\n");
  const table = extractCareerStatsTable(t);
  assert.ok(table.includes("nested") && table.includes("Career total") && !table.includes("after"));
  assert.deepEqual(parseCareerTotal(table), { apps: 1234, goals: 987 });
});

test("throws when the table is missing or unbalanced", () => {
  assert.throws(() => extractCareerStatsTable("no table here"), /not found/);
  assert.throws(() => extractCareerStatsTable(`{|\n|+ ${CAREER_TABLE_CAPTION}\n| x`), /unbalanced/);
  assert.throws(() => parseCareerTotal("{|\n| x\n|}"), /Career total/);
});

test("revisionUrl targets the Action API with maxlag, by title or revid", () => {
  const u = new URL(revisionUrl("https://en.wikipedia.org/w/api.php", { title: "Cristiano_Ronaldo" }));
  assert.equal(u.searchParams.get("titles"), "Cristiano_Ronaldo");
  assert.equal(u.searchParams.get("maxlag"), "5");
  assert.equal(u.searchParams.get("rvslots"), "main");
  const v = new URL(revisionUrl("https://en.wikipedia.org/w/api.php", { revid: 42 }));
  assert.equal(v.searchParams.get("revids"), "42");
  assert.equal(v.searchParams.get("titles"), null);
});
