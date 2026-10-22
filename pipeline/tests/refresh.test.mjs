import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { tempRoot, stubFetch, fakeClient, repoFile } from "./helpers.mjs";
import { runRefresh, mergeManifest } from "../refresh-snapshots.mjs";
import { CAREER_TABLE_CAPTION } from "../lib/wikitext.mjs";

const quiet = () => {};
const raw = (f) => repoFile(`data/raw/${f}`);
const listWikitext = `{{Short description|x}}\n${"Lorem ipsum. ".repeat(100)}\n{| class="wikitable"\n! No. !! Date\n|-\n| 1 || 2004\n|}\n`;
const mwJson = (content, revid = 1376549197) => JSON.stringify({ batchcomplete: true, query: { pages: [{ title: "List", revisions: [{ revid, timestamp: "2026-10-01T00:00:00Z", slots: { main: { content } } }] }] } });

/** Upstream full results.csv = old Portugal rows + a non-Portugal row (+ optional extra rows). */
function upstreamResults(extra = []) {
  const [header, ...rows] = parse(raw("martj42-portugal-results.csv"));
  return stringify([header, ...rows, ["2026-10-05", "Spain", "Italy", "1", "1", "UEFA Nations League", "Madrid", "Spain", "FALSE"], ...extra]);
}

function routes({ results = upstreamResults(), shootouts = raw("martj42-portugal-shootouts.csv"), list = raw("wikipedia-cr7-international-goals.html"), rsssfStatus = 500 } = {}) {
  return [
    [/rest_v1\/page\/html\/List_of_international/, () => ({ body: list, headers: { "content-revision-id": "1376549197" } })],
    [(u) => u.includes("api.php") && u.includes("revids=1376549197"), () => ({ body: mwJson(listWikitext) })],
    [(u) => u.includes("api.php") && u.includes("titles=Cristiano_Ronaldo"), () => ({ body: raw("wikipedia-cristiano-ronaldo.json") })],
    [/rsssf\.org/, () => ({ status: rsssfStatus, body: rsssfStatus === 200 ? Buffer.from(raw("rsssf-cronaldo-intlg.html"), "latin1") : "down" })],
    [/api\.github\.com\/repos\/martj42/, () => ({ body: JSON.stringify({ sha: "newsha123" }) })],
    [/martj42\/international_results\/master\/results\.csv/, () => ({ body: results })],
    [/goalscorers\.csv/, () => ({ body: raw("martj42-portugal-goalscorers.csv") })],
    [/shootouts\.csv/, () => ({ body: shootouts })],
  ];
}

test("unchanged data leaves data/raw byte-identical; new pipeline snapshots are added", async () => {
  const root = tempRoot();
  const manifestBefore = readFileSync(join(root, "data/raw/MANIFEST.json"), "utf8");
  const { fetchImpl } = stubFetch(routes({ rsssfStatus: 200 }));
  const { client } = fakeClient(fetchImpl);
  const rep = await runRefresh({ root, client, log: quiet });
  assert.deepEqual(rep.errors, []);
  assert.deepEqual(rep.changed.sort(), ["pipeline/snapshots/wikipedia-cr7-career-stats.wikitext", "pipeline/snapshots/wikipedia-cr7-international-goals.wikitext"]);
  assert.equal(readFileSync(join(root, "data/raw/MANIFEST.json"), "utf8"), manifestBefore);
  const career = readFileSync(join(root, "pipeline/snapshots/wikipedia-cr7-career-stats.wikitext"), "utf8");
  assert.ok(career.includes(CAREER_TABLE_CAPTION));
  const pm = JSON.parse(readFileSync(join(root, "pipeline/snapshots/MANIFEST.json"), "utf8"));
  assert.equal(pm.entries.length, 2);
  assert.ok(existsSync(join(root, "reports/pipeline/refresh.json")));

  // Second run: nothing changes at all (no daily noise PRs).
  const again = await runRefresh({ root, client: fakeClient(stubFetch(routes({ rsssfStatus: 200 })).fetchImpl).client, log: quiet });
  assert.deepEqual(again.changed, []);
});

