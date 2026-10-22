# pipeline/ — CI, daily refresh and deploy (M5)

Owned by the Pipeline/Automation workstream (CONTRACTS §7). Everything here runs on free GitHub-hosted runners and the free Cloudflare Pages plan, so it costs **$0**. It needs no paid APIs and no sign-ups beyond the GitHub and Cloudflare accounts the project already has.

The pipeline writes to `data/` only through the ingest scripts, and only inside a **pull request that a human reviews**. Nothing is merged, pushed to `main` or published automatically.

## Workflows (`.github/workflows/`)

| File | Trigger | What it does | Token permissions |
|---|---|---|---|
| `ci.yml` | every PR, push to `main`, manual | `npm ci`, `npm run check`, then the pipeline unit tests (Node 24, npm cache) | `contents: read` |
| `daily-refresh.yml` | daily 06:17 UTC, manual | backs up `data/raw`, runs `npm run snapshots:refresh -- --only=intl` and `-- --only=club`, validates with `snapshot-guard.mjs`, detects new matches, re-runs `npm run ingest:intl` / `npm run ingest:club` and `check` for changed groups, then opens or updates **one** review PR (`automation/daily-refresh`) | `contents: write`, `pull-requests: write`, `issues: write` (refresh job only) |
| | weekly, Monday 07:41 UTC | keepalive: `PUT /actions/workflows/daily-refresh.yml/enable`, which resets GitHub's 60-day inactivity timer without a commit | `actions: write` (keepalive job only) |
| `deploy.yml` | push to `main` (merging a PR), manual | `npm run check`, `npm run build --if-present`, then `wrangler pages deploy dist --project-name=siuuustats --branch=main` | `contents: read` |

Each workflow sets top-level `permissions: {}`, and each job grants only what it needs. Checkouts use `persist-credentials: false`. Third-party actions are pinned to a commit SHA: `peter-evans/create-pull-request` v8.1.1 and `cloudflare/wrangler-action` v4.1.3. First-party `actions/*` use major tags (v7).

## Snapshots: who does what

**`scripts/ingest/fetch-snapshots.mjs` owns fetching, pinning and `data/raw/MANIFEST.json`** (`npm run snapshots:refresh -- --only=intl|club`):
- `intl` covers the Wikipedia international list and article, RSSSF, and martj42.
- `club` covers the eswiki club match list, the enwiki club career table at the article's pinned revision, the season-article snippets, and the Kaggle seed.

The pipeline does no snapshot fetching of its own. It adds a safety net around that script:

| Script | Network | Writes |
|---|---|---|
| `snapshot-guard.mjs save --backup DIR` | no | copies `data/raw` to DIR (the workflow uses `$RUNNER_TEMP`) |
| `snapshot-guard.mjs verify --backup DIR --intl <outcome> --club <outcome>` | no | restores files and MANIFEST entries in `data/raw` when needed. Report goes to `reports/pipeline/refresh.json`. GitHub outputs: `decision`, `changed`, `errors`, `intl_changed`, `club_changed` |
| `detect-matches.mjs [--root DIR] [--today YYYY-MM-DD] [--offline]` | TheSportsDB (unless `--offline`) | `pipeline/state/new-match-candidates.json` (review queue). Report goes to `reports/pipeline/detect.json` |
| `pr-body.mjs` | no | `reports/pipeline/pr-body.md` |

### What `verify` adds on top of `snapshots:refresh`

Each snapshot is parsed with the same parsers the ingest uses (`scripts/lib/sources-raw.mjs`; see `lib/checks.mjs`).

