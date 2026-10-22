# siuuustats

The data ledger behind **SIUUU Stats** (siuuustats.pages.dev): a fan site that makes the case for Cristiano Ronaldo as the GOAT using numbers that each cite a source. It is about Ronaldo only, with no comparison against other players and no gambling ads. **The project costs $0.** It uses open-source tools and free tiers only, with no paid APIs, domains or hosting.

This repo currently holds **milestone M2: the data model and validation subsystem**. That covers the CSV ledger, JSON Schemas, ingest, validation, reconciliation and the static-API builder. The website (`web/`) and automation (`pipeline/`) are placeholders owned by other workstreams.

> Shared machine: other bots and agents may work in this directory. Read **CONTRACTS.md** before changing anything another subsystem relies on. Do your work on a branch and run `npm run check` before you commit.

## Quick start

```bash
cd /workspace/siuuustats
npm ci            # Node >= 20; dev deps only (ajv, csv-parse, csv-stringify, cheerio)
npm test          # 26 tests: schema/FK/dup validation, stats goldens, reconciliation, API shape
npm run check     # validate + reconcile + test + build:api
```

| Command | What it does | Network? |
|---|---|---|
| `npm run validate` | Checks every row against its JSON Schema, then primary keys, foreign keys, duplicates and the domain rules | offline |
| `npm run reconcile` | Compares ledger totals with Wikipedia, RSSSF and martj42 snapshots, then writes `reports/reconciliation.json` | offline |
| `npm run build:api` | Writes `dist/api/v1/*.json` (static API, CONTRACTS §6) | offline |
| `npm run ingest:intl` | Rebuilds `data/matches.csv` and `data/goals.csv` (international) from `data/raw/` and `data/manual/`, and writes `reports/ingest-international.json` | offline |
| `npm run snapshots:refresh` | Downloads fresh raw snapshots and rewrites `data/raw/MANIFEST.json` | **online** |
| `npm test` | `node --test tests/*.test.mjs` | offline |

## Layout

```
data/                 SOURCE OF TRUTH (CC BY-SA 4.0) — CSV ledger, one file per table
  raw/                pinned upstream snapshots + MANIFEST.json (sha256, revision, licence)
  manual/             human-reviewed corrections.csv and extra appearances, each with its evidence
  reconciliation/     expectations.json (pinned headline numbers) + known-differences.json
schema/               JSON Schema (2020-12) per table + tables.json registry (PKs, FKs)
scripts/
  lib/                csv, ledger loader, stats (pure functions), source parsers, wikitable parser
  ingest/             fetch-snapshots.mjs (online), international.mjs (offline build)
  validate.mjs  reconcile.mjs  build-api.mjs
tests/                node:test suites
web/  pipeline/       placeholders for other workstreams
docs/                 notes; engineering plan link
reports/  dist/       generated, git-ignored
```

## Current data (as of 2026-10-22)

- **International (complete):** 234 caps and 146 goals for Portugal from 20 Aug 2003 to 24 Sep 2026. Of these, 124 goals are competitive and 22 came in friendlies. 23 are penalties and there are 10 hat-tricks. The record is W142 D54 L38, with shootouts counted as draws.
- **Club:** not loaded yet. This is the next milestone (M3, club backfill).
- The trophies and awards tables have a schema and a CSV header but no rows yet. `records.csv` holds 5 computed records.

## Updating data

1. Run `npm run snapshots:refresh`. This needs the network and is the only step that does. Review the diff of `data/raw/MANIFEST.json`.
2. Run `npm run ingest:intl`. If it reports source disagreements, do not edit the generated CSVs by hand. Either add a row with evidence to `data/manual/corrections.csv`, or add a missing appearance to `data/manual/international-appearances-extra.csv`.
3. Run `npm run check`. When a reconciliation check fails, either fix the data or record a reviewed entry in `data/reconciliation/known-differences.json`. Known differences are pinned to exact values, so they stop matching as soon as either side changes.
4. Update `data/reconciliation/expectations.json` when a real new goal or cap happens. Commit with a message that cites the source.

## Licences

The code is MIT (`LICENSE`). The data is CC BY-SA 4.0 (`data/LICENSE.md`). Upstream credits are in `ATTRIBUTION.md`.
