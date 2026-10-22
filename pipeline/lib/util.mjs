import { createHash } from "node:crypto";
import { writeFileSync, renameSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Write via temp file + rename so a crash never leaves a half-written snapshot. */
export function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

export const readIfExists = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

export function readJson(path, fallback) {
  const t = readIfExists(path);
  return t === null ? fallback : JSON.parse(t);
}

export const writeJson = (path, obj) => atomicWrite(path, JSON.stringify(obj, null, 2) + "\n");

/** JSON.stringify with sorted object keys, for order-independent digests. */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

export const digestOf = (v) => sha256(stableStringify(v));

/** Parse CLI flags of the form --key value / --flag. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

export function setGithubOutput(values) {
  const f = process.env.GITHUB_OUTPUT;
  if (!f) return;
  const lines = Object.entries(values).map(([k, v]) => `${k}=${String(v).replace(/\n/g, " ")}`);
  writeFileSync(f, lines.join("\n") + "\n", { flag: "a" });
}

export const rel = (root, p) => join(root, p);
