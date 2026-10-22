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

// ---- Club + career (M3) ------------------------------------------------------------------------

const isClub = (m) => m.team_id !== NATIONAL_TEAM;
export const CLUB_TEAMS = ["sporting-cp", "manchester-united", "real-madrid", "juventus", "al-nassr"];
export const UCL = "uefa-champions-league";
/** Competitions FIFA/UEFA/AFC do not count as official (flagged so headline totals can show both). */
export const NON_FIFA_COMPETITIONS = ["arab-club-champions-cup"];
const isQualifier = (m) => /qualif/i.test(m.stage ?? "");
const isAwarded = (m) => /^Awarded /.test(m.notes ?? "");

export const clubApps = (ledger) => appearances(ledger, isClub).length;
export const clubGoals = (ledger) => goalsWithMatch(ledger).filter((g) => g.match && isClub(g.match)).length;
export const careerApps = (ledger) => appearances(ledger).length;
export const careerGoals = (ledger) => ledger.tables.goals.length;
export const careerPenaltyGoals = (ledger) => penaltyGoals(ledger);
/** Champions League goals in the main competition (group/league phase onward): the headline figure (decision a). */
export const uclGoalsMain = (ledger) => goalsWithMatch(ledger).filter((g) => g.match?.competition_id === UCL && !isQualifier(g.match)).length;
/** Including qualifying rounds (141, the figure on UEFA's "including qualifying rounds" list): stored and footnoted. UEFA.com's headline is 140 (uclGoalsMain). */
export const uclGoalsInclQualifiers = (ledger) => goalsInCompetition(ledger, UCL);
export const uclAppsMain = (ledger) => appearances(ledger, (m) => m.competition_id === UCL && !isQualifier(m)).length;
export const goalsForClub = (ledger, teamId) => goalsWithMatch(ledger).filter((g) => g.match?.team_id === teamId).length;

/** Score after a goal, parsed from "for-against". */
const scoreAfter = (g) => {
  const [f, a] = String(g.score_after ?? "").split("-").map(Number);
  return Number.isInteger(f) && Number.isInteger(a) ? { f, a } : null;
};

/**
 * Winning goal: a goal in a match Ronaldo's team won (score, not shootout; awarded results excluded)
 * that took the team to one more than the opponent's final total, i.e. score_after.for === score_against + 1.
 */
export function winningGoals(ledger, pred = () => true) {
  return goalsWithMatch(ledger).filter((g) => {
    const m = g.match;
    if (!m || !pred(m) || isAwarded(m) || !(m.score_for > m.score_against)) return false;
    const s = scoreAfter(g);
    return s !== null && s.f === m.score_against + 1;
  });
}

/** Equaliser: a goal after which the score was level (score_after.for === score_after.against). */
export function equalisers(ledger, pred = () => true) {
  return goalsWithMatch(ledger).filter((g) => {
    if (!g.match || !pred(g.match)) return false;
    const s = scoreAfter(g);
    return s !== null && s.f === s.a;
  });
}

/** Distinct opponents scored against, with first goal date, optionally filtered by match predicate. */
export function opponentsScoredAgainst(ledger, pred = () => true) {
  const first = new Map();
  for (const g of goalsWithMatch(ledger)) {
    if (!g.match || !pred(g.match)) continue;
    const prev = first.get(g.match.opponent_id);
    if (!prev || g.match.date < prev) first.set(g.match.opponent_id, g.match.date);
  }
  return [...first.entries()].map(([opponent_id, first_goal]) => ({ opponent_id, first_goal })).sort((a, b) => a.first_goal.localeCompare(b.first_goal));
}
export const nationalTeamsScoredAgainst = (ledger) => opponentsScoredAgainst(ledger, isIntl).length;

/** Goals scored on or after a given age (default 30). */
export const goalsFromAge = (ledger, age = 30) => goalsWithMatch(ledger).filter((g) => g.match && ageOn(g.match.date) >= Number(age)).length;

