# CONTRACTS — interfaces other subsystems rely on

Status: **v1, stable** (M2, 2026-10-22; M3 additions 2026-10-22: all additive). Breaking changes need a version bump: a new `/api/v2`, or a schema change plus a migration note here, and every consumer listed in §8 must be updated in the same PR. Adding a nullable column at the end of a table, or a new endpoint, is non-breaking.

## 1. Source of truth

- The **CSV files in `data/`** are canonical. Everything else is derived: the API JSON, reports and any future database or search index. Never hand-edit derived files.
- `matches.csv` and `goals.csv` (international) are **generated** by `npm run ingest:intl` from `data/raw/` and `data/manual/`. Fix them through `data/manual/*` and re-run the ingest. Do not edit them directly. Club rows come from `node scripts/ingest/club.mjs` (M3), which follows the same rules and leaves the international rows untouched (and `ingest:intl` leaves the club rows untouched). See §9.
- `sources.csv`, `teams.csv`, `competitions.csv`, `trophies.csv`, `awards.csv` and `records.csv` are curated by hand. The ingest only appends new teams.
- **Every row in matches, goals, trophies, awards and records must cite at least one `source_id`** that exists in `sources.csv`.

## 2. CSV conventions

| Rule | Detail |
|---|---|
| Encoding | UTF-8, LF, RFC 4180 quoting, header row required |
| Column order | Exactly the order of `properties` in `schema/<table>.schema.json`. `validate` fails on any header mismatch |
| Null | Empty cell. It becomes `null` when the schema type allows it |
| Booleans | `true` / `false` |
| Arrays | Separated by `;` with no spaces, e.g. `wikipedia-cr7-intl-goals;martj42-goalscorers` (`tables.json.listSeparator`) |
| Dates | ISO `YYYY-MM-DD`, local date of the match |
| Seasons | Club: `2026-27`. International: calendar year `2026` |
| Scores | Always **Ronaldo's team first** (`score_for`, `score_against`, `score_after`) |
| IDs | Lowercase kebab-case slugs `^[a-z0-9]+(-[a-z0-9]+)*$` |

## 3. Tables

The registry is `schema/tables.json` (file, schema, primaryKey, foreignKeys). The machine-checkable definitions are the JSON Schemas (draft 2020-12). All columns are required to be present, and nullability is set by type.

### sources — PK `source_id`
`source_id, title, publisher, url, licence (CC BY-SA 4.0 | CC0 1.0 | ODbL 1.0 | Free with acknowledgement (RSSSF) | Citation only), tier (official | reference | secondary), revision (Wikipedia rev id / git sha / "last updated" stamp), accessed_at, notes`

### teams — PK `team_id`
`team_id, name, kind (club | national), country, confederation, wikidata_id (Q…)`. National team ids are country slugs such as `portugal` or `bosnia-and-herzegovina`.

### competitions — PK `competition_id`
`competition_id, name, type (league | domestic_cup | league_cup | super_cup | continental_club | club_world | intl_tournament | intl_qualifier | intl_league | friendly), scope (club | international), confederation, country, official (false = excluded from official totals), includes_qualifiers (UEFA 140-vs-141 rule), notes`

Plus `wikipedia_category` (league | national_cup | league_cup | continental | other | null), the column enwiki's club career table uses for the competition. Club reconciliation groups by it.

International ids: `fifa-world-cup, fifa-world-cup-qualification, uefa-euro, uefa-euro-qualification, uefa-nations-league, fifa-confederations-cup, international-friendly`.
Club ids (M3): `primeira-liga, taca-de-portugal, premier-league, fa-cup, efl-cup, fa-community-shield, la-liga, copa-del-rey, supercopa-de-espana, serie-a, coppa-italia, supercoppa-italiana, saudi-pro-league, kings-cup-saudi-arabia, saudi-super-cup, uefa-champions-league, uefa-cup, uefa-europa-league, uefa-super-cup, fifa-club-world-cup, afc-champions-league, afc-champions-league-two, arab-club-champions-cup`. `arab-club-champions-cup` is a UAFA competition that FIFA does not recognise: it counts in totals the way Wikipedia counts it, and `goals_excluding_non_fifa` is published next to the totals (981 → 975).

