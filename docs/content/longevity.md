---
title: "Longevity"
slug: longevity
description: "Two decades at the top: Cristiano Ronaldo's goals by age, scoring after 30 and after 35, and a record six World Cups and six Euros, all sourced."
kind: argument
status: draft
data_as_of: 2026-10-22
ledger_endpoints: [summary, goals, matches, goals-by-year, goals-by-age, goals-by-season]
ledger_source_ids: [eswiki-cr7-club-matches, wikipedia-club-season-articles, kaggle-sigmaborov-cr7-goals, wikipedia-cr7-intl-goals, rsssf-cronaldo-intlg, martj42-results, martj42-goalscorers]
unverified_count: 0
---

# Longevity

> **Argument page.** Numbers marked **[ledger]** are computed by stats-engine functions (`goalsFromAge`, `splitBy`, `ageOn`, `appearances`) from the SIUUU Stats ledger. The ledger now covers every club and international match up to 20 October 2026.

Ronaldo was born on **5 February 1985**.[^wiki] He played his first official senior match for Sporting CP on **14 August 2002**, at 17.[^wiki] Twenty-four years later he is still playing, and still scoring.

## The headline numbers

- **1,341 official senior appearances** (1,107 for clubs and 234 for Portugal). **[ledger]**[^ledger-career] Wikipedia counts 1,343, because it includes 2 Sporting CP B reserve matches, and calls it the most by any outfield player.[^wiki] [^ledger-kd]
- **981 official senior goals**. Wikipedia calls him the top goalscorer in the history of the sport, though its records table notes that who holds the all-time record is disputed.[^wiki] [^wa-records]
- **518 goals from the age of 30 onwards, and 463 before.** **[ledger]**[^ledger-career] So **more of his goals have come after 30 than before**. He became the **first player to score 500 goals after turning 30** on 21 February 2026.[^gulf-500] [^soccernews-500] The press count that day (463 before, 501 after) matches the ledger.[^ledger-age]
- **Six World Cups and six European Championships.** He is the first player to appear at six Euros, and has a joint-record six World Cups.[^wiki] He is the **first player to score at six World Cups** (2006–2026).[^reuters-6wc] [^ap-6wc] **[ledger]**[^ledger-comp]

## Career: goals by age **[ledger]**

| Age | Apps | Goals | Goals per game |
|---|---|---|---|
| 17–24 | 407 | 160 | 0.39 |
| 25–29 | 311 | 303 | 0.97 |
| 30–34 | 277 | 259 | 0.94 |
| 35–41 | 346 | 259 | 0.75 |
| **Total** | **1,341** | **981** | **0.73** |

Computed as `splitBy(ledger, m => ageBand(ageOn(m.date)))`, with `goalsFromAge(ledger, 30)` = 518 and `goalsFromAge(ledger, 35)` = 259.[^ledger-age] The first band starts at 17 because his first senior club match came at 17.

- **259 goals after his 35th birthday**, as many as he scored from 30 to 34. **[ledger]**[^ledger-age]
- **161 goals in 193 matches at age 38 or older**, and **58 goals in 80 matches at 40 or older**. **[ledger]**[^ledger-age]
- He has scored in **every calendar year from 2002 to 2026**, 25 years in a row. **[ledger]**[^ledger-years]
- His latest goal came on 12 October 2026 for Al-Nassr against Neftchi Fergana, at 41. **[ledger]**[^ledger-goals]

## Portugal: goals by age **[ledger]**

| Age | Caps | Goals | Goals per cap |
|---|---|---|---|
| 18–24 | 68 | 22 | 0.32 |
| 25–29 | 50 | 30 | 0.60 |
| 30–34 | 46 | 47 | 1.02 |
| 35–41 | 70 | 47 | 0.67 |
| **Total** | **234** | **146** | **0.62** |

Computed as `splitBy(ledger, m => ageBand(ageOn(m.date)))`.[^ledger-goals]

- **94 of his 146 international goals came after his 30th birthday.** **47 came after his 35th.** **[ledger]**[^ledger-goals]
- **28 international goals at age 38 or older**, in 38 caps. **[ledger]**[^ledger-goals]
- He has scored for Portugal in **every calendar year from 2004 to 2026**, 23 years in a row. **[ledger]**[^ledger-years]
- **First international goal:** 12 June 2004 against Greece, at 19. **Latest:** 2 July 2026 against Croatia at the World Cup, at 41. **[ledger]**[^ledger-goals] [^wiki-list]
- His caps run from **20 August 2003 to 24 September 2026**. **[ledger]**[^ledger-summary]

