---
title: "Myths Debunked"
slug: myths
description: "Six things people say about Cristiano Ronaldo, checked against the ledger and cited sources: penalties, minnows, big games, teammates and Saudi goals."
kind: argument
status: draft
data_as_of: 2026-10-22
ledger_endpoints: [summary, goals-by-competition, goals-by-opponent, goals-by-club, big-games, goals]
ledger_source_ids: [eswiki-cr7-club-matches, wikipedia-club-season-articles, kaggle-sigmaborov-cr7-goals, wikipedia-cristiano-ronaldo, wikipedia-cr7-intl-goals, rsssf-cronaldo-intlg, martj42-results, martj42-goalscorers, messivsronaldo-app-international]
unverified_count: 0
---

# Myths Debunked

> **Argument page.** This is the SIUUU Stats case, not a neutral facts page. Every number links to its source. Numbers marked **[ledger]** are computed by `scripts/lib/stats.mjs` from our own match-by-match ledger (`data/matches.csv`, `data/goals.csv`). That ledger now covers every club and international appearance (milestone M3). Each myth also gets a **fair point** section, because a case that hides the weak spots isn't worth making.

Career baseline used on this page: **981 official senior goals** (835 for clubs and 146 for Portugal) in **1,341 appearances** (1,107 for clubs and 234 for Portugal), as of 20 October 2026. **[ledger]**[^ledger-career] Wikipedia counts 1,109 club appearances. The 2 extra are Sporting CP B reserve matches, which the ledger does not count.[^ledger-kd] [^wiki-career]

---

## Myth 1: "He only scores penalties"

**The numbers say no.** Ronaldo has scored **184 career penalties** out of 981 goals, which leaves **797 non-penalty goals**: **81%** of everything he has scored. **[ledger]**[^ledger-career] Some trackers give 183. The difference is one goal, at Watford on 31 Jan 2007, which the season article and the Kaggle dataset record as a penalty.[^ledger-watford] [^pens-rs] [^pens-mvr] [^pens-pf]

- **For Portugal:** 23 of his 146 international goals were penalties, which leaves **123 non-penalty international goals**. **[ledger]**[^ledger-summary]
- **In the Champions League:** 19 of his 140 goals were penalties, so **121 came from open play or free kicks**. **[ledger]**[^ledger-ucl] [^uefa-records]
- **Free kicks:** at least **55 direct free-kick goals** for his clubs. The ledger does not yet classify free kicks for Portugal goals, so the real career number is higher. **[ledger]**[^ledger-career]
- **With his head:** Wikipedia's records table lists **156 headed goals** as a world record, and he holds the record for headed goals at European Championship finals tournaments, with 5.[^wa-records] Headed goals cannot be penalties. (The ledger knows the body part for only 563 of his 835 club goals, so it cannot confirm the 156 yet.)[^ledger-method]
- **Equalisers:** he has scored **99 goals that levelled the score** (81 for clubs, 18 for Portugal). **[ledger]**[^ledger-career] Two of the Portugal ones came against Spain, in the 2025 Nations League final and a 2018 World Cup group game, and neither was a penalty. **[ledger]**[^ledger-goals]

**Fair point:** He takes a lot of penalties, about 220 so far, and scores roughly 83% of them. Being the penalty taker adds to his total.[^pens-mvr] [^pens-pf] Even if you took every penalty out, he would still have scored 797 goals. **[ledger]**[^ledger-career]

---

## Myth 2: "Stat-padder: he farms goals against small national teams"

**Yes, he punishes the minnows. So does every great striker. But that is not where most of the 146 come from.**

