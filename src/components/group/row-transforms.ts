import type { QRItem } from "./types";
import { formatDate } from "@/lib/format";

/**
 * Maps a raw backend QR code type string to the display type used in the group detail page.
 */
export function mapType(t?: string): QRItem["type"] {
  return t === "file"
    ? "File"
    : t === "folder"
      ? "Taliho"
      : t === "url"
        ? "URL"
        : t === "static"
          ? "URL"
          : t === "procore-tool"
            ? "Procore Tool"
            : t === "procore-location"
              ? "Procore Location"
              : t === "procore-drawing-code"
                ? "Procore Drawing"
                : "Taliho"; // Default to "Taliho" (folder) to match backend resolvedType default
}

/**
 * Transforms a raw QR code row from the API response into a QRItem for the group detail grid.
 */
export function buildGroupQRItem(r: {
  _id: string;
  qrcodeName?: string;
  type?: string;
  resolvedType?: string;
  createdAt?: string | Date;
  mobileScanCount?: number;
  qrimage?: string;
  qrImageUrl?: string;
  passwordActivated?: boolean;
}): QRItem & { qrCodeId: string } {
  return {
    id: String(r._id),
    qrCodeId: String(r._id),
    title: String(r.qrcodeName || ""),
    type: mapType(r.resolvedType || r.type),
    created: formatDate(r.createdAt),
    scans: Number(r.mobileScanCount ?? 0),
    hasS3: Boolean(r.qrImageUrl),
    image: r.qrImageUrl
      ? String(r.qrImageUrl)
      : r.qrimage
        ? `data:image/svg+xml;base64,${btoa(String(r.qrimage))}`
        : undefined,
    svgFallback: r.qrimage
      ? `data:image/svg+xml;base64,${btoa(String(r.qrimage))}`
      : undefined,
    passwordActivated: r.passwordActivated,
  };
}
