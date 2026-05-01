/**
 * @fileoverview React Query key factory for QR code queries.
 */

/**
 * Query key factory for QR code-related React Query queries.
 * Provides hierarchical cache keys that enable targeted invalidation.
 *
 * @example
 * ```ts
 * // Invalidate all QR queries
 * queryClient.invalidateQueries({ queryKey: QrKeys.all });
 *
 * // Fetch a filtered list
 * useQuery({ queryKey: QrKeys.list({ projectId: '123' }), queryFn: ... });
 * ```
 */
export const QrKeys = {
  all: ["Qrs"] as const,
  list: (filters: Record<string, unknown>) =>
    [...QrKeys.all, "list", filters] as const,
};
