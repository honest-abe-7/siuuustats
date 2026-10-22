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
    for (const r of splitBy(ledger, bigGameClass, pred)) {
      const g = goalsWithMatch(ledger).filter((x) => x.match && pred(x.match) && bigGameClass(x.match) === r.key);
      out.push({ scope, stage_class: r.key, apps: r.apps, goals: r.goals, matches_scored_in: new Set(g.map((x) => x.match_id)).size, penalties: g.filter((x) => x.method === "penalty").length });
    }
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

// ---- M3b content splits (figures the docs/content write-ups state) -----------------------------

const SCOPES = { career: () => true, club: (m) => isClub(m), international: (m) => isIntl(m) };
const isQual = (m) => stageClass(m.stage) === "qualifying";
const round2 = (x) => Math.round(x * 100) / 100;
const gpg = (goals, apps) => (apps ? round2(goals / apps) : null);
const scoredMatches = (goals) => new Set(goals.map((g) => g.match_id)).size;

/** Champions League: main competition by stage class, knockout and final totals, penalties; qualifiers separate. */
export function championsLeagueSplits(ledger) {
  const main = (m) => m.competition_id === UCL && !isQual(m);
  const goals = goalsWithMatch(ledger).filter((g) => g.match && main(g.match));
  const apps = appearances(ledger, main);
  const STAGES = ["group_or_league", "round_of_16", "quarter_final", "semi_final", "final"];
  const by_stage = STAGES.map((stage_class) => {
    const a = apps.filter((m) => stageClass(m.stage) === stage_class);
    const g = goals.filter((x) => stageClass(x.match.stage) === stage_class);
    return { stage_class, apps: a.length, goals: g.length, penalties: g.filter((x) => x.method === "penalty").length, matches_scored_in: scoredMatches(g) };
  });
  const other = apps.filter((m) => !STAGES.includes(stageClass(m.stage)));
  const ko = by_stage.filter((s) => s.stage_class !== "group_or_league");
  const qual = appearances(ledger, (m) => m.competition_id === UCL && isQual(m));
  const qualGoals = goalsWithMatch(ledger).filter((g) => g.match?.competition_id === UCL && isQual(g.match)).length;
  return {
    apps: apps.length,
    goals: goals.length,
    penalty_goals: goals.filter((g) => g.method === "penalty").length,
    non_penalty_goals: goals.filter((g) => g.method !== "penalty").length,
    by_stage,
    unclassified_apps: other.length,
    knockout: { apps: ko.reduce((n, s) => n + s.apps, 0), goals: ko.reduce((n, s) => n + s.goals, 0), penalties: ko.reduce((n, s) => n + s.penalties, 0) },
    finals: { ...by_stage.find((s) => s.stage_class === "final") },
    qualifying: { apps: qual.length, goals: qualGoals },
    incl_qualifying: { apps: apps.length + qual.length, goals: goals.length + qualGoals },
    hat_tricks: multiGoalMatches(ledger, 3, main).length,
  };
}

const minuteOf = (g) => (g.minute === null || g.minute === undefined || g.minute === "" ? null : Number(g.minute));

/** Winning goals, equalisers, one-goal wins and late goals per scope (career / club / international / each club). */
export function clutchSplits(ledger) {
  const scopes = [...Object.entries(SCOPES), ...CLUB_TEAMS.map((t) => [t, (m) => m.team_id === t])];
  return scopes.map(([scope, pred]) => {
    const goals = goalsWithMatch(ledger).filter((g) => g.match && pred(g.match));
    const winners = winningGoals(ledger, pred);
    const oneGoal = (m) => !isAwarded(m) && m.score_for - m.score_against === 1;
    const withMinute = goals.filter((g) => minuteOf(g) !== null);
    const oneGoalWins = appearances(ledger, (m) => pred(m) && oneGoal(m));
    const scoredIn = new Set(goals.map((g) => g.match_id));
    return {
      scope,
      apps: appearances(ledger, pred).length,
      goals: goals.length,
      winning_goals: winners.length,
      winning_goals_in_one_goal_wins: winners.filter((g) => oneGoal(g.match)).length,
      winning_goals_penalties: winners.filter((g) => g.method === "penalty").length,
      equalisers: equalisers(ledger, pred).length,
      equalisers_penalties: equalisers(ledger, pred).filter((g) => g.method === "penalty").length,
      one_goal_wins: oneGoalWins.length,
      one_goal_wins_scored_in: oneGoalWins.filter((m) => scoredIn.has(m.match_id)).length,
      goals_with_minute: withMinute.length,
      goals_80_plus: withMinute.filter((g) => minuteOf(g) >= 80).length,
      goals_90_plus: withMinute.filter((g) => minuteOf(g) >= 90).length,
    };
  });
}