### matches — PK `match_id`, one row per match *Ronaldo's team played while he was in contention* (club: in the squad; international: every cap plus any recorded unused appearances)
| Column | Type | Notes |
|---|---|---|
| match_id | string | `{date}-{team_id}-{opponent_id}`, e.g. `2016-07-10-portugal-france` |
| date, season | string | see §2 |
| competition_id | FK competitions | |
| stage | string? | e.g. `Final`, `Group F, matchday 2`, `Quarter-final 2nd leg`, `Matchday 10`. Club stages are normalised from eswiki. A `Qualifying …` stage marks a UEFA qualifying round. Still null for internationals |
| team_id, opponent_id | FK teams | team_id is Ronaldo's team |
| venue | home \| away \| neutral | from Ronaldo's team's perspective |
| city, country | string? | |
| score_for, score_against | int | score after 90/120 minutes, **excluding shootouts** |
| extra_time | bool? | |
| shootout | `won n-n` \| `lost n-n` \| null | score is Ronaldo's team first |
| appeared | bool | false = unused squad member (no goals allowed) |
| started, minutes, captain | ? | club: `started` from eswiki's sub-on/sub-off templates (null when it cannot be told), `minutes` = eswiki MJ. Null for internationals |
| notes | string? | (M3, last column) e.g. `Awarded 3-0; played 1-2 on the pitch.` Awarded results store the official score |
| cap_number | int? | international appearance number. Must run 1..N contiguously by date. Null for club matches |
| source_ids | FK[] sources | |

Rules enforced: id format, team ≠ opponent, no duplicate (date, team, opponent), a shootout requires a level score unless the stage is a `2nd leg` (aggregate tie), unused subs have no minutes or start, caps are contiguous, and international matches use the calendar year as season. (M3 dropped the extra_time ≠ false rule: super cups go straight to penalties.)

### goals — PK `goal_id`, one row per Ronaldo goal (own goals by opponents are never included)
| Column | Type | Notes |
|---|---|---|
| goal_id | string | `{match_id}-g{n}`, with n = 1..k in order within the match |
| match_id | FK matches | match must have `appeared=true` |
| team_id | FK teams | must equal the match's team_id |
| minute, added_time | int? | `90+3` is stored as minute 90, added_time 3 |
| method | open_play \| penalty \| direct_free_kick \| non_penalty_unspecified | `non_penalty_unspecified` means the source only says "not a penalty" |
| body_part | right_foot \| left_foot \| head \| other \| null | |
| location | inside_box \| outside_box \| null | |
| assist_player, assist_type | string? | `assist_type` is required when `assist_player` is set. `source_unspecified` means the source names an assister without a type |
| score_after | `f-a` | score right after the goal, Ronaldo's team first. Must be ≤ the final score and unique within the match |
| intl_goal_no | int? | number in Wikipedia's international goals list (1..146). Unique |
| source_ids | FK[] | |
| verified_by, verified_at | string? | human verification stamp (manual review, M5) |

### trophies — PK `trophy_id` (37 rows, M3b)
`trophy_id, competition_id, season, team_id, participation (played_final | played | squad_unused | not_in_squad), counted_in_total, source_ids, notes`

- `trophy_id` = `<team_id>-<competition_id>-<season>`. `season` is the edition label Wikipedia uses (`2006-07` for leagues/cups, `2018` for the Supercoppa played in Jan 2019, `2018-19` for the Nations League).
- `counted_in_total = true` for the **35** titles in Wikipedia's Honours list (won while in the squad, including the 2002 Supertaça as an unused sub). The 2 extra rows (2008 Community Shield, 2016 UEFA Super Cup) are titles his team won while he was **not in the squad**; messivsronaldo.app counts them, which is why it shows **37**.
- `participation`: `played_final` = appeared in the final (or the deciding match/legs); `played` = appeared earlier in the competition (league titles; 2013-14 Copa del Rey, final missed injured); `squad_unused` = on the bench, not used; `not_in_squad`.
- Every row cites Wikipedia and/or messivsronaldo.app; disputed participation rows add the edition's Wikipedia article.
- Reconciliation checks: the counted rows equal Wikipedia's Honours items one for one (`honours-items-wikipedia`), counts 35/37, and participation agrees with ledger appearances (`honours-participation-vs-ledger`).

