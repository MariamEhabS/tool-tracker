import { keepPreviousData } from "@tanstack/react-query";

/**
 * Default options for list/table queries.
 * Use for paginated endpoints like useListQRCodes, useListGroups.
 */
export const listQueryDefaults = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;

/**
 * Default options for detail/single-item queries.
 * Use for endpoints like useSingleQRCode, useSingleProject.
 */
export const detailQueryDefaults = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
} as const;

/**
 * Default options for Procore tool data queries.
 * Longer stale time since Procore data changes less frequently.
 */
export const procoreToolQueryDefaults = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;
