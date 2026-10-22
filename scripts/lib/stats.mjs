// Stats engine: pure functions over a loaded ledger ({ tables }). No I/O.
// Every number the site publishes should come from a function here so it can be unit-tested.

const by = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

export const NATIONAL_TEAM = "portugal";
export const BIRTH_DATE = "1985-02-05";

/** Matches Ronaldo actually played (appeared=true), optionally filtered. */
export function appearances(ledger, pred = () => true) {
  return ledger.tables.matches.filter((m) => m.appeared && pred(m));
}

/** Goals joined with their match (and competition). */
export function goalsWithMatch(ledger) {
  const matches = new Map(ledger.tables.matches.map((m) => [m.match_id, m]));
  const comps = new Map(ledger.tables.competitions.map((c) => [c.competition_id, c]));
  return ledger.tables.goals.map((g) => {
    const match = matches.get(g.match_id);
    return { ...g, match, competition: match ? comps.get(match.competition_id) : undefined };
  });
}

const isIntl = (m) => m.team_id === NATIONAL_TEAM;
const isFriendly = (m) => m.competition_id === "international-friendly";

export const intlCaps = (ledger) => appearances(ledger, isIntl).length;
export const intlGoals = (ledger) => goalsWithMatch(ledger).filter((g) => g.match && isIntl(g.match)).length;
export const intlCompetitiveGoals = (ledger) => goalsWithMatch(ledger).filter((g) => g.match && isIntl(g.match) && !isFriendly(g.match)).length;
export const intlCompetitiveCaps = (ledger) => appearances(ledger, (m) => isIntl(m) && !isFriendly(m)).length;
export const goalsInCompetition = (ledger, competitionId) => goalsWithMatch(ledger).filter((g) => g.match?.competition_id === competitionId).length;
export const penaltyGoals = (ledger, pred = () => true) => goalsWithMatch(ledger).filter((g) => g.method === "penalty" && pred(g.match)).length;

/** Matches where Ronaldo scored at least `n` goals (default 3 = hat-tricks). */
export function multiGoalMatches(ledger, n = 3, pred = () => true) {
  const g = goalsWithMatch(ledger).filter((x) => x.match && pred(x.match));
  return [...by(g, (x) => x.match_id).entries()]
    .filter(([, list]) => list.length >= n)
    .map(([match_id, list]) => ({ match_id, date: list[0].match.date, opponent_id: list[0].match.opponent_id, goals: list.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Win/draw/loss record over appearances (shootouts count as draws, the FIFA convention). */
export function record(ledger, pred = () => true) {
  const ms = appearances(ledger, pred);
  const won = ms.filter((m) => m.score_for > m.score_against).length;
  const drawn = ms.filter((m) => m.score_for === m.score_against).length;
  return { played: ms.length, won, drawn, lost: ms.length - won - drawn };
}

/** Generic grouping: apps and goals per key. keyFn receives a match. */
export function splitBy(ledger, keyFn, pred = () => true) {
  const apps = by(appearances(ledger, pred), keyFn);
  const goals = by(
    goalsWithMatch(ledger).filter((g) => g.match && pred(g.match)),
    (g) => keyFn(g.match)
  );
  const keys = new Set([...apps.keys(), ...goals.keys()]);
  return [...keys]
    .map((key) => ({ key, apps: apps.get(key)?.length ?? 0, goals: goals.get(key)?.length ?? 0 }))
    .sort((a, b) => b.goals - a.goals || b.apps - a.apps || String(a.key).localeCompare(String(b.key)));
}

/** Age in whole years on a given ISO date. */
export function ageOn(date, birth = BIRTH_DATE) {
  const [y, m, d] = date.split("-").map(Number);
  const [by_, bm, bd] = birth.split("-").map(Number);
  return y - by_ - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Registry of functions records.csv may reference in compute_fn ("name" or "name:arg"). */
export const COMPUTE_FNS = {
  intlGoals,
  intlCaps,
  intlCompetitiveGoals,
  intlCompetitiveCaps,
  goalsInCompetition,
};

export function evaluateComputeFn(ledger, spec) {
  const [name, arg] = spec.split(":");
  const fn = COMPUTE_FNS[name];
  if (!fn) throw new Error(`Unknown compute_fn ${name}`);
  return arg === undefined ? fn(ledger) : fn(ledger, arg);
}

/** Headline summary for the international career. */
export function internationalSummary(ledger) {
  const rec = record(ledger, isIntl);
  const caps = intlCaps(ledger);
  const goals = intlGoals(ledger);
  return {
    team_id: NATIONAL_TEAM,
    caps,
    goals,
    goals_per_game: Math.round((goals / caps) * 100) / 100,
    competitive: { caps: intlCompetitiveCaps(ledger), goals: intlCompetitiveGoals(ledger) },
    friendly: { caps: caps - intlCompetitiveCaps(ledger), goals: goals - intlCompetitiveGoals(ledger) },
    penalty_goals: penaltyGoals(ledger, isIntl),
    hat_tricks: multiGoalMatches(ledger, 3, isIntl).length,
    record: rec,
    first_cap: appearances(ledger, isIntl).map((m) => m.date).sort()[0],
    last_cap: appearances(ledger, isIntl).map((m) => m.date).sort().at(-1),
  };
}
