# CONTRACTS — interfaces other subsystems rely on

Status: **v1, stable** (M2, 2026-10-22). Breaking changes need a version bump: a new `/api/v2`, or a schema change plus a migration note here, and every consumer listed in §8 must be updated in the same PR. Adding a nullable column at the end of a table, or a new endpoint, is non-breaking.

## 1. Source of truth

- The **CSV files in `data/`** are canonical. Everything else is derived: the API JSON, reports and any future database or search index. Never hand-edit derived files.
- `matches.csv` and `goals.csv` (international) are **generated** by `npm run ingest:intl` from `data/raw/` and `data/manual/`. Fix them through `data/manual/*` and re-run the ingest. Do not edit them directly. Club rows (M3) will come from their own ingest script and must follow the same rules.
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

Current ids: `fifa-world-cup, fifa-world-cup-qualification, uefa-euro, uefa-euro-qualification, uefa-nations-league, fifa-confederations-cup, international-friendly`.

### matches — PK `match_id`, one row per match *Ronaldo's team played while he was in contention* (club: in the squad; international: every cap plus any recorded unused appearances)
| Column | Type | Notes |
|---|---|---|
| match_id | string | `{date}-{team_id}-{opponent_id}`, e.g. `2016-07-10-portugal-france` |
| date, season | string | see §2 |
| competition_id | FK competitions | |
| stage | string? | e.g. `Final`, `Group F`. Currently null for internationals |
| team_id, opponent_id | FK teams | team_id is Ronaldo's team |
| venue | home \| away \| neutral | from Ronaldo's team's perspective |
| city, country | string? | |
| score_for, score_against | int | score after 90/120 minutes, **excluding shootouts** |
| extra_time | bool? | |
| shootout | `won n-n` \| `lost n-n` \| null | score is Ronaldo's team first |
| appeared | bool | false = unused squad member (no goals allowed) |
| started, minutes, captain | ? | currently null for internationals |
| cap_number | int? | international appearance number. Must run 1..N contiguously by date. Null for club matches |
| source_ids | FK[] sources | |

Rules enforced: id format, team ≠ opponent, no duplicate (date, team, opponent), a shootout requires a level score and extra_time ≠ false, unused subs have no minutes or start, and caps are contiguous.

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

### trophies — PK `trophy_id` (empty, M3/M4)
`trophy_id, competition_id, season, team_id, participation (played_final | played | squad_unused | not_in_squad), counted_in_total, source_ids, notes`

### awards — PK `award_id` (empty)
`award_id, name, awarding_body, year_or_season, placing (1 = winner), source_ids, notes`

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
| `internationalSummary(ledger)` | the object served in `summary.json` |
| `COMPUTE_FNS`, `evaluateComputeFn(ledger, "name:arg")` | registry for `records.compute_fn` |

## 5. Corrections and known differences

- `data/manual/corrections.csv`: `correction_id, source_id, target, field, from_value, to_value, reason, evidence_source_ids`. Each row changes one upstream value at ingest time. `target` is `cap=N` (RSSSF) or `goal_no=N` (Wikipedia list). The ingest aborts if `from_value` no longer matches the source, so a fixed upstream error forces you to remove the correction.
- `data/manual/international-appearances-extra.csv`: appearances missing from RSSSF, each with sources and reasoning.
- `data/reconciliation/expectations.json`: pinned headline numbers. Change these only when a real new goal or cap happens.
- `data/reconciliation/known-differences.json`: accepted ledger-vs-source mismatches. These apply **only while expected and actual both equal the pinned values**.
- `npm test` fails on any reconciliation `fail`.

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
| `summary.json` | `{ international: { team_id, caps, goals, goals_per_game, competitive:{caps,goals}, friendly:{caps,goals}, penalty_goals, hat_tricks, record:{played,won,drawn,lost}, first_cap, last_cap } }` (a `club` key will be added in M3) |
| `goals.json` | `[{goal_id, match_id, date, season, team_id, opponent_id, opponent, competition_id, competition, venue, minute, added_time, method, body_part, assist_player, assist_type, score_after, result, age, intl_goal_no, source_ids}]` in date order |
| `matches.json` | matches rows (§3) + `opponent`, `competition` names |
| `goals-by-competition.json` | `[{competition_id, name, apps, goals}]` |
| `goals-by-year.json` | `[{year, apps, goals}]` in ascending year order |
| `goals-by-opponent.json` | `[{opponent_id, name, apps, goals}]` |
| `records.json` | records rows + `computed_value` |
| `sources.json` | the sources rows cited anywhere in the API |

The frontend must display the `attribution` of any data it renders, which the CC BY-SA licence requires.

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
