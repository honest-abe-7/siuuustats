#!/usr/bin/env node
// Builds the static read API (the /api/v1 contract in CONTRACTS.md) from the ledger.
// Usage: npm run build:api [-- --out <dir>]   (default: dist/api/v1)
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadLedger } from "./lib/ledger.mjs";
import * as stats from "./lib/stats.mjs";
import { readCsv } from "./lib/csv.mjs";
import { existsSync, readFileSync } from "node:fs";
import { runReconciliation } from "./reconcile.mjs";

export const API_VERSION = "v1";

export function buildApi(ledger, generatedAt = new Date().toISOString()) {
  const { matches, teams, competitions, sources, records } = ledger.tables;
  const teamName = new Map(teams.map((t) => [t.team_id, t.name]));
  const compName = new Map(competitions.map((c) => [c.competition_id, c.name]));
  const isPor = (m) => m.team_id === stats.NATIONAL_TEAM;
  const scopeOf = (m) => (isPor(m) ? "international" : "club");
  const dataAsOf = matches.map((m) => m.date).sort().at(-1) ?? null;
  const usedSources = new Set();
  const envelope = (endpoint, data, sourceIds) => {
    const ids = [...new Set(sourceIds)].sort();
    ids.forEach((s) => usedSources.add(s));
    return {
      api_version: API_VERSION,
      endpoint,
      generated_at: generatedAt,
      data_as_of: dataAsOf,
      licence: "CC BY-SA 4.0",
      attribution: ids.map((id) => {
        const s = sources.find((x) => x.source_id === id);
        return { source_id: id, title: s?.title, publisher: s?.publisher, url: s?.url, licence: s?.licence };
      }),
      data,
    };
  };
  const goals = stats.goalsWithMatch(ledger);
  const flags = stats.goalFlags(ledger);
  const goalRows = goals
    .map((g) => ({
      goal_id: g.goal_id,
      match_id: g.match_id,
      date: g.match.date,
      season: g.match.season,
      team_id: g.team_id,
      opponent_id: g.match.opponent_id,
      opponent: teamName.get(g.match.opponent_id),
      competition_id: g.match.competition_id,
      competition: compName.get(g.match.competition_id),
      scope: scopeOf(g.match),
      stage: g.match.stage ?? null,
      venue: g.match.venue,
      minute: g.minute,
      added_time: g.added_time,
      method: g.method,
      body_part: g.body_part,
      assist_player: g.assist_player,
      assist_type: g.assist_type,
      score_after: g.score_after,
      ...flags(g.goal_id),
      result: `${g.match.score_for}-${g.match.score_against}`,
      age: stats.ageOn(g.match.date),
      intl_goal_no: g.intl_goal_no,
      source_ids: g.source_ids,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.goal_id.localeCompare(b.goal_id, "en", { numeric: true }));
  const allSrc = (rows) => rows.flatMap((r) => r.source_ids);
  const intlMatches = matches.filter(isPor);
  const out = {};
  const clubMatches = matches.filter((m) => !isPor(m));
  const goalSrc = (pred) => allSrc(goals.filter((g) => g.match && pred(g.match)));
  // Row-level sources: every source cited by the appearances and goals that make up a row.
  const goalsByMatch = new Map();
  for (const g of ledger.tables.goals) (goalsByMatch.get(g.match_id) ?? goalsByMatch.set(g.match_id, []).get(g.match_id)).push(g);
  const rowSrc = (pred) => {
    const ids = new Set();
    for (const m of matches) {
      if (!m.appeared || !pred(m)) continue;
      m.source_ids.forEach((x) => ids.add(x));
      for (const g of goalsByMatch.get(m.match_id) ?? []) g.source_ids.forEach((x) => ids.add(x));
    }
    return [...ids].sort();
  };
  const INTL = ["wikipedia-cristiano-ronaldo", "wikipedia-cr7-intl-goals", "rsssf-cronaldo-intlg", "martj42-results"];
  const CLUB = ["eswiki-cr7-club-matches", "wikipedia-club-season-articles", "wikipedia-cristiano-ronaldo"];
  // Per-number citations (dotted path into data -> source_ids). The envelope attribution still lists every source used.
  const citations = {
    "international.caps": INTL,
    "international.goals": INTL,
    "international.penalty_goals": ["wikipedia-cr7-intl-goals", "martj42-goalscorers", "messivsronaldo-app-international"],
    "international.hat_tricks": ["wikipedia-cr7-intl-goals"],
    "international.record": ["rsssf-cronaldo-intlg", "martj42-results"],
    "club.apps": ["eswiki-cr7-club-matches", "wikipedia-club-season-articles"],
    "club.goals": CLUB,
    "club.penalty_goals": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-club-season-articles"],
    "club.champions_league": ["eswiki-cr7-club-matches", "wikipedia-club-season-articles", "wikipedia-cristiano-ronaldo"],
    "club.clubs": CLUB,
    "club.record": ["eswiki-cr7-club-matches", "wikipedia-club-season-articles"],
    "career.apps": ["eswiki-cr7-club-matches", ...INTL],
    "career.goals": [...CLUB, "wikipedia-cr7-intl-goals"],
    "career.penalty_goals": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-club-season-articles", "wikipedia-cr7-intl-goals", "martj42-goalscorers"],
    "career.winning_goals": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-cr7-intl-goals"],
    "career.equalisers": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-cr7-intl-goals"],
    "career.goals_per_game": [...CLUB, ...INTL],
    "career.free_kick_goals": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals"],
    "career.non_penalty_goals": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-club-season-articles", "wikipedia-cr7-intl-goals", "martj42-goalscorers"],
    "career.hat_tricks": ["eswiki-cr7-club-matches", "wikipedia-cr7-intl-goals"],
    "career.goals_from_age_30": ["eswiki-cr7-club-matches", "wikipedia-cr7-intl-goals", "wikipedia-cristiano-ronaldo"],
    "career.goals_excluding_non_fifa": [...CLUB, "wikipedia-cr7-intl-goals"],
    "career.non_fifa_competitions": ["wikipedia-cristiano-ronaldo", "wikipedia-club-season-articles"],
    "career.record": ["eswiki-cr7-club-matches", "wikipedia-club-season-articles", "rsssf-cronaldo-intlg", "martj42-results"],
    "club.goals_per_game": CLUB,
    "club.goals_excluding_non_fifa": CLUB,
    "club.hat_tricks": ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals"],
    "international.goals_per_game": INTL,
    "international.competitive": ["wikipedia-cr7-intl-goals", "martj42-goalscorers", "martj42-results"],
    "international.friendly": ["wikipedia-cr7-intl-goals", "rsssf-cronaldo-intlg"],
    "international.first_cap": ["rsssf-cronaldo-intlg", "martj42-results"],
    "international.last_cap": ["wikipedia-cristiano-ronaldo", "wikipedia-cr7-intl-goals", "martj42-results"],
    "honours.major_trophies": ["wikipedia-cristiano-ronaldo"],
    "honours.trophies_incl_not_in_squad": ["messivsronaldo-app-honours", "wikipedia-2008-community-shield", "wikipedia-2016-uefa-super-cup"],
    "honours.trophies_by_team": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-honours"],
    "honours.trophies_by_participation": ["eswiki-cr7-club-matches", "wikipedia-2002-supertaca", "wikipedia-2014-copa-del-rey-final", "messivsronaldo-app-honours"],
    "honours.champions_league_titles": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-honours"],
    "honours.league_titles": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-honours"],
    "honours.ballon_dor": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards"],
    "honours.fifa_best": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards"],
    "honours.european_golden_shoes": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards"],
    "honours.ucl_top_scorer_seasons": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards", "uefa-com-ucl-all-time-top-scorers"],
    "honours.league_top_scorer_awards": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards"],
    "honours.individual_awards": ["wikipedia-cristiano-ronaldo", "messivsronaldo-app-individual-awards"],
  };
  out["summary.json"] = envelope(
    "summary",
    { international: stats.internationalSummary(ledger), club: stats.clubSummary(ledger), career: stats.careerSummary(ledger), honours: stats.honoursSummary(ledger), citations },
    allSrc(matches).concat(allSrc(ledger.tables.goals))
  );
  out["goals.json"] = envelope("goals", goalRows, allSrc(goalRows));
  out["matches.json"] = envelope(
    "matches",
    matches.map((m) => ({ ...m, scope: scopeOf(m), opponent: teamName.get(m.opponent_id), competition: compName.get(m.competition_id) })),
    allSrc(matches)
  );
  // Split files: one row per (scope, key). Filter on `scope` for club-only or international-only views.
  const scoped = (keyFn, map) =>
    ["international", "club"].flatMap((scope) =>
      stats.splitBy(ledger, keyFn, (m) => scopeOf(m) === scope).map((r) => ({ scope, ...map(r) }))
    );
  const named = (nameMap, keyName) => (r) => ({ [keyName]: r.key, name: nameMap ? nameMap.get(r.key) : undefined, apps: r.apps, goals: r.goals });
  const everything = allSrc(matches).concat(allSrc(ledger.tables.goals));
  out["goals-by-competition.json"] = envelope("goals-by-competition", scoped((m) => m.competition_id, named(compName, "competition_id")), everything);
  out["goals-by-year.json"] = envelope(
    "goals-by-year",
    scoped((m) => m.date.slice(0, 4), (r) => ({ year: r.key, apps: r.apps, goals: r.goals })).sort((a, b) => a.scope.localeCompare(b.scope) || a.year.localeCompare(b.year)),
    everything
  );
  out["goals-by-opponent.json"] = envelope("goals-by-opponent", scoped((m) => m.opponent_id, named(teamName, "opponent_id")), everything);
  out["goals-by-club.json"] = envelope("goals-by-club", stats.clubSummary(ledger).clubs.map((c) => ({ ...c, name: teamName.get(c.team_id), source_ids: rowSrc((m) => m.team_id === c.team_id) })), allSrc(clubMatches).concat(goalSrc((m) => !isPor(m))));
  out["club-season-totals.json"] = envelope(
    "club-season-totals",
    stats.clubSeasonTotals(ledger).map((r) => ({ ...r, name: teamName.get(r.team_id), source_ids: rowSrc((m) => m.team_id === r.team_id && m.season === r.season) })),
    allSrc(clubMatches).concat(goalSrc((m) => !isPor(m)))
  );
  out["goals-by-season.json"] = envelope(
    "goals-by-season",
    stats
      .splitBy(ledger, (m) => `${m.season}|${m.team_id}|${m.competition_id}`, (m) => !isPor(m))
      .map((r) => {
        const [season, team_id, competition_id] = r.key.split("|");
        return { season, team_id, competition_id, competition: compName.get(competition_id), wikipedia_category: competitions.find((c) => c.competition_id === competition_id)?.wikipedia_category ?? null, apps: r.apps, goals: r.goals, source_ids: rowSrc((m) => m.season === season && m.team_id === team_id && m.competition_id === competition_id) };
      })
      .sort((a, b) => a.season.localeCompare(b.season) || a.team_id.localeCompare(b.team_id) || b.apps - a.apps || a.competition_id.localeCompare(b.competition_id)),
    allSrc(clubMatches).concat(goalSrc((m) => !isPor(m)))
  );
  const multi = stats.multiGoalMatches(ledger, 2);
  const multiIds = new Set(multi.map((x) => x.match_id));
  const matchById = new Map(matches.map((m) => [m.match_id, m]));
  out["multi-goal-matches.json"] = envelope(
    "multi-goal-matches",
    multi.map((x) => {
      const m = matchById.get(x.match_id);
      return { ...x, scope: scopeOf(m), opponent: teamName.get(x.opponent_id), competition_id: m.competition_id, team_id: m.team_id, result: `${m.score_for}-${m.score_against}`, kind: x.goals >= 4 ? (x.goals === 4 ? "poker" : "haul") : x.goals === 3 ? "hat-trick" : "brace", source_ids: m.source_ids };
    }),
    allSrc(matches.filter((m) => multiIds.has(m.match_id)))
  );
  out["goals-by-age.json"] = envelope(
    "goals-by-age",
    scoped((m) => stats.ageOn(m.date), (r) => ({ age: r.key, apps: r.apps, goals: r.goals }))
      .map((r) => ({ ...r, source_ids: rowSrc((m) => scopeOf(m) === r.scope && stats.ageOn(m.date) === r.age) }))
      .sort((a, b) => a.scope.localeCompare(b.scope) || a.age - b.age),
    everything
  );
  out["streaks.json"] = envelope(
    "streaks",
    stats.scoringStreaks(ledger).map((r) => {
      const ids = new Set(r.match_ids);
      return { ...r, source_ids: rowSrc((m) => ids.has(m.match_id)) };
    }),
    everything
  );
  out["big-games.json"] = envelope(
    "big-games",
    stats.bigGameSplits(ledger).map((r) => ({ ...r, source_ids: rowSrc((m) => scopeOf(m) === r.scope && stats.bigGameClass(m) === r.stage_class) })),
    everything
  );
  const rec = runReconciliation(ledger.root ?? undefined, ledger);
  out["reconciliation.json"] = envelope(
    "reconciliation",
    { counts: rec.counts, checks: rec.checks.map(({ check, source_id, description, expected, actual, status, note }) => ({ check, source_id, description, expected, actual, status, note: note ?? null })) },
    rec.checks.map((c) => c.source_id)
  );
  const root = ledger.root ?? ROOT;
  const corr = readCsv(join(root, "data/manual/corrections.csv")).rows;
  const dateChecks = readCsv(join(root, "data/manual/club-date-checks.csv")).rows;
  const resPath = join(root, "data/reconciliation/club-ingest-resolutions.json");
  const ingestClub = existsSync(resPath) ? JSON.parse(readFileSync(resPath, "utf8")) : { resolutions: [] };
  out["corrections.json"] = envelope(
    "corrections",
    {
      corrections: corr.map((c) => ({ ...c, evidence_source_ids: c.evidence_source_ids.split(";") })),
      date_checks: dateChecks.map((d) => ({ ...d, evidence_source_ids: d.evidence_source_ids.split(";") })),
      resolutions_2_of_3: ingestClub.resolutions ?? [],
    },
    corr.flatMap((c) => [c.source_id, ...c.evidence_source_ids.split(";")]).concat(dateChecks.flatMap((d) => d.evidence_source_ids.split(";")))
  );
  // ---- M3b content splits ----
  const SCOPE_PRED = { career: () => true, all: () => true, club: (m) => scopeOf(m) === "club", international: (m) => scopeOf(m) === "international" };
  const scopePred = (scope) => SCOPE_PRED[scope] ?? ((m) => m.team_id === scope);
  const UCLMAIN = (m) => m.competition_id === "uefa-champions-league" && stats.stageClass(m.stage) !== "qualifying";
  const ucl = stats.championsLeagueSplits(ledger);
  out["champions-league.json"] = envelope(
    "champions-league",
    {
      ...ucl,
      by_stage: ucl.by_stage.map((r) => ({ ...r, source_ids: rowSrc((m) => UCLMAIN(m) && stats.stageClass(m.stage) === r.stage_class) })),
      note: "Main competition (group/league phase to final), stage from matches.stage via stageClass(). Qualifying rounds are separate; incl_qualifying matches UEFA's all-rounds list.",
      source_ids: rowSrc(UCLMAIN),
    },
    allSrc(matches.filter(UCLMAIN))
  );
  out["clutch.json"] = envelope(
    "clutch",
    stats.clutchSplits(ledger).map((r) => ({ ...r, source_ids: rowSrc(scopePred(r.scope)) })),
    everything
  );
  const ab = stats.ageBands(ledger);
  out["goals-by-age-band.json"] = envelope(
    "goals-by-age-band",
    {
      bands: ab.bands.map((r) => {
        const b = stats.AGE_BANDS.find((x) => x.band === r.band);
        return { ...r, source_ids: rowSrc((m) => scopePred(r.scope)(m) && stats.ageOn(m.date) >= b.from && stats.ageOn(m.date) <= b.to) };
      }),
      thresholds: ab.thresholds.map((r) => ({ ...r, source_ids: rowSrc((m) => scopePred(r.scope)(m) && stats.ageOn(m.date) >= r.from_age) })),
      birth_date: stats.BIRTH_DATE,
    },
    everything.concat(["wikipedia-cristiano-ronaldo"])
  );
  const st = stats.seasonTotals(ledger);
  out["season-totals.json"] = envelope(
    "season-totals",
    {
      by_year: st.by_year.map((r) => ({ ...r, source_ids: rowSrc((m) => m.date.startsWith(r.year)) })),
      by_season: st.by_season.map((r) => ({ ...r, source_ids: rowSrc((m) => (scopeOf(m) === "international" ? stats.seasonOf(m.date) : m.season) === r.season) })),
      scoring_years: st.scoring_years,
      note: "All competitions, club + international. by_season uses the club season; international matches are placed in the July-June season of their date.",
    },
    everything
  );
  const nto = stats.nationalTeamOpponents(ledger);
  out["national-teams.json"] = envelope(
    "national-teams",
    {
      ...nto,
      tournament_editions: stats.tournamentEditions(ledger).map((r) => ({ ...r, source_ids: rowSrc((m) => scopeOf(m) === "international" && m.competition_id === r.competition_id && m.date.startsWith(r.year)) })),
      scored: nto.scored.map((r) => ({ ...r, source_ids: rowSrc((m) => scopeOf(m) === "international" && m.opponent_id === r.opponent_id) })),
      never_scored: nto.never_scored.map((r) => ({ ...r, source_ids: rowSrc((m) => scopeOf(m) === "international" && m.opponent_id === r.opponent_id) })),
    },
    allSrc(matches.filter((m) => scopeOf(m) === "international")).concat(goalSrc((m) => scopeOf(m) === "international"))
  );
  const co = stats.clubOpponentSplits(ledger);
  const oppRow = (pred) => (r) => ({ ...r, source_ids: rowSrc((m) => pred(m) && m.opponent_id === r.opponent_id) });
  out["club-opponents.json"] = envelope(
    "club-opponents",
    {
      el_clasico: { ...co.el_clasico, source_ids: rowSrc((m) => scopeOf(m) === "club" && m.opponent_id === "barcelona") },
      madrid_derby: { ...co.madrid_derby, source_ids: rowSrc((m) => scopeOf(m) === "club" && m.opponent_id === "atletico-madrid") },
      champions_league_opponents: co.champions_league_opponents.map(oppRow(UCLMAIN)),
      top_club_opponents: co.top_club_opponents.map(oppRow((m) => scopeOf(m) === "club")),
      top_opponents_by_club: co.top_opponents_by_club.map((c) => ({ ...c, name: teamName.get(c.team_id), opponents: c.opponents.map(oppRow((m) => m.team_id === c.team_id)) })),
    },
    allSrc(clubMatches).concat(goalSrc((m) => !isPor(m)))
  );
  out["milestones.json"] = envelope(
    "milestones",
    stats.milestones(ledger).map((r) => ({ ...r, source_ids: rowSrc((m) => m.match_id === r.match_id) })),
    everything
  );
  out["body-parts.json"] = envelope(
    "body-parts",
    stats.bodyParts(ledger).map((r) => ({ ...r, source_ids: r.scope === "international" ? ["wikipedia-cr7-intl-goals"] : ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals"] })),
    ["eswiki-cr7-club-matches", "kaggle-sigmaborov-cr7-goals", "wikipedia-cr7-intl-goals"]
  );
  const trophies = ledger.tables.trophies ?? [];
  const awards = ledger.tables.awards ?? [];
  out["trophies.json"] = envelope(
    "trophies",
    trophies.map((t) => ({ ...t, competition: compName.get(t.competition_id), team: teamName.get(t.team_id) })),
    allSrc(trophies)
  );
  out["awards.json"] = envelope("awards", awards, allSrc(awards));
  out["records.json"] = envelope(
    "records",
    records.map((r) => ({ ...r, computed_value: r.compute_fn ? String(stats.evaluateComputeFn(ledger, r.compute_fn)) : null })),
    allSrc(records)
  );
  out["sources.json"] = envelope("sources", sources.filter((s) => usedSources.has(s.source_id)), [...usedSources]);
  out["index.json"] = envelope(
    "index",
    Object.keys(out).map((f) => ({ path: `/api/${API_VERSION}/${f}`, items: Array.isArray(out[f].data) ? out[f].data.length : null })),
    []
  );
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--out");
  const outDir = i > 0 ? resolve(process.argv[i + 1]) : join(ROOT, "dist", "api", API_VERSION);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const files = buildApi(loadLedger());
  for (const [name, body] of Object.entries(files)) writeFileSync(join(outDir, name), JSON.stringify(body, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(files).length} files to ${outDir}`);
}