1. **Failed step → restore that group.** `fetch-snapshots.mjs` writes files as it goes and only writes the MANIFEST at the end, so a failure can leave a partial update. The group's files and MANIFEST entries are restored from the backup.
2. **Doesn't parse → reject everything.** If any snapshot fails its parser, every file is restored.
3. **Totals go down → reject everything.** The guarded totals are:
   - Wikipedia list goals and caps, and the infobox caps and goals
   - RSSSF caps
   - martj42 row counts
   - eswiki club matches and goals
   - the enwiki club career total (apps and goals)
   - Kaggle goals and season-article pages

   This catches vandalism and truncated downloads. Rejecting everything keeps the article snapshot and the club career table (fetched at the article's revision) consistent with each other.
4. **No semantic change → restore everything.** Change is measured by a semantic digest. A new `fetched_at`, a re-render, an unrelated wiki edit, a new RSSSF "Last updated" stamp, or a new season-article revision id alone leaves `data/raw` and the MANIFEST byte-identical, so no daily noise PR is opened.
5. Problems are listed in the PR body and the job summary, and recorded in a single "Daily refresh: source fetch errors" issue, which is reused and commented on.

Politeness for snapshot fetching (User-Agent, pauses) is part of `fetch-snapshots.mjs`. The pipeline's own HTTP client (`lib/http.mjs`) is used only for TheSportsDB. It sends requests serially, at least 5 s apart, with the User-Agent `siuuustats-pipeline/0.2 (…)`. It makes up to 3 retries with backoff that honours `Retry-After` (capped at 65 s). A run makes about 12 requests.

### New-match detection

- **Portugal**: the martj42 results snapshot covers home and away matches completely. Any played Portugal match after the latest ledger cap that is missing from `data/matches.csv` becomes a candidate. The PR shows a hint when RSSSF's cap list was updated after the match but has no cap that day, which suggests he did not play.
- **Al-Nassr (and Portugal as a cross-check)**: the TheSportsDB v1 free API with the documented public key `123`:
  - `eventslast.php?id=` and `eventsnext.php?id=` for teams 136022 and 133908
  - `eventsday.php?d=…&l=…` for the last 2 days in Al-Nassr's competitions (4668, 5649, 5650, 4719)
- Candidates stay in `pipeline/state/new-match-candidates.json` until the match appears in the ledger, or until a human adds the key to `pipeline/config/dismissed-candidates.json` with a reason and evidence.
- **Free-tier limits** (from TheSportsDB's docs): `eventslast` and `eventsnext` return only **1 home event**, and `eventsday` returns at most **3 events**. Away matches are only caught by the day scan and can be missed on busy days, which the PR notes. Treat TheSportsDB as a hint. The club snapshots (eswiki list, enwiki career table and season articles) are the authoritative signal for club matches.
- Ledger team ids: `al-nassr` and `portugal` (CONTRACTS §9).
- **Reviewed queue** (`pipeline/config/`), from the owner's review on 2026-10-22:
  - **`ledger-additions.json`**: matches that should become ledger rows, which the pipeline must not write itself. Detection keeps each one in the queue, marked with its action, and the PR body shows a section "Reviewed: add to the ledger" with the evidence and a ready-made `data/matches.csv` line. The entry disappears once the row exists.
    - 2026-09-27 Norway 1-2 Portugal: **unused substitute**, to be added as an `appeared=false` row with no cap. Evidence: two BBC Sport articles.
  - **`dismissed-candidates.json`**: matches where he was not in the squad. These are never flagged again.
    - 2026-10-01 Denmark 2-4 Portugal: left the camp (BBC Sport live match coverage; Al Jazeera pre-match explainer)
    - 2026-10-04 Portugal 2-1 Norway: absent (Al Jazeera match report; BBC Sport post-match article)

  Every evidence entry carries a verified article URL.

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
# Dry-run detection against a scratch copy, never the working tree:
mkdir -p /tmp/siuuu/pipeline && cp -r data /tmp/siuuu/ && cp -r pipeline/config /tmp/siuuu/pipeline/
node pipeline/detect-matches.mjs --root /tmp/siuuu
# Lint workflows (free binaries: rhysd/actionlint + koalaman/shellcheck):
actionlint -shellcheck shellcheck
```

The root `npm test` script only globs `tests/*.test.mjs`, so the pipeline tests run as a separate CI step. See "Contract notes" in the M5 hand-off.
