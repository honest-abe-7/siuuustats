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

test("daily refresh delegates fetching to npm run snapshots:refresh (flags exist in the script)", () => {
  const t = code("daily-refresh.yml");
  assert.match(t, /run: npm run snapshots:refresh -- --only=intl$/m);
  assert.match(t, /run: npm run snapshots:refresh -- --only=club$/m);
  const pkg = JSON.parse(repoFile("package.json"));
  assert.equal(pkg.scripts["snapshots:refresh"], "node scripts/ingest/fetch-snapshots.mjs");
  const fetcher = repoFile("scripts/ingest/fetch-snapshots.mjs");
  assert.match(fetcher, /startsWith\("--only="\)/);
  assert.match(fetcher, /want\("intl"\)/);
  assert.match(fetcher, /want\("club"\)/);
  // backup before, verify after
  assert.ok(t.indexOf("snapshot-guard.mjs save") < t.indexOf("--only=intl"));
  assert.ok(t.indexOf("--only=club") < t.indexOf("snapshot-guard.mjs verify"));
  // the pipeline no longer fetches snapshots itself
  assert.doesNotMatch(t, /refresh-snapshots\.mjs/);
});

test("daily refresh has a schedule, a weekly keepalive and opens a PR", () => {
  const t = wf("daily-refresh.yml");
  assert.match(t, /schedule:/);
  assert.match(t, /actions\/workflows\/.*\/enable/);
  assert.match(t, /create-pull-request/);
});
