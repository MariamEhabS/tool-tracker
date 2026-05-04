/**
 * Shared parsing primitives for v2 Create-page bulk methods. The
 * Prefix-Quantity exclude parser and the low-level CSV cell splitter live
 * here so each Create page (Tool Tracker, Equipment Code) reuses them
 * instead of duplicating. Higher-level CSV-to-row mapping is *not* shared
 * because each page maps to its own row shape; pages call `parseCsvLine`
 * to split each line, then map cells to their own type.
 */

/**
 * Parses the user's "skip numbers" string into a Set of integers within
 * [start, end]. Accepts comma-separated single numbers (`4`) and ranges
 * (`42-50`). Out-of-range and unparseable segments are silently dropped —
 * UX is forgiving rather than nitpicky since the field is optional and the
 * live preview already shows the resulting count.
 */
export function parseExcludeNumbers(
  raw: string,
  start: number,
  end: number,
): Set<number> {
  const out = new Set<number>();
  if (!raw.trim()) return out;
  for (const seg of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (seg.includes("-")) {
      const [loStr, hiStr] = seg.split("-").map((s) => s.trim());
      const lo = Number(loStr);
      const hi = Number(hiStr);
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        const a = Math.min(lo, hi);
        const b = Math.max(lo, hi);
        for (let n = a; n <= b; n++) {
          if (n >= start && n <= end) out.add(n);
        }
      }
    } else {
      const n = Number(seg);
      if (Number.isFinite(n) && n >= start && n <= end) out.add(n);
    }
  }
  return out;
}

/**
 * Parses one CSV line into cells. Handles double-quoted values (with the
 * doubled `""` escape) so Excel/Sheets exports that quote fields containing
 * commas don't get split incorrectly.
 *
 * Pure cell splitting — column mapping is each page's responsibility.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Splits a CSV file's text into a header row + data rows. Trims trailing
 * whitespace, drops empty lines, and runs each line through `parseCsvLine`.
 * Returns `null` when the file has no usable content. The caller maps the
 * header to its own column indexes and projects each data row.
 */
export function splitCsvIntoLines(text: string): string[][] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  return lines.map((line) => parseCsvLine(line));
}
