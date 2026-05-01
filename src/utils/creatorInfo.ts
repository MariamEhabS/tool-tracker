/**
 * @fileoverview Utilities for persisting and retrieving anonymous creator
 * info (name + company) via localStorage. Used when a non-authenticated
 * user submits forms that need creator attribution.
 */

export type CreatorInfo = { name: string; company: string };

export const CREATOR_INFO_STORAGE_KEY = "talihoCreatorInfo";

/**
 * Retrieves previously stored creator info from localStorage.
 * @returns The parsed CreatorInfo, or null if absent or malformed.
 */
export function getCreatorInfoFromStorage(): CreatorInfo | null {
  try {
    const raw = localStorage.getItem(CREATOR_INFO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.name === "string" &&
      parsed.name &&
      typeof parsed.company === "string" &&
      parsed.company
    ) {
      return { name: parsed.name, company: parsed.company } as CreatorInfo;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists creator info to localStorage and dispatches a custom event
 * so other components (e.g., header) can react to the change.
 * @param info - The creator name and company to store.
 */
export function saveCreatorInfoToStorage(info: CreatorInfo) {
  try {
    localStorage.setItem(CREATOR_INFO_STORAGE_KEY, JSON.stringify(info));
    // Notify any listeners (e.g., header) to refresh stored info view
    window.dispatchEvent(new Event("taliho:creatorInfoUpdated"));
  } catch (error) {
    console.error("Error saving creator info to storage:", error);
  }
}
