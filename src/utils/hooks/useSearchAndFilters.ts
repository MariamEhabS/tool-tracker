/**
 * @fileoverview Hook for managing search query text and active filter state
 * used by search/filter card components.
 */

import { useState } from "react";
import type { ActiveFilters } from "@components/ui/SearchFiltersCard";

/**
 * Manages the search query string and active filter selections for
 * search/filter card UI. Provides a `clearAll` helper that resets both
 * the query and filters to their initial empty state.
 *
 * @returns An object containing:
 *   - `query` - The current search query string
 *   - `setQuery` - Setter for the search query
 *   - `filters` - The active filter selections (keyed by filter name)
 *   - `setFilters` - Setter for the active filters
 *   - `clearAll` - Resets both query and filters to empty
 */
export function useSearchAndFilters() {
  const [query, setQuery] = useState<string>("");
  const [filters, setFilters] = useState<ActiveFilters>({});

  function clearAll() {
    setQuery("");
    setFilters({});
  }

  return { query, setQuery, filters, setFilters, clearAll };
}
