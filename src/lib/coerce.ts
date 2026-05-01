/**
 * Type coercion utilities for safely handling unknown API data.
 * These helpers keep strict TS while allowing deterministic UI mapping.
 */

/** Type guard: checks if value is a non-array object */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Returns the value as Record if it is one, otherwise undefined */
export function asRecord(v: unknown): Record<string, unknown> | undefined {
  return isRecord(v) ? v : undefined;
}

/** Coerces unknown to string with fallback */
export function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

/** Coerces unknown to number with fallback */
export function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Coerces unknown to boolean */
export function asBoolean(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

/**
 * Returns value only if it's a valid input for formatDate().
 * Accepts string, number, Date, null, or undefined.
 */
export function asDateLike(
  v: unknown,
): string | number | Date | null | undefined {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return v;
  return undefined;
}

/** Gets a string property from a record with fallback */
export function getString(
  r: Record<string, unknown> | undefined | null,
  key: string,
  fallback = "",
): string {
  return asString(r?.[key], fallback);
}

/** Gets a nested record property */
export function getRecord(
  r: Record<string, unknown> | undefined | null,
  key: string,
): Record<string, unknown> | undefined {
  return asRecord(r?.[key]);
}

/** Gets array property, returns empty array if not an array */
export function getArray(
  r: Record<string, unknown> | undefined | null,
  key: string,
): unknown[] {
  const v = r?.[key];
  return Array.isArray(v) ? v : [];
}

/** Gets first element of an array property as a record */
export function getFirstRecord(
  r: Record<string, unknown> | undefined | null,
  key: string,
): Record<string, unknown> | undefined {
  const arr = getArray(r, key);
  return asRecord(arr[0]);
}