/** Club headline summary: totals, per club, per season (club × season) and per competition. */
export function clubSummary(ledger) {
  const goals = clubGoals(ledger);
  const apps = clubApps(ledger);
  const teamName = new Map((ledger.tables.teams ?? []).map((t) => [t.team_id, t.name]));
  const perClub = CLUB_TEAMS.map((team_id) => ({
    team_id,
    name: teamName.get(team_id) ?? null,
    apps: appearances(ledger, (m) => m.team_id === team_id).length,
    goals: goalsForClub(ledger, team_id),
    first_match: appearances(ledger, (m) => m.team_id === team_id).map((m) => m.date).sort()[0] ?? null,
    last_match: appearances(ledger, (m) => m.team_id === team_id).map((m) => m.date).sort().at(-1) ?? null,
  }));
  const nonFifa = goalsWithMatch(ledger).filter((g) => g.match && isClub(g.match) && NON_FIFA_COMPETITIONS.includes(g.match.competition_id)).length;
  return {
    apps,
    goals,
    goals_per_game: Math.round((goals / apps) * 100) / 100,
    goals_excluding_non_fifa: goals - nonFifa,
    penalty_goals: penaltyGoals(ledger, isClub),
    hat_tricks: multiGoalMatches(ledger, 3, isClub).length,
    record: record(ledger, isClub),
    champions_league: {
      goals: uclGoalsMain(ledger),
      apps: uclAppsMain(ledger),
      goals_incl_qualifiers: uclGoalsInclQualifiers(ledger),
      apps_incl_qualifiers: appearances(ledger, (m) => m.competition_id === UCL).length,
      note: "Headline uses the main competition (group/league phase onward), the same basis as UEFA.com's 140 goals in 183 appearances. UEFA's all-time list including qualifying rounds gives 141 (extra goal: Debrecen, 9 Aug 2005).",
    },
    clubs: perClub,
  };
}

/** Career = club + international. */
export function careerSummary(ledger) {
  const goals = careerGoals(ledger);
  const nonFifa = goalsWithMatch(ledger).filter((g) => g.match && NON_FIFA_COMPETITIONS.includes(g.match.competition_id)).length;
  const apps = careerApps(ledger);
  return {
    apps,
    goals,
    goals_per_game: Math.round((goals / apps) * 100) / 100,
    goals_excluding_non_fifa: goals - nonFifa,
    non_fifa_competitions: NON_FIFA_COMPETITIONS,
    penalty_goals: careerPenaltyGoals(ledger),
    non_penalty_goals: goals - careerPenaltyGoals(ledger),
    free_kick_goals: goalsWithMatch(ledger).filter((g) => g.method === "direct_free_kick").length,
    hat_tricks: multiGoalMatches(ledger, 3).length,
    winning_goals: winningGoals(ledger).length,
    equalisers: equalisers(ledger).length,
    goals_from_age_30: goalsFromAge(ledger, 30),
    record: record(ledger),
  };
}

Object.assign(COMPUTE_FNS, {
  clubGoals,
  clubApps,
  careerGoals,
  careerApps,
  careerPenaltyGoals,
  uclGoalsMain,
  uclGoalsInclQualifiers,
  goalsForClub,
  nationalTeamsScoredAgainst,
  goalsFromAge,
});

/** Longest runs of consecutive appearances with at least one goal, per scope ("all", "club", "international"). */
export function scoringStreaks(ledger, top = 5) {
  const goalsBy = new Map();
  for (const g of ledger.tables.goals) goalsBy.set(g.match_id, (goalsBy.get(g.match_id) ?? 0) + 1);
  const out = [];
  for (const [scope, pred] of [["all", () => true], ["club", isClub], ["international", isIntl]]) {
    const apps = appearances(ledger, pred).slice().sort((a, b) => a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id));
    const runs = [];
    let cur = null;
    for (const m of apps) {
      const n = goalsBy.get(m.match_id) ?? 0;
      if (n > 0) {
        cur ??= { scope, matches: 0, goals: 0, from: m.date, to: m.date, match_ids: [] };
        cur.matches++;
        cur.goals += n;
        cur.to = m.date;
        cur.match_ids.push(m.match_id);
      } else if (cur) {
        runs.push(cur);
        cur = null;
      }
    }
    if (cur) runs.push({ ...cur, ongoing: true });
    runs.sort((a, b) => b.matches - a.matches || b.goals - a.goals || a.from.localeCompare(b.from));
    out.push(...runs.slice(0, top).map((r) => ({ ongoing: false, ...r })));
  }
  return out;
}

/** Normalised stage class used for big-game splits. */
export function stageClass(stage) {
  const s = String(stage ?? "").toLowerCase();
  if (!s) return "unknown";
  if (/qualif|preliminary|play-off round/.test(s)) return "qualifying";
  if (/^final|^final\b|\bfinal$/.test(s) && !/semi|quarter|1\/8/.test(s)) return "final";
  if (/semi/.test(s)) return "semi_final";
  if (/quarter/.test(s)) return "quarter_final";
  if (/round of 16|last 16|1\/8/.test(s)) return "round_of_16";
  if (/round of 32|round of 64|round \d|play-off/.test(s)) return "early_knockout";
  if (/group|league phase|league stage|matchday/.test(s)) return "group_or_league";
  return "other";
}

