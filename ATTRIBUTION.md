# Attribution

Every ledger row lists the sources it came from in `source_ids` (see `data/sources.csv`). The upstream sources are:

| source_id | Source | Licence | Snapshot used |
|---|---|---|---|
| wikipedia-cr7-intl-goals | Wikipedia contributors, "List of international goals scored by Cristiano Ronaldo", https://en.wikipedia.org/wiki/List_of_international_goals_scored_by_Cristiano_Ronaldo | CC BY-SA 4.0 | revision 1376549197 |
| wikipedia-cristiano-ronaldo | Wikipedia contributors, "Cristiano Ronaldo", https://en.wikipedia.org/wiki/Cristiano_Ronaldo | CC BY-SA 4.0 | revision 1381391040 |
| rsssf-cronaldo-intlg | Roberto Mamrud / RSSSF, "Cristiano Ronaldo dos Santos Aveiro - Century of International Appearances", https://www.rsssf.org/miscellaneous/cronaldo-intlg.html | Free use with acknowledgement | last updated 7 Oct 2026 |
| martj42-results, martj42-goalscorers, martj42-shootouts | Mart Jürisoo, "international_results", https://github.com/martj42/international_results | CC0 1.0 | commit d5bd6de012c87e2f325de602ae77fe2f9ab61ef3 |
| eswiki-cr7-club-matches | Wikipedia (es) contributors, "Anexo:Partidos oficiales de Cristiano Ronaldo en clubes", https://es.wikipedia.org/wiki/Anexo:Partidos_oficiales_de_Cristiano_Ronaldo_en_clubes | CC BY-SA 4.0 | revision 175883102 |
| wikipedia-club-season-articles | Wikipedia contributors, club season articles ("2002–03 Sporting CP season" … "2026–27 Al-Nassr FC season"), https://en.wikipedia.org/wiki/Cristiano_Ronaldo#Club | CC BY-SA 4.0 | 27 pages; per-page revision ids in `data/raw/MANIFEST.json` |
| kaggle-sigmaborov-cr7-goals | sigmaborov, "Ronaldo CR7 All Goals GOAT" (Kaggle dataset), https://www.kaggle.com/datasets/sigmaborov/ronaldo-cr7-all-goals-goat | CC BY-SA 4.0 | version 1 (2026-03-09); seed only, every row reconciled with Wikipedia |
| messivsronaldo-app-international | messivsronaldo.app | Citation only (cross-check, no data copied) | accessed 2026-10-22 |

Changes made to upstream data are listed one by one in `data/manual/corrections.csv` (with the evidence), `data/manual/international-appearances-extra.csv`, and the club files `data/manual/club-appearances-extra.csv`, `club-date-checks.csv`, `club-neutral-results.csv` and `club-team-names.csv`.

Data was reproduced under CC BY-SA 4.0 with modifications (normalised IDs, merged sources, corrections). Thanks to the RSSSF, English and Spanish Wikipedia editors, Mart Jürisoo and sigmaborov (Kaggle).
