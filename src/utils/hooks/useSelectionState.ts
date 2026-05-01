/**
 * @fileoverview Hook for managing row selection, removal animations, and
 * select-all behavior in table components.
 */

import { useState } from "react";

/**
 * Manages row selection state for table components, including individual
 * toggle, select-all/deselect-all, and removal animation tracking. Tracks
 * three ID sets: selected rows, rows currently animating out (`removingIds`),
 * and rows that have finished removal (`removedIds`).
 *
 * @typeParam Row - The row data type
 * @param rows - The current array of visible rows
 * @param getRowId - Function to extract a unique string ID from a row
 * @returns An object containing:
 *   - `selected` - Set of currently-selected row IDs
 *   - `setSelected` - Direct setter for the selected set
 *   - `removingIds` - Set of row IDs currently animating removal
 *   - `setRemovingIds` - Direct setter for the removing set
 *   - `removedIds` - Set of row IDs that have been removed
 *   - `setRemovedIds` - Direct setter for the removed set
 *   - `allSelected` - Whether every visible row is selected
 *   - `getRowClassName` - Returns a CSS class string for removal animation
 *   - `toggleRow` - Toggles selection for a single row by ID
 *   - `toggleSelectAll` - Selects all visible rows or deselects them if all are selected
 */
export function useSelectionState<Row>(
  rows: Row[],
  getRowId: (r: Row) => string,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const allSelected =
    selected.size > 0 &&
    rows.length > 0 &&
    rows.every((r) => selected.has(getRowId(r)));

  const getRowClassName = (row: Row) => {
    const id = getRowId(row);
    return removingIds.has(id) || removedIds.has(id)
      ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
      : "";
  };

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(getRowId(r)));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.add(getRowId(r)));
        return next;
      });
    }
  }

  return {
    selected,
    setSelected,
    removingIds,
    setRemovingIds,
    removedIds,
    setRemovedIds,
    allSelected,
    getRowClassName,
    toggleRow,
    toggleSelectAll,
  };
}