/** Stage class of a match for big-game splits: one-off and two-legged super cups count as finals. */
export const bigGameClass = (m) => (/super-?cup|supercop|shield/.test(m.competition_id) && /^(|1st leg|2nd leg)$/.test(m.stage ?? "") ? "final" : stageClass(m.stage));

/** Per club season (club × season) totals with enwiki-category splits. */
export function clubSeasonTotals(ledger) {
  const cat = new Map(ledger.tables.competitions.map((c) => [c.competition_id, c.wikipedia_category]));
  const rows = new Map();
  const goalsBy = new Map();
  for (const g of ledger.tables.goals) goalsBy.set(g.match_id, (goalsBy.get(g.match_id) ?? 0) + 1);
  for (const m of appearances(ledger, isClub)) {
    const k = `${m.season}|${m.team_id}`;
    if (!rows.has(k)) rows.set(k, { season: m.season, team_id: m.team_id, apps: 0, goals: 0, by_category: {} });
    const r = rows.get(k);
    const c = cat.get(m.competition_id) ?? "other";
    r.by_category[c] ??= { apps: 0, goals: 0 };
    const n = goalsBy.get(m.match_id) ?? 0;
    r.apps++;
    r.goals += n;
    r.by_category[c].apps++;
    r.by_category[c].goals += n;
  }
  return [...rows.values()]
    .map((r) => ({ ...r, goals_per_game: Math.round((r.goals / r.apps) * 100) / 100 }))
    .sort((a, b) => a.season.localeCompare(b.season) || a.team_id.localeCompare(b.team_id));
}

/** Apps and goals by stage class and scope (finals, semi-finals, ...). One-off super cups and two-legged super cups count as finals.
 *  International stage is not yet populated, so international rows are "unknown". */
export function bigGameSplits(ledger) {
  const out = [];
  for (const [scope, pred] of [["club", isClub], ["international", isIntl]])
    for (const r of splitBy(ledger, bigGameClass, pred)) out.push({ scope, stage_class: r.key, apps: r.apps, goals: r.goals });
  return out;
}

/**
 * Team trophies and individual awards headline counts.
 * major_trophies = rows with counted_in_total (Wikipedia's Honours list: won while in the squad);
 * trophies_incl_not_in_squad adds titles his team won while he was not in the matchday squad (messivsronaldo.app's 37).
 */
export function honoursSummary(ledger) {
  const trophies = ledger.tables.trophies ?? [];
  const awards = ledger.tables.awards ?? [];
  const wins = (prefix) => awards.filter((a) => a.placing === 1 && prefix.some((p) => a.award_id.startsWith(p))).length;
  const byTeam = {};
  for (const t of trophies.filter((x) => x.counted_in_total)) byTeam[t.team_id] = (byTeam[t.team_id] ?? 0) + 1;
  const byParticipation = {};
  for (const t of trophies) byParticipation[t.participation] = (byParticipation[t.participation] ?? 0) + 1;
  return {
    major_trophies: trophies.filter((t) => t.counted_in_total).length,
    trophies_incl_not_in_squad: trophies.length,
    trophies_by_team: byTeam,
    trophies_by_participation: byParticipation,
    champions_league_titles: trophies.filter((t) => t.counted_in_total && t.competition_id === "uefa-champions-league").length,
    league_titles: trophies.filter((t) => t.counted_in_total && ["primeira-liga", "premier-league", "la-liga", "serie-a", "saudi-pro-league"].includes(t.competition_id)).length,
    ballon_dor: awards.filter((a) => a.placing === 1 && ["Ballon d'Or", "FIFA Ballon d'Or"].includes(a.name)).length,
    fifa_best: wins(["the-best-fifa-mens-player-"]),
    european_golden_shoes: wins(["european-golden-shoe-"]),
    ucl_top_scorer_seasons: wins(["ucl-top-scorer-"]),
    league_top_scorer_awards: wins(["premier-league-golden-boot-", "pichichi-trophy-", "capocannoniere-", "saudi-pro-league-golden-boot-"]),
    individual_awards: awards.filter((a) => a.placing === 1).length,
  };
}