- His biggest international victims really are smaller nations: **Luxembourg 11, Hungary 9, Sweden 7, Armenia 7, Lithuania 7**. **[ledger]**[^ledger-opp]
- **124 of his 146 international goals came in competitive matches.** Only 22 came in friendlies. **[ledger]**[^ledger-summary]
- He has scored **42 goals in tournaments and the Nations League**: 14 at European Championship finals (a record), 11 at World Cup finals, 15 in the Nations League and 2 at the Confederations Cup. **[ledger]**[^ledger-comp] [^wa-records]
- He has scored against the strong teams too: **Spain 4, Netherlands 4, Belgium 3, Croatia 3, France 2, Germany 2, Argentina 1**. **[ledger]**[^ledger-opp] That includes a World Cup hat-trick against Spain in 2018, the opening goal of the Euro 2004 semi-final against the Netherlands, and the winner in the 2025 Nations League semi-final in Germany.[^wiki-career] [^bbc-euro2004] [^uefa-unl25-sf] (Stages are taken from the cited reports. International `stage` is not in the ledger yet.)
- A "small team" did not decide the 2014 World Cup play-off. That was **Sweden**, and he scored all four of Portugal's goals over the two legs, including a hat-trick in Stockholm.[^wiki-career] [^uefa-swe13] **[ledger]**[^ledger-goals]
- He has scored against **49 different national teams**. The 49th was **Uzbekistan**, on 23 June 2026. **[ledger]**[^ledger-nt] (Wikipedia's records table still says 48.)[^wa-records]

**Fair point:** He has never scored against **Brazil** (3 caps), **England** (3) or **Italy** (2). **[ledger]**[^ledger-opp] We would rather say that ourselves than have someone else find it. A proper strength-of-opponent split, with each opponent's Elo rating on the day of the match, is on our data-request list.[^data-requests]

---

## Myth 3: "Flat-track bully: he only scores against weak clubs"

Here are the clubs he has scored against most. **[ledger]**[^ledger-opp] The same top five appear in Wikipedia's goals-by-opponent table.[^wa-opp]

| Opponent | Apps | Goals |
|---|---|---|
| Sevilla | 18 | 27 |
| Atlético Madrid | 37 | 25 |
| Getafe | 14 | 23 |
| Barcelona | 34 | 20 |
| Celta Vigo | 13 | 20 |

Two of his top four are **Atlético Madrid and Barcelona**.

- **El Clásico:** **18 goals in 30 matches** for Real Madrid against Barcelona, level with Alfredo Di Stéfano's club record. **[ledger]**[^ledger-opp] [^marca-clasico] His other 2 goals against Barcelona were penalties for Juventus at Camp Nou on 8 Dec 2020. **[ledger]**[^ledger-goals]
- **Madrid derby:** **22 goals in 31 matches** against Atlético for Real Madrid, a derby record. **[ledger]**[^ledger-opp] [^wa-records]
- **Champions League knockout rounds:** **67 goals in 85 matches**, the most anyone has scored. That breaks down as 25 in the round of 16, 25 in quarter-finals, 13 in semi-finals and 4 in finals. **[ledger]**[^ledger-ucl] [^uefa-records]
- **Against the giants of Europe:** **10 Champions League goals against Juventus**, the most anyone has scored against a single opponent in the competition. He has also scored **9 in 8 matches against Bayern Munich**. **[ledger]**[^ledger-opp] [^wa-records]

**Fair point:** In La Liga he also scored plenty against mid-table and lower sides. That is what a 311-goal league career looks like. **[ledger]**[^ledger-comp] The claim being tested is "only against weak clubs", and the table above disproves it.

---

## Myth 4: "He disappears in big games"

The full case is on the **Big Games & Clutch** page. In short:

- He is the **only player to score in three Champions League finals**: 2008, 2014 and 2017 (twice in 2017).[^uefa-records] **[ledger]**[^ledger-ucl] He also scored the winning kick in the 2016 final shoot-out.[^wiki-career]
- **Club finals overall:** he has scored **24 goals in 37 club finals** (including super cups) and scored in 19 of them. **[ledger]**[^ledger-big]
- He scored the **winner in the 2011 Copa del Rey final** against Barcelona, a header in extra time.[^uefa-copa11] **[ledger]**[^ledger-goals]
- He scored a **hat-trick in the 2016 Club World Cup final**.[^fifa-cwc16] **[ledger]**[^ledger-goals]
- At **Euro 2016** he scored in the semi-final against Wales on Portugal's way to their first major trophy.[^uefa-wal16] [^wiki-career]
- He scored a **hat-trick in the 2019 Nations League semi-final**, then in 2025 scored the **semi-final winner against Germany** and the **equaliser in the final against Spain**. Portugal won both tournaments.[^uefa-sui19] [^uefa-unl25-sf] [^uefa-unl25-f]

**Fair point:** In World Cup knockout matches the record is thin. His **only World Cup knockout goal** is a penalty against Croatia in the 2026 round of 32, and commentators judged his 2026 World Cup as low-impact overall.[^wiki-career] (We cite Wikipedia for this because international `stage` is not in the ledger yet.) He went off injured after 25 minutes of the Euro 2016 final.[^wiki-career] He did not score at Euro 2024. **[ledger]**[^ledger-comp]

---

## Myth 5: "He was only good because of the teams around him"

Teammates change. The goals kept coming.

- He is the **first player to score 100 goals for four different clubs**: Real Madrid 450, Manchester United 145, Al-Nassr 134 and Juventus 101. **[ledger]**[^ledger-club] [^ap-100x4] Real Madrid's own site says 451; see Proven in Every League.
- He is the **first player to finish top scorer in four different top-flight leagues**: England, Spain, Italy and Saudi Arabia.[^wiki-career] [^goal-4leagues]
- He has won **league titles in four countries**: England (3), Spain (2), Italy (2) and Saudi Arabia (1).[^wiki-career]
- **Portugal had never won a major trophy before Euro 2016.** With him as captain they have since won Euro 2016 and two Nations Leagues.[^wiki-career] He is their all-time top scorer with 146 goals **[ledger]**[^ledger-summary], and their top World Cup scorer (11 goals, having passed Eusébio's nine).[^wiki-career] [^ledger-comp]
- At **Juventus** he set the club record for goals in a season: 37 in 2019–20. **[ledger]**[^ledger-season] [^wiki-career] At **Al-Nassr** he won the club's first league title since 2018–19, scoring twice on the final day.[^bein-title] [^espn-title]

**Fair point:** He has always played with very good teammates, and some critics, such as The Guardian's Jonathan Wilson, argue his mid-30s immobility made Juventus weaker as a team even while he kept scoring.[^wiki-career] Football is a team sport. "Only good because of his teams" is a different and much stronger claim, and the four-club, four-league record disproves it.

---

## Myth 6: "His Saudi goals don't count"

**They count.** They are official first-division and continental matches. Wikipedia's career table, the yardstick our ledger is reconciled against, includes them.[^wiki-career] **[ledger]**[^ledger-club]

- **Do the maths anyway:** take away all **134 Al-Nassr goals** and he still has **847 official goals**. **[ledger]**[^ledger-club]
- **The Saudi Pro League record** for goals in a season is **35**, which he scored in 2023–24 in 31 matches, at age 39. That broke Abderrazak Hamdallah's record of 34. **[ledger]**[^ledger-season] [^bbc-spl35] [^reuters-spl35]
- He won the league's Golden Boot in 2023–24 and 2024–25.[^wiki-career]
- **It is not a walkover.** In 2025–26 he scored 28 league goals **[ledger]**[^ledger-season] and still finished **third** in the scoring chart, behind Julián Quiñones (33) and Ivan Toney (32). His side won the title by two points over Al-Hilal on the last day.[^bein-title] [^espn-title]
- He has scored **15 goals in 19 AFC Champions League matches**, Asia's top club competition. **[ledger]**[^ledger-comp]
- He scored these goals between the ages of 37 and 41. He was born on 5 February 1985 and his first Al-Nassr match was on 22 January 2023. **[ledger]**[^ledger-club]

**Fair point:** The 6 goals from the **2023 Arab Club Champions Cup** are part of the 981, but FIFA does not recognise that competition. The ledger flags them and publishes **975** as the total without them. **[ledger]**[^ledger-career] [^espn-title] We show both numbers and let you pick.

[^ledger-career]: SIUUU Stats ledger (main @ 605a932), `careerSummary()` in `scripts/lib/stats.mjs` over `data/matches.csv` and `data/goals.csv`, served as `/api/v1/summary.json` → `career` (apps 1,341; goals 981; goals_excluding_non_fifa 975; penalty_goals 184; non_penalty_goals 797; free_kick_goals 55; winning_goals 322; equalisers 99; goals_from_age_30 518). Club rows: `eswiki-cr7-club-matches`, `wikipedia-club-season-articles`, `kaggle-sigmaborov-cr7-goals`. https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^ledger-kd]: `data/reconciliation/known-differences.json` → `wikipedia-club-career-apps` (1,109 vs 1,107: Sporting CP B ×2) and `data/METHODOLOGY.md` (decision b). https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040#Club
[^ledger-watford]: `data/manual/corrections.csv` → `eswiki-match-198-penalty` (Watford, 31 Jan 2007, 12'). The season article and Kaggle both mark it as a penalty, and the 2-of-3 rule applies. `data/reconciliation/expectations.json` → `career-penalty-goals` = 184. https://www.kaggle.com/datasets/sigmaborov/ronaldo-cr7-all-goals-goat
[^ledger-ucl]: SIUUU Stats ledger, `uclGoalsMain` (140) and `uclAppsMain` (183) in `stats.mjs`, `summary.json` → `club.champions_league`. Stage split by `stageClass()` over `matches.stage` (group 73, R16 25, QF 25, SF 13, final 4; 19 penalties). Including the 2005 qualifier at Debrecen: 141 goals in 187 apps. `records.csv` → `most-goals-uefa-champions-league`. https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^ledger-method]: `data/METHODOLOGY.md`, gap list: club body part is known for 563 of 835 goals. https://www.kaggle.com/datasets/sigmaborov/ronaldo-cr7-all-goals-goat
[^ledger-nt]: SIUUU Stats ledger, `nationalTeamsScoredAgainst` / `opponentsScoredAgainst()` in `stats.mjs` (49; the latest first goal is against Uzbekistan, 2026-06-23). Pinned in `data/reconciliation/expectations.json` → `national-teams-scored-against`. https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-club]: SIUUU Stats ledger, `clubSummary().clubs` / `goalsForClub()` in `stats.mjs`, `/api/v1/goals-by-club.json` (Sporting 31/5, Man Utd 346/145, Real Madrid 438/450, Juventus 134/101, Al-Nassr 158/134; Al-Nassr first match 2023-01-22). https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^ledger-season]: SIUUU Stats ledger, `/api/v1/goals-by-season.json` (club × season × competition), reconciled to enwiki's per-season table. https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040#Club
[^ledger-big]: SIUUU Stats ledger, `bigGameSplits()` in `stats.mjs`, `/api/v1/big-games.json` (club finals: 37 apps, 24 goals; super cups count as finals). Club stages come from `eswiki-cr7-club-matches`. https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes
[^wiki-career]: Wikipedia contributors, "Cristiano Ronaldo", revision 1381391040 (22 Oct 2026): lead, club/international sections and *Career statistics* (club table as of 20 Oct 2026). https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040
[^ledger-summary]: SIUUU Stats ledger, `/api/v1/summary.json` (international: 234 caps, 146 goals, 124 competitive, 23 penalties, 10 hat-tricks). Built from `wikipedia-cr7-intl-goals`, `rsssf-cronaldo-intlg`, `martj42-results`, `martj42-goalscorers`; penalty total cross-checked with `messivsronaldo-app-international`. https://en.wikipedia.org/wiki/List_of_international_goals_scored_by_Cristiano_Ronaldo · https://www.rsssf.org/miscellaneous/cronaldo-intlg.html · https://github.com/martj42/international_results
[^ledger-comp]: SIUUU Stats ledger, `/api/v1/goals-by-competition.json` (club and international scopes), built from `eswiki-cr7-club-matches`, `wikipedia-cr7-intl-goals` and `martj42-results`. https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-opp]: SIUUU Stats ledger, `/api/v1/goals-by-opponent.json` and `splitBy()` in `stats.mjs` (club and international scopes), built from `eswiki-cr7-club-matches`, `wikipedia-cr7-intl-goals`, `rsssf-cronaldo-intlg` and `martj42-results`. https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-goals]: SIUUU Stats ledger, `/api/v1/goals.json` (per-goal `minute`, `method`, `score_after`). Equalisers and winners are computed by `equalisers()` / `winningGoals()` in `stats.mjs`. International rows: `wikipedia-cr7-intl-goals`, `martj42-goalscorers`. Club rows: `eswiki-cr7-club-matches`. https://github.com/martj42/international_results
[^data-requests]: See `docs/content/data-requests.md` in this repo.
[^pens-mvr]: messivsronaldo.app, "Penalties: All Time Penalty Goals, Misses and Conversion Rates" (184 of 221; 18.76% of 981 goals). Cited only; no data copied. https://www.messivsronaldo.app/detailed-stats/penalties/
[^pens-pf]: Planet Football, "Messi v Ronaldo penalty record". Ronaldo figures used: 184 of 220 scored, 18.8% of total goals. https://www.planetfootball.com/quick-reads/cristiano-ronaldo-lionel-messi-man-utd-real-madrid-barcelona-penalty-records-stats-compared
[^pens-rs]: records.soccer, "Most penalties scored career" (183, last updated 21 Oct 2026; the one-goal gap is explained in the Watford note). https://records.soccer/r/en/penalty-doelpunten
[^wa-records]: Wikipedia contributors, "List of career achievements by Cristiano Ronaldo", revision 1379944509, *Records* table (stamped 25 Sep 2026). https://en.wikipedia.org/w/index.php?title=List_of_career_achievements_by_Cristiano_Ronaldo&oldid=1379944509#Records
[^wa-opp]: Same article and revision, *Goalscoring statistics*, "Goals by opponent" table. https://en.wikipedia.org/w/index.php?title=List_of_career_achievements_by_Cristiano_Ronaldo&oldid=1379944509#Goalscoring_statistics
[^uefa-records]: UEFA.com, "What UEFA records does Cristiano Ronaldo hold?" (140 UCL goals; 67 knockout goals; only player to score in three UCL finals). https://www.uefa.com/european-qualifiers/news/0253-0d820b46805f-b78ccae2c451-1000--what-uefa-records-does-cristiano-ronaldo-hold/
[^marca-clasico]: Marca, "Cristiano empata con Di Stéfano como el máximo goleador blanco en los Clásicos" (6 May 2018). https://www.marca.com/futbol/primera-division/2018/05/06/5aef5512268e3e47298b45bc.html
[^bbc-euro2004]: BBC Sport, "Portugal 2-1 Holland" (Euro 2004 semi-final, 30 Jun 2004). http://news.bbc.co.uk/sport2/hi/football/euro_2004/3844465.stm
[^uefa-swe13]: UEFA.com, "Ronaldo hat-trick takes Portugal past Sweden" (19 Nov 2013). https://www.uefa.com/european-qualifiers/news/0253-0d7eeff62152-38beffc43bd8-1000--ronaldo-hat-trick-takes-portugal-past-sweden/
[^uefa-copa11]: UEFA.com, "Ronaldo heads Madrid to Copa del Rey glory" (20 Apr 2011). https://www.uefa.com/news-media/news/01f0-0e77f1d6d2dd-c97c07dcf26b-1000--ronaldo-heads-madrid-to-copa-del-rey-glory/
[^fifa-cwc16]: FIFA, "Madrid see off spirited Kashima in electric extra time final" (18 Dec 2016). https://inside.fifa.com/tournaments/mens/clubworldcup/japan2016/news/ronaldo-hat-trick-sees-off-spirited-kashima-2860920
[^uefa-wal16]: UEFA.com, "Portugal reach EURO 2016 final as Wales fairy tale ends" (6 Jul 2016). https://www.uefa.com/uefaeuro/history/news/0253-0d81e2a4e79e-1fa42500c63d-1000--portugal-reach-euro-2016-final-as-wales-fairy-tale-ends/
[^uefa-sui19]: UEFA.com, "Portugal 3-1 Switzerland: Nations League at a glance" (5 Jun 2019). https://www.uefa.com/uefanationsleague/news/0253-0d82079bd44e-014936ea57ed-1000--portugal-3-1-switzerland-nations-league-at-a-glance/
[^uefa-unl25-sf]: UEFA.com, "Germany 1-2 Portugal highlights and report: Cristiano Ronaldo completes semi-final turnaround for Seleção" (4 Jun 2025). https://www.uefa.com/uefanationsleague/news/029a-1dec2ceeef0c-3334bd307573-1000--germany-1-2-portugal-highlights-and-report-cristiano-ronald/
[^uefa-unl25-f]: UEFA.com, "Portugal vs Spain highlights and report: Seleção create Nations League history with shoot-out success" (8 Jun 2025). https://www.uefa.com/uefanationsleague/news/029a-1df446a2d81d-0bc47d9324a5-1000--portugal-vs-spain-highlights-and-report-selecao-create-natio/
[^ap-100x4]: AP News, "Cristiano Ronaldo makes history with 100 goals for four clubs, but Al-Nassr loses Saudi Super Cup" (23 Aug 2025). https://apnews.com/article/ronaldo-100-goals-record-alnassr-2584cac92877eb9c6f3b04cf22d9efd6
[^goal-4leagues]: Goal.com, "'Proud' Cristiano Ronaldo thanks Man Utd for role in Golden Boot record" (May 2024). https://www.goal.com/en/lists/proud-cristiano-ronaldo-thanks-man-utd-golden-boot-record-al-nassr-superstar-more-goalscoring-history/bltd1a95d73f71bd357
[^bein-title]: beIN SPORTS, "Al-Nassr 4-1 Damac: Ronaldo scores brace to secure his first Pro League title" (21 May 2026). https://www.beinsports.com/en-us/soccer/articles/al-nassr-4-1-damac-ronaldo-scores-brace-to-secure-his-first-pro-league-title-2026-05-21
[^espn-title]: ESPN, "Cristiano Ronaldo wins first Saudi title as Al Nassr clinch league" (21 May 2026). https://global.espn.com/football/story/_/id/48635460/cristiano-ronaldo-first-saudi-title-al-nassr-clinch-league
[^bbc-spl35]: BBC Sport, "Cristiano Ronaldo: Al-Nassr forward sets new Saudi Pro League scoring record" (27 May 2024). https://www.bbc.co.uk/sport/football/articles/c9een3y52jpo
[^reuters-spl35]: Reuters, "Ronaldo breaks Saudi League's single-season scoring record" (27 May 2024). https://www.reuters.com/sports/soccer/ronaldo-breaks-saudi-leagues-single-season-scoring-record-2024-05-27/
