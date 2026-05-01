/**
 * @fileoverview Hook for managing the expanded/collapsed state of collapsible
 * settings page sections. Defaults to only the "user-settings" section
 * expanded on each page visit.
 */

import { useState, useCallback } from "react";
// import { logApiError } from "@/utils/rollbar";

// const STORAGE_KEY = "settings-expanded-sections";
const DEFAULT_STATE: Record<string, boolean> = { "user-settings": true };

export interface UseExpandedSectionsReturn {
  isExpanded: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
  setExpandedState: (sectionId: string, state: boolean) => void;
}

/**
 * Manages the expanded/collapsed state of settings page sections.
 * By default only the "user-settings" section starts expanded; all others
 * start collapsed.
 *
 * NOTE: localStorage persistence is commented out so all sections
 * start collapsed on each visit. Uncomment the blocks below to restore
 * persistence across page visits.
 *
 * @returns An object implementing {@link UseExpandedSectionsReturn}:
 *   - `isExpanded` - Check whether a section is expanded by its ID
 *   - `toggle` - Toggle a section's expanded/collapsed state
 *   - `setExpandedState` - Explicitly set a section's expanded state
 */
export function useExpandedSections(): UseExpandedSectionsReturn {
  // const localStorageAvailable = useRef(true);

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    // COMMENTED OUT: localStorage persistence - restore from storage
    // try {
    //   const stored = localStorage.getItem(STORAGE_KEY);
    //   if (stored) {
    //     return { ...DEFAULT_STATE, ...JSON.parse(stored) };
    //   }
    // } catch (error) {
    //   localStorageAvailable.current = false;
    //   logApiError(error, "settings-parse-localstorage-failed");
    // }
    return DEFAULT_STATE;
  });

  // COMMENTED OUT: localStorage persistence - save to storage
  // useEffect(() => {
  //   if (!localStorageAvailable.current) return;
  //   try {
  //     localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedSections));
  //   } catch (error) {
  //     localStorageAvailable.current = false;
  //     logApiError(error, "settings-save-localstorage-failed");
  //   }
  // }, [expandedSections]);

  const isExpanded = useCallback(
    (sectionId: string): boolean => {
      return expandedSections[sectionId] ?? false;
    },
    [expandedSections],
  );

  const toggle = useCallback((sectionId: string): void => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const setExpandedState = useCallback(
    (sectionId: string, state: boolean): void => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionId]: state,
      }));
    },
    [],
  );

  return {
    isExpanded,
    toggle,
    setExpandedState,
  };
}

export default useExpandedSections;
