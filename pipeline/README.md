# pipeline/ — CI, daily refresh and deploy (M5)

Owned by the Pipeline/Automation workstream (CONTRACTS §7). Everything here runs on free GitHub-hosted runners and the free Cloudflare Pages plan, so it costs **$0**. It needs no paid APIs and no sign-ups beyond the GitHub and Cloudflare accounts the project already has.

The pipeline writes to `data/` only through the ingest scripts, and only inside a **pull request that a human reviews**. Nothing is merged, pushed to `main` or published automatically.

## Workflows (`.github/workflows/`)

| File | Trigger | What it does | Token permissions |
|---|---|---|---|
| `ci.yml` | every PR, push to `main`, manual | `npm ci`, `npm run check`, then the pipeline unit tests (Node 24, npm cache) | `contents: read` |
| `daily-refresh.yml` | daily 06:17 UTC, manual | refreshes snapshots, detects new matches, re-runs ingest and check, then opens or updates **one** review PR (`automation/daily-refresh`) | `contents: write`, `pull-requests: write`, `issues: write` (refresh job only) |
| | weekly, Monday 07:41 UTC | keepalive: `PUT /actions/workflows/daily-refresh.yml/enable`, which resets GitHub's 60-day inactivity timer without a commit | `actions: write` (keepalive job only) |
| `deploy.yml` | push to `main` (merging a PR), manual | `npm run check`, `npm run build --if-present`, then `wrangler pages deploy dist --project-name=siuuustats --branch=main` | `contents: read` |

Each workflow sets top-level `permissions: {}`, and each job grants only what it needs. Checkouts use `persist-credentials: false`. Third-party actions are pinned to a commit SHA: `peter-evans/create-pull-request` v8.1.1 and `cloudflare/wrangler-action` v4.1.3. First-party `actions/*` use major tags (v7).

## Scripts

| Script | Network | Writes |
|---|---|---|
| `refresh-snapshots.mjs [--root DIR] [--only id,…] [--strict]` | yes | `data/raw/*` and `data/raw/MANIFEST.json` (same files and format as `scripts/ingest/fetch-snapshots.mjs`), plus `pipeline/snapshots/*.wikitext` and `pipeline/snapshots/MANIFEST.json`. Report goes to `reports/pipeline/refresh.json` |
| `detect-matches.mjs [--root DIR] [--today YYYY-MM-DD] [--offline]` | TheSportsDB (unless `--offline`) | `pipeline/snapshots/new-match-candidates.json` (review queue). Report goes to `reports/pipeline/detect.json` |
| `pr-body.mjs` | no | `reports/pipeline/pr-body.md` |

### Sources

- **Wikipedia, "List of international goals scored by Cristiano Ronaldo"**: Parsoid HTML for the M2 parser (`data/raw/…html`), plus the **raw wikitext of the same revision** from the MediaWiki Action API (`pipeline/snapshots/wikipedia-cr7-international-goals.wikitext`), which gives readable diffs.
- **Wikipedia, "Cristiano Ronaldo"**: the raw wikitext comes from the Action API (`data/raw/wikipedia-cristiano-ronaldo.json`). The **club career statistics table** ("Appearances and goals by club, season and competition") is cut out to `pipeline/snapshots/wikipedia-cr7-career-stats.wikitext`, and its "Career total" row is checked.
- **martj42/international_results**: `results.csv`, `goalscorers.csv` and `shootouts.csv` come from `raw.githubusercontent.com` and are filtered to Portugal. `revision` is the upstream commit SHA.
- **RSSSF** cap list, as before.

### Fail-safe behaviour

1. Every source is fetched and then parsed with the **same parsers the ingest uses** (`scripts/lib/sources-raw.mjs`) before anything is written. If a fetch fails (after retries), the parse fails, or the response is empty or odd, that source **keeps its old snapshot and old MANIFEST entry**. The run carries on with the other sources.
2. **Regression guard**: an update is *rejected* if totals go down, for example fewer goals or caps on Wikipedia, a lower club career total, or fewer martj42 rows. This catches vandalism and upstream breakage.
3. **No noise**: a snapshot is rewritten only when its *data* changes, measured by a semantic digest. A Wikipedia edit elsewhere in the article, a re-render, or a new RSSSF "Last updated" stamp alone gives no diff and no PR.
4. Writes are atomic (temp file plus rename). MANIFEST entries are merged by file, and untouched entries stay byte-identical.
5. Failures are listed in the PR body and the job summary, and recorded in a single "Daily refresh: source fetch errors" issue, which is reused and commented on.

### Politeness

