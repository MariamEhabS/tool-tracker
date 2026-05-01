import { FileOutlineIcon } from "../assets/icons/FileOutlineIcon";
import { LinkIcon } from "../assets/icons/LinkIcon";
import talihoIcon from "../assets/images/logo.png";
import procoreIcon from "../assets/images/procore-icon.png";

/**
 * Resolves the QR code type from raw database fields, replicating
 * the backend aggregation pipeline's $switch logic.
 *
 * Needed because the single QR code endpoint (GET /qr-code/:id) returns
 * raw fields without the computed resolvedType that the list endpoint provides.
 *
 * Priority order (mirrors aggregation.service.ts):
 * 1. If type is already procore-tool/procore-location/procore-drawing-code/static → use as-is
 * 2. If procoreConnect + procoreCategory='drawings' + qrcodeType non-empty → 'procore-drawing-code'
 * 3. If procoreConnect + procoreCategory='location' → 'procore-location'
 * 4. If procoreConnect + procoreCategory non-empty → 'procore-tool'
 * 5. If type is 'file' or 'url' → preserve
 * 6. Default → 'folder'
 */
export function resolveQRCodeTypeFromFields(qrcode: {
  type?: string | null;
  procoreConnect?: boolean | string | number | null;
  procoreCategory?: string | null;
  qrcodeType?: string | null;
}): string {
  const type = (qrcode?.type || "").toLowerCase();

  // Priority 1: already a known specific type
  const knownTypes = [
    "procore-tool",
    "procore-location",
    "procore-drawing-code",
    "static",
  ];
  if (knownTypes.includes(type)) return type;

  // Check procoreConnect with same loose coercion the backend uses
  const pc = qrcode?.procoreConnect;
  const isProcoreConnected =
    pc === true ||
    pc === "true" ||
    pc === "TRUE" ||
    pc === "True" ||
    pc === 1 ||
    pc === "1";

  if (isProcoreConnected) {
    const category = (qrcode?.procoreCategory || "").toLowerCase();

    // Priority 2: procore-drawing-code
    if (category === "drawings" && (qrcode?.qrcodeType || "") !== "") {
      return "procore-drawing-code";
    }
    // Priority 3: procore-location
    if (category === "location") return "procore-location";
    // Priority 4: procore-tool (any non-empty category)
    if (category !== "") return "procore-tool";
  }

  // Preserve explicit file/url types
  if (type === "file") return "file";
  if (type === "url") return "url";

  // Priority 5: default
  return "folder";
}

/**
 * Determines the QR code type with backwards compatibility for legacy V2 QR codes.
 *
 * Uses `resolvedType` from the backend when available (list endpoint),
 * otherwise computes from raw fields (single QR code endpoint).
 */
export function resolveQRCodeType(qrcode: {
  resolvedType?: string;
  type?: string;
  procoreConnect?: boolean | string | number | null;
  procoreCategory?: string | null;
  qrcodeType?: string | null;
}): string {
  if (qrcode?.resolvedType) return qrcode.resolvedType;
  return resolveQRCodeTypeFromFields(qrcode);
}

/**
 * Unified icon/color mapping for QR code types.
 * Used by dashboard and other components for consistent visual treatment.
 *
 * Note: For table rows, prefer using RowTypeIcon from components/ui/Icon.tsx
 * which provides a styled container with the icon.
 */
export const iconColorMap = (type: string) => {
  const t = (type || "").toLowerCase();

  switch (t) {
    case "file":
      return {
        color: "text-blue-600",
        bg: "bg-blue-100",
        icon: <FileOutlineIcon />,
        iconClass: "bx bx-file text-blue-600",
        label: "File",
      };
    case "folder":
      // "folder" type represents Taliho-managed content
      return {
        color: "text-yellow-600",
        bg: "bg-slate-300/60",
        icon: <img src={talihoIcon} alt="Taliho" className="w-5 h-5" />,
        iconClass: "bx bx-folder text-yellow-600",
        label: "Taliho",
      };
    case "url":
      return {
        color: "text-green-600",
        bg: "bg-green-100",
        icon: <LinkIcon />,
        iconClass: "bx bx-link text-green-600",
        label: "URL",
      };
    case "static":
      return {
        color: "text-gray-600",
        bg: "bg-gray-100",
        icon: <i className="bx bx-link text-gray-600" />,
        iconClass: "bx bx-link text-gray-600",
        label: "Static",
      };
    case "procore":
    case "procore-tool":
    case "procore-location":
    case "procore-drawing-code":
      return {
        color: "text-orange-600",
        bg: "bg-orange-50",
        icon: <img src={procoreIcon} alt="Procore" className="w-5 h-5" />,
        iconClass: "bx bx-briefcase text-orange-600",
        label:
          t === "procore-tool"
            ? "Procore Tool"
            : t === "procore-location"
              ? "Procore Location"
              : t === "procore-drawing-code"
                ? "Procore Drawing"
                : "Procore",
      };
    default:
      return {
        color: "text-gray-700",
        bg: "bg-gray-100",
        icon: <FileOutlineIcon />,
        iconClass: "bx bx-file text-gray-600",
        label: type || "--",
      };
  }
};
