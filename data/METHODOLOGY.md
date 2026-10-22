# Methodology — club ledger (M3)

As of **20 Oct 2026** (Al-Nassr 1-0 Neom): **835 club goals in 1,107 club appearances**. Career: **981 goals in 1,341 appearances** (146 in 234 for Portugal).

## Sources and roles
| Role | Source |
|---|---|
| Match spine (one row per club appearance, goal minutes, penalty/free-kick markers, assisters, minutes, sub on/off) | eswiki *Anexo:Partidos de Cristiano Ronaldo con clubes*, rev 175883102 |
| Acceptance test (apps and goals per club × season × competition category) | enwiki *Cristiano Ronaldo* career table, rev 1381391040, "correct as of 20 October 2026" |
| Date and score cross-check, tie-breaker for disputed details | 27 enwiki club season articles (pinned revisions in `raw/MANIFEST.json`; only date-anchored snippets are stored) |
| Enrichment seed: body part, assister fallback, penalty/free-kick cross-check (decision c) | Kaggle "Ronaldo CR7 All Goals GOAT" (CC BY-SA 4.0), 816 goals to 25 Feb 2026, no Arab Club Champions Cup |

No Transfermarkt or FBref pages were fetched. Everything was downloaded anonymously, at no cost.

## Rules
1. **Counting.** A goal exists only if eswiki records it and the season total matches enwiki. Kaggle never adds or removes a goal.
2. **Corrections.** Every change to an eswiki value is a row in `manual/corrections.csv` with its reason and evidence. There are 25: 14 dates, 2 phantom goals (Bologna 2021-01-24 and Al-Hilal 2024-05-17, both scored by teammates; 2 rows each), 4 final scores, 1 venue, 1 truncated goal cell and 1 penalty marker. The ingest fails if eswiki changes underneath a correction.
3. **Dates.** Every match date must appear in the English season article, unless `manual/club-date-checks.csv` shows outside evidence that eswiki is right. There are 3 such cases, where the enwiki article was a day off: Naval 2003, Zaragoza 2009, Athletic 2010.
4. **2-of-3.** Where eswiki and Kaggle disagree on the penalty flag, the season article decides. 15 goals were settled this way (`reconciliation/club-ingest-resolutions.json`). One more (Watford 2007) needed an explicit correction because the article's minute differs.
5. **Neutral venues.** eswiki gives neutral-venue scores in designated-home order. Orientation comes from the goal sequence, then Kaggle, then `manual/club-neutral-results.csv` (24 finals and other neutral matches, each checked against the season article).
6. **Awarded results.** The official score is stored and the score played on the pitch goes in `notes` (Al-Nassr v Al-Orobah, 28 Feb 2025: played 1-2, awarded 3-0).
7. **Champions League (decision a).** The headline is 140 (main competition). 141 including qualifiers is stored and footnoted.
8. **Appearances (decision b).** The ledger's count is the published figure. Wikipedia's 1,109 includes 2 Sporting CP B reserve matches that the ledger does not have (gap list).
9. **Non-FIFA competition.** The Arab Club Champions Cup 2023 (6 apps, 6 goals) counts in totals, matching Wikipedia. `goals_excluding_non_fifa` (975 career) is published next to it.

## Reference figures and known differences
| Figure | Ledger | Reference | Note |
|---|---|---|---|
| Club apps | 1,107 | 1,109 (enwiki) | Sporting CP B ×2 |
| Real Madrid goals | 450 | 451 (some outlets) | Ledger = enwiki. The other figure's extra goal could not be traced in an open source |
| Career penalties | 184 | 183 or 184 | The 2-of-3 rule makes Watford 2007 (12') a penalty. Sources that miss it give 183 |
| National teams scored against | 49 | 48 (older pages) | The 49th, Uzbekistan, came on 23 Jun 2026 |
| Champions League | 140 | 141 (UEFA) | Qualifier at Debrecen, 2005 |

## Gap list
- Sporting CP B 2002-03: 2 apps, 0 goals, with no match rows (dates and opponents disputed).
- Club goal `location` is unknown for all rows. `method` can't separate open play from other set pieces (`non_penalty_unspecified` = 742 career goals including internationals).
- Club body part is known for 563 of 835 goals (Kaggle labels the rest only as penalty, free kick and so on). Assister named for 549.
- Club `started` is null for 10 matches where eswiki gives neither a sub template nor an unambiguous minute note.
- International `stage`, `started`, `minutes`, body part and 22 goal minutes: still null (no open source in the snapshot set provides them).
