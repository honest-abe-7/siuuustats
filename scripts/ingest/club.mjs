#!/usr/bin/env node
// Builds the CLUB rows of data/matches.csv and data/goals.csv from the raw snapshots (offline):
//   - Spanish Wikipedia match list (CC BY-SA)   -> one match per official club appearance, goals with score/minute,
//                                                  penalty and free-kick markers, assisters, substitutions, minutes
//   - data/manual/club-team-names.csv           -> eswiki opponent name -> team_id / English name / country
//   - data/manual/club-neutral-results.csv      -> result from Ronaldo's side for neutral-venue matches with no goal
//   - data/manual/club-appearances-extra.csv    -> documented appearances missing from the eswiki list
//   - data/manual/corrections.csv (eswiki rows) -> documented fixes to eswiki values, each with evidence
//   - Kaggle seed (CC BY-SA)                    -> goal type (body part) and assister; cross-checks minute/penalty
//   - English Wikipedia season articles         -> verifies every match date + opponent
// Writes reports/ingest-club.json; exits 1 if anything is unexplained.
// Usage: npm run ingest:club
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadRegistry } from "../lib/ledger.mjs";
import { readCsv, writeCsv } from "../lib/csv.mjs";
import { parseEswikiClub, loadKaggleGoals, loadClubSeasonSnippets } from "../lib/sources-raw.mjs";
import { slug } from "../lib/slug.mjs";

export const CLUB_TEAMS = [
  { team_id: "sporting-cp", name: "Sporting CP", country: "Portugal", from: "2002-07-01", to: "2003-08-12" },
  { team_id: "manchester-united", name: "Manchester United", country: "England", from: "2003-08-13", to: "2009-06-30" },
  { team_id: "real-madrid", name: "Real Madrid", country: "Spain", from: "2009-07-01", to: "2018-07-09" },
  { team_id: "juventus", name: "Juventus", country: "Italy", from: "2018-07-10", to: "2021-08-30" },
  { team_id: "manchester-united", name: "Manchester United", country: "England", from: "2021-08-31", to: "2022-11-22" },
  { team_id: "al-nassr", name: "Al-Nassr", country: "Saudi Arabia", from: "2022-12-30", to: "9999-12-31" },
];
export const clubOn = (date) => CLUB_TEAMS.find((c) => date >= c.from && date <= c.to)?.team_id ?? null;
const CLUB_IDS = new Set(CLUB_TEAMS.map((c) => c.team_id));

// Spanish competition label -> competition_id (longest prefix first).
const COMPETITIONS = [
  ["AFC Champions Two", "afc-champions-league-two"],
  ["AFC Champions", "afc-champions-league"],
  ["Copa de Campeones Árabe", "arab-club-champions-cup"],
  ["Champions", "uefa-champions-league"],
  ["Copa UEFA", "uefa-cup"],
  ["Europa League", "uefa-europa-league"],
  ["Supercopa de Europa", "uefa-super-cup"],
  ["Mundial de Clubes", "fifa-club-world-cup"],
  ["Primeira Liga", "primeira-liga"],
  ["Copa Portugal", "taca-de-portugal"],
  ["Premier League", "premier-league"],
  ["FA Cup", "fa-cup"],
  ["EFL League Cup", "efl-cup"],
  ["Community Shield", "fa-community-shield"],
  ["Liga Española", "la-liga"],
  ["Copa del Rey", "copa-del-rey"],
  ["Supercopa de España", "supercopa-de-espana"],
  ["Serie A", "serie-a"],
  ["Copa Italia", "coppa-italia"],
  ["Supercopa de Italia", "supercoppa-italiana"],
  ["Liga Saudí", "saudi-pro-league"],
  ["Copa Saudí", "kings-cup-saudi-arabia"],
  ["Supercopa Saudí", "saudi-super-cup"],
];
const QUALIFYING = new Set(["uefa-champions-league"]); // "#R" rounds of these are qualifying rounds

