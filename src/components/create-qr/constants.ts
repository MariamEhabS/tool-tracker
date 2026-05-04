import { icons } from "@/lib/icons";
import type { StartOptionKey } from "./types";

/** Maximum QR codes that can be created in a single bulk operation (server protection) */
export const MAX_BULK_QR_BATCH_SIZE = 1_000_000;
export const CREATE_NEW_GROUP_OPTION_VALUE = "__create_new_group__";
export const ADD_TO_EXISTING_GROUP_OPTION_VALUE = "__add_to_existing_group__";
export const CREATE_NEW_PROJECT_OPTION_VALUE = "__create_new_project__";

export const optionCards: Array<{
  key: StartOptionKey;
  title: string;
  description: string;
  buttonText: string;
  headerIcon: string;
  buttonIcon: string;
}> = [
  {
    key: "single",
    title: "Single QR Code",
    description: "Create one QR code that links to a single destination.",
    buttonText: "Create a Single QR Code",
    headerIcon: icons.qrScan,
    buttonIcon: icons.plusCircle,
  },
  {
    key: "bulk",
    title: "Bulk Codes",
    description: "Generate multiple QR codes at once.",
    buttonText: "Create Bulk QR Codes",
    headerIcon: "bx bx-spreadsheet",
    buttonIcon: icons.plusCircle,
  },
];

export function getLabelByKey(groupName?: string): Record<string, string> {
  return {
    "single:taliho": "Taliho QR Code",
    "single:procore-location": "Procore Location",
    "single:procore-tool": "Procore Tool",
    "single:procore-drawing": "Procore Drawing",
    "single:vcard": "V-Card",
    "single:url": "URL",
    "single:tool-tracker": "Tool Tracker",
    "bulk:tool-tracker": "Tool Trackers",
    "bulk:existing-group": `Add to "${groupName || "Group"}"`,
    "bulk:arrangement:assorted": "Assorted Group",
    "bulk:arrangement:procore-drawings": "Procore Drawings",
    "bulk:equipment:prefix-quantity": "Prefix + Quantity",
    "bulk:equipment:upload-csv": "Upload CSV",
    "bulk:equipment:manual-entry": "Manual Entry",
  };
}