test("a new Portugal row updates the snapshot and only its MANIFEST entry", async () => {
  const root = tempRoot();
  const before = JSON.parse(readFileSync(join(root, "data/raw/MANIFEST.json"), "utf8"));
  const extra = [["2026-11-14", "Portugal", "Ireland", "3", "0", "UEFA Euro qualification", "Porto", "Portugal", "FALSE"]];
  const { fetchImpl } = stubFetch(routes({ results: upstreamResults(extra), rsssfStatus: 200 }));
  const rep = await runRefresh({ root, client: fakeClient(fetchImpl).client, log: quiet, now: () => new Date("2026-11-15T06:00:00Z") });
  assert.ok(rep.changed.includes("data/raw/martj42-portugal-results.csv"));
  const csv = readFileSync(join(root, "data/raw/martj42-portugal-results.csv"), "utf8");
  assert.ok(csv.includes("2026-11-14,Portugal,Ireland"));
  assert.ok(!csv.includes("Spain,Italy"));
  const after = JSON.parse(readFileSync(join(root, "data/raw/MANIFEST.json"), "utf8"));
  assert.equal(after.generated_by, before.generated_by);
  assert.equal(after.entries.length, before.entries.length);
  const e = after.entries.find((x) => x.file === "data/raw/martj42-portugal-results.csv");
  assert.equal(e.revision, "newsha123");
  assert.equal(e.fetched_at, "2026-11-15T06:00:00.000Z");
  const untouched = (x) => x.file !== "data/raw/martj42-portugal-results.csv";
  assert.deepEqual(after.entries.filter(untouched), before.entries.filter(untouched));
});

test("fetch failures keep the old snapshot and are reported", async () => {
  const root = tempRoot();
  const old = readFileSync(join(root, "data/raw/rsssf-cronaldo-intlg.html"), "utf8");
  const { fetchImpl } = stubFetch(routes({ rsssfStatus: 500 }));
  const rep = await runRefresh({ root, client: fakeClient(fetchImpl, { retries: 1 }).client, log: quiet });
  const r = rep.results.find((x) => x.id === "rsssf-cronaldo-intlg");
  assert.equal(r.status, "error");
  assert.match(r.error, /HTTP 500/);
  assert.equal(readFileSync(join(root, "data/raw/rsssf-cronaldo-intlg.html"), "utf8"), old);
  assert.equal(rep.errors.length, 1);
});

test("unparseable content is not written (keeps old snapshot)", async () => {
  const root = tempRoot();
  const old = readFileSync(join(root, "data/raw/wikipedia-cr7-international-goals.html"), "utf8");
  const { fetchImpl } = stubFetch(routes({ list: "<html><body>Service temporarily unavailable</body></html>", rsssfStatus: 200 }));
  const rep = await runRefresh({ root, client: fakeClient(fetchImpl).client, log: quiet });
  assert.equal(rep.results.find((x) => x.id === "wikipedia-cr7-intl-goals").status, "error");
  assert.equal(readFileSync(join(root, "data/raw/wikipedia-cr7-international-goals.html"), "utf8"), old);
});

test("a regression (fewer rows than before) is rejected, not written", async () => {
  const root = tempRoot();
  const old = readFileSync(join(root, "data/raw/martj42-portugal-shootouts.csv"), "utf8");
  const [header, ...rows] = parse(old);
  const { fetchImpl } = stubFetch(routes({ shootouts: stringify([header, ...rows.slice(1)]), rsssfStatus: 200 }));
  const rep = await runRefresh({ root, client: fakeClient(fetchImpl).client, log: quiet });
  const r = rep.results.find((x) => x.id === "martj42-shootouts");
  assert.equal(r.status, "rejected");
  assert.match(r.error, /decreased/);
  assert.equal(readFileSync(join(root, "data/raw/martj42-portugal-shootouts.csv"), "utf8"), old);
});

test("mergeManifest replaces by file, appends new files, keeps generated_by", () => {
  const m = mergeManifest({ generated_by: "orig", entries: [{ file: "a", v: 1 }, { file: "b", v: 1 }] }, [{ file: "b", v: 2 }, { file: "c", v: 1 }], "new");
  assert.deepEqual(m, { generated_by: "orig", entries: [{ file: "a", v: 1 }, { file: "b", v: 2 }, { file: "c", v: 1 }] });
  assert.equal(mergeManifest(null, [], "new").generated_by, "new");
});
