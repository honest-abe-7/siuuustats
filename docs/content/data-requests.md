# Data requests from the content workstream (M6)

These are stats the editorial pages use, or would like to use, that are not yet in `data/` or in `scripts/lib/stats.mjs`. Owners: data model & validation (M2/M3). Content does not edit `data/`.

**Status as of the rebase onto main @ 605a932 (M3 club backfill), 22 Oct 2026.** #16 and #17 were resolved on main @ 4947a21. Every value marked "resolved" was recomputed from main's `data/*.csv` with main's `stats.mjs`, not copied from a summary. `npm test` on main: 36 pass, 0 fail.

Priority: **P1** means a headline number relies on a non-ledger source. **P2** would strengthen an argument. **P3** is nice to have.

## Resolved by M3

| # | Stat | Resolution (ledger value) | Where it lives | Pages updated |
|---|---|---|---|---|
| 1 | Club matches/goals ledger | **1,107 club apps / 835 goals**; career **1,341 / 981** (apps / goals throughout this row). Per club: Sporting 31/5, Man Utd 346/145, Real Madrid 438/450, Juventus 134/101, Al-Nassr 158/134. League: PL 236/103, La Liga 292/311, Serie A 98/81, SPL 115/106, Primeira Liga 25/3. Wikipedia's 1,109 club apps includes 2 Sporting CP B apps that are not in the ledger | `clubSummary`, `careerSummary`, `goals-by-club.json`, `goals-by-season.json`; `known-differences.json` → `wikipedia-club-career-apps` | all four |
| 2 | Career penalty goals | **184**, or 183 if the Watford 31 Jan 2007 goal is not counted as a penalty (`corrections.csv` → `eswiki-match-198-penalty`, 2-of-3 rule). No longer UNVERIFIED | `careerPenaltyGoals`; `expectations.json` → `career-penalty-goals` | Myths |
| 3 | Winning goals / equalisers | **`winningGoals()` / `equalisers()` now in `stats.mjs`** with tests. Career **322 / 99** (club 270 / 81, Portugal 52 / 18; Portugal matches the earlier provisional count). One-goal-win winners 107 (club 85, Portugal 22); penalties among winners 63 | `stats.mjs`, `summary.json` → `career` | Big Games, Myths |
| 5 | Champions League per-goal data | **140 goals / 183 apps** (main competition); 141 / 187 including the 2005 Debrecen qualifier. Knockout **67 in 85 apps** (R16 25, QF 25, SF 13, F 4), **19 penalties**, final goals 2008, 2014 (120' pen) and 2017 ×2 | `uclGoalsMain`, `uclAppsMain`, `stageClass`, `records.csv` → `most-goals-uefa-champions-league` | Big Games, Myths, Every League |
| 6 | Goals after age 30 | **518** (463 before 30; 259 from 35). The ledger's count to 21 Feb 2026 is 501, matching the press. No longer UNVERIFIED. Wikipedia's 494 is stale | `goalsFromAge`, `goals-by-age.json` | Longevity |
| 7 | National teams scored against | **49**. The 49th was Uzbekistan, 2026-06-23. Wikipedia's 48 is stale | `nationalTeamsScoredAgainst`; `expectations.json` | Myths |
| 9 | Club goals by opponent | Goals in apps: Sevilla 27 in 18, Atlético 25 in 37, Getafe 23 in 14, Barcelona 20 in 34, Celta 20 in 13. **Clásico 18 in 30** (Real Madrid v Barcelona). The other 2 against Barcelona were Juventus penalties on 2020-12-08. **Madrid derby 22 in 31** (no longer single-source). UCL v Juventus 10; Bayern 9 in 8 | `splitBy` over `matches`/`goals`; `goals-by-opponent.json` | Myths |
| 15 | Non-FIFA competition flag | `arab-club-champions-cup` is in `NON_FIFA_COMPETITIONS`. Career **975** and club 829 excluding its 6 goals | `careerSummary.goals_excluding_non_fifa` | Myths, Every League |
| — | Club finals (new, from club `stage`) | **37 club finals (super cups included), 24 goals, scored in 19** | `bigGameSplits`, `big-games.json` | Big Games, Myths |
| — | Career free kicks (new) | **55** direct free kicks, all club. International goals are not classified, so read this as "at least 55" | `careerSummary.free_kick_goals` | Myths |
| 16 | Real Madrid 450 vs 451 | **Documented.** `known-differences.json` → `reference-real-madrid-goals-marca` (451 expected, 450 actual), plus the Real Madrid row in METHODOLOGY's known-differences table. Real Sociedad 1-2 Real Madrid, 18 Sep 2010, 74': Ronaldo's free kick went in off Pepe. The official record, ESPN and enwiki credit Pepe; Real Madrid and Marca credit Ronaldo (Sky Sports, 1 Oct 2015). The ledger keeps 450 / 311 La Liga | `known-differences.json`, `METHODOLOGY.md`; sources `espn-2010-09-18-real-sociedad-real-madrid`, `skysports-ronaldo-mystery-goal` | Every League |
| 17 | Champions League 140 vs 141 wording | **Fixed in METHODOLOGY.md.** Decision (a): the headline 140 in 183 matches UEFA.com, so there is no difference. 141 in 187, including the 2005 qualifier at Debrecen, matches UEFA's "including qualifying rounds" list and is stored as `goals_incl_qualifiers` | `METHODOLOGY.md` decision (a) and reference table | Big Games, Every League |

## Still open

| # | Stat / change | Pages | Why | Suggested source | Priority |
|---|---|---|---|---|---|
| 4 | **`matches.stage` for internationals** (Group / R32 / R16 / QF / SF / Final / Play-off) | Big Games, Myths | Still null for all 234 caps (`METHODOLOGY.md` gap list), and `big-games.json` reports them as `unknown`. Every Portugal knockout claim is still cited externally and labelled *(stage: cited, not ledger)*: Euro 2004 SF, Euro 2012 QF, Euro 2016 SF, NL Finals 2019/2025, WC 2026 R32 ("only World Cup knockout goal") and the 2013 play-off | Wikipedia tournament knockout-stage articles; UEFA match pages, e.g. https://www.uefa.com/uefaeuro/match/2003343--czechia-vs-portugal/ | P1 |
| 8 | **Opponent strength at match date** (Elo or FIFA ranking) | Myths | Would let us split goals by opponent-strength tier instead of hand-picked examples. Licence check needed | https://www.eloratings.net/ (check terms); https://inside.fifa.com/fifa-world-ranking/men | P2 |
| 10 | **`trophies.csv` / `awards.csv` rows** | Every League, Big Games, Myths | Still headers only, so titles and awards are cited from Wikipedia's honours list | https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040#Honours ; https://www.ligaportugal.pt/news/25330/cristiano-ronaldo-o-melhor-de-sempre | P2 |
| 11 | **Editorial `records.csv` rows (≥2 sources)**: only player to score in 3 UCL finals; most UCL knockout goals 67; first to score at 6 World Cups; top scorer in 4 leagues; 100 goals for 4 clubs; SPL season record 35; most goals from age 30 (518). Computed versions could use `uclGoalsMain`, `goalsFromAge:30` and similar | All | Only `most-goals-uefa-champions-league` was added in M3 | UEFA records: https://www.uefa.com/european-qualifiers/news/0253-0d820b46805f-b78ccae2c451-1000--what-uefa-records-does-cristiano-ronaldo-hold/ ; Reuters: https://www.reuters.com/sports/soccer/ronaldo-becomes-first-player-score-six-world-cup-finals-2026-06-23/ ; AP: https://apnews.com/article/ronaldo-100-goals-record-alnassr-2584cac92877eb9c6f3b04cf22d9efd6 | P2 |
| 14 | **Body part for all goals, and free kicks for internationals** | Myths | Body part is known for 563 of 835 club goals (124 headers), and for no international goals, so Wikipedia's "156 headed goals" can't be confirmed. Free kicks: 0 of 146 international goals classified | Wikipedia match reports; UEFA match pages | P3 |
| 12 | **`goals.added_time` for internationals** | Big Games | For example, the 2021 Ireland winner is stored as minute 90 with null added time | martj42 `goalscorers.csv`; match reports | P3 |
| 13 | **International `minutes`/`started`**, and minutes for the 22 friendly goals | Longevity, Big Games | Goals per 90 by age. The career "80th minute or later" count covers only 959 of 981 goals | RSSSF cap list; FPF match sheets: https://www.fpf.pt/ | P3 |
| 18 | **Penalty attempts/misses** | Myths | The ledger has only scored penalties, so the ~83% conversion rate is still cited from messivsronaldo.app and Planet Football | https://www.messivsronaldo.app/detailed-stats/penalties/ | P3 |

## Source issues noticed while fact-checking (for the data team)

- **ESPN (21 May 2026)** says Ronaldo has won "domestic league titles in Portugal, England, Spain, Italy and Saudi Arabia". Wikipedia's honours list (and the ledger's Sporting season) shows no Primeira Liga title. The pages do **not** use this claim.
- **Wikipedia "Cristiano Ronaldo" (rev 1381391040)** says he "broke" the men's international scoring record with his two goals against France on 23 Jun 2021. The ledger has those as goals 108 and 109, and goals 110 and 111 came against Ireland on 1 Sep 2021. The pages avoid the claim.
- **Wikipedia lead: 141 international wins.** The ledger has 142, which is already a known difference.
- **Wikipedia career-achievements records table** (stamped 25 Sep 2026): career goals 979 (ledger and main article: 981), goals after 30 494 (ledger: 518), national teams 48 (ledger: 49). All stale.