### awards — PK `award_id` (82 rows, M3b)
`award_id, name, awarding_body, year_or_season, placing (1 = winner), source_ids, notes`

- `award_id` = `<award-slug>-<year_or_season>` (`-<placing>` suffix for placings other than 1). All 75 individual honours in Wikipedia's Honours list are rows with `placing = 1` (checked by `honours-individual-count-wikipedia`), plus 7 Ballon d'Or podium placings (2nd/3rd) from messivsronaldo.app.
- Where sources disagree the row cites both and says so in `notes` (2025 Nations League Finals top scorer: UEFA.com + Wikipedia vs messivsronaldo.app; Portuguese Sportsman of the Year: Wikipedia's 8 years recorded, messivsronaldo.app's extra 2007-2009 noted, not recorded).

### records — PK `record_id`
`record_id, title, scope (world | continental | competition | league | club | national_team), value, unit, compute_fn, shared_with, status (verified | disputed | broken), last_checked, source_ids, notes`

- `compute_fn` set means the value is derived from the ledger. Format: `name` or `name:arg`, with names from `COMPUTE_FNS` in `scripts/lib/stats.mjs`. Reconciliation fails if the stored `value` ≠ the computed one.
- `compute_fn` null means an editorial claim, which needs **≥ 2 source_ids**.

## 4. JavaScript interfaces (ESM, Node ≥ 20)

```js
import { ROOT, loadRegistry, loadLedger, coerceRow } from "./scripts/lib/ledger.mjs";
const ledger = loadLedger(root = ROOT, overrides = {});
// → { registry, tables: { matches: Row[], goals: Row[], ... }, headers: {table: string[]}, missing: string[] }
//   Rows are typed per schema (ints, booleans, arrays, null). overrides = { table: rawStringRows[] } replaces a table (used by tests).

import { validateLedger } from "./scripts/validate.mjs";     // (ledger) → Issue[] ({table, row, message}); [] = valid
import { runReconciliation } from "./scripts/reconcile.mjs"; // (root?, ledger?) → { summary, checks: [{check, status: pass|fail|known_difference, expected, actual, source_id}] }
import { buildApi } from "./scripts/build-api.mjs";          // (ledger, generatedAt?) → { "summary.json": Envelope, ... }
```

`scripts/lib/stats.mjs` holds pure functions of `(ledger, …)` and is the **only** place where stat definitions live. The site, API and records must not re-implement them.

