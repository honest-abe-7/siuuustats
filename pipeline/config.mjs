// Pipeline configuration: endpoints, IDs, politeness settings. No secrets live here.
// TheSportsDB IDs were verified against https://www.thesportsdb.com/documentation and the live
// free API on 2026-10-22 (see pipeline/README.md, "TheSportsDB IDs").

export const USER_AGENT =
  "siuuustats-pipeline/0.1 (+https://siuuustats.pages.dev; open-source fan stats project; GitHub Actions daily refresh)";

/** Minimum gap between two requests to the same host, in ms. */
export const MIN_INTERVAL_MS = {
  "en.wikipedia.org": 1000, // Wikimedia asks for serial requests; we never run in parallel
  "www.rsssf.org": 2000,
  "raw.githubusercontent.com": 1000,
  "api.github.com": 1000,
  "www.thesportsdb.com": 3000, // free tier: 30 requests/minute (docs); we make ~12 per run
  default: 1500,
};

export const WIKI = {
  api: "https://en.wikipedia.org/w/api.php",
  restHtml: (title) => `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`,
  article: "Cristiano_Ronaldo",
  intlList: "List_of_international_goals_scored_by_Cristiano_Ronaldo",
};

export const MARTJ42 = {
  raw: "https://raw.githubusercontent.com/martj42/international_results/master",
  commitApi: "https://api.github.com/repos/martj42/international_results/commits/master",
};

export const RSSSF_URL = "https://www.rsssf.org/miscellaneous/cronaldo-intlg.html";

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
      team_id: "al-nassr", // ledger slug; must match data/teams.csv once M3 adds club rows
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

/** Files the daily workflow is allowed to change (also used as create-pull-request add-paths). */
export const PIPELINE_SNAPSHOT_DIR = "pipeline/snapshots";
export const CANDIDATES_FILE = "pipeline/snapshots/new-match-candidates.json";
export const DISMISSED_FILE = "pipeline/config/dismissed-candidates.json";
export const REPORT_DIR = "reports/pipeline"; // git-ignored (reports/ is in .gitignore)
