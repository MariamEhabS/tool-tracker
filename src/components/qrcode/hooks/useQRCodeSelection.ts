import { useState } from "react";

/**
 * Consolidates selection and visibility state for the QR code detail page.
 *
 * Includes:
 * - Bulk action mode toggle
 * - Hidden/removing/removed item tracking (for hide/show/remove animations)
 * - Local optimistic hide/show/fading state for Procore items
 */
export function useQRCodeSelection() {
  // Bulk actions mode toggle
  const [bulkActions, setbulkActions] = useState<boolean>(false);

  // Hidden/removing/removed item tracking
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Local hide/show state for optimistic UI updates (Procore items)
  const [localHiddenIds, setLocalHiddenIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [localShownIds, setLocalShownIds] = useState<Set<string>>(new Set());

  return {
    // Bulk actions
    bulkActions,
    setbulkActions,

    // Hidden/removing/removed
    hiddenIds,
    setHiddenIds,
    removingIds,
    setRemovingIds,
    removedIds,
    setRemovedIds,

    // Local optimistic state (Procore)
    localHiddenIds,
    setLocalHiddenIds,
    fadingIds,
    setFadingIds,
    localShownIds,
    setLocalShownIds,
  };
}
