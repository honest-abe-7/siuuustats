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
- **Ledger numbers** (club and international, from `data/` → `dist/api/v1`, M3 merged at 605a932) are marked **[ledger]**. They cite the `stats.mjs` function or API endpoint and the `source_ids` behind it. Each one was recomputed from main before publishing.
- **Provisional ledger computations** (marked **[ledger, provisional]**) mean the definition is not yet in `scripts/lib/stats.mjs`. As of the M3 rebase, none are left: winning goals, equalisers, goals from age 30 and national teams scored against all have `stats.mjs` functions with tests.
- **International `stage` is still null** in the ledger. Any claim about a Portugal knockout round, semi-final or final is cited to UEFA, BBC or Wikipedia and labelled *(stage: cited, not ledger)*.
- Titles and individual awards are cited from Wikipedia, official sites and the press, because `trophies.csv` and `awards.csv` are still empty.
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

- Ledger: `main` @ 605a932 (M3 club backfill). Club rows come from eswiki "Anexo:Partidos oficiales de Cristiano Ronaldo en clubes" rev 175883102, the 27 enwiki club season articles and the Kaggle "Ronaldo CR7 All Goals GOAT" v1 seed (see ATTRIBUTION.md).

- Wikipedia "Cristiano Ronaldo", revision 1381391040 (22 Oct 2026; career tables as of 20 Oct 2026 for club and 24 Sep 2026 for international). This is the same revision as `sources.csv` → `wikipedia-cristiano-ronaldo`.
- Wikipedia "List of career achievements by Cristiano Ronaldo", revision 1379944509 (12 Oct 2026; its records table is stamped 25 Sep 2026).
- Wikipedia "List of international goals scored by Cristiano Ronaldo", revision 1376549197 (`wikipedia-cr7-intl-goals`).
