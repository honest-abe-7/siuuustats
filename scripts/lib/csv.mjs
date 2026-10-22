// CSV helpers. All ledger CSVs are UTF-8, comma-separated, RFC 4180 quoting, header row first.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

/** Read a CSV file. Returns { header: string[], rows: Record<string,string>[] } with raw string values. */
export function readCsv(path) {
  const text = readFileSync(path, "utf8");
  const records = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: false });
  if (records.length === 0) return { header: [], rows: [] };
  const [header, ...body] = records;
  const rows = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  return { header, rows };
}

/** Write rows (objects) to CSV using the given column order. null/undefined -> "", arrays -> ";"-joined, booleans -> true/false. */
export function writeCsv(path, columns, rows, sep = ";") {
  mkdirSync(dirname(path), { recursive: true });
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.join(sep);
      return String(v);
    })
  );
  writeFileSync(path, stringify([columns, ...body]), "utf8");
}