## Club: still producing in his thirties and forties

Goals in all competitions, by season, from the age of 30. **[ledger]**[^ledger-season] These match Wikipedia's career table.[^wiki]

| Season | Club | Age during season | Goals (all comps) |
|---|---|---|---|
| 2015–16 | Real Madrid | 30–31 | 51 |
| 2016–17 | Real Madrid | 31–32 | 42 |
| 2017–18 | Real Madrid | 32–33 | 44 |
| 2018–19 | Juventus | 33–34 | 28 |
| 2019–20 | Juventus | 34–35 | 37 |
| 2020–21 | Juventus | 35–36 | 36 |
| 2021–22 | Manchester United | 36–37 | 24 |
| 2022–23 | Manchester United / Al-Nassr | 37–38 | 3 + 14 |
| 2023–24 | Al-Nassr | 38–39 | 50 |
| 2024–25 | Al-Nassr | 39–40 | 35 |
| 2025–26 | Al-Nassr | 40–41 | 30 |
| 2026–27 (to 20 Oct) | Al-Nassr | 41 | 5 |

- **At 35:** he became the oldest player since 1948 to score 30 or more goals in a season in one of Europe's top five leagues.[^wiki]
- **At 36:** he became the first player to score at least 20 goals in **12 consecutive seasons** in Europe's top five leagues.[^wiki]
- **At 36 (2020–21):** he was Serie A's top scorer with 29 goals.[^wiki] [^uefa-capo21]
- **At 38 (2023):** he was the **world's top scorer for the calendar year**, with 54 official goals in 59 matches.[^espn-2023] [^iffhs-2023] **[ledger]**[^ledger-years]
- **At 39 (2023–24):** he set the **Saudi Pro League season record of 35 goals**.[^bbc-spl35] [^reuters-spl35] **[ledger]**[^ledger-season]
- **At 41 (2025–26):** he scored 28 league goals and won the league title, scoring twice on the final day.[^bein-title] [^espn-title] **[ledger]**[^ledger-season]

## The road to 1,000

He is on **981**, which leaves **19 to go**. **[ledger]**[^ledger-career] He has called 1,000 his final big ambition before retiring.[^gulf-500] When he gets there, this page will say so, with sources.

## Fair points

- Age has changed his game. Commentators judged his 2026 World Cup ineffective, and his only goals there were two against Uzbekistan and a penalty against Croatia.[^wiki] **[ledger]**[^ledger-goals]
- His scoring rate has dropped with age: 0.75 goals per game after 35 against a peak of 0.97 at 25–29, and for Portugal 0.67 after 35 against 1.02 at 30–34. **[ledger]**[^ledger-age] [^ledger-goals] That is longevity, not immortality.
- Wikipedia's records table still shows **494** goals after 30 (stamped 25 Sep 2026). That is out of date: the press count in February already passed 500, and the ledger has 518.[^wa-records] [^ledger-age]