/** "Champions 2008-09 CF Vuelta" -> { competition_id, stage: "Quarter-final, 2nd leg" } */
export function parseCompetition(text) {
  const hit = COMPETITIONS.find(([p]) => text.startsWith(p + " "));
  if (!hit) return { competition_id: null, stage: null };
  const [prefix, competition_id] = hit;
  let rest = text.slice(prefix.length).trim().replace(/^\d{4}(-\d{2})?\s*/, "").replace(/\bwr\b/g, "").replace(/–\d+\s*/, "").trim();
  const legs = { Ida: "1st leg", Vuelta: "2nd leg", Replay: "replay" };
  const names = { OF: "Round of 16", CF: "Quarter-final", SF: "Semi-final", Final: "Final", PO: "Play-off" };
  const parts = [];
  let m;
  if ((m = rest.match(/^J(\d+)$/))) return { competition_id, stage: `Matchday ${m[1]}` };
  if ((m = rest.match(/^\(G([A-Z])\)\s*J(\d+)/))) return { competition_id, stage: `Group ${m[1]}, matchday ${m[2]}` };
  rest = rest.replace(/[()]/g, "");
  for (const tok of rest.split(/\s+/).filter(Boolean)) {
    if ((m = tok.match(/^(\d+)R(?:=OF)?$/))) parts.push(QUALIFYING.has(competition_id) ? `Qualifying round ${m[1]}` : `Round ${m[1]}`);
    else if (tok === "=" || tok === "=OF" || tok === "OF" && parts.length) continue;
    else if (names[tok]) parts.push(names[tok]);
    else if (legs[tok]) parts.push(legs[tok]);
    else parts.push(tok);
  }
  return { competition_id, stage: parts.length ? parts.join(", ").replace(/, (1st leg|2nd leg|replay)/, " $1") : null };
}

/** "0-0 (4-5)p", "1-0 (te)", "4-1te", "2-1 (1-3p)", "2-1, 0-3*" -> scores in the source's (home/designated-home first) order */
export function parseResult(text) {
  const t = text.replace(/\s+/g, "");
  const m = t.match(/^(\d+)-(\d+)/);
  if (!m) return null;
  const pens = t.match(/\((\d+)-(\d+)\)?p\)?/);
  const awarded = t.match(/,(\d+)-(\d+)\*/);
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    extraTime: /te/.test(t),
    pens: pens ? [Number(pens[1]), Number(pens[2])] : null,
    awarded: awarded ? [Number(awarded[1]), Number(awarded[2])] : null,
  };
}

/** "1-0 (48'tl), 3-0 (70') y 5-0 (88')" -> [{a,b,minute,added,marker}] */
export function parseGoalCell(text) {
  if (!text || text === "-") return [];
  return [...text.matchAll(/(\d+)\s*-\s*(\d+)'?\s*\((\d+)(?:\+(\d+))?'?\s*(p|tl)?\??\)/g)].map((g) => ({
    a: Number(g[1]),
    b: Number(g[2]),
    minute: Number(g[3]),
    added: g[4] ? Number(g[4]) : null,
    marker: g[5] ?? null,
  }));
}

/** "Higuaín, Özil, Di María y --" / "Ramos x2 y --" -> ["Higuaín","Özil","Di María",null] */
export function parseAssisters(text) {
  if (!text || text === "-") return [];
  const out = [];
  for (const part of text.split(/,\s*|\s+[ye]\s+/)) {
    const m = part.trim().match(/^(.*?)(?:\s*x(\d+))?$/);
    const name = m[1].trim();
    for (let i = 0; i < Number(m[2] || 1); i++) out.push(name === "--" || name === "" ? null : name);
  }
  return out;
}

const KAGGLE_BODY = { Header: "head", "Left-footed shot": "left_foot", "Right-footed shot": "right_foot" };