/** Per-goal flags used by goals.json. */
export function goalFlags(ledger) {
  const w = new Set(winningGoals(ledger).map((g) => g.goal_id));
  const e = new Set(equalisers(ledger).map((g) => g.goal_id));
  return (goalId) => ({ winning_goal: w.has(goalId), equaliser: e.has(goalId) });
}

export const AGE_BANDS = [
  { band: "under_25", from: 0, to: 24 },
  { band: "25_29", from: 25, to: 29 },
  { band: "30_34", from: 30, to: 34 },
  { band: "35_plus", from: 35, to: 99 },
];
export const AGE_THRESHOLDS = [30, 35, 38, 40];

/** Apps and goals per age band and from threshold ages, per scope. min_age/max_age are the ages actually played. */
export function ageBands(ledger) {
  const bands = [];
  const thresholds = [];
  for (const [scope, pred] of Object.entries(SCOPES)) {
    const apps = appearances(ledger, pred);
    const goals = goalsWithMatch(ledger).filter((g) => g.match && pred(g.match));
    for (const b of AGE_BANDS) {
      const inB = (m) => ageOn(m.date) >= b.from && ageOn(m.date) <= b.to;
      const a = apps.filter(inB);
      const g = goals.filter((x) => inB(x.match));
      const ages = a.map((m) => ageOn(m.date));
      bands.push({ scope, band: b.band, min_age: Math.min(...ages), max_age: Math.max(...ages), apps: a.length, goals: g.length, goals_per_game: gpg(g.length, a.length) });
    }
    for (const t of AGE_THRESHOLDS) {
      const a = apps.filter((m) => ageOn(m.date) >= t).length;
      const g = goals.filter((x) => ageOn(x.match.date) >= t).length;
      thresholds.push({ scope, from_age: t, apps: a, goals: g, goals_before: goals.length - g, goals_per_game: gpg(g, a) });
    }
  }
  return { bands, thresholds };
}

