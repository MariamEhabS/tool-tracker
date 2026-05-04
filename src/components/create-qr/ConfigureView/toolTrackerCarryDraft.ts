/**
 * Tiny persistence helpers for the Tool Tracker Single↔Bulk segmented control.
 *
 * - `taliho:toolTrackerCarryDraft` (sessionStorage): when a user types a tool
 *   in the Single form and switches to Bulk, the four bulk-relevant fields
 *   ride along as row 1. Cleared on consumption.
 * - `taliho:toolTrackerLastMode` (localStorage, via safeLocalStorage): remembers
 *   whether the user last worked in Single or Bulk so the next visit lands them
 *   in the right place without re-toggling.
 */

import { safeLocalStorage } from "@/utils/safeStorage";

export const TOOL_TRACKER_CARRY_DRAFT_KEY = "taliho:toolTrackerCarryDraft";
export const TOOL_TRACKER_LAST_MODE_KEY = "taliho:toolTrackerLastMode";

export type ToolTrackerLastMode = "single" | "bulk";

export interface ToolTrackerCarryDraft {
  name: string;
  category: string;
  serial: string;
  homeLocation: string;
}

export function setCarryDraft(draft: ToolTrackerCarryDraft): void {
  try {
    sessionStorage.setItem(
      TOOL_TRACKER_CARRY_DRAFT_KEY,
      JSON.stringify(draft),
    );
  } catch {
    // Private browsing / quota — silently ignore. Worst case the carry-forward
    // doesn't happen; the user retypes one row.
  }
}

export function consumeCarryDraft(): ToolTrackerCarryDraft | null {
  try {
    const raw = sessionStorage.getItem(TOOL_TRACKER_CARRY_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TOOL_TRACKER_CARRY_DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<ToolTrackerCarryDraft>;
    if (!parsed || typeof parsed.name !== "string" || parsed.name.trim() === "") {
      return null;
    }
    return {
      name: parsed.name,
      category: typeof parsed.category === "string" ? parsed.category : "",
      serial: typeof parsed.serial === "string" ? parsed.serial : "",
      homeLocation:
        typeof parsed.homeLocation === "string" ? parsed.homeLocation : "",
    };
  } catch {
    return null;
  }
}

export function readLastMode(): ToolTrackerLastMode {
  const value = safeLocalStorage.getItem(TOOL_TRACKER_LAST_MODE_KEY);
  return value === "bulk" ? "bulk" : "single";
}

export function writeLastMode(mode: ToolTrackerLastMode): void {
  safeLocalStorage.setItem(TOOL_TRACKER_LAST_MODE_KEY, mode);
}
