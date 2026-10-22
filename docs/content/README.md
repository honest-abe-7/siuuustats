# docs/content/ — editorial pages (M6)

Argument pages for SIUUU Stats. Per the engineering plan, the facts pages stay neutral and the GOAT case lives in pages that are **clearly marked as argument pages**. Every file here sets `kind: argument`.

Neither README.md nor CONTRACTS.md defines a content convention yet, so these files use the one below. The web workstream can adjust it when it adds an Astro content collection.

## Front matter

```yaml
---
title: "Myths Debunked"          # page <h1>
slug: myths                       # URL path segment, kebab-case (matches CONTRACTS §2 id style)
description: "…"                  # <meta name="description">, 160 characters or fewer
kind: argument                    # argument | facts
status: draft                     # draft | reviewed | published
data_as_of: 2026-10-22            # date the numbers were checked
ledger_endpoints: [summary, goals]          # /api/v1 files the page takes numbers from
ledger_source_ids: [wikipedia-cr7-intl-goals]  # sources.csv ids behind those numbers
unverified_count: 0               # count of claims marked UNVERIFIED in the body
---
```

## Citation rules used here

- Every factual claim has a footnote (`[^n]`) with a URL. Footnotes are GFM, which Astro renders by default.
- **Ledger numbers** (international only, from `data/` → `dist/api/v1`) are marked **[ledger]**. They cite the API endpoint and the `source_ids` behind it. Club numbers are not in the ledger yet (M3), so they cite Wikipedia's career table at a pinned revision, plus press or official sources.
- **Provisional ledger computations** are numbers worked out from ledger rows with a definition that is not yet in `scripts/lib/stats.mjs` (for example "winning goals"). They are marked **[ledger, provisional]** and listed in `data-requests.md`. CONTRACTS §4 says stat definitions must live in `stats.mjs`, so these cannot ship as headline numbers until that function exists.
- Anything that could not be confirmed is marked **UNVERIFIED** in the text.
- Where sources disagree, the page shows the range and names the sources. It does not pick the bigger number.
- Ronaldo only. These pages do not compare him with other players (README scope). Other players are named only when a fact needs it, for example who scored a goal.

## Files

| File | Page |
|---|---|
| `myths-debunked.md` | Myths Debunked |
| `big-games-clutch.md` | Big Games & Clutch |
| `proven-in-every-league.md` | Proven in Every League |
| `longevity.md` | Longevity |
| `data-requests.md` | Stats these pages need that are not in `data/` yet |

## Pinned reference revisions used

- Wikipedia "Cristiano Ronaldo", revision 1381391040 (22 Oct 2026; career tables as of 20 Oct 2026 for club and 24 Sep 2026 for international). This is the same revision as `sources.csv` → `wikipedia-cristiano-ronaldo`.
- Wikipedia "List of career achievements by Cristiano Ronaldo", revision 1379944509 (12 Oct 2026; its records table is stamped 25 Sep 2026).
- Wikipedia "List of international goals scored by Cristiano Ronaldo", revision 1376549197 (`wikipedia-cr7-intl-goals`).
