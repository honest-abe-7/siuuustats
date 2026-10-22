// Pipeline configuration: endpoints, IDs, politeness settings. No secrets live here.
// TheSportsDB IDs were verified against https://www.thesportsdb.com/documentation and the live
// free API on 2026-10-22 (see pipeline/README.md, "TheSportsDB IDs").

export const USER_AGENT =
  "siuuustats-pipeline/0.2 (+https://siuuustats.pages.dev; open-source fan stats project; GitHub Actions daily match check)";

// Snapshot fetching, pinning and data/raw/MANIFEST.json are owned by scripts/ingest/fetch-snapshots.mjs
// (`npm run snapshots:refresh -- --only=intl|club`). The pipeline only fetches TheSportsDB (match detection).

/** Minimum gap between two requests to the same host, in ms. */
export const MIN_INTERVAL_MS = {
  "www.thesportsdb.com": 5000, // docs say 30/min for the free key, but 429s were seen at 3 s gaps; ~12 requests per run
  default: 1500,
};

export const THESPORTSDB = {
  // v1 free key, documented at https://www.thesportsdb.com/documentation ("The current free API key is: 123").
  // Override with THESPORTSDB_KEY only if the project ever gets a key; never commit one.
  base: "https://www.thesportsdb.com/api/v1/json",
  freeKey: "123",
  // Free-tier per-call result caps (from the docs); used to flag possibly truncated answers.
  freeLimits: { eventslast: 1, eventsnext: 1, eventsday: 3 },
  // How many past days (UTC, including today) to scan with eventsday.php (only for teams with scanLeagues).
  lookbackDays: 2,
  teams: [
    {
      idTeam: "136022", // verified: "Al-Nassr", idLeague 4668
      team_id: "al-nassr", // ledger team_id (fixed by CONTRACTS §9)
      name: "Al-Nassr",
      // 4668 Saudi Pro League, 5649 Saudi King Cup, 5650 Saudi Super Cup, 4719 AFC Champions League Elite
      leagues: ["4668", "5649", "5650", "4719"],
      scanLeagues: true, // away matches are invisible to eventslast on the free key, so scan recent days
    },
    {
      idTeam: "133908", // verified: "Portugal" (men), via searchteams.php?t=Portugal
      team_id: "portugal",
      name: "Portugal",
      // 4429 FIFA World Cup, 4490 UEFA Nations League, 4562 International Friendlies, 5519 UEFA Euro qualifying
      leagues: ["4429", "4490", "4562", "5519"],
      scanLeagues: false, // Portugal is covered completely (home and away) by the martj42 results snapshot
    },
  ],
};

export const CANDIDATES_FILE = "pipeline/state/new-match-candidates.json";
export const DISMISSED_FILE = "pipeline/config/dismissed-candidates.json";
export const ADDITIONS_FILE = "pipeline/config/ledger-additions.json";
export const REPORT_DIR = "reports/pipeline"; // git-ignored (reports/ is in .gitignore)
