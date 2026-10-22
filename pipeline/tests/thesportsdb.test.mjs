import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { THESPORTSDB, MIN_INTERVAL_MS } from "../config.mjs";
import { eventsOf, normalizeEvent, isFinished, inLedger, plannedRequests, apiUrl, publicUrl } from "../lib/thesportsdb.mjs";

const J = (f) => JSON.parse(fixture(f));

test("configured IDs match TheSportsDB lookups saved on 2026-10-22", () => {
  const nassr = J("tsdb-lookupteam-136022.json").teams[0];
  assert.equal(nassr.strTeam, "Al-Nassr");
  assert.equal(nassr.idLeague, "4668");
  const league = J("tsdb-lookupleague-4668.json").leagues[0];
  assert.equal(league.strLeague, "Saudi-Arabian Pro League");
  const por = J("tsdb-lookupteam-133908.json").teams[0];
  assert.equal(por.strTeam, "Portugal");
  assert.equal(por.strGender, "Male");
  const cfgNassr = THESPORTSDB.teams.find((t) => t.team_id === "al-nassr");
  assert.equal(cfgNassr.idTeam, nassr.idTeam);
  assert.deepEqual(cfgNassr.leagues, [nassr.idLeague, nassr.idLeague2, nassr.idLeague3, nassr.idLeague4]);
  const cfgPor = THESPORTSDB.teams.find((t) => t.team_id === "portugal");
  assert.equal(cfgPor.idTeam, por.idTeam);
  assert.deepEqual(cfgPor.leagues, [por.idLeague, por.idLeague2, por.idLeague3, por.idLeague4]);
});

test("eventsOf handles results/events/null shapes", () => {
  assert.equal(eventsOf(J("tsdb-eventslast-136022.json")).length, 1);
  assert.equal(eventsOf(J("tsdb-eventsday-2026-10-20-4668.json")).length, 3);
  assert.deepEqual(eventsOf(J("tsdb-null.json")), []);
  assert.throws(() => eventsOf(null), /invalid/);
  assert.throws(() => eventsOf({ events: "nope" }), /not an array/);
});

test("normalizeEvent maps a finished Al-Nassr home match", () => {
  const [e] = eventsOf(J("tsdb-eventslast-136022.json"));
  const n = normalizeEvent(e, THESPORTSDB.teams);
  assert.equal(n.team_id, "al-nassr");
  assert.equal(n.key, `${e.dateEvent}-al-nassr`);
  assert.equal(n.score, `${e.intHomeScore}-${e.intAwayScore}`);
  assert.equal(n.thesportsdb_url, `https://www.thesportsdb.com/event/${e.idEvent}`);
});

test("normalizeEvent ignores untracked teams and gives no score to unplayed events", () => {
  const evs = eventsOf(J("tsdb-eventsday-2026-10-20-4668.json")).map((e) => normalizeEvent(e, THESPORTSDB.teams));
  assert.equal(evs.filter(Boolean).length, 1);
  const [next] = eventsOf(J("tsdb-eventsnext-136022.json"));
  assert.equal(isFinished(next), false);
  assert.equal(normalizeEvent(next, THESPORTSDB.teams).score, null);
});

test("inLedger tolerates a one-day time-zone shift", () => {
  const ev = { team_id: "al-nassr", date: "2026-10-20", date_local: "2026-10-20" };
  assert.ok(inLedger(ev, [{ team_id: "al-nassr", date: "2026-10-21" }]));
  assert.ok(!inLedger(ev, [{ team_id: "portugal", date: "2026-10-20" }]));
  assert.ok(!inLedger(ev, [{ team_id: "al-nassr", date: "2026-10-23" }]));
});

test("a run stays far below the free 30 requests/minute", () => {
  const reqs = plannedRequests("2026-10-22");
  assert.equal(reqs.length, 4 + THESPORTSDB.lookbackDays * 4);
  assert.ok(60000 / MIN_INTERVAL_MS["www.thesportsdb.com"] <= 30); // serial client => never above 30/min
  assert.ok(reqs.every((r) => r.url.startsWith("https://www.thesportsdb.com/api/v1/json/123/")));
});

test("publicUrl hides the key", () => {
  assert.equal(publicUrl(apiUrl("eventslast", { id: "1" }, { key: "secret" })), "https://www.thesportsdb.com/api/v1/json/{key}/eventslast.php?id=1");
});