| Function | Meaning |
|---|---|
| `appearances(ledger, pred?)` | matches with `appeared=true` |
| `goalsWithMatch(ledger)` | goals joined with `.match` |
| `intlCaps`, `intlGoals`, `intlCompetitiveCaps`, `intlCompetitiveGoals` | Portugal totals (competitive = not `international-friendly`) |
| `goalsInCompetition(ledger, competitionId)` | |
| `penaltyGoals(ledger, pred?)`, `multiGoalMatches(ledger, n=3, pred?)` | |
| `record(ledger, pred?)` | `{played, won, drawn, lost}`. **Shootouts count as draws** |
| `splitBy(ledger, keyFn, pred?)` | `[{key, apps, goals}]` sorted by goals, then apps |
| `ageOn(date)` | age in whole years (born 1985-02-05) |
| `internationalSummary(ledger)` | `summary.json` → `international` |
| `clubSummary(ledger)`, `careerSummary(ledger)` | `summary.json` → `club`, `career` (M3) |
| `clubGoals`, `clubApps`, `careerGoals`, `careerApps`, `careerPenaltyGoals`, `goalsForClub(ledger, teamId)` | club and career totals |
| `uclGoalsMain`, `uclAppsMain` | Champions League **main competition** (group/league phase onward): the headline (decision a) |
| `uclGoalsInclQualifiers` | count including qualifying rounds (141, as on UEFA's "including qualifying rounds" list): stored and footnoted |
| `winningGoals(ledger, pred?)` | goals in a match won on the score (not a shootout; awarded results excluded) where `score_after.for === score_against + 1`, i.e. the goal that put the team ahead for good |
| `equalisers(ledger, pred?)` | goals after which the score was level (`score_after.for === score_after.against`) |
| `opponentsScoredAgainst(ledger, pred?)`, `nationalTeamsScoredAgainst` | distinct opponents with first goal date |
| `goalsFromAge(ledger, age=30)` | goals scored on or after that birthday |
| `scoringStreaks(ledger, top=5)`, `stageClass(stage)`, `bigGameSplits(ledger)` | streaks and big-game splits for the API |
| `championsLeagueSplits`, `clutchSplits`, `goalFlags`, `ageBands` (+ `AGE_BANDS`, `AGE_THRESHOLDS`), `seasonOf`, `seasonTotals`, `nationalTeamOpponents`, `tournamentEditions`, `clubOpponentSplits`, `bodyParts`, `milestones` (all `(ledger)`, M3b) | the content-figure endpoints above |
| `bigGameClass(m)`, `clubSeasonTotals(ledger)`, `honoursSummary(ledger)` (M3b) | big-game class of a match (super cups = finals), per club-season totals, trophy/award headline counts |
| `NON_FIFA_COMPETITIONS` | `["arab-club-champions-cup"]` |
| `COMPUTE_FNS`, `evaluateComputeFn(ledger, "name:arg")` | registry for `records.compute_fn` |

## 5. Corrections and known differences

- `data/manual/corrections.csv`: `correction_id, source_id, target, field, from_value, to_value, reason, evidence_source_ids`. Each row changes one upstream value at ingest time. `target` is `cap=N` (RSSSF) or `goal_no=N` (Wikipedia list). The ingest exits 1 if a correction's `from_value` no longer matches the source or its target no longer exists, so a fixed upstream error forces you to remove the correction. It also exits 1 on any source disagreement it does not explain.
- `data/manual/international-appearances-extra.csv`: appearances missing from RSSSF, each with sources and reasoning.
- `data/manual/international-unused-squad.csv` (`date, opponent, source_ids, note`): international matches where he was in the matchday squad but did not play. `ingest:intl` emits them as `appeared=false`, `started=false`, `cap_number` empty; score/venue come from martj42. They never count as caps (234 stays 234) and cannot carry goals. First row: Norway 1-2 Portugal, 27 Sep 2026 (BBC, Al Jazeera).
- Club (M3): corrections with `source_id = eswiki-cr7-club-matches` use `target = match_n=N` (eswiki's match number) and fields `date | venue | goals | goal_cell | result | assisted_by`. `data/manual/club-neutral-results.csv` gives Ronaldo-first scores for neutral-venue matches whose orientation can't be derived. `club-appearances-extra.csv` holds appearances newer than the eswiki snapshot. `club-date-checks.csv` lists dates where the English season article disagrees with eswiki and outside match reports side with eswiki. `club-team-names.csv` maps eswiki opponent names to team ids (with aliases).
- **2-of-3 rule** (club): when eswiki and Kaggle disagree on a goal detail (currently the penalty flag), the English season article decides and the result is logged in `data/reconciliation/club-ingest-resolutions.json`. Disagreements it can't settle fail the ingest until a correction row is added.
- `data/reconciliation/expectations.json`: pinned headline numbers. Change these only when a real new goal or cap happens.
- `data/reconciliation/known-differences.json`: accepted ledger-vs-source mismatches. These apply **only while expected and actual both equal the pinned values**.
- `npm test` fails on any reconciliation `fail`. Club acceptance: every enwiki club-table cell (club × season × `wikipedia_category`, apps and goals) must pass or be a known difference.

## 6. Static API `/api/v1` (built into `dist/api/v1/`, served as static files)

Every file uses this envelope:
```json
{ "api_version": "v1", "endpoint": "goals-by-year", "generated_at": "ISO-8601 UTC",
  "data_as_of": "YYYY-MM-DD (latest match date)", "licence": "CC BY-SA 4.0",
  "attribution": [{ "source_id", "title", "publisher", "url", "licence" }], "data": ... }
```

| File | `data` |
|---|---|
| `index.json` | `[{path, items}]` listing all endpoints |
| `summary.json` | `{ international: { team_id, caps, goals, goals_per_game, competitive:{caps,goals}, friendly:{caps,goals}, penalty_goals, hat_tricks, record, first_cap, last_cap }, club: { apps, goals, goals_per_game, goals_excluding_non_fifa, penalty_goals, hat_tricks, record, champions_league:{goals, apps, goals_incl_qualifiers, apps_incl_qualifiers, note}, clubs:[{team_id, name, apps, goals, first_match, last_match}] }, career: { apps, goals, goals_per_game, goals_excluding_non_fifa, non_fifa_competitions, penalty_goals, non_penalty_goals, free_kick_goals, hat_tricks, winning_goals, equalisers, goals_from_age_30, record }, honours: { major_trophies, trophies_incl_not_in_squad, trophies_by_team, trophies_by_participation, champions_league_titles, league_titles, ballon_dor, fifa_best, european_golden_shoes, ucl_top_scorer_seasons, league_top_scorer_awards, individual_awards }, citations: { "<block>.<field>": [source_id…] } }`. `citations` gives per-number sources and has a key for every field of every block (tested); the envelope `attribution` still lists everything used |
| `goals.json` | `[{goal_id, match_id, date, season, team_id, opponent_id, opponent, competition_id, competition, scope, stage, venue, minute, added_time, method, body_part, assist_player, assist_type, score_after, winning_goal, equaliser, result, age, intl_goal_no, source_ids}]` in date order. `winning_goal`/`equaliser` (M3b) use the `winningGoals()`/`equalisers()` definitions |
| `matches.json` | matches rows (§3) + `scope`, `opponent`, `competition` names |
| `goals-by-competition.json` | `[{scope, competition_id, name, apps, goals}]` |
| `goals-by-year.json` | `[{scope, year, apps, goals}]`, calendar year, sorted by scope then year |
| `goals-by-opponent.json` | `[{scope, opponent_id, name, apps, goals}]` (a club and a national team never share an id) |
| `goals-by-club.json` (M3) | `[{team_id, name, apps, goals, first_match, last_match, source_ids}]` |
| `goals-by-season.json` (M3) | `[{season, team_id, competition_id, competition, wikipedia_category, apps, goals, source_ids}]` (club only) |
| `club-season-totals.json` (M3b) | `[{season, team_id, name, apps, goals, goals_per_game, by_category:{league|national_cup|league_cup|continental|other: {apps, goals}}, source_ids}]`, one row per club season (2021-22 and 2022-23 have two clubs) |
| `goals-by-age.json` (M3) | `[{scope, age, apps, goals, source_ids}]` |
| `multi-goal-matches.json` (M3) | `[{match_id, date, opponent_id, opponent, goals, kind (brace/hat-trick/poker/haul), scope, team_id, competition_id, result, source_ids}]`, 2+ goals |
| `streaks.json` (M3) | top 5 consecutive-scoring runs per scope (`all`/`club`/`international`): `[{scope, matches, goals, from, to, match_ids, ongoing, source_ids}]` |
| `big-games.json` (M3) | `[{scope, stage_class (final/semi_final/quarter_final/round_of_16/early_knockout/group_or_league/qualifying/unknown), apps, goals, matches_scored_in, penalties, source_ids}]` |
| `champions-league.json` (M3b) | `{apps, goals, penalty_goals, non_penalty_goals, by_stage:[{stage_class (group_or_league/round_of_16/quarter_final/semi_final/final), apps, goals, penalties, matches_scored_in, source_ids}], unclassified_apps, knockout:{apps, goals, penalties}, finals:{…}, qualifying:{apps, goals}, incl_qualifying:{apps, goals}, hat_tricks, note, source_ids}`; main competition unless stated |
| `clutch.json` (M3b) | `[{scope (career/club/international/<club team_id>), apps, goals, winning_goals, winning_goals_in_one_goal_wins, winning_goals_penalties, equalisers, equalisers_penalties, one_goal_wins, one_goal_wins_scored_in, goals_with_minute, goals_80_plus, goals_90_plus, source_ids}]`. Late goals use `minute` (a 90+3 goal has minute 90, so it counts in both `goals_80_plus` and `goals_90_plus`; extra-time minutes 91–120 count too). `goals_with_minute` is the denominator, because the 22 international friendly goals have no minute |
| `goals-by-age-band.json` (M3b) | `{bands:[{scope (career/club/international), band (under_25/25_29/30_34/35_plus), min_age, max_age, apps, goals, goals_per_game, source_ids}], thresholds:[{scope, from_age (30/35/38/40), apps, goals, goals_before, goals_per_game, source_ids}], birth_date}`. `min_age`/`max_age` are the ages actually played in that band, so labels read 17–24 (career) and 18–24 (Portugal) |
| `season-totals.json` (M3b) | `{by_year:[{year, apps, goals, club_apps, club_goals, international_apps, international_goals, goals_per_game, source_ids}], by_season:[{season, …same}], scoring_years:{career|club|international: {from, to, years}}, note}`: all competitions; `by_season` puts internationals in the July–June season of their date |
| `national-teams.json` (M3b) | `{scored_against, faced, scored:[{n, opponent_id, name, caps, goals, first_goal, source_ids}] (in order of first goal), never_scored:[{opponent_id, name, caps, goals:0, first_goal:null, source_ids}], tournament_editions:[{competition_id (fifa-world-cup/uefa-euro/fifa-confederations-cup), year played, apps, goals, source_ids}]}` |
| `club-opponents.json` (M3b) | `{el_clasico, madrid_derby: {opponent_id, label, for_real_madrid:{apps, goals}, all_clubs:{apps, goals}, by_club:[…], penalties_for_other_clubs, source_ids}, champions_league_opponents:[{opponent_id, name, apps, goals, source_ids}] (main competition, by goals), top_club_opponents:[top 10], top_opponents_by_club:[{team_id, name, opponents:[top 5]}]}` |
| `body-parts.json` (M3b) | `[{scope, goals, right_foot, left_foot, head, other, unknown, known, source_ids}]`. Body part is known only for 563 club goals; every international goal is `unknown` |
| `milestones.json` (M3b) | `[{key, label, date, match_id, team_id, opponent_id, opponent, competition_id, age, goal_id?, minute?, value?, apps_to_date?, source_ids}]`: first and latest matches and goals, first match per club, every 100th career goal, 100th UCL goal, 300th La Liga goal, 500th goal from age 30, 100th goal per club |
| `trophies.json` (M3b) | trophies rows (§3) + `competition`, `team` names |
| `awards.json` (M3b) | awards rows (§3) |
| `reconciliation.json` (M3) | `{counts:{pass, known_difference, fail}, checks:[{check, source_id, description, expected, actual, status, note}]}` |
| `corrections.json` (M3) | `{corrections:[…corrections.csv rows], date_checks:[…], resolutions_2_of_3:[…]}` |
| `records.json` | records rows + `computed_value` |

Row-level `source_ids` (M3b) on derived tables are the union of the sources cited by the appearances and goals that make up the row.

**Content figures (M3b).** `tests/content-figures.test.mjs` pins every ledger-derivable number in `docs/content/*.md` to the API file a frontend would read. If a write-up changes a number, update the test in the same PR. These write-up claims are *not* derivable from the ledger and stay cited-only:
- Headed-goal totals (156 career; 5 at Euros) and the "header" labels on Portugal goals: international goals have no body part, and club body part covers 563 of 835 goals.
- Portugal knockout-stage labels (Euro 2004/2016 semi-finals, Euro 2012 quarter-final, 2019/2025 Nations League Finals, 2026 World Cup round of 32): international `matches.stage` is still empty (data request #4). The goals themselves are in `goals.json`.
- Penalty attempts and conversion (~220 taken, ~83%), and the 2016 UCL final shoot-out kick: misses and shoot-out kicks are not stored.
- Comparative records ("first", "only", "most", "record", "level with Di Stéfano", "oldest since 1948", 20+ goals in 12 straight top-five-league seasons, 2023 world top scorer): the ledger has only Ronaldo, so it gives his number but not the ranking.
- Minutes on the pitch (Euro 2016 final, off after 25'), the 2025-26 Saudi scoring chart and title margin, Wikipedia's 1,343 apps and 494 goals after 30 (reference figures, see known differences).
- PFA Players' Player of the Year (2007, 2008), Serie A MVP 2019 and Premier League Team of the Year 2021-22 are not in `awards.csv`, because Wikipedia's Honours list leaves them out.
| `sources.json` | the sources rows cited anywhere in the API |

The frontend must display the `attribution` of any data it renders, which the CC BY-SA licence requires.

**M3 compatibility note:** the goals-by-* files keep their old fields, but rows now span both scopes, so totals across a whole file are career totals (981). Filter `scope === "international"` to get the old 146-goal view. No field was removed or renamed.

## 7. Ownership

| Path | Owner | Others may |
|---|---|---|
| `data/`, `schema/`, `scripts/`, `tests/`, `CONTRACTS.md` | Data model & validation (M2) | open PRs that pass `npm run check` |
| `web/` | Web/frontend workstream | read `dist/api/v1` only |
| `pipeline/` (and future `.github/workflows/`) | Pipeline/automation workstream | call the npm scripts |
| `docs/` | anyone | |

## 8. Consumers of these contracts
- `web/` reads the `/api/v1` JSON (§6).
- `pipeline/` runs `npm run snapshots:refresh`, `ingest:intl` and `check`, and publishes `dist/`.
- `records.csv` depends on the `COMPUTE_FNS` names.

## 9. Club ledger (M3) — decisions and rules

- **Decision (a): Champions League.** The headline is main-competition goals (`uclGoalsMain` = 140, 183 apps), the same figure UEFA.com shows (140 goals in 183 appearances, excluding qualifying). The count including qualifying rounds (`uclGoalsInclQualifiers` = 141, 187 apps; UEFA's all-time list "including qualifying rounds" also says 141) is stored and footnoted. The difference is one goal: Man Utd at Debrecen, 9 Aug 2005, third qualifying round.
- **Decision (b): appearances are whatever the ledger computes** (club 1,107; career 1,341). Wikipedia (1,109 club), ESPN and messivsronaldo are reconciliation references, and every difference is explained in `known-differences.json` (the 2 Sporting CP B reserve apps).
- **Decision (c): Kaggle seed.** "Ronaldo CR7 All Goals GOAT" (sigmaborov, CC BY-SA 4.0, v1 2026-03-09) adds body part, assist names and penalty/free-kick cross-checks. It never adds or removes a goal by itself. Every season must reconcile to enwiki's per-season, per-category table before it is accepted (all 27 first-team seasons do).
- **Club spine:** Spanish Wikipedia's "Anexo:Partidos oficiales de Cristiano Ronaldo en clubes" match table (rev 175883102) gives one row per appearance. Dates are cross-checked against the English club season articles (pinned revisions in MANIFEST).
- **Ids:** club `team_id`s are `sporting-cp`, `manchester-united`, `real-madrid`, `juventus`, `al-nassr` (fixed: the pipeline's match detection relies on `al-nassr`). `match_id` = `{date}-{team_id}-{opponent_id}`.
- **Run order:** `npm run snapshots:refresh -- --only=club` (network) → `node scripts/ingest/club.mjs` → `npm run check`. The club ingest writes `reports/ingest-club.json` and exits 1 on any unexplained issue. Warnings (assister count, one-day Kaggle date offsets, minute differences, flipped goal-cell orientation) never change a count.
- **Known club gaps:** Sporting CP B (2 apps, 0 goals, 2002-03) has no match rows. `location` is null for all club goals. `method` for club goals is `penalty`, `direct_free_kick` or `non_penalty_unspecified` (no source here separates open play from other set pieces). International `stage`, `started`, `minutes` and body part remain null.