[^ledger-career]: SIUUU Stats ledger (main @ 605a932), `careerSummary()` in `scripts/lib/stats.mjs`, `/api/v1/summary.json` → `career` (apps 1,341; goals 981; goals_from_age_30 518). Built from `eswiki-cr7-club-matches`, `wikipedia-club-season-articles`, `kaggle-sigmaborov-cr7-goals`, `wikipedia-cr7-intl-goals`, `rsssf-cronaldo-intlg` and `martj42-*`. https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^ledger-age]: SIUUU Stats ledger, `goalsFromAge()`, `ageOn()` and `splitBy()` in `stats.mjs`; `/api/v1/goals-by-age.json`. Birth date 1985-02-05. https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^ledger-season]: SIUUU Stats ledger, `/api/v1/goals-by-season.json` (club × season), reconciled to enwiki's per-season table. https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040#Club
[^ledger-kd]: `data/reconciliation/known-differences.json` → `wikipedia-club-career-apps` (1,109 vs 1,107: Sporting CP B ×2). https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040#Club
[^wiki]: Wikipedia contributors, "Cristiano Ronaldo", revision 1381391040 (22 Oct 2026): lead, club and international sections, and *Career statistics* (club as of 20 Oct 2026). https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040
[^wiki-list]: Wikipedia contributors, "List of international goals scored by Cristiano Ronaldo", revision 1376549197. https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^wa-records]: Wikipedia contributors, "List of career achievements by Cristiano Ronaldo", revision 1379944509, *Records* table. https://en.wikipedia.org/w/index.php?title=List_of_career_achievements_by_Cristiano_Ronaldo&oldid=1379944509#Records
[^ledger-summary]: SIUUU Stats ledger, `/api/v1/summary.json` (`caps`, `first_cap`, `last_cap`), built from `rsssf-cronaldo-intlg`, `wikipedia-cr7-intl-goals` and `martj42-results`. https://www.rsssf.org/miscellaneous/cronaldo-intlg.html
[^ledger-goals]: SIUUU Stats ledger, `/api/v1/goals.json` (`age`, `date`, `scope`) and `matches.json`, built from `eswiki-cr7-club-matches` (club) and `wikipedia-cr7-intl-goals`, `martj42-goalscorers`, `rsssf-cronaldo-intlg` (international). Age bands come from `ageOn` (birth date 1985-02-05). https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-years]: SIUUU Stats ledger, `/api/v1/goals-by-year.json` (club and international scopes. Career: every year from 2002 to 2026 has at least 1 goal, and 2023 has 54 goals in 59 apps. International: every year from 2004 to 2026). https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-comp]: SIUUU Stats ledger, `/api/v1/matches.json` (World Cup appearances in 2006, 2010, 2014, 2018, 2022 and 2026; Euro appearances from 2004 to 2024) and `goals-by-competition.json`. https://github.com/martj42/international_results
[^gulf-500]: Gulf News, "Ronaldo wears a Bisht after becoming the first player to score 500 goals since turning 30" (22 Feb 2026). https://gulfnews.com/sport/football/ronaldo-wears-a-bisht-after-becoming-the-first-player-to-score-500-goals-since-turning-30-i-belong-to-saudi-arabia-1.500451592
[^soccernews-500]: SoccerNews, "Al-Nassr 4-0 Al-Hazem: Ronaldo at the double" (21 Feb 2026). https://www.soccernews.com/al-nassr-4-0-al-hazem-ronaldo-at-the-double-to-send-hosts-top-of-saudi-pro-league-table/396290/
[^reuters-6wc]: Reuters, "Ronaldo becomes first player to score at six World Cup finals" (23 Jun 2026). https://www.reuters.com/sports/soccer/ronaldo-becomes-first-player-score-six-world-cup-finals-2026-06-23/
[^ap-6wc]: AP News, "Ronaldo becomes first player to score in six World Cups". https://apnews.com/article/ronaldo-world-cup-score-b511151c5a78afb738e8249c07d30aef
[^uefa-capo21]: UEFA.com (Italian), "Classifica marcatori Serie A 2020/21: vince Ronaldo". https://it.uefa.com/uefachampionsleague/news/0266-11ae0b524e1b-b7af12823f66-1000--classifica-marcatori-serie-a-2020-21-vince-ronaldo/
[^espn-2023]: ESPN, "Cristiano Ronaldo to end 2023 as world's top goal scorer". https://www.espn.com/football/story/_/id/39211354/cristiano-ronaldo-end-2023-world-top-goalscorer
[^iffhs-2023]: IFFHS, "IFFHS Men's World Best Goal Scorer 2023". https://iffhs.com/en/news/iffhs-mens-world-best-goal-scorer-2023-3288
[^bbc-spl35]: BBC Sport, "Cristiano Ronaldo: Al-Nassr forward sets new Saudi Pro League scoring record". https://www.bbc.co.uk/sport/football/articles/c9een3y52jpo
[^reuters-spl35]: Reuters, "Ronaldo breaks Saudi League's single-season scoring record" (27 May 2024). https://www.reuters.com/sports/soccer/ronaldo-breaks-saudi-leagues-single-season-scoring-record-2024-05-27/
[^bein-title]: beIN SPORTS, "Al-Nassr 4-1 Damac: Ronaldo scores brace to secure his first Pro League title" (21 May 2026). https://www.beinsports.com/en-us/soccer/articles/al-nassr-4-1-damac-ronaldo-scores-brace-to-secure-his-first-pro-league-title-2026-05-21
[^espn-title]: ESPN, "Cristiano Ronaldo wins first Saudi title as Al Nassr clinch league" (21 May 2026). https://global.espn.com/football/story/_/id/48635460/cristiano-ronaldo-first-saudi-title-al-nassr-clinch-league
