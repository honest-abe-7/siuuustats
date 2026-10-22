// Cheap structural guards on the workflow files (actionlint does the real linting).
import { test } from "node:test";
import assert from "node:assert/strict";
import { repoFile } from "./helpers.mjs";

const wf = (n) => repoFile(`.github/workflows/${n}`);
const code = (n) => wf(n).replace(/(^|\s)#.*$/gm, "$1"); // without YAML comments
const ALL = ["ci.yml", "daily-refresh.yml", "deploy.yml"];

test("every workflow starts from empty top-level permissions", () => {
  for (const n of ALL) assert.match(wf(n), /^permissions: \{\}$/m, n);
});

test("nothing enables auto-merge or pushes to main", () => {
  for (const n of ALL) {
    assert.doesNotMatch(code(n), /auto-merge|automerge|merge --auto|gh pr merge/i, n);
    assert.doesNotMatch(code(n), /git push/i, n);
  }
});

test("Node 24 with npm cache everywhere Node is set up", () => {
  for (const n of ALL) {
    const t = wf(n);
    assert.match(t, /node-version: 24/, n);
    assert.match(t, /cache: npm/, n);
  }
});

test("deploy only references the two Cloudflare secrets and the siuuustats project", () => {
  const t = wf("deploy.yml");
  assert.deepEqual([...new Set(t.match(/secrets\.[A-Z_]+/g))].sort(), ["secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN"]);
  assert.match(t, /--project-name=siuuustats/);
  assert.match(t, /branches: \[main\]/);
});

test("daily refresh has a schedule, a weekly keepalive and opens a PR", () => {
  const t = wf("daily-refresh.yml");
  assert.match(t, /schedule:/);
  assert.match(t, /actions\/workflows\/.*\/enable/);
  assert.match(t, /create-pull-request/);
});
