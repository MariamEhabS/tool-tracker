import { toolsMap, backendEnumToToolKey } from "@/utils/toolMap";

/**
 * Convert a backend enum value or tool key to a friendly display title.
 *
 * @example
 *   getToolTitle('rfis')        // "RFI's"
 *   getToolTitle('rfi')         // "RFI's"
 *   getToolTitle('coordination-issues') // "Coordination Issues"
 */
export const getToolTitle = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  // Try to get tool key from backend enum value (e.g., 'rfis' -> 'rfi')
  const toolKey =
    (backendEnumToToolKey as Record<string, string>)[value] || value;
  // Get the friendly title from toolsMap (e.g., 'rfi' -> "RFI's")
  const tool = toolsMap[toolKey as keyof typeof toolsMap];
  return tool?.title || value;
};
