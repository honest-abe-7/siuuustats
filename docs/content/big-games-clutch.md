---
title: "Big Games & Clutch"
slug: big-games
description: "Finals, knockout rounds and match-winners: where Cristiano Ronaldo's goals came when the stakes were highest, with every claim sourced."
kind: argument
status: draft
data_as_of: 2026-10-22
ledger_endpoints: [goals, matches, goals-by-competition, records]
ledger_source_ids: [wikipedia-cr7-intl-goals, martj42-results, martj42-goalscorers, rsssf-cronaldo-intlg]
unverified_count: 0
---

# Big Games & Clutch

> **Argument page.** International numbers marked **[ledger]** come from the SIUUU Stats match-by-match ledger. Numbers marked **[ledger, provisional]** use a definition that is not yet in the stats engine (see data-requests.md). Club numbers are cited from UEFA, FIFA, Wikipedia and the press until the club ledger ships.

The test of greatness is not how many you score, but **when**. Here is the record in finals, in knockout ties and in matches decided by a single goal.

---

## 1. Champions League finals

| Final | Result | Ronaldo |
|---|---|---|
| 2008, Manchester United v Chelsea | 1–1, United won on penalties | **Scored United's only goal**[^wiki] |
| 2014, Real Madrid v Atlético | 4–1 after extra time | **Scored**[^wiki] [^uefa-honour] |
| 2016, Real Madrid v Atlético | Won on penalties | **Scored the winning shoot-out kick**[^wiki] |
| 2017, Real Madrid v Juventus | 4–1 | **Scored twice**[^wiki] |
| 2018, Real Madrid v Liverpool | 3–1 | Won his fifth title, the first player to win five[^wiki] |

- He is the **only player to score in three Champions League finals**.[^uefa-records]
- He has won **five Champions Leagues** (2008, 2014, 2016, 2017 and 2018).[^uefa-honour]

## 2. Champions League knockout rounds: the record book

- **Most goals in Champions League knockout rounds: 67.**[^uefa-records]
- **Most in quarter-finals (25) and semi-finals (13).**[^wa-records]
- He is the first player to score **hat-tricks in consecutive Champions League knockout matches**.[^wa-records] That was 2016–17: a hat-trick against Bayern in the quarter-final second leg, then another against Atlético in the semi-final first leg.[^uefa-ucl100] [^uefa-atm17]
- **2016 quarter-final, Wolfsburg:** Madrid lost the first leg 2–0. He scored a **hat-trick in the 3–0 return** to send them through.[^uefa-wob16]
- **2017 quarter-final, Bayern:** He scored both goals in the 2–1 first-leg win, becoming the first player to reach 100 goals in UEFA club competition.[^wiki] In the return leg his hat-trick took him to **100 Champions League goals**.[^uefa-ucl100]
- **2018 quarter-final, Juventus:** He scored twice in a 3–0 away win. The second was the bicycle kick that earned a standing ovation from the home fans.[^wiki]
- **2019 round of 16, Atlético:** Juventus were 2–0 down from the first leg. He scored a **hat-trick in the 3–0 second leg**.[^wiki]

## 3. Other club finals and trophy-deciders

- **2004 FA Cup final:** scored the opening goal of United's 3–0 win over Millwall.[^wiki]
- **2006 League Cup final:** scored United's third goal in the 4–0 win over Wigan.[^wiki]
- **2011 Copa del Rey final:** scored the **winner against Barcelona**, a header in extra time.[^uefa-copa11]
- **2016 Club World Cup final:** scored a **hat-trick** as Madrid beat Kashima Antlers 4–2 after extra time.[^fifa-cwc16]
- **2017 Club World Cup final:** scored in the 1–0 win over Grêmio. He was the first player to score in consecutive Club World Cup finals, and holds the competition's scoring record with 7 goals.[^wa-records]
- **2018 Supercoppa Italiana (played January 2019):** scored the only goal against AC Milan, a header.[^wiki]
- **2023 Arab Club Champions Cup final:** scored **both goals** in Al-Nassr's 2–1 extra-time win over Al-Hilal.[^wiki]
- **Saudi Pro League 2025–26, final day:** scored **twice in a 4–1 win over Damac** to clinch the title.[^bein-title] [^espn-title]

## 4. Portugal in tournaments

