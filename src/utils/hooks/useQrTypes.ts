/**
 * @fileoverview Hook for deriving boolean flags from a QR code type string,
 * indicating whether it is a Procore-specific type.
 */

/**
 * Derives boolean type-classification flags from a QR code type string.
 * Useful for conditionally rendering Procore-specific UI or selecting
 * the correct data-fetching strategy based on the QR code type.
 *
 * @param type - The QR code type string (e.g. "procore-tool", "procore-location",
 *   "procore-drawing", "procore-drawing-code"), or `null`/`undefined`
 * @returns An object with boolean flags:
 *   - `isProcoreLocationType` - True if type is "procore-location"
 *   - `isProcoreToolType` - True if type is "procore-tool"
 *   - `isProcoreDrawingCodeType` - True if type is "procore-drawing-code"
 *   - `isProcoreSpecialType` - True if type matches any Procore-specific type
 */
export function useQrTypes(type?: string | null) {
  const t = (type || "").toLowerCase();
  const isProcoreLocationType = t === "procore-location";
  const isProcoreToolType = t === "procore-tool";
  const isProcoreDrawingCodeType = t === "procore-drawing-code";
  const isProcoreDrawingType = t === "procore-drawing";
  const isProcoreSpecialType =
    isProcoreToolType ||
    isProcoreLocationType ||
    isProcoreDrawingType ||
    isProcoreDrawingCodeType;
  return {
    isProcoreLocationType,
    isProcoreToolType,
    isProcoreDrawingCodeType,
    isProcoreSpecialType,
  };
}