Requests are serial, with a per-host minimum gap: Wikipedia 1 s, RSSSF 2 s, GitHub 1 s, TheSportsDB 3 s (the free tier allows 30 per minute). Every request sends the User-Agent `siuuustats-pipeline/0.1 (+https://siuuustats.pages.dev; …)`, also sent as `Api-User-Agent` for Wikimedia. Action API calls use `maxlag=5`. Retries are bounded to 3, with exponential backoff that honours `Retry-After` (capped at 65 s). Identical URLs are fetched once per run. A normal run makes about 8 snapshot requests and about 12 TheSportsDB requests.

### New-match detection

- **Portugal**: the martj42 results snapshot covers home and away matches completely. Any played Portugal match after the latest ledger cap that is missing from `data/matches.csv` becomes a candidate. The PR shows a hint when RSSSF's cap list was updated after the match but has no cap that day, which suggests he did not play.
- **Al-Nassr (and Portugal as a cross-check)**: the TheSportsDB v1 free API with the documented public key `123`:
  - `eventslast.php?id=` and `eventsnext.php?id=` for teams 136022 and 133908
  - `eventsday.php?d=…&l=…` for the last 2 days in Al-Nassr's competitions (4668, 5649, 5650, 4719)
- Candidates stay in `pipeline/snapshots/new-match-candidates.json` until the match appears in the ledger, or until a human adds the key to `pipeline/config/dismissed-candidates.json` with a reason and evidence.
- **Free-tier limits** (from TheSportsDB's docs): `eventslast` and `eventsnext` return only **1 home event**, and `eventsday` returns at most **3 events**. Away matches are only caught by the day scan and can be missed on busy days, which the PR notes. Treat TheSportsDB as a hint. The Wikipedia career-table diff is the authoritative signal for club matches.

### TheSportsDB IDs (verified 2026-10-22)

| ID | Lookup result |
|---|---|
| team **136022** | `lookupteam.php`: "Al-Nassr", idLeague 4668, plus 5649 Saudi King Cup, 5650 Saudi Super Cup, 4719 AFC Champions League Elite |
| league **4668** | `lookupleague.php`: "Saudi-Arabian Pro League" (Saudi Arabia, current season 2026-2027) |
| team **133908** | `searchteams.php?t=Portugal`: "Portugal" (Male), leagues 4429 World Cup, 4490 Nations League, 4562 Friendlies, 5519 Euro qualifying |

Saved responses are in `tests/fixtures/tsdb-lookup*.json`, and `thesportsdb.test.mjs` asserts that `config.mjs` matches them.

## Required secrets and settings (nothing is created by this repo)

| Name | Where | Value |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | repo → Settings → Secrets and variables → Actions | A Cloudflare **API token** (not the Global API Key) with exactly one permission, **Account → Cloudflare Pages → Edit**, limited to the one account that owns the project. No zone permissions are needed for `*.pages.dev`. |
| `CLOUDFLARE_ACCOUNT_ID` | same | Cloudflare dashboard → Workers & Pages → Account ID |
| `PIPELINE_PR_TOKEN` *(optional)* | same | A fine-grained PAT (free) with *Contents: read/write* and *Pull requests: read/write* on this repo only. Without it, the PR is opened with `GITHUB_TOKEN`, and GitHub does **not** run `ci.yml` on that PR. Close and reopen the PR, or rely on the `npm run check` result in the PR body. |

Repository settings:
- Settings → Actions → General → Workflow permissions: **"Allow GitHub Actions to create and approve pull requests"** must be on so the daily job can open its PR. The workflows set their own scopes, so the default token permission can stay "Read".
- Settings → Branches: protect `main` with a required "CI / npm run check" status and a required review. This is recommended, and is the human-approval gate before `deploy.yml` publishes.
- Optional: add required reviewers to the `production` environment that `deploy.yml` uses (free on public repos).

Cloudflare Pages: create a **Direct Upload** project named `siuuustats` with production branch `main`, for example with `npx wrangler pages project create siuuustats --production-branch=main`. The project must exist before the first deploy.

## Local use

```bash
npm ci
npm run check                               # ledger gate (M2)
node --test pipeline/tests/*.test.mjs       # pipeline unit tests, offline, saved fixtures
# Dry-run the online parts against a scratch copy, never the working tree:
mkdir -p /tmp/siuuu && cp -r data pipeline /tmp/siuuu/
node pipeline/refresh-snapshots.mjs --root /tmp/siuuu
node pipeline/detect-matches.mjs   --root /tmp/siuuu
# Lint workflows (free binaries: rhysd/actionlint + koalaman/shellcheck):
actionlint -shellcheck shellcheck
```

The root `npm test` script only globs `tests/*.test.mjs`, so the pipeline tests run as a separate CI step. See "Contract notes" in the M5 hand-off.
