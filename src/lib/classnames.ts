/**
 * @fileoverview Lightweight classname utilities and reusable style constants.
 */

/**
 * Joins class name parts, filtering out falsy values.
 * Lightweight alternative to the `classnames` / `clsx` packages.
 * @param parts - Strings or falsy values to join with spaces
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Centralized Tailwind style bundles (CVA-style lightweight helpers). */
export const styles = {
  // Reusable tile/panel container used across selection cards
  tilePanel:
    "rounded-2xl border border-gray-200 backdrop-blur p-5 flex flex-col",
  // Small icon tile used in headers of selection cards
  iconTileBrand50:
    "rounded-lg p-4 bg-brand-50 text-brand-700 flex items-center justify-center",
  iconTileBrand100:
    "rounded-lg p-4 bg-brand-100 text-brand-700 flex items-center justify-center",
  // Focus ring bundle for brand focus state
  focusRingBrand:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
  // Generic chip/badge fallback when not using Badge component
  chipDefault:
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700",
};