// ------------------------------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith("club.mjs")) {
  const issues = []; // unexplained: make the ingest fail
  const issue = (kind, detail) => issues.push({ kind, ...detail });
  const warnings = []; // informational: detail we could not use (kept out of the ledger), never a count change
  const warn = (kind, detail) => warnings.push({ kind, ...detail });
  const resolutions = []; // source disagreements settled by the 2-of-3 rule (eswiki, Kaggle, season article)
  const ES = "eswiki-cr7-club-matches";
  const KG = "kaggle-sigmaborov-cr7-goals";
  const SEASONS = "wikipedia-club-season-articles";

  const es = parseEswikiClub();
  const kaggle = loadKaggleGoals();
  const pages = loadClubSeasonSnippets();
  const teamMap = new Map(readCsv(join(ROOT, "data/manual/club-team-names.csv")).rows.map((r) => [r.es_name, r]));
  const neutral = new Map(readCsv(join(ROOT, "data/manual/club-neutral-results.csv")).rows.map((r) => [Number(r.es_match_no), r]));
  const extras = readCsv(join(ROOT, "data/manual/club-appearances-extra.csv")).rows;
  // Dates where the English season article disagrees with eswiki and outside match reports side with eswiki.
  const dateChecks = new Map(readCsv(join(ROOT, "data/manual/club-date-checks.csv")).rows.map((r) => [Number(r.es_match_no), r]));
  const usedDateChecks = new Set();
  const corrections = readCsv(join(ROOT, "data/manual/corrections.csv")).rows.filter((c) => c.source_id === ES);
  const applied = [];
  const usedNeutral = new Set();

  // ---- corrections ---------------------------------------------------------------------------
  const FIELD = { date: "date", venue: "venueCode", goals: "goals", goal_cell: "goalCell", result: "result", assisted_by: "assistedBy" };
  for (const c of corrections) {
    const n = Number(c.target.replace(/^match_n=/, ""));
    const row = es.find((r) => r.n === n);
    const f = FIELD[c.field];
    if (!row || !f) {
      issue("correction-target-missing", { correction_id: c.correction_id });
      continue;
    }
    if (String(row[f]) !== c.from_value) {
      issue("correction-stale", { correction_id: c.correction_id, expected_from: c.from_value, found: String(row[f]) });
      continue;
    }
    row[f] = f === "goals" ? Number(c.to_value) : c.to_value;
    (row._corr ??= []).push(c);
    applied.push(c.correction_id);
  }

  // ---- season-article date check -------------------------------------------------------------
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const snippetsByDate = new Map();
  for (const p of pages) for (const s of p.snippets) (snippetsByDate.get(s.date) ?? snippetsByDate.set(s.date, []).get(s.date)).push(norm(s.text.slice(20, 80 + 20 + 90)));
  const STOP = new Set(["city", "united", "real", "club", "town", "athletic", "saudi", "arabia", "qatar"]);
  /** Ronaldo's goals (minute, penalty) as written in the season article snippets for a date. */
  const rawSnippets = new Map();
  for (const p of pages) for (const sn of p.snippets) (rawSnippets.get(sn.date) ?? rawSnippets.set(sn.date, []).get(sn.date)).push(sn.text);
  function seasonArticleGoals(date) {
    const out = [];
    for (const t of rawSnippets.get(date) ?? []) {
      // The snippet starts 80 chars before the date; stop at the next written date so a later match's scorers never count.
      let tail = t.slice(80);
      const next = tail.slice(25).search(/\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/);
      if (next >= 0) tail = tail.slice(0, 25 + next);
      for (const m of tail.matchAll(/Ronaldo(?: \(\d\))? ((?:\d+(?:\+\d+)?'(?: \(pen\.\))?(?:, )?)+)/g))
        for (const item of m[1].split(/,\s*/).filter(Boolean)) {
          const mm = item.match(/(\d+)(?:\+\d+)?'( \(pen\.\))?/);
          if (mm) out.push({ minute: Number(mm[1]), pen: Boolean(mm[2]) });
        }
      if (out.length) break;
    }
    return out;
  }
  function dateConfirmed(date, names) {
    const keys = new Set();
    for (const n of names) {
      const words = norm(n).replace(/\(.*\)/, "").split(/[\s.]+/).filter((w) => w.length > 3 && !STOP.has(w));
      if (words.length) keys.add(words.sort((x, y) => y.length - x.length)[0].replace(/^al-/, ""));
    }
    return (snippetsByDate.get(date) ?? []).some((t) => [...keys].some((k) => t.includes(k)));
  }

  const shiftDate = (d, days) => new Date(Date.parse(d + "T00:00:00Z") + days * 864e5).toISOString().slice(0, 10);

  // ---- matches + goals -----------------------------------------------------------------------
  const kaggleByDate = new Map();
  for (const k of kaggle) (kaggleByDate.get(k.date) ?? kaggleByDate.set(k.date, []).get(k.date)).push(k);
  const usedKaggleDates = new Set();
  const KAGGLE_LAST = kaggle.map((k) => k.date).sort().at(-1);
  const teams = new Map();
  const matches = [];
  const goals = [];
  let enriched = 0;

  for (const r of es) {
    const team_id = clubOn(r.date);
    const tm = teamMap.get(r.opponent);
    if (!tm) {
      issue("unmapped-opponent", { n: r.n, opponent: r.opponent });
      continue;
    }
    teams.set(tm.team_id, { team_id: tm.team_id, name: tm.name, kind: "club", country: tm.country, confederation: tm.confederation || null, wikidata_id: null });
    const { competition_id, stage } = parseCompetition(r.competition);
    if (!competition_id) issue("unknown-competition", { n: r.n, competition: r.competition });
    const res = parseResult(r.result);
    if (!res) {
      issue("unparseable-result", { n: r.n, result: r.result });
      continue;
    }
    const cells = parseGoalCell(r.goalCell);
    if (cells.length !== r.goals) issue("goal-cell-count-mismatch", { n: r.n, date: r.date, goals: r.goals, cell: r.goalCell });
    const venue = { L: "home", V: "away", N: "neutral" }[r.venueCode];

    // Which side of the source's "a-b" is Ronaldo's team?
    let side = venue === "home" ? "a" : venue === "away" ? "b" : null;
    const man = neutral.get(r.n);
    let manual = null;
    // Does reading the goal cells' column `s` as Ronaldo's team give a strictly rising score that ends within `bound`?
    const valid = (s, bound = s === "a" ? res.a : res.b) => {
      let last = 0;
      for (const g of cells) {
        const f = s === "a" ? g.a : g.b;
        if (f <= last) return false;
        last = f;
      }
      return last <= bound;
    };
    if (venue === "neutral") {
      if (man) {
        manual = man;
        usedNeutral.add(r.n);
        const sf = Number(man.score_for);
        side = res.a === res.b ? (res.pens ? (man.shootout?.startsWith(res.pens[0] > res.pens[1] ? "won" : "lost") ? "a" : "b") : "a") : res.a === sf ? "a" : "b";
      } else if (cells.length && valid("a") !== valid("b")) side = valid("a") ? "a" : "b";
      else {
        const k = (kaggleByDate.get(r.date) ?? [])[0];
        if (k && res.a !== res.b) {
          const [h, aw] = k.finalScore.split(":").map(Number);
          const sf = k.homeAway === "Home" ? h : aw;
          side = res.a === sf && res.b !== sf ? "a" : res.b === sf && res.a !== sf ? "b" : null;
        }
      }
      if (!side) {
        issue("neutral-orientation-unknown", { n: r.n, date: r.date, opponent: r.opponent, result: r.result });
        continue;
      }
    }
    const pick = (pair) => (side === "a" ? pair : [pair[1], pair[0]]);
    // eswiki occasionally writes a goal cell with Ronaldo's team first even away from home; detect it from the score sequence.
    let cellSide = side;
    const other = side === "a" ? "b" : "a";
    const ourTotal = side === "a" ? res.a : res.b;
    if (cells.length && !valid(side) && valid(other, ourTotal)) {
      cellSide = other;
      warn("goal-cell-orientation-flipped", { n: r.n, date: r.date, cell: r.goalCell, venue });
    }
    const pickCell = (pair) => (cellSide === "a" ? pair : [pair[1], pair[0]]);
    let [score_for, score_against] = pick([res.a, res.b]);
    let notes = null;
    if (res.awarded) {
      const [af, aa] = pick(res.awarded);
      notes = `Awarded ${af}-${aa}; played ${score_for}-${score_against} on the pitch.`;
      [score_for, score_against] = [af, aa];
    }
    let shootout = null;
    if (res.pens) {
      const [pf, pa] = pick(res.pens);
      shootout = `${pf > pa ? "won" : "lost"} ${pf}-${pa}`;
    }
    if (manual) {
      if (Number(manual.score_for) !== score_for || Number(manual.score_against) !== score_against || (manual.shootout || null) !== shootout)
        issue("neutral-manual-disagrees-with-source", { n: r.n, manual: `${manual.score_for}-${manual.score_against} ${manual.shootout}`, derived: `${score_for}-${score_against} ${shootout}` });
    }

    // date verified by the English season article?
    const dateSources = [];
    const dc = dateChecks.get(r.n);
    if (dc && dc.date === r.date) {
      usedDateChecks.add(r.n);
      dateSources.push(...dc.evidence_source_ids.split(";"));
    } else if (dateConfirmed(r.date, [tm.name, r.opponent, ...(tm.aliases ? tm.aliases.split(";") : [])])) dateSources.push(SEASONS);
    else issue("date-not-confirmed-by-season-article", { n: r.n, date: r.date, opponent: tm.name, competition: r.competition });

    let started = null;
    if (r.subOn) started = false;
    else if (r.subOff) started = true;
    else if (r.notes === "-") started = true;
    else {
      const nums = (r.notes.match(/\d+/g) || []).map(Number);
      if (nums.length === 1 && r.minutes !== null) {
        const m = nums[0];
        const asOff = Math.abs(r.minutes - m) <= 1;
        const asOn = Math.abs(r.minutes - (90 - m)) <= 2;
        if (asOff !== asOn) started = asOff;
      }
    }

    const match_id = `${r.date}-${team_id}-${tm.team_id}`;
    const source_ids = [ES, ...dateSources];
    for (const c of r._corr ?? []) source_ids.push(...c.evidence_source_ids.split(";"));
    if (manual) source_ids.push(...manual.evidence_source_ids.split(";"));

    // ---- goals for this match
    const assisters = parseAssisters(r.assistedBy);
    const useAssist = assisters.length === cells.length;
    if (cells.length && !useAssist && r.assistedBy && r.assistedBy !== "-") warn("assister-count-mismatch", { n: r.n, assistedBy: r.assistedBy, goals: cells.length });
    let kDate = r.date;
    if (!kaggleByDate.has(kDate) && cells.length) {
      // Kaggle is sometimes a day out; accept the neighbouring day only if no other ledger match sits on it.
      for (const d of [shiftDate(r.date, -1), shiftDate(r.date, 1)])
        if (kaggleByDate.has(d) && !es.some((x) => x.date === d)) {
          warn("kaggle-date-off-by-one", { n: r.n, date: r.date, kaggle_date: d });
          kDate = d;
          break;
        }
    }
    const kRows = (kaggleByDate.get(kDate) ?? []).slice().sort((x, y) => x.minute - y.minute || (x.addedTime ?? 0) - (y.addedTime ?? 0));
    if (kRows.length) usedKaggleDates.add(kDate);
    const kUsable = kRows.length === cells.length && cells.length > 0;
    if (kRows.length && !shootout && !res.awarded && !res.extraTime) { // Kaggle folds shootout goals into extra-time finals
      const [h, aw] = kRows[0].finalScore.split(":").map(Number);
      const [kf, ka] = kRows[0].homeAway === "Home" ? [h, aw] : [aw, h];
      if (kf !== score_for || ka !== score_against) issue("final-score-differs-from-kaggle", { n: r.n, date: r.date, opponent: tm.name, eswiki: `${score_for}-${score_against}`, kaggle: `${kf}-${ka}`, kaggle_home_away: kRows[0].homeAway });
    }
    const kaggleCovers = r.date <= KAGGLE_LAST && competition_id !== "arab-club-champions-cup";
    if (kaggleCovers && kRows.length !== cells.length) issue("kaggle-goal-count-differs", { n: r.n, date: r.date, opponent: tm.name, eswiki: cells.length, kaggle: kRows.length });

    const ordered = cells.map((g, i) => ({ ...g, assist: useAssist ? assisters[i] : null })).sort((x, y) => x.minute - y.minute || (x.added ?? 0) - (y.added ?? 0));
    ordered.forEach((g, i) => {
      const k = kUsable ? kRows[i] : null;
      const gs = [ES];
      for (const c of r._corr ?? []) gs.push(...c.evidence_source_ids.split(";"));
      let body_part = null;
      let assist = g.assist;
      if (k) {
        enriched++;
        gs.push(KG);
        if (k.minute !== g.minute) warn("minute-mismatch-eswiki-vs-kaggle", { n: r.n, date: r.date, eswiki: g.minute, kaggle: k.minute });
        if ((k.method === "Penalty") !== (g.marker === "p")) {
          const art = seasonArticleGoals(r.date).find((x) => Math.abs(x.minute - g.minute) <= 1);
          if (art && art.pen === (k.method === "Penalty")) {
            resolutions.push({ kind: "penalty-flag", n: r.n, date: r.date, minute: g.minute, eswiki: g.marker === "p", kaggle: k.method, season_article: art.pen, adopted: art.pen });
            g.marker = art.pen ? "p" : g.marker === "p" ? null : g.marker;
            gs.push(SEASONS);
          } else if (art) {
            resolutions.push({ kind: "penalty-flag", n: r.n, date: r.date, minute: g.minute, eswiki: g.marker === "p", kaggle: k.method, season_article: art.pen, adopted: art.pen });
            gs.push(SEASONS);
          } else issue("penalty-flag-mismatch", { n: r.n, date: r.date, minute: g.minute, eswiki: g.marker === "p", kaggle: k.method });
        }
        if ((k.method === "Direct free kick") !== (g.marker === "tl")) warn("free-kick-flag-mismatch", { n: r.n, date: r.date, minute: g.minute, eswiki: g.marker === "tl", kaggle: k.method });
        body_part = KAGGLE_BODY[k.method] ?? null;
        assist ??= k.assist;
      }
      const [f, a] = pickCell([g.a, g.b]);
      goals.push({
        goal_id: `${match_id}-g${i + 1}`,
        match_id,
        team_id,
        minute: g.minute,
        added_time: g.added,
        method: g.marker === "p" ? "penalty" : g.marker === "tl" ? "direct_free_kick" : "non_penalty_unspecified",
        body_part,
        location: null,
        assist_player: assist,
        assist_type: assist ? "source_unspecified" : null,
        score_after: `${f}-${a}`,
        intl_goal_no: null,
        source_ids: [...new Set(gs)],
        verified_by: null,
        verified_at: null,
      });
    });
    if (kUsable && !source_ids.includes(KG)) source_ids.push(KG);

    matches.push({
      match_id,
      date: r.date,
      season: r.season,
      competition_id,
      stage,
      team_id,
      opponent_id: tm.team_id,
      venue,
      city: null,
      country: null,
      score_for,
      score_against,
      extra_time: res.extraTime ? true : res.pens ? null : false,
      shootout,
      appeared: true,
      started,
      minutes: r.minutes,
      captain: null,
      cap_number: null,
      source_ids: [...new Set(source_ids)],
      notes,
    });
  }

  // Kaggle goals on dates with no eswiki match
  for (const [d, list] of kaggleByDate) if (!usedKaggleDates.has(d) && !matches.some((m) => m.date === d)) issue("kaggle-goal-without-match", { date: d, opponent: list[0].opponent, goals: list.length });
  for (const n of dateChecks.keys()) if (!usedDateChecks.has(n)) issue("date-check-unused", { es_match_no: n });
  for (const n of neutral.keys()) if (!usedNeutral.has(n)) issue("neutral-manual-unused", { es_match_no: n });

  // documented extra appearances
  for (const e of extras) {
    const team_id = e.team_id;
    matches.push({
      match_id: `${e.date}-${team_id}-${e.opponent_id}`,
      date: e.date,
      season: e.season,
      competition_id: e.competition_id,
      stage: e.stage || null,
      team_id,
      opponent_id: e.opponent_id,
      venue: e.venue,
      city: null,
      country: null,
      score_for: Number(e.score_for),
      score_against: Number(e.score_against),
      extra_time: false,
      shootout: null,
      appeared: true,
      started: null,
      minutes: null,
      captain: null,
      cap_number: null,
      source_ids: e.source_ids.split(";"),
      notes: e.reason,
    });
    if (!teams.has(e.opponent_id)) teams.set(e.opponent_id, { team_id: e.opponent_id, name: e.opponent_name, kind: "club", country: e.opponent_country, confederation: "AFC", wikidata_id: null });
  }

  // ---- write -----------------------------------------------------------------------------------
  const reg = loadRegistry();
  const cols = (n) => reg.tables.find((t) => t.name === n).columns;
  for (const c of CLUB_TEAMS) teams.set(c.team_id, { team_id: c.team_id, name: c.name, kind: "club", country: c.country, confederation: c.country === "Saudi Arabia" ? "AFC" : "UEFA", wikidata_id: null });
  const existingTeams = readCsv(join(ROOT, "data/teams.csv")).rows;
  const nationalIds = new Set(existingTeams.filter((t) => t.kind === "national").map((t) => t.team_id));
  for (const id of teams.keys()) if (nationalIds.has(id)) issue("club-id-collides-with-national-team", { team_id: id });
  const keptTeams = existingTeams.filter((t) => t.kind !== "club");
  writeCsv(
    join(ROOT, "data/teams.csv"),
    cols("teams"),
    [...keptTeams, ...teams.values()].sort((a, b) => (a.team_id === "portugal" ? -1 : b.team_id === "portugal" ? 1 : a.team_id.localeCompare(b.team_id)))
  );
  const isClub = (row) => CLUB_IDS.has(row.team_id);
  const otherMatches = readCsv(join(ROOT, "data/matches.csv")).rows.filter((r) => !isClub(r));
  writeCsv(join(ROOT, "data/matches.csv"), cols("matches"), [...otherMatches, ...matches].sort((a, b) => a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id)));
  const otherGoals = readCsv(join(ROOT, "data/goals.csv")).rows.filter((r) => !isClub(r));
  writeCsv(join(ROOT, "data/goals.csv"), cols("goals"), [...otherGoals, ...goals].sort((a, b) => a.goal_id.localeCompare(b.goal_id, "en", { numeric: true })));

  const unapplied = corrections.filter((c) => !applied.includes(c.correction_id)).map((c) => c.correction_id);
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  const byKind = {};
  for (const i of issues) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
  writeFileSync(
    join(ROOT, "reports/ingest-club.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), matches: matches.length, goals: goals.length, goals_enriched_from_kaggle: enriched, corrections_applied: applied, unapplied, issues_by_kind: byKind, issues, resolutions, warnings }, null, 2) + "\n"
  );
  console.log(`Club ingest: ${matches.length} matches, ${goals.length} goals (${enriched} enriched from Kaggle), ${teams.size} club teams.`);
  // Committed log of 2-of-3 resolutions (reports/ is gitignored); the API's corrections.json reads it.
  writeFileSync(join(ROOT, "data/reconciliation/club-ingest-resolutions.json"), JSON.stringify({ $comment: "Source disagreements settled by the 2-of-3 rule (eswiki, Kaggle, English season article). Generated by scripts/ingest/club.mjs.", resolutions }, null, 2) + "\n");
  console.log(`Corrections applied: ${applied.length}. Resolved by 2-of-3: ${resolutions.length}. Warnings: ${warnings.length}. Issues: ${JSON.stringify(byKind)}`);
  for (const i of issues.slice(0, 80)) console.log("  -", JSON.stringify(i));
  if (issues.length || unapplied.length) {
    if (unapplied.length) console.error(`Corrections not applied: ${unapplied.join(", ")}`);
    console.error("Club ingest finished with items to review; see reports/ingest-club.json. Exiting 1.");
    process.exitCode = 1;
  }
}
