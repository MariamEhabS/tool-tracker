/**
 * @fileoverview Shared helper functions for table interactions: selection,
 * filtering, sorting, pagination, and debouncing.
 */

import { useMemo } from "react";
import { useEffect, useState } from "react";

interface DataSetArray {
  id: string;
  name: string;
  type: string;
  key: string;
  tool: string;
  filesCount: number;
  size: number;
  lastModified: string;
  category: string;
}

export interface DataItem {
  id: string;
  name: string;
  type: string;
  key: string;
  tool: string;
  filesCount: number;
  size: number;
  lastModified: string;
  category: string;
}

/**
 * Toggles the bulk-action toolbar visibility and clears selected items
 * when the toolbar is dismissed.
 */
export const toggleGroupActions = ({
  showGroupActions,
  setShowGroupActions,
  setSelectedItems,
}: {
  showGroupActions: boolean;
  setShowGroupActions: (show: boolean) => void;
  setSelectedItems: (items: Set<string>) => void;
}) => {
  setShowGroupActions(!showGroupActions);
  if (showGroupActions) setSelectedItems(new Set());
};

/**
 * Selects or deselects all items in the data set.
 * @param checked - Whether the "select all" checkbox is checked
 * @param dataSet - The full data set whose item IDs will be selected
 * @param setSelectedItems - State setter for the selected items set
 */
export const handleSelectAll = (
  checked: boolean,
  dataSet: DataSetArray[],
  setSelectedItems: (items: Set<string>) => void,
) => {
  setSelectedItems(
    checked ? new Set(dataSet.map((item) => item.id)) : new Set(),
  );
};

/**
 * Toggles selection of a single item in the selected items set.
 * @param itemId - The ID of the item to toggle
 */
export const handleItemSelect = (
  itemId: string,
  selectedItems: Set<string>,
  setSelectedItems: (items: Set<string>) => void,
) => {
  const newSelected = new Set(selectedItems);
  if (newSelected.has(itemId)) newSelected.delete(itemId);
  else newSelected.add(itemId);
  setSelectedItems(newSelected);
};

/**
 * Adds or removes a filter value for a given filter key, then resets
 * pagination to page 1.
 * @param filterKey - The filter category (e.g., "type", "status")
 * @param value - The filter value to add or remove
 * @param checked - Whether the filter value was checked or unchecked
 */
export const handleFilterChange = (
  filterKey: string,
  value: string,
  checked: boolean,
  setActiveFilters: (
    arg0: (prev: Record<string, string[]>) => Record<string, string[]>,
  ) => void,
  setCurrentPage: (arg0: number) => void,
) => {
  setActiveFilters((prev) => ({
    ...prev,
    [filterKey]: prev[filterKey]
      ? checked
        ? [...prev[filterKey], value]
        : prev[filterKey].filter((v) => v !== value)
      : checked
        ? [value]
        : [],
  }));
  setCurrentPage(1);
};

/**
 * Clears all active filters and resets pagination to page 1.
 */
export const clearFilters = (
  setActiveFilters: (
    arg0: (prev: Record<string, string[]>) => Record<string, string[]>,
  ) => void,
  setCurrentPage: (arg0: number) => void,
) => {
  setActiveFilters(() => ({}));
  setCurrentPage(1);
};

/**
 * Toggles sort direction for a column. Clicking the same column flips
 * between ascending and descending; clicking a new column defaults to ascending.
 * @param key - The column key to sort by
 */
export const handleSort = (
  key: string,
  sortConfig: { key: string | null; direction: "asc" | "desc" },
  setSortConfig: (arg0: { key: string; direction: "asc" | "desc" }) => void,
) => {
  let direction: "asc" | "desc" = "asc";
  if (sortConfig.key === key && sortConfig.direction === "asc")
    direction = "desc";
  setSortConfig({ key, direction });
};

/**
 * Toggles an individual dropdown open/closed by its ID.
 * @param dropdownId - Identifier for the dropdown to toggle
 */
export const toggleDropdown = (
  dropdownId: string,
  setOpenDropdowns: (
    arg0: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void,
) => {
  setOpenDropdowns((prev) => ({ ...prev, [dropdownId]: !prev[dropdownId] }));
};

/**
 * Memoized hook that filters data by search term and active filters,
 * then sorts by the configured sort column and direction.
 * @returns The filtered and sorted data array.
 */
export function useFilteredAndSortedData<T>(
  data: T[],
  searchTerm: string,
  activeFilters: Record<string, string[]>,
  sortConfig: { key: string | null; direction: "asc" | "desc" },
): T[] {
  return useMemo(() => {
    const filtered = data.filter((item) => {
      const obj = item as unknown as Record<string, unknown>;

      const matchesSearch =
        !searchTerm ||
        Object.values(obj).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        );

      const matchesFilters = Object.entries(activeFilters).every(
        ([key, values]) => {
          if (!values.length) return true;
          return values.includes(String(obj[key] ?? ""));
        },
      );

      return matchesSearch && matchesFilters;
    });

    if (sortConfig.key) {
      const key = sortConfig.key as string; // narrow once
      filtered.sort((a, b) => {
        const ao = a as unknown as Record<string, unknown>;
        const bo = b as unknown as Record<string, unknown>;
        const av = String(ao[key] ?? "");
        const bv = String(bo[key] ?? "");
        if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, activeFilters, sortConfig]);
}

/**
 * Generates a pagination range array with ellipsis placeholders.
 * Always includes the first and last page, with "..." where pages are skipped.
 * @param currentPage - The current active page (1-indexed)
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and "..." strings
 */
export const getPaginationNumbers = (
  currentPage: number,
  totalPages: number,
) => {
  const delta = 2;
  const range = [];
  const rangeWithDots = [];

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  if (currentPage - delta > 2) rangeWithDots.push(1, "...");
  else rangeWithDots.push(1);

  rangeWithDots.push(...range);

  if (currentPage + delta < totalPages - 1)
    rangeWithDots.push("...", totalPages);
  else if (totalPages > 1) rangeWithDots.push(totalPages);

  return rangeWithDots;
};

/**
 * Debounces a value by the specified delay in milliseconds.
 * Useful for delaying search input handling until the user stops typing.
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds before updating the debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
