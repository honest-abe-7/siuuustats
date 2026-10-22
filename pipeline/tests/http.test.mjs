import { test } from "node:test";
import assert from "node:assert/strict";
import { stubFetch, fakeClient } from "./helpers.mjs";
import { HttpError, retryAfterMs } from "../lib/http.mjs";
import { USER_AGENT } from "../config.mjs";

test("sends the identifying User-Agent (and Api-User-Agent for Wikimedia)", async () => {
  const { fetchImpl, calls } = stubFetch([[/./, () => ({ body: "ok" })]]);
  const { client } = fakeClient(fetchImpl);
  await client.get("https://en.wikipedia.org/x");
  assert.equal(calls[0].headers["User-Agent"], USER_AGENT);
  assert.equal(calls[0].headers["Api-User-Agent"], USER_AGENT);
  assert.match(USER_AGENT, /siuuustats/);
});

test("throttles requests to the same host but not across hosts", async () => {
  const { fetchImpl } = stubFetch([[/./, () => ({ body: "ok" })]]);
  const { client, sleeps } = fakeClient(fetchImpl, { intervals: { "a.test": 3000, default: 1000 } });
  await client.get("https://a.test/1");
  await client.get("https://a.test/2");
  await client.get("https://b.test/1");
  assert.deepEqual(sleeps, [3000]);
});

test("retries 503 with backoff, then succeeds", async () => {
  let n = 0;
  const { fetchImpl } = stubFetch([[/./, () => (++n < 3 ? { status: 503, body: "busy" } : { body: "ok" })]]);
  const { client, sleeps } = fakeClient(fetchImpl, { intervals: { default: 0 } });
  const r = await client.get("https://x.test/");
  assert.equal(r.text, "ok");
  assert.equal(n, 3);
  assert.deepEqual(sleeps.filter((s) => s >= 2000), [2000, 4000]);
});

test("honours Retry-After on 429 (capped) and gives up after the retry budget", async () => {
  const { fetchImpl, calls } = stubFetch([[/./, () => ({ status: 429, body: "slow down", headers: { "retry-after": "600" } })]]);
  const { client, sleeps } = fakeClient(fetchImpl, { intervals: { default: 0 }, retries: 2 });
  await assert.rejects(client.get("https://x.test/"), (e) => e instanceof HttpError && e.status === 429);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps.filter((s) => s > 0), [65000, 65000]);
});

test("does not retry a 404", async () => {
  const { fetchImpl, calls } = stubFetch([]);
  const { client } = fakeClient(fetchImpl);
  await assert.rejects(client.get("https://x.test/missing"), /HTTP 404/);
  assert.equal(calls.length, 1);
});

test("retries network errors", async () => {
  let n = 0;
  const { fetchImpl } = stubFetch([[/./, () => (++n === 1 ? new TypeError("fetch failed") : { body: "ok" })]]);
  const { client } = fakeClient(fetchImpl);
  assert.equal((await client.get("https://x.test/")).text, "ok");
});

test("memoises identical GETs within a run (one request per URL)", async () => {
  const { fetchImpl, calls } = stubFetch([[/./, () => ({ body: '{"a":1}' })]]);
  const { client } = fakeClient(fetchImpl);
  await client.getJson("https://x.test/j");
  const r = await client.getJson("https://x.test/j");
  assert.deepEqual(r.json, { a: 1 });
  assert.equal(calls.length, 1);
  assert.equal(client.stats().requests, 1);
});

test("retryAfterMs parses seconds and HTTP dates", () => {
  assert.equal(retryAfterMs("5"), 5000);
  assert.equal(retryAfterMs(null), null);
  assert.ok(retryAfterMs(new Date(Date.now() + 10000).toUTCString()) > 0);
});
