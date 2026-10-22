import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLedger } from "../scripts/lib/ledger.mjs";
import { buildApi } from "../scripts/build-api.mjs";

const files = buildApi(loadLedger(), "2026-10-22T00:00:00.000Z");

test("builds the documented /api/v1 files", () => {
  for (const f of ["index.json", "summary.json", "goals.json", "matches.json", "goals-by-competition.json", "goals-by-year.json", "goals-by-opponent.json", "records.json", "sources.json", "goals-by-club.json", "goals-by-season.json"])
    assert.ok(files[f], f);
});

test("every response has the envelope fields and attribution", () => {
  for (const [name, body] of Object.entries(files)) {
    assert.equal(body.api_version, "v1", name);
    assert.equal(body.licence, "CC BY-SA 4.0", name);
    assert.ok(body.data_as_of, name);
    if (name !== "index.json") assert.ok(body.attribution.length > 0, name);
  }
});

test("aggregates add up to the totals, per scope", () => {
  const sum = (arr, k, scope) => arr.filter((r) => !scope || r.scope === scope).reduce((a, r) => a + r[k], 0);
  assert.equal(files["goals.json"].data.length, 981);
  for (const f of ["goals-by-competition.json", "goals-by-year.json", "goals-by-opponent.json", "goals-by-age.json"]) {
    assert.equal(sum(files[f].data, "goals"), 981, f);
    assert.equal(sum(files[f].data, "goals", "international"), 146, f);
    assert.equal(sum(files[f].data, "goals", "club"), 835, f);
    assert.ok(files[f].data.every((r) => r.scope === "club" || r.scope === "international"), f);
  }
  assert.equal(sum(files["goals-by-year.json"].data, "apps", "international"), 234);
  assert.equal(sum(files["goals-by-year.json"].data, "apps", "club"), 1107);
  assert.equal(sum(files["goals-by-club.json"].data, "goals"), 835);
  assert.equal(sum(files["goals-by-season.json"].data, "goals"), 835);
  assert.equal(sum(files["goals-by-season.json"].data, "apps"), 1107);
});

test("summary has international, club and career blocks with per-number citations", () => {
  const d = files["summary.json"].data;
  assert.equal(d.international.goals, 146);
  assert.equal(d.club.goals, 835);
  assert.equal(d.club.apps, 1107);
  assert.equal(d.club.champions_league.goals, 140);
  assert.equal(d.club.champions_league.goals_incl_qualifiers, 141);
  assert.equal(d.career.goals, 981);
  assert.equal(d.career.apps, 1341);
  const known = new Set(files["sources.json"].data.map((s) => s.source_id));
  for (const [path, ids] of Object.entries(d.citations)) {
    assert.ok(ids.length > 0, path);
    for (const id of ids) assert.ok(known.has(id), `${path} cites unknown ${id}`);
  }
});

test("new M3 files exist and are consistent", () => {
  for (const f of ["goals-by-club.json", "goals-by-season.json", "multi-goal-matches.json", "goals-by-age.json", "streaks.json", "big-games.json", "reconciliation.json", "corrections.json"]) assert.ok(files[f], f);
  assert.equal(files["reconciliation.json"].data.counts.fail, 0);
  assert.equal(files["multi-goal-matches.json"].data.filter((m) => m.goals >= 3).length, 66);
  const ucl = files["goals.json"].data.filter((g) => g.competition_id === "uefa-champions-league" && !/qualif/i.test(g.stage ?? ""));
  assert.equal(ucl.length, 140);
  assert.equal(ucl.filter((g) => g.method === "penalty").length, 19);
});

test("records.json computed values equal the stored values", () => {
  for (const r of files["records.json"].data) if (r.compute_fn) assert.equal(r.computed_value, r.value, r.record_id);
});

test("every summary figure has a citations key naming known sources", () => {
  const s = files["summary.json"].data;
  const known = new Set(files["sources.json"].data.map((x) => x.source_id));
  for (const block of ["international", "club", "career", "honours"])
    for (const k of Object.keys(s[block])) {
      if (k === "team_id") continue;
      const ids = s.citations[`${block}.${k}`];
      assert.ok(ids && ids.length > 0, `${block}.${k} has no citation`);
      for (const id of ids) assert.ok(known.has(id), `${block}.${k} cites unknown ${id}`);
    }
  assert.ok(s.club.clubs.every((c) => c.name), "club names present");
  assert.equal(s.career.goals_per_game, Math.round((s.career.goals / s.career.apps) * 100) / 100);
});