- **Euro 2004 semi-final:** opened the scoring with a header in the 2–1 win over the Netherlands.[^bbc-euro2004]
- **Euro 2012 quarter-final:** scored the **79th-minute winner** against the Czech Republic, a header.[^uefa-cze12] He finished as the tournament's joint top scorer.[^wiki]
- **Euro 2016 semi-final:** scored a header in the 2–0 win over Wales, and his shot was turned in by Nani for the second. Portugal went on to win their **first major trophy**.[^uefa-wal16] [^wiki]
- **Euro 2020:** won the **Golden Boot**.[^wiki]
- **Most goals at European Championship finals tournaments: 14.** **[ledger]**[^ledger-records] [^wa-records]
- **2014 World Cup play-off against Sweden:** scored **all four of Portugal's goals** over the two legs.[^wiki] That includes a hat-trick in Stockholm (50', 77', 79'), the last of which made it 3–2.[^uefa-swe13] **[ledger]**[^ledger-goals]
- **2018 World Cup:** a hat-trick against Spain in a 3–3 draw, finished with an **88th-minute equaliser**. That made him the oldest player to score a World Cup hat-trick.[^wiki] [^ledger-goals] He then scored the only goal against Morocco.[^wiki]
- **2019 Nations League semi-final:** **hat-trick** against Switzerland (25', 88', 90'). Portugal won the tournament.[^uefa-sui19] [^wiki-list]
- **2025 Nations League Finals:** scored the **semi-final winner against Germany** and the **equaliser in the final against Spain** (2–2). Portugal won 5–3 on penalties.[^uefa-unl25-sf] [^uefa-unl25-f] He was top scorer at both the 2019 and 2025 Finals (shared in 2025).[^wiki]
- **2026 World Cup:** became the **first player to score at six World Cups**, with two goals against Uzbekistan.[^reuters-6wc] [^ap-6wc]

## 5. Match-winners, equalisers and late goals for Portugal **[ledger, provisional]**

The ledger stores the score straight after every goal (`score_after`). From that we can count the goals that decided matches. These definitions are not yet in `stats.mjs`, so treat the numbers as provisional (see data-requests.md).

| Measure (international, 2003–2026) | Count |
|---|---|
| **Winning goals**: the goal that put Portugal one ahead of the opponent's final total, in a match Portugal won | **52** of 146 |
| …of which in competitive matches | 45 |
| …of which in matches won by one goal | 22 |
| …of which penalties | 8 |
| **Equalisers**: the goal left the score level | 18 |
| Goals in the 80th minute or later (out of 124 goals with a recorded minute) | 25 |

Source for all rows: SIUUU Stats ledger.[^ledger-goals]

Winning goals at major tournaments and Nations League Finals, straight from the ledger:[^ledger-goals]

- Euro 2008 v Czech Republic (63', made it 2–1 in a 3–1 win)
- Euro 2012 v Netherlands (74', 2–1) and v Czech Republic (79', 1–0, quarter-final)
- 2014 World Cup v Ghana (80', 2–1)
- Euro 2016 v Wales (50', semi-final)
- 2018 World Cup v Morocco (4', 1–0)
- 2019 Nations League Finals v Switzerland (88', semi-final)
- 2025 Nations League Finals v Germany (68', semi-final)
- 2026 World Cup v Uzbekistan (6', 5–0)

One example of late goals: on 1 September 2021 against the Republic of Ireland, Portugal were 1–0 down. He scored in the 89th and 90th minutes (as recorded in the ledger) to turn the match into a 2–1 win. Those were his 110th and 111th international goals.[^ledger-goals] [^wiki-list]

---

## Fair points

- **World Cup knockout matches** are his weak spot. His only World Cup knockout goal is a **penalty against Croatia in the 2026 round of 32**. Portugal went out to Spain in the next round, and commentators rated his 2026 tournament as low-impact.[^wiki]
- In the **Euro 2016 final** he went off injured after 25 minutes. Portugal won without him on the pitch.[^wiki]
- He **did not score at Euro 2024**. **[ledger]**[^ledger-comp] He did not score in the **2018 Champions League final** either. UEFA lists his finals goals as 2008, 2014 and 2017 only.[^uefa-records]

The case does not need these hidden. Across five Champions League titles, three finals with a goal and 67 knockout goals, the big-game record holds up.

[^wiki]: Wikipedia contributors, "Cristiano Ronaldo", revision 1381391040 (22 Oct 2026). https://en.wikipedia.org/w/index.php?title=Cristiano_Ronaldo&oldid=1381391040
[^wiki-list]: Wikipedia contributors, "List of international goals scored by Cristiano Ronaldo", revision 1376549197 (`wikipedia-cr7-intl-goals`). https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^wa-records]: Wikipedia contributors, "List of career achievements by Cristiano Ronaldo", revision 1379944509, *Records* table. https://en.wikipedia.org/w/index.php?title=List_of_career_achievements_by_Cristiano_Ronaldo&oldid=1379944509#Records
[^uefa-records]: UEFA.com, "What UEFA records does Cristiano Ronaldo hold?" https://www.uefa.com/european-qualifiers/news/0253-0d820b46805f-b78ccae2c451-1000--what-uefa-records-does-cristiano-ronaldo-hold/
[^uefa-honour]: UEFA.com, "Cristiano Ronaldo honoured as UEFA Champions League All-Time Top Scorer" (29 Aug 2024). https://www.uefa.com/uefachampionsleague/news/0290-1bba8222dbee-c67bbff473ca-1000--cristiano-ronaldo-honoured-as-uefa-champions-league-all-/
[^uefa-ucl100]: UEFA.com, "Champions League all-time top scorers" (Ronaldo's 100th UCL goal came with a hat-trick against Bayern on 18 Apr 2017). https://www.uefa.com/uefachampionsleague/news/0257-0e910cf2494a-5185150de9d4-1000--champions-league-all-time-top-scorers-cristiano-ronaldo-/
[^uefa-atm17]: UEFA.com, "Ronaldo hat-trick leaves Real Madrid on brink of final" (2 May 2017). https://www.uefa.com/uefachampionsleague/news/0239-0e96d80bccab-59a3cd0ec78a-1000--ronaldo-hat-trick-leaves-real-madrid-on-brink-of-final/
[^uefa-wob16]: UEFA.com, "Ronaldo hat-trick inspires Madrid to comeback win" (12 Apr 2016). https://www.uefa.com/uefachampionsleague/news/022c-0e93fa8a4963-8b14fd14f141-1000--ronaldo-hat-trick-inspires-madrid-to-comeback-win/
[^uefa-copa11]: UEFA.com, "Ronaldo heads Madrid to Copa del Rey glory". https://www.uefa.com/news-media/news/01f0-0e77f1d6d2dd-c97c07dcf26b-1000--ronaldo-heads-madrid-to-copa-del-rey-glory/
[^fifa-cwc16]: FIFA, "Madrid see off spirited Kashima in electric extra time final". https://inside.fifa.com/tournaments/mens/clubworldcup/japan2016/news/ronaldo-hat-trick-sees-off-spirited-kashima-2860920
[^bein-title]: beIN SPORTS, "Al-Nassr 4-1 Damac: Ronaldo scores brace to secure his first Pro League title" (21 May 2026). https://www.beinsports.com/en-us/soccer/articles/al-nassr-4-1-damac-ronaldo-scores-brace-to-secure-his-first-pro-league-title-2026-05-21
[^espn-title]: ESPN, "Cristiano Ronaldo wins first Saudi title as Al Nassr clinch league" (21 May 2026). https://global.espn.com/football/story/_/id/48635460/cristiano-ronaldo-first-saudi-title-al-nassr-clinch-league
[^bbc-euro2004]: BBC Sport, "Portugal 2-1 Holland" (30 Jun 2004). http://news.bbc.co.uk/sport2/hi/football/euro_2004/3844465.stm
[^uefa-cze12]: UEFA.com, "Ronaldo header against Czech Republic puts Portugal into UEFA EURO 2012 last four". https://www.uefa.com/uefaeuro/history/news/0254-0d7e27aed71c-f49c9ce81582-1000--ronaldo-header-against-czech-republic-puts-portugal-into/
[^uefa-wal16]: UEFA.com, "Portugal reach EURO 2016 final as Wales fairy tale ends". https://www.uefa.com/uefaeuro/history/news/0253-0d81e2a4e79e-1fa42500c63d-1000--portugal-reach-euro-2016-final-as-wales-fairy-tale-ends/
[^uefa-swe13]: UEFA.com, "Ronaldo hat-trick takes Portugal past Sweden" (19 Nov 2013). https://www.uefa.com/european-qualifiers/news/0253-0d7eeff62152-38beffc43bd8-1000--ronaldo-hat-trick-takes-portugal-past-sweden/
[^uefa-sui19]: UEFA.com, "Portugal 3-1 Switzerland: Nations League at a glance". https://www.uefa.com/uefanationsleague/news/0253-0d82079bd44e-014936ea57ed-1000--portugal-3-1-switzerland-nations-league-at-a-glance/
[^uefa-unl25-sf]: UEFA.com, "Germany 1-2 Portugal highlights and report". https://www.uefa.com/uefanationsleague/news/029a-1dec2ceeef0c-3334bd307573-1000--germany-1-2-portugal-highlights-and-report-cristiano-ronald/
[^uefa-unl25-f]: UEFA.com, "Portugal vs Spain highlights and report: Seleção create Nations League history with shoot-out success". https://www.uefa.com/uefanationsleague/news/029a-1df446a2d81d-0bc47d9324a5-1000--portugal-vs-spain-highlights-and-report-selecao-create-natio/
[^reuters-6wc]: Reuters, "Ronaldo becomes first player to score at six World Cup finals" (23 Jun 2026). https://www.reuters.com/sports/soccer/ronaldo-becomes-first-player-score-six-world-cup-finals-2026-06-23/
[^ap-6wc]: AP News, "Ronaldo becomes first player to score in six World Cups with two goals against Uzbekistan". https://apnews.com/article/ronaldo-world-cup-score-b511151c5a78afb738e8249c07d30aef
[^ledger-goals]: SIUUU Stats ledger, `/api/v1/goals.json` (`minute`, `score_after`, `method` per goal), built from `wikipedia-cr7-intl-goals` and `martj42-goalscorers` (minutes recorded for competitive goals). https://github.com/martj42/international_results
[^ledger-comp]: SIUUU Stats ledger, `/api/v1/goals-by-competition.json` and `matches.json`. https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
[^ledger-records]: SIUUU Stats ledger, `/api/v1/records.json` → `most-goals-euro-finals` (14, compute_fn `goalsInCompetition:uefa-euro`). https://en.wikipedia.org/w/index.php?title=List_of_international_goals_scored_by_Cristiano_Ronaldo&oldid=1376549197
