/**
 * @fileoverview Display formatting functions for bytes, dates, and counts.
 * All formatters return "-" or "0" when given null/undefined input.
 */

/**
 * Formats a byte count into a compact human-readable string (e.g., "2.5 MB").
 * Returns "-" for undefined, null, or non-positive values.
 * @param bytes - The number of bytes to format
 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  const precision = size < 10 && unitIndex > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

/**
 * Formats a date value into "Mon DD, YYYY" format (e.g., "Jan 15, 2025").
 * Accepts strings, timestamps, Date objects, null, or undefined.
 * @returns Formatted date string, or "-" for invalid/missing input.
 */
export function formatDate(value?: string | number | Date | null): string {
  if (value === undefined || value === null) return "-";
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(Date.parse(value));
  if (Number.isNaN(d.getTime())) return "-";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Formats a date into a short locale-dependent form (e.g., "Jan 15").
 * Omits the year for compact display in tables and lists.
 * @returns Formatted short date string, or "-" for invalid/missing input.
 */
export function formatShortDate(value?: string | number | Date | null): string {
  if (value === undefined || value === null) return "-";
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(Date.parse(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Formats a numeric count with "k" / "M" suffixes for large values.
 * Returns "0" for null/undefined.
 * @returns e.g., "42", "1.5k", "2.3M"
 */
export function formatCount(value?: number | null): string {
  if (value === undefined || value === null) return "0";
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