/** Club-style season (Jul-Jun) for any date. */
export const seasonOf = (date) => {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

const longestRun = (years) => {
  const ys = [...new Set(years)].map(Number).sort((a, b) => a - b);
  let best = { from: null, to: null, years: 0 };
  let s = 0;
  for (let i = 0; i < ys.length; i++) {
    if (i > 0 && ys[i] !== ys[i - 1] + 1) s = i;
    if (i - s + 1 > best.years) best = { from: ys[s], to: ys[i], years: i - s + 1 };
  }
  return best;
};

/** All-competition totals (club + international) per calendar year and per Jul-Jun season, with scoring-year runs. */
export function seasonTotals(ledger) {
  const row = (keyFn) => {
    const out = new Map();
    for (const m of appearances(ledger)) {
      const k = keyFn(m);
      if (!out.has(k)) out.set(k, { apps: 0, goals: 0, club_apps: 0, club_goals: 0, international_apps: 0, international_goals: 0 });
      const r = out.get(k);
      r.apps++;
      r[isIntl(m) ? "international_apps" : "club_apps"]++;
    }
    for (const g of goalsWithMatch(ledger)) {
      if (!g.match) continue;
      const r = out.get(keyFn(g.match));
      r.goals++;
      r[isIntl(g.match) ? "international_goals" : "club_goals"]++;
    }
    return [...out.entries()].map(([k, r]) => ({ key: k, ...r, goals_per_game: gpg(r.goals, r.apps) })).sort((a, b) => a.key.localeCompare(b.key));
  };
  const by_year = row((m) => m.date.slice(0, 4)).map(({ key, ...r }) => ({ year: key, ...r }));
  const by_season = row((m) => (isIntl(m) ? seasonOf(m.date) : m.season)).map(({ key, ...r }) => ({ season: key, ...r }));
  return {
    by_year,
    by_season,
    scoring_years: {
      career: longestRun(by_year.filter((r) => r.goals > 0).map((r) => r.year)),
      club: longestRun(by_year.filter((r) => r.club_goals > 0).map((r) => r.year)),
      international: longestRun(by_year.filter((r) => r.international_goals > 0).map((r) => r.year)),
    },
  };
}

/** National teams: every opponent faced, with caps, goals and first goal; count scored against. */
export function nationalTeamOpponents(ledger) {
  const teamName = new Map((ledger.tables.teams ?? []).map((t) => [t.team_id, t.name]));
  const first = new Map(opponentsScoredAgainst(ledger, isIntl).map((o) => [o.opponent_id, o.first_goal]));
  const rows = splitBy(ledger, (m) => m.opponent_id, isIntl).map((r) => ({
    opponent_id: r.key,
    name: teamName.get(r.key) ?? r.key,
    caps: r.apps,
    goals: r.goals,
    first_goal: first.get(r.key) ?? null,
  }));
  const scored = rows.filter((r) => r.goals > 0).sort((a, b) => a.first_goal.localeCompare(b.first_goal)).map((r, i) => ({ n: i + 1, ...r }));
  return { scored_against: scored.length, faced: rows.length, scored, never_scored: rows.filter((r) => r.goals === 0).sort((a, b) => b.caps - a.caps || a.name.localeCompare(b.name)) };
}

/** Club opponent splits: El Clásico, Madrid derby, Champions League opponents, top opponents overall and per club. */
export function clubOpponentSplits(ledger, top = 5) {
  const teamName = new Map((ledger.tables.teams ?? []).map((t) => [t.team_id, t.name]));
  const named = (r) => ({ opponent_id: r.key, name: teamName.get(r.key) ?? r.key, apps: r.apps, goals: r.goals });
  const vs = (opp, label) => {
    const byClub = splitBy(ledger, (m) => m.team_id, (m) => isClub(m) && m.opponent_id === opp).map((r) => ({ team_id: r.key, apps: r.apps, goals: r.goals }));
    const rm = byClub.find((r) => r.team_id === "real-madrid") ?? { apps: 0, goals: 0 };
    const all = byClub.reduce((a, r) => ({ apps: a.apps + r.apps, goals: a.goals + r.goals }), { apps: 0, goals: 0 });
    const pens = penaltyGoals(ledger, (m) => isClub(m) && m.opponent_id === opp && m.team_id !== "real-madrid");
    return { opponent_id: opp, label, for_real_madrid: { apps: rm.apps, goals: rm.goals }, all_clubs: all, by_club: byClub, penalties_for_other_clubs: pens };
  };
  const ucl = (m) => m.competition_id === UCL && !isQual(m);
  return {
    el_clasico: vs("barcelona", "El Clásico (Real Madrid v Barcelona)"),
    madrid_derby: vs("atletico-madrid", "Madrid derby (Real Madrid v Atlético Madrid)"),
    champions_league_opponents: splitBy(ledger, (m) => m.opponent_id, ucl).map(named),
    top_club_opponents: splitBy(ledger, (m) => m.opponent_id, isClub).slice(0, 10).map(named),
    top_opponents_by_club: CLUB_TEAMS.map((team_id) => ({ team_id, opponents: splitBy(ledger, (m) => m.opponent_id, (m) => m.team_id === team_id).slice(0, top).map(named) })),
  };
}

/** Body-part counts per scope; unknown = no body part recorded (all international goals for now). */
export function bodyParts(ledger) {
  return Object.entries(SCOPES).map(([scope, pred]) => {
    const goals = goalsWithMatch(ledger).filter((g) => g.match && pred(g.match));
    const c = (v) => goals.filter((g) => g.body_part === v).length;
    const right = c("right_foot"), left = c("left_foot"), head = c("head");
    const known = goals.filter((g) => g.body_part).length;
    return { scope, goals: goals.length, right_foot: right, left_foot: left, head, other: known - right - left - head, unknown: goals.length - known, known };
  });
}

/** World Cup / Euro / Confederations Cup finals tournaments: apps and goals per edition (edition = calendar year played). */
export function tournamentEditions(ledger) {
  const T = ["fifa-world-cup", "uefa-euro", "fifa-confederations-cup"];
  return splitBy(ledger, (m) => `${m.competition_id}|${m.date.slice(0, 4)}`, (m) => isIntl(m) && T.includes(m.competition_id))
    .map((r) => {
      const [competition_id, year] = r.key.split("|");
      return { competition_id, year, apps: r.apps, goals: r.goals };
    })
    .sort((a, b) => a.competition_id.localeCompare(b.competition_id) || a.year.localeCompare(b.year));
}

/** Dated milestones derived from the ledger (first/latest, every 100th goal, competition milestones the write-ups cite). */
export function milestones(ledger) {
  const teamName = new Map((ledger.tables.teams ?? []).map((t) => [t.team_id, t.name]));
  const apps = appearances(ledger).sort((a, b) => a.date.localeCompare(b.date));
  const goals = goalsWithMatch(ledger).filter((g) => g.match).sort((a, b) => a.match.date.localeCompare(b.match.date) || (Number(a.minute) || 0) - (Number(b.minute) || 0));
  const out = [];
  const fromMatch = (key, label, m, extra = {}) => m && out.push({ key, label, date: m.date, match_id: m.match_id, team_id: m.team_id, opponent_id: m.opponent_id, opponent: teamName.get(m.opponent_id) ?? m.opponent_id, competition_id: m.competition_id, age: ageOn(m.date), ...extra });
  const nth = (key, label, list, n, appsPred) => {
    const g = list[n - 1];
    if (!g) return;
    fromMatch(key, label, g.match, { goal_id: g.goal_id, minute: g.minute ?? null, value: n, ...(appsPred ? { apps_to_date: appearances(ledger, (m) => appsPred(m) && m.date <= g.match.date).length } : {}) });
  };
  fromMatch("first-senior-match", "First official senior match", apps[0]);
  for (const t of CLUB_TEAMS) fromMatch(`first-match-${t}`, `First match for ${teamName.get(t) ?? t}`, apps.find((m) => m.team_id === t));
  fromMatch("first-cap", "First cap for Portugal", apps.find(isIntl));
  fromMatch("latest-match", "Latest appearance", apps.at(-1));
  nth("first-goal", "First official senior goal", goals, 1);
  nth("first-international-goal", "First goal for Portugal", goals.filter((g) => isIntl(g.match)), 1);
  const latest = goals.at(-1);
  fromMatch("latest-goal", "Latest goal", latest.match, { goal_id: latest.goal_id, minute: latest.minute ?? null, value: goals.length });
  const li = goals.filter((g) => isIntl(g.match)).at(-1);
  fromMatch("latest-international-goal", "Latest goal for Portugal", li.match, { goal_id: li.goal_id, minute: li.minute ?? null, value: goals.filter((g) => isIntl(g.match)).length });
  for (let n = 100; n <= goals.length; n += 100) nth(`career-goal-${n}`, `Career goal ${n}`, goals, n, () => true);
  const uclMain = (m) => m.competition_id === UCL && !isQual(m);
  nth("ucl-goal-100", "100th Champions League goal (main competition)", goals.filter((g) => uclMain(g.match)), 100, uclMain);
  const liga = (m) => m.competition_id === "la-liga";
  nth("la-liga-goal-300", "300th La Liga goal", goals.filter((g) => liga(g.match)), 300, liga);
  const after30 = goals.filter((g) => ageOn(g.match.date) >= 30);
  nth("goals-from-30-500", "500th goal from age 30", after30, 500, (m) => ageOn(m.date) >= 30);
  for (const t of CLUB_TEAMS) {
    const list = goals.filter((g) => g.match.team_id === t);
    if (list.length >= 100) nth(`club-goal-100-${t}`, `100th goal for ${teamName.get(t) ?? t}`, list, 100, (m) => m.team_id === t);
  }
  return out;
}
