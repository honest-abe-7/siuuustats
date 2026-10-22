import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoalCell, parseResult, parseAssisters, clubOn } from "../scripts/ingest/club.mjs";

test("parseGoalCell reads eswiki goal cells, including sloppy variants", () => {
  assert.deepEqual(parseGoalCell("1-0 (48'tl), 3-0 (70') y 5-0 (90+2'p)").map((g) => [g.a, g.b, g.minute, g.added, g.marker]), [
    [1, 0, 48, null, "tl"],
    [3, 0, 70, null, null],
    [5, 0, 90, 2, "p"],
  ]);
  assert.equal(parseGoalCell("2-2' (68'p)")[0].marker, "p");
  assert.equal(parseGoalCell("2-1 (26'tl?)")[0].marker, "tl");
  assert.deepEqual(parseGoalCell("-"), []);
});

test("parseResult handles extra time, shootouts and awarded results", () => {
  assert.deepEqual(parseResult("0 - 0 (4-5)p"), { a: 0, b: 0, extraTime: false, pens: [4, 5], awarded: null });
  assert.equal(parseResult("4-3(te)").extraTime, true);
  assert.deepEqual(parseResult("2-1, 0-3*").awarded, [0, 3]);
});

test("parseAssisters splits on commas, y and e", () => {
  assert.deepEqual(parseAssisters("-- y Fernández"), [null, "Fernández"]);
  assert.equal(parseAssisters("Benzema e Bale").length, 2);
});

test("clubOn maps dates to Ronaldo's club", () => {
  assert.equal(clubOn("2003-08-16"), "manchester-united");
  assert.equal(clubOn("2021-09-11"), "manchester-united");
  assert.equal(clubOn("2026-10-20"), "al-nassr");
});
