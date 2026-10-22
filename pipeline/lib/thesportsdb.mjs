// TheSportsDB v1 free API helpers. The free key only returns a few rows per call
// (eventslast/eventsnext: 1 home event; eventsday: 3 events), so results are hints for a human.
import { THESPORTSDB } from "../config.mjs";

export function apiUrl(endpoint, params, { key = process.env.THESPORTSDB_KEY || THESPORTSDB.freeKey, base = THESPORTSDB.base } = {}) {
  return `${base}/${key}/${endpoint}.php?${new URLSearchParams(params)}`;
}

/** Strip a URL's API key so it can be shown in reports/PRs. */
export const publicUrl = (url) => url.replace(/\/json\/[^/]+\//, "/json/{key}/");

/** Events array from any v1 schedule response ({events}, {results}, or null). */
export function eventsOf(json) {
  if (!json || typeof json !== "object") throw new Error("TheSportsDB: invalid response");
  const arr = json.events ?? json.results ?? json.event ?? null;
  if (arr === null) return [];
  if (!Array.isArray(arr)) throw new Error("TheSportsDB: events is not an array");
  return arr;
}

const FINISHED = new Set(["FT", "AET", "PEN", "AP", "Match Finished", "After Extra Time", "After Penalties"]);

export function isFinished(e) {
  if (FINISHED.has(e.strStatus)) return true;
  if (e.strStatus && /^(NS|TBD|PST|CANC|ABD|SUSP|1H|2H|HT|ET|LIVE|Not Started|Postponed|Cancelled)$/i.test(e.strStatus)) return false;
  return e.intHomeScore !== null && e.intHomeScore !== undefined && e.intHomeScore !== "" && e.intAwayScore !== null && e.intAwayScore !== "";
}

/** Keep only the stable, useful fields of an event. */
export function normalizeEvent(e, tracked) {
  const t = tracked.find((x) => x.idTeam === e.idHomeTeam || x.idTeam === e.idAwayTeam);
  if (!t) return null;
  return {
    key: `${e.dateEvent}-${t.team_id}`,
    team_id: t.team_id,
    date: e.dateEvent,
    date_local: e.dateEventLocal || null,
    home_team: e.strHomeTeam,
    away_team: e.strAwayTeam,
    opponent: e.idHomeTeam === t.idTeam ? e.strAwayTeam : e.strHomeTeam,
    score: isFinished(e) ? `${e.intHomeScore}-${e.intAwayScore}` : null,
    competition: e.strLeague,
    thesportsdb_event_id: e.idEvent,
    thesportsdb_url: `https://www.thesportsdb.com/event/${e.idEvent}`,
    source: "thesportsdb",
  };
}

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** True if the ledger has a match for this team on the event date (±1 day for time-zone shifts). */
export function inLedger(ev, ledgerMatches) {
  const dates = new Set([ev.date, ev.date_local, addDays(ev.date, -1), addDays(ev.date, 1)].filter(Boolean));
  return ledgerMatches.some((m) => m.team_id === ev.team_id && dates.has(m.date));
}

/** The list of URLs to query for one run. */
export function plannedRequests(today, cfg = THESPORTSDB) {
  const reqs = [];
  for (const t of cfg.teams) {
    reqs.push({ kind: "eventslast", url: apiUrl("eventslast", { id: t.idTeam }), team: t.idTeam });
    reqs.push({ kind: "eventsnext", url: apiUrl("eventsnext", { id: t.idTeam }), team: t.idTeam });
  }
  for (let d = 0; d < cfg.lookbackDays; d++) {
    const day = addDays(today, -d);
    for (const l of [...new Set(cfg.teams.filter((t) => t.scanLeagues).flatMap((t) => t.leagues))])
      reqs.push({ kind: "eventsday", url: apiUrl("eventsday", { d: day, l }), league: l, day });
  }
  return reqs;
}

export { addDays };
