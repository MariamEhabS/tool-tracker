/**
 * @fileoverview Factory function that creates a {@link TableLoadingState} from
 * non-TanStack-Query loading sources, such as hooks using plain `useState` for
 * loading indicators.
 */

import type { TableLoadingState } from "./useTableLoadingState";

/**
 * Options for creating a table loading state from non-TanStack-Query sources.
 */
export interface CreateTableLoadingStateOptions<T> {
  /**
   * The data from the loading source.
   * Can be null/undefined when not yet loaded.
   */
  data: T | null | undefined;

  /**
   * Whether the data is currently being loaded/fetched.
   */
  loading: boolean;

  /**
   * Optional error from the loading source.
   */
  error?: Error | null;
}

/**
 * Creates a TableLoadingState from non-TanStack-Query loading sources.
 * Use this adapter for hooks that use useState for loading (e.g., useProcoreToolData)
 * instead of TanStack Query.
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useProcoreToolData(...);
 * const loadingState = createTableLoadingState({ data, loading, error });
 *
 * if (loadingState.showSkeleton) return <TableSkeleton />;
 *
 * return <DataTable rows={data ?? []} />;
 * ```
 *
 * @param opts - Options containing data, loading state, and optional error
 * @returns TableLoadingState object compatible with DataTable/DataGrid
 */
export function createTableLoadingState<T>(
  opts: CreateTableLoadingStateOptions<T>,
): TableLoadingState {
  const { data, loading, error } = opts;

  // Determine if we have usable data
  const hasData = data !== undefined && data !== null;

  // Check if data array is empty
  // Handles both direct arrays and paginated responses with { data: [] }
  const isEmpty =
    hasData &&
    (Array.isArray(data)
      ? data.length === 0
      : (data as { data?: unknown[] })?.data?.length === 0);

  return {
    // Only show skeleton when loading AND no data available yet
    showSkeleton: loading && !hasData,

    // Show body-only skeleton when loading but we have data to display
    showContentsSkeleton: loading && hasData,

    isEmpty,
    hasData,
    isError: Boolean(error),
    data,
  };
}