test("derived tables carry row-level source_ids from sources.json", () => {
  const known = new Set(files["sources.json"].data.map((x) => x.source_id));
  const nested = (f) => {
    const x = files[f].data;
    if (Array.isArray(x)) return x;
    return Object.entries(x).filter(([k]) => k !== "source_ids").map(([, v]) => v).flatMap((v) => (Array.isArray(v) ? v.flatMap((r) => (Array.isArray(r?.opponents) ? r.opponents : [r])) : v && typeof v === "object" && v.source_ids ? [v] : []));
  };
  for (const f of ["streaks.json", "big-games.json", "goals-by-age.json", "goals-by-season.json", "goals-by-club.json", "club-season-totals.json", "trophies.json", "awards.json",
    "champions-league.json", "clutch.json", "goals-by-age-band.json", "season-totals.json", "national-teams.json", "club-opponents.json", "body-parts.json", "milestones.json"])
    for (const r of nested(f)) {
      assert.ok(Array.isArray(r.source_ids) && r.source_ids.length > 0, `${f} row without sources`);
      for (const id of r.source_ids) assert.ok(known.has(id), `${f} cites unknown ${id}`);
    }
});

test("club season totals add up to the club totals", () => {
  const rows = files["club-season-totals.json"].data;
  assert.equal(rows.reduce((a, r) => a + r.goals, 0), 835);
  assert.equal(rows.reduce((a, r) => a + r.apps, 0), files["summary.json"].data.club.apps);
  for (const r of rows) assert.equal(Object.values(r.by_category).reduce((a, c) => a + c.goals, 0), r.goals, `${r.season} ${r.team_id}`);
});

test("trophies: 35 counted (Wikipedia), 37 including not-in-squad titles (messivsronaldo.app)", () => {
  const h = files["summary.json"].data.honours;
  assert.equal(h.major_trophies, 35);
  assert.equal(h.trophies_incl_not_in_squad, 37);
  assert.equal(h.ballon_dor, 5);
  assert.equal(files["trophies.json"].data.filter((t) => !t.counted_in_total).every((t) => t.participation === "not_in_squad"), true);
});

test("unused-substitute rows are in matches.json but never caps", () => {
  const unused = files["matches.json"].data.filter((m) => m.appeared === false);
  assert.ok(unused.some((m) => m.match_id === "2026-09-27-portugal-norway"));
  assert.ok(unused.every((m) => m.cap_number === null));
  assert.equal(files["summary.json"].data.international.caps, 234);
});

// Independent of build-api's own collector: walk every endpoint's data for source references.
const citedIn = (data) => {
  const ids = new Set();
  const add = (v) => (Array.isArray(v) ? v : String(v).split(";")).forEach((x) => x && ids.add(x));
  const walk = (v, key) => {
    if (["source_id", "source_ids", "evidence_source_ids"].includes(key) && (typeof v === "string" || Array.isArray(v))) return add(v);
    if (key === "citations" && v && typeof v === "object") return Object.values(v).forEach(add);
    if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(data);
  return ids;
};

test("every endpoint's attribution includes every source its citations and source_ids reference", () => {
  const known = new Set(loadLedger().tables.sources.map((s) => s.source_id));
  for (const [name, body] of Object.entries(files)) {
    const attributed = new Set(body.attribution.map((a) => a.source_id));
    for (const id of citedIn(body.data)) {
      assert.ok(attributed.has(id), `${name}: ${id} is cited but missing from attribution`);
      assert.ok(known.has(id), `${name}: ${id} is not in data/sources.csv`);
    }
    for (const a of body.attribution) assert.ok(a.title && a.url, `${name}: attribution ${a.source_id} has no sources.csv row`);
  }
});

test("summary.json attribution covers the honours citations (regression: 7 honours sources were missing)", () => {
  const attributed = new Set(files["summary.json"].attribution.map((a) => a.source_id));
  for (const id of ["messivsronaldo-app-honours", "messivsronaldo-app-individual-awards", "uefa-com-ucl-all-time-top-scorers", "wikipedia-2002-supertaca", "wikipedia-2008-community-shield", "wikipedia-2014-copa-del-rey-final", "wikipedia-2016-uefa-super-cup"])
    assert.ok(attributed.has(id), id);
});

test("sources.json lists every source attributed by any endpoint", () => {
  const listed = new Set(files["sources.json"].data.map((s) => s.source_id));
  for (const [name, body] of Object.entries(files)) for (const a of body.attribution) assert.ok(listed.has(a.source_id), `${name}: ${a.source_id}`);
});
