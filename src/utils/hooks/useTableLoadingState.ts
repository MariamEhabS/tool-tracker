/**
 * @fileoverview Hook and utilities for deriving table loading states from
 * TanStack Query results. Provides skeleton, empty-state, and error indicators
 * that leverage React Query's stale-while-revalidate caching to avoid
 * unnecessary skeleton flashes during refetches.
 */

import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";

/**
 * Loading state indicators for table components.
 * Designed to work with TanStack Query's stale-while-revalidate pattern.
 */
export interface TableLoadingState {
  /**
   * Show full skeleton - only true when no cached data exists.
   * Use this to conditionally render TableSkeleton.
   */
  showSkeleton: boolean;

  /**
   * Show body-only skeleton (TableContentsSkeleton / GridContentsSkeleton).
   * True when refetching with cached data visible — replaces table body
   * with skeleton rows while keeping header and footer interactive.
   */
  showContentsSkeleton: boolean;

  /**
   * Data array is empty after successful fetch.
   * Use this to show EmptyState component.
   */
  isEmpty: boolean;

  /**
   * Data is available (cached or fresh).
   * Use this to determine if table can render.
   */
  hasData: boolean;

  /**
   * Query is in error state.
   * Use this to show error UI.
   */
  isError: boolean;

  /**
   * The actual data from the query (for convenience).
   */
  data: unknown;
}

/**
 * Utility hook for determining table loading states.
 * Properly leverages TanStack Query's caching to avoid unnecessary skeleton flashes.
 *
 * @example
 * ```tsx
 * const query = useListGroups({ companyId });
 * const loadingState = useTableLoadingState(query);
 *
 * if (loadingState.showSkeleton) return <TableSkeleton />;
 *
 * return (
 *   <DataTable
 *     rows={query.data?.data ?? []}
 *     loadingState={loadingState}
 *   />
 * );
 * ```
 *
 * @param query - TanStack Query result from useQuery
 * @returns Loading state indicators
 */
export function useTableLoadingState<TData>(
  query: UseQueryResult<TData, unknown>,
): TableLoadingState {
  const { isPending, isFetching, isSuccess, isError, data } = query;

  // Determine if we have usable data (including stale cached data)
  const hasData = data !== undefined && data !== null;

  // Check if data array is empty
  // Handles both direct arrays and paginated responses with { data: [] }
  const isEmpty =
    isSuccess &&
    (Array.isArray(data)
      ? data.length === 0
      : (data as { data?: unknown[] })?.data?.length === 0);

  return {
    // Only show skeleton when truly loading (pending) AND no cached data
    showSkeleton: isPending && !hasData,

    // Show body-only skeleton when fetching but we already have data to display
    showContentsSkeleton: isFetching && hasData,

    isEmpty,
    hasData,
    isError,
    data,
  };
}

/**
 * Pre-configured placeholder data function for paginated queries.
 * Keeps previous page data visible while fetching new page.
 *
 * @example
 * ```tsx
 * const query = useQuery({
 *   queryKey: ['items', page],
 *   queryFn: () => fetchItems(page),
 *   placeholderData: keepPreviousData,
 * });
 * ```
 */
export { keepPreviousData };

/**
 * Default query options for table queries.
 * Import these when creating new table query hooks.
 *
 * @example
 * ```tsx
 * export const useListItems = (params) => {
 *   return useQuery({
 *     queryKey: itemKeys.list(params),
 *     queryFn: () => fetchItems(params),
 *     ...tableQueryDefaults,
 *   });
 * };
 * ```
 */
export const tableQueryDefaults = {
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;

// Re-export adapter for non-TanStack-Query loading sources
export { createTableLoadingState } from "./createTableLoadingState";
