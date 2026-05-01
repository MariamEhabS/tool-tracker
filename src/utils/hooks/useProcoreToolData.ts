/**
 * @fileoverview Hook for fetching Procore tool data with React Query caching,
 * providing a simplified interface over the raw query result.
 */

import { useProcoreToolQuery } from "@/api/endpoints/procore-tools";
import { toolsMap } from "@/utils/toolMap";

type ToolData = unknown[] | Record<string, unknown>;

/**
 * Fetches data for a specific Procore tool with React Query caching support.
 * Wraps {@link useProcoreToolQuery} to provide a simplified return interface
 * that is compatible with {@link createTableLoadingState}.
 *
 * Returns `undefined` for `data` until the query has fetched at least once,
 * allowing skeleton loaders to display correctly during the initial load.
 *
 * @param tool - The Procore tool key (must be a key of `toolsMap`)
 * @param qrId - The QR code ID to fetch tool data for
 * @param companyId - The Procore company ID
 * @param projectId - The Procore project ID
 * @param desktop - Whether the request is from a desktop client (defaults to `true`)
 * @param fetchPage - Whether to fetch paginated data (defaults to `false`)
 * @returns An object containing:
 *   - `data` - The tool data array/object, or `undefined` if not yet fetched
 *   - `hiddenIds` - Set of IDs hidden by the user
 *   - `loading` - Whether the query is in its initial pending state
 *   - `isFetching` - Whether the query is currently fetching (including refetches)
 *   - `isFetched` - Whether the query has fetched at least once
 *   - `error` - The query error, or `null`
 *   - `refetch` - Function to manually refetch the data
 */
export function useProcoreToolData(
  tool: keyof typeof toolsMap,
  qrId: string,
  companyId: string,
  projectId: string,
  desktop: boolean = true,
  fetchPage: boolean = false,
) {
  const query = useProcoreToolQuery(tool, qrId, companyId, projectId, {
    desktop,
    fetchPage,
  });

  // Return undefined for data when query hasn't fetched yet
  // This allows createTableLoadingState to correctly show skeleton
  const data = query.isFetched ? (query.data?.data ?? []) : undefined;

  return {
    data: data as ToolData | undefined,
    hiddenIds: query.data?.hiddenIds,
    loading: query.isPending,
    isFetching: query.isFetching,
    isFetched: query.isFetched,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
