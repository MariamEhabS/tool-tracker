/**
 * @fileoverview Badge computation helpers. Each function derives a BadgeData
 * object (label + variant + optional href) from entity attributes, used
 * consistently across tables and detail pages.
 */

import type { BadgeData, BadgeVariant } from "../types/Badge.types";

/**
 * Computes a badge for a QR code's resolved type (e.g., "folder" -> Taliho slate badge).
 * @param type - The QR code type string (e.g., "file", "folder", "procore-tool")
 * @returns BadgeData or undefined if type is falsy
 */
export function computeTypeBadge(type?: string): BadgeData | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase();
  const mapping: Record<string, { label: string; variant: BadgeVariant }> = {
    file: { label: "File", variant: "blue" },
    folder: { label: "Taliho", variant: "slate" },
    url: { label: "URL", variant: "green" },
    static: { label: "Static", variant: "indigo" },
    procore: { label: "Procore", variant: "orange" },
    "procore-tool": { label: "Procore Tool", variant: "orange" },
    "procore-location": { label: "Procore Location", variant: "orange" },
    "procore-drawing": { label: "Procore Drawing", variant: "orange" },
    "procore-drawing-code": { label: "Procore Drawing", variant: "orange" },
  };
  const m = mapping[t];
  if (!m) return { label: type, variant: "gray" };
  return m;
}

/**
 * Computes a badge for a QR code's grouping (arrangement or equipment).
 * Includes an href for navigation to the group detail page.
 */
export function computeGroupingBadge(args: {
  groupingType?: string;
  arrangement?: string;
  equipment?: string;
  groupingId?: string;
  arrangementName?: string;
  equipmentName?: string;
  groupName?: string;
}): BadgeData {
  const {
    groupingType,
    arrangement,
    equipment,
    groupingId,
    arrangementName,
    equipmentName,
    groupName,
  } = args;
  const t = (
    groupingType ??
    (arrangement ? "arrangement" : equipment ? "equipment" : "none")
  ).toLowerCase();
  let label = "[UNASSIGNED]";
  let variant: BadgeVariant = "gray";
  if (t === "arrangement") {
    label = arrangementName || arrangement || "Arrangement";
    variant = "indigo";
  } else if (t === "equipment") {
    label = equipmentName || equipment || "Equipment";
    variant = "red";
  } else if (t === "group") {
    label = groupName || "Group";
    variant = "blue";
  }
  // Generate href for grouping badge (will implement navigation later)
  const id = groupingId ?? arrangement ?? equipment;
  const href = id ? `/group/${id}` : undefined;
  return { label, variant, href };
}

/**
 * Computes a badge for a QR code's project assignment. Variant reflects
 * project status (green=active, cyan=completed, yellow=on-hold, gray=unassigned/archived).
 */
export function computeProjectBadge(args: {
  project?: string;
  projectName?: string;
  projectStatus?: string;
  archived?: boolean;
}): BadgeData {
  const { project, projectName, projectStatus, archived } = args;

  const label = projectName ?? (project ? "Project" : "[UNASSIGNED]");
  const href = project ? `/project/${project}` : undefined;

  // Unassigned → gray; archived → gray; otherwise default green
  const variant: BadgeVariant = !project
    ? "gray"
    : archived
      ? "gray"
      : projectStatus === "completed"
        ? "cyan"
        : projectStatus === "on-hold" || projectStatus === "on hold"
          ? "yellow"
          : "green";

  return { label, variant, href };
}

/**
 * Returns the badge variant for a project status string.
 * Accounts for archived state (always gray).
 */
export function computeProjectStatusVariant(
  status?: string,
  archived?: boolean,
): BadgeVariant {
  if (archived) return "gray";
  const v = (status ?? "").toLowerCase();
  if (v === "completed") return "cyan";
  if (v === "on hold" || v === "on-hold") return "yellow";
  return "green";
}

/**
 * Simplified project variant: gray if archived, green otherwise.
 * Maintains current UI expectations in v3-frontend.
 */
export function computeProjectVariantSimple(
  _status?: string,
  archived?: boolean,
): BadgeVariant {
  if (archived) return "gray";
  return "green";
}

/**
 * Returns the badge variant for an arrangement type (Taliho, Procore Drawings, etc.).
 * Preserves current color conventions across the app.
 */
export function computeArrangementTypeVariant(type?: string): BadgeVariant {
  const t = (type ?? "").toLowerCase();
  if (t === "taliho") return "yellow";
  if (t === "procore drawings" || t === "procore drawings codes")
    return "orange";
  // Default to blue for arrangement grouping badges (My QRCodes page expectation)
  return "blue";
}
