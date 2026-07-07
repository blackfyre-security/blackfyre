import chalk from "chalk";

/**
 * Renders a simple ASCII table with aligned columns.
 */
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce(
      (max, row) => Math.max(max, (row[i] ?? "").length),
      0,
    );
    return Math.max(h.length, maxData);
  });

  const separator = colWidths.map((w) => "-".repeat(w + 2)).join("+");
  const formatRow = (row: string[]): string =>
    row.map((cell, i) => ` ${(cell ?? "").padEnd(colWidths[i])} `).join("|");

  const lines: string[] = [];
  lines.push(formatRow(headers));
  lines.push(separator);
  for (const row of rows) {
    lines.push(formatRow(row));
  }
  return lines.join("\n");
}

/**
 * Returns a colored badge string.
 */
export function badge(
  text: string,
  color: "green" | "red" | "yellow" | "blue",
): string {
  const colorFn: Record<string, (s: string) => string> = {
    green: chalk.bgGreen.black,
    red: chalk.bgRed.white,
    yellow: chalk.bgYellow.black,
    blue: chalk.bgBlue.white,
  };
  return (colorFn[color] ?? chalk.white)(` ${text} `);
}

/**
 * Returns a color-coded score string.
 * Green for >80, yellow for 60-80, red for <60.
 */
export function score(value: number): string {
  const pct = `${value.toFixed(1)}%`;
  if (value > 80) return chalk.green(pct);
  if (value >= 60) return chalk.yellow(pct);
  return chalk.red(pct);
}

/**
 * Returns formatted JSON output.
 */
export function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// REAL IMPL (BLACKFYRE 2026-06): RFC-4180 CSV formatter for CLI list output (GAP-007).
// Escapes any field containing comma, double-quote, CR or LF by wrapping in
// double-quotes and doubling embedded quotes. Header row is derived from the
// union of object keys (preserving first-seen order so all columns are present
// even when records are sparse). Handles arrays of flat records as produced by
// the findings/scans/compliance endpoints; nested arrays (e.g. frameworks[],
// targets[], findingIds[]) are joined with "; " into a single cell, objects are
// JSON-encoded, and null/undefined render as empty cells.

/**
 * Escapes a single CSV field per RFC 4180.
 * A field is quoted when it contains a comma, double-quote, CR or LF;
 * embedded double-quotes are doubled.
 */
function csvEscapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts a single cell value into its CSV string representation
 * (before quoting/escaping).
 */
function csvStringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    // Flat arrays (string[]/number[]) flatten to a delimited list; anything
    // non-primitive inside is JSON-encoded so no data is silently dropped.
    return value
      .map((item) =>
        item === null || item === undefined
          ? ""
          : typeof item === "object"
            ? JSON.stringify(item)
            : String(item),
      )
      .join("; ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Returns RFC-4180 CSV output for an array of flat records.
 *
 * - Header row is the union of all record keys (first-seen order preserved).
 * - Fields containing comma/quote/newline are quoted and quote-escaped.
 * - Nested arrays are joined with "; "; nested objects are JSON-encoded.
 * - Uses CRLF line endings as specified by RFC 4180.
 * - An empty array yields an empty string (no spurious header row).
 *
 * @param rows Array of flat record objects (e.g. findings, scans, scores).
 * @param columns Optional explicit column order/subset; when omitted, columns
 *   are inferred from the records.
 */
export function csv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<string>,
): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  let keys: string[];
  if (columns && columns.length > 0) {
    keys = [...columns];
  } else {
    const seen = new Set<string>();
    keys = [];
    for (const row of rows) {
      if (row && typeof row === "object") {
        for (const k of Object.keys(row)) {
          if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }
      }
    }
  }

  // Degenerate case: records with no enumerable keys produce no columns.
  if (keys.length === 0) return "";

  const lines: string[] = [];
  lines.push(keys.map((k) => csvEscapeField(k)).join(","));
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>;
    lines.push(
      keys
        .map((k) => csvEscapeField(csvStringifyCell(record[k])))
        .join(","),
    );
  }
  // RFC 4180 uses CRLF as the record separator.
  return lines.join("\r\n");
}

/**
 * Returns a severity-colored string.
 */
export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.bgRed.white(` ${severity.toUpperCase()} `);
    case "high":
      return chalk.red(severity);
    case "medium":
      return chalk.yellow(severity);
    case "low":
      return chalk.blue(severity);
    case "info":
      return chalk.gray(severity);
    default:
      return severity;
  }
}

/**
 * Returns a status-colored string.
 */
export function statusColor(status: string): string {
  switch (status) {
    case "completed":
    case "ready":
    case "resolved":
    case "active":
      return chalk.green(status);
    case "running":
    case "generating":
    case "in_progress":
    case "configuring":
      return chalk.yellow(status);
    case "failed":
    case "cancelled":
    case "suspended":
      return chalk.red(status);
    case "queued":
    case "pending":
    case "open":
      return chalk.blue(status);
    default:
      return status;
  }
}
