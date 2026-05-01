/**
 * @fileoverview Hooks for tracking unsaved changes across settings page
 * sections and blocking navigation when changes exist. Uses a global
 * external store with `useSyncExternalStore` for cross-component state
 * sharing and TanStack Router's `useBlocker` for in-app navigation blocking.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useBlocker } from "@tanstack/react-router";

// Type definitions
export type SectionId = string;

interface UnsavedSection {
  id: SectionId;
  label: string;
}

interface UnsavedChangesStore {
  sections: Map<SectionId, UnsavedSection>;
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => Map<SectionId, UnsavedSection>;
  register: (id: SectionId, label: string) => void;
  unregister: (id: SectionId) => void;
  setDirty: (id: SectionId, isDirty: boolean) => void;
  isDirty: (id: SectionId) => boolean;
  hasAnyUnsavedChanges: () => boolean;
  getUnsavedSections: () => UnsavedSection[];
  clear: () => void;
}

// Create the store singleton
function createUnsavedChangesStore(): UnsavedChangesStore {
  let sections = new Map<SectionId, UnsavedSection>();
  const listeners = new Set<() => void>();

  const emitChange = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    sections,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot() {
      return sections;
    },
    register(id, label) {
      if (!sections.has(id)) {
        sections = new Map(sections);
        sections.set(id, { id, label });
        emitChange();
      }
    },
    unregister(id) {
      if (sections.has(id)) {
        sections = new Map(sections);
        sections.delete(id);
        emitChange();
      }
    },
    setDirty(id, isDirty) {
      if (isDirty && !sections.has(id)) {
        // Auto-register if setting dirty without explicit register
        sections = new Map(sections);
        sections.set(id, { id, label: id });
        emitChange();
      } else if (!isDirty && sections.has(id)) {
        sections = new Map(sections);
        sections.delete(id);
        emitChange();
      }
    },
    isDirty(id) {
      return sections.has(id);
    },
    hasAnyUnsavedChanges() {
      return sections.size > 0;
    },
    getUnsavedSections() {
      return Array.from(sections.values());
    },
    clear() {
      if (sections.size > 0) {
        sections = new Map();
        emitChange();
      }
    },
  };
}

// Global store instance
const unsavedChangesStore = createUnsavedChangesStore();

/**
 * Tracks unsaved changes for a specific settings section by registering it
 * with the global unsaved-changes store. Components use this to signal that
 * their form data has been modified.
 *
 * Automatically unregisters the section when the component unmounts, ensuring
 * stale dirty state does not persist.
 *
 * @param sectionId - Unique identifier for the settings section
 * @param label - Human-readable label for the section (displayed in warnings)
 * @returns An object containing:
 *   - `isDirty` - Whether this section currently has unsaved changes
 *   - `setDirty` - Set or clear the dirty state for this section
 *   - `markClean` - Convenience method to clear the dirty state
 */
export function useUnsavedChangesSection(sectionId: SectionId, label: string) {
  const [localDirty, setLocalDirty] = useState(false);

  // Register on mount, unregister on unmount
  useEffect(() => {
    return () => {
      unsavedChangesStore.unregister(sectionId);
    };
  }, [sectionId]);

  const setDirty = useCallback(
    (isDirty: boolean) => {
      setLocalDirty(isDirty);
      if (isDirty) {
        unsavedChangesStore.register(sectionId, label);
      } else {
        unsavedChangesStore.unregister(sectionId);
      }
    },
    [sectionId, label],
  );

  const markClean = useCallback(() => {
    setLocalDirty(false);
    unsavedChangesStore.unregister(sectionId);
  }, [sectionId]);

  return {
    isDirty: localDirty,
    setDirty,
    markClean,
  };
}

/**
 * Provides read access to the global unsaved-changes state. Returns whether
 * any section has unsaved changes and a list of those sections.
 *
 * Subscribes to the global store via `useSyncExternalStore`, so components
 * using this hook re-render whenever the dirty-section set changes.
 *
 * @returns An object containing:
 *   - `hasUnsavedChanges` - Whether any section has unsaved changes
 *   - `unsavedSections` - Array of `{ id, label }` for each dirty section
 *   - `clear` - Clears all unsaved-changes tracking
 */
export function useUnsavedChanges() {
  const sections = useSyncExternalStore(
    unsavedChangesStore.subscribe,
    unsavedChangesStore.getSnapshot,
    unsavedChangesStore.getSnapshot,
  );

  const hasUnsavedChanges = sections.size > 0;
  const unsavedSections = useMemo(
    () => Array.from(sections.values()),
    [sections],
  );

  const clear = useCallback(() => {
    unsavedChangesStore.clear();
  }, []);

  return {
    hasUnsavedChanges,
    unsavedSections,
    clear,
  };
}

/**
 * Combines unsaved-changes tracking with navigation blocking for both
 * browser-level navigation (`beforeunload`) and in-app route transitions
 * (TanStack Router's `useBlocker`).
 *
 * When unsaved changes exist and the guard is enabled, the hook:
 * - Prevents browser tab/window close with a confirmation dialog
 * - Blocks in-app navigation and exposes `isBlocked` so a confirmation
 *   modal can be rendered
 *
 * **Lifecycle behavior:**
 * - The `beforeunload` listener is added/removed based on `shouldBlock`.
 * - Cleanup occurs automatically when the component unmounts or when
 *   there are no longer unsaved changes.
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether the navigation guard is active (defaults to `true`)
 * @returns An object containing:
 *   - `hasUnsavedChanges` - Whether any section has unsaved changes
 *   - `unsavedSections` - Array of dirty sections
 *   - `isBlocked` - Whether in-app navigation is currently blocked
 *   - `confirmAndProceed` - Clear changes and allow the blocked navigation
 *   - `cancelNavigation` - Cancel the blocked navigation
 *   - `clear` - Clear all unsaved-changes tracking
 */
export function useUnsavedChangesGuard(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const { hasUnsavedChanges, unsavedSections, clear } = useUnsavedChanges();

  const shouldBlock = enabled && hasUnsavedChanges;

  // Block in-app navigation using TanStack Router's useBlocker
  const { proceed, reset, status } = useBlocker({
    condition: shouldBlock,
  });

  // Handle browser beforeunload event
  useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show a generic message, but we set returnValue for compatibility
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldBlock]);

  // Helper to confirm and proceed with navigation
  const confirmAndProceed = useCallback(() => {
    clear();
    proceed();
  }, [clear, proceed]);

  // Helper to cancel navigation
  const cancelNavigation = useCallback(() => {
    reset();
  }, [reset]);

  return {
    hasUnsavedChanges,
    unsavedSections,
    isBlocked: status === "blocked",
    confirmAndProceed,
    cancelNavigation,
    clear,
  };
}

// Export store for testing purposes
export { unsavedChangesStore };
