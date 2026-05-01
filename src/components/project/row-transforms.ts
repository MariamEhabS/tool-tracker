import { formatDate } from "@lib/format";
import type {
  QuickRow,
  GroupRow,
  QRRow,
  QRImageRow,
  GroupApiRow,
} from "./types";

/**
 * Transforms raw QR code API rows into QuickRow (QRCodeTableRow) entries
 * for display in the project QR codes data table.
 */
export function transformQRRows(
  rows: QRRow[],
  nameOverrides: Record<string, string>,
): QuickRow[] {
  return rows.map((q) => {
    // Use resolvedType from backend (computed with full type determination logic)
    // Falls back to raw type, then to "folder"
    const baseType = String(q.resolvedType ?? q.type ?? "folder");
    // Normalize legacy 'static' codes - keep as 'static' (valid type, not 'url')
    const normalizedType = baseType;

    // Use groupType and groupArrangementType from API response
    let groupType: QuickRow["groupType"] = "none";
    if (q.groupType === "arrangement") {
      groupType = "arrangement";
    } else if (q.groupType === "equipment") {
      groupType = "equipment";
    }

    const groupLabel: string = String(q.groupLabel ?? "[UNASSIGNED]");

    // Use groupArrangementType directly from backend
    // computeArrangementTypeVariant() handles case-insensitive comparison
    const groupArrangementType =
      groupType === "arrangement" && q.groupArrangementType
        ? (q.groupArrangementType as QuickRow["groupArrangementType"])
        : undefined;

    const groupId = String(q.arrangement ?? q.equipment ?? "");

    return {
      id: String(q._id),
      name: nameOverrides[String(q._id)] ?? String(q.qrcodeName ?? ""),
      type:
        normalizedType === "file" ||
        normalizedType === "folder" ||
        normalizedType === "url" ||
        normalizedType === "static" ||
        normalizedType === "procore-tool" ||
        normalizedType === "procore-location" ||
        normalizedType === "procore-drawing-code"
          ? (normalizedType as QuickRow["type"])
          : "folder",
      group: groupLabel,
      groupType,
      groupArrangementType,
      groupId: groupId || undefined,
      date:
        typeof q.createdAt === "string"
          ? formatDate(q.createdAt)
          : formatDate(q.createdAt)
            ? formatDate(q.createdAt)
            : "",
      scans: Number(q.mobileScanCount ?? 0),
    };
  });
}

/**
 * Builds a Map from QR code id -> image source (SVG data URL or pre-signed URL).
 */
export function buildQRImageMap(rows: QRImageRow[]): Map<string, string> {
  const m = new Map<string, string>();
  rows.forEach((r) => {
    if (r.qrImageUrl) m.set(String(r._id), String(r.qrImageUrl));
    else if (r.qrimage)
      m.set(
        String(r._id),
        `data:image/svg+xml;base64,${btoa(String(r.qrimage))}`,
      );
  });
  return m;
}

/**
 * Transforms raw group API rows into GroupRow (GroupTableRow) entries
 * for display in the project groups data table.
 */
export function transformGroupRows(
  list: GroupApiRow[],
  nameOverrides: Record<string, string>,
): GroupRow[] {
  return list.map((g) => ({
    id: String(g._id),
    name:
      nameOverrides[String(g._id)] ??
      String(g.groupName ?? g.arrangementName ?? g.equipmentName ?? ""),
    // procore-drawing-codes groups are displayed as "arrangement" type
    groupType:
      g.type === "arrangement" ||
      (g.type || "").toLowerCase() === "procore-drawing-codes"
        ? "arrangement"
        : "equipment",
    // Determine arrangementType for Procore Drawings badge display
    // procore-drawing-codes is now a first-class type (not arrangement subtype)
    arrangementType:
      (g.type || "").toLowerCase() === "procore-drawing-codes"
        ? "Procore Drawings"
        : g.type === "arrangement"
          ? "Taliho"
          : undefined,
    equipmentId: g.type === "equipment" ? (g.equipmentID ?? "") : undefined,
    qrCodes: Number(g.numberOfCodes ?? 0),
    date: formatDate(g.createdAt),
    scans: Number(g.mobileScanCount ?? 0),
  }));
}
