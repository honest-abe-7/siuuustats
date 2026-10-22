// Loads the ledger (all tables in schema/tables.json) into typed rows.
// This is the read interface other subsystems (stats engine, web build, pipeline) should use.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv } from "./csv.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadRegistry(root = ROOT) {
  const reg = JSON.parse(readFileSync(join(root, "schema", "tables.json"), "utf8"));
  for (const t of reg.tables) {
    t.jsonSchema = JSON.parse(readFileSync(join(root, t.schema), "utf8"));
    t.columns = Object.keys(t.jsonSchema.properties);
  }
  return reg;
}

function typesOf(prop) {
  return Array.isArray(prop.type) ? prop.type : [prop.type];
}

/** Convert one raw CSV string to the JSON type declared in the schema. Unparseable values are returned as-is so schema validation reports them. */
export function coerceValue(raw, prop, sep = ";") {
  const types = typesOf(prop);
  if (raw === "" && types.includes("null")) return null;
  if (types.includes("array")) return raw === "" ? [] : raw.split(sep).map((s) => s.trim()).filter(Boolean);
  if (types.includes("integer")) return /^-?\d+$/.test(raw) ? Number(raw) : raw;
  if (types.includes("number")) return raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  if (types.includes("boolean")) return raw === "true" ? true : raw === "false" ? false : raw;
  return raw;
}

export function coerceRow(rawRow, table, sep = ";") {
  const out = {};
  for (const [k, v] of Object.entries(rawRow)) {
    const prop = table.jsonSchema.properties[k];
    out[k] = prop ? coerceValue(v, prop, sep) : v;
  }
  return out;
}

/**
 * Load every table. Returns { registry, tables: { [name]: typedRows[] }, headers: { [name]: string[] }, missing: string[] } (missing also lists unparseable files).
 * Pass `overrides` ({ [name]: rawRows[] }) to validate in-memory data (used by tests).
 */
export function loadLedger(root = ROOT, overrides = {}) {
  const registry = loadRegistry(root);
  const tables = {};
  const headers = {};
  const missing = [];
  for (const t of registry.tables) {
    let raw;
    if (overrides[t.name]) {
      raw = { header: t.columns, rows: overrides[t.name] };
    } else {
      const path = join(root, t.file);
      if (!existsSync(path)) {
        missing.push(t.file);
        tables[t.name] = [];
        headers[t.name] = [];
        continue;
      }
      try {
        raw = readCsv(path);
      } catch (e) {
        missing.push(`${t.file} (unparseable: ${e.message})`);
        tables[t.name] = [];
        headers[t.name] = [];
        continue;
      }
    }
    headers[t.name] = raw.header;
    tables[t.name] = raw.rows.map((r) => coerceRow(r, t, registry.listSeparator));
  }
  return { registry, tables, headers, missing };
}
