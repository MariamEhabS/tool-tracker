import type { BadgeVariant } from "@/types/Badge.types";

/**
 * Returns a badge color variant for a project status string.
 *
 * Used by project detail, group detail, and my-qrcodes pages.
 */
export function projectStatusBadgeVariant(s?: string): BadgeVariant {
  switch (s) {
    case "active":
      return "green";
    case "completed":
      return "blue";
    case "on-hold":
      return "yellow";
    default:
      return "gray";
  }
}

/**
 * Returns a badge color variant for a QR code's group type.
 *
 * Arrangement groups are always blue; equipment groups are red.
 */
export function groupBadgeVariant(
  t: "arrangement" | "equipment" | "none",
  _arrangementType?: "Procore Drawings" | "Taliho" | "Procore Drawings Codes",
): BadgeVariant {
  switch (t) {
    case "arrangement":
      return "blue"; // Always blue to match My QR Codes page
    case "equipment":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Returns a badge color variant for a group row's type column.
 */
export function groupTypeBadgeVariant(
  t: "arrangement" | "equipment",
): BadgeVariant {
  return t === "arrangement" ? "indigo" : "red";
}
