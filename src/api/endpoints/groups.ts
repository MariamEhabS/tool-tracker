/**
 * @fileoverview Groups (Arrangements / Equipment) API endpoints and TanStack Query hooks.
 *
 * Provides hooks for: listing groups (paginated), fetching a single group,
 * and fetching Procore fetch-global status for a group.
 *
 * Provides API functions for: creating, updating (patch), and deleting groups
 * (single, bulk, and async), plus Procore fetch-global queries by tool.
 *
 * Query keys: groupsKeys.all, groupsKeys.list(filters), groupsKeys.detail(id)
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { axiosInstance } from "../index";
import axios from "axios";
import { logApiError, logProcoreError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Shape of a group record returned by the API (arrangement, equipment, or procore-drawing-codes). */
export type GroupApi = {
  _id: string;
  type?: "arrangement" | "equipment";
  arrangementName?: string;
  arrangementType?: string;
  equipmentID?: string;
  equipmentName?: string;
  groupName?: string;
  project?: string;
  numberOfCodes?: number;
  mobileScanCount?: number;
  createdAt?: string;
  company?: string;
  categories?: string[];
  // Password protection fields
  passwordActivated?: boolean;
  password?: string;
  timezone?: string;
  weekdayPassword?: boolean;
  weekdayPasswordTimeStart?: string;
  weekdayPasswordTimeEnd?: string;
  weekendPassword?: boolean;
  weekendPasswordTimeStart?: string;
  weekendPasswordTimeEnd?: string;
};

/** Paginated response envelope for group list queries. */
export type PaginatedGroupsResponse = {
  success_message: string;
  total_pages: number;
  current_page: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  data: GroupApi[];
};

/** Parameters for paginated group list queries. */
export interface GroupsListParams {
  companyId?: string;
  projectId?: string;
  /** Filter by single group type */
  type?: "arrangement" | "equipment" | "procore-drawing-codes";
  /** Filter by multiple group types */
  types?: Array<"arrangement" | "equipment" | "procore-drawing-codes">;
  /** @deprecated Use type: "procore-drawing-codes" instead */
  arrangementType?: string;
  /** @deprecated No longer needed - procore-drawing-codes is now a separate type */
  excludeArrangementTypes?: string[];
  filter_ids?: string[];
  current_page?: number;
  per_page?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** When true, excludes groups whose associated project is archived */
  excludeArchivedProjects?: boolean;
}

/** Query key factory for group queries -- ensures consistent cache invalidation. */
export const groupsKeys = {
  /** Base key for all group queries. */
  all: ["Groups"] as const,
  /** Key for a paginated group list, incorporating all filter parameters for cache stability. */
  list: (filters: GroupsListParams) =>
    [
      ...groupsKeys.all,
      "list",
      filters.companyId ?? "",
      filters.projectId ?? "",
      filters.type ?? "",
      (filters.types ?? []).join(","),
      filters.arrangementType ?? "",
      (filters.excludeArrangementTypes ?? []).join(","),
      String(filters.current_page ?? ""),
      String(filters.per_page ?? ""),
      filters.search ?? "",
      filters.sortBy ?? "",
      filters.sortDir ?? "",
      String(filters.excludeArchivedProjects ?? ""),
    ] as const,
  /** Key for a single group detail by ID. */
  detail: (id: string) => [...groupsKeys.all, "detail", id] as const,
};

/**
 * Fetches a paginated list of groups for the current company/project.
 *
 * GET /groups -- Server-side pagination, sorting, and search.
 * Enabled when companyId or projectId is provided.
 * Uses keepPreviousData for seamless pagination transitions.
 * Stale time: 5 minutes; GC time: 30 minutes.
 *
 * @param params - Pagination, sort, search, type, and filter parameters
 * @returns TanStack Query result with PaginatedGroupsResponse
 */
export const useListGroups = (params: GroupsListParams) => {
  return useQuery({
    queryKey: groupsKeys.list(params),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<PaginatedGroupsResponse>(
          "/groups",
          { params },
        );
        return data;
      } catch (error) {
        logApiError(error, "list-groups-query-failed", {
          companyId: params.companyId,
          projectId: params.projectId,
        });
        throw error;
      }
    },
    enabled: !!params.companyId || !!params.projectId,
    // Caching configuration for stale-while-revalidate behavior
    staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    placeholderData: keepPreviousData, // Show previous data while fetching new page
  });
};

/**
 * Fetches a single group by ID.
 *
 * GET /groups/:id -- Enabled when groupId is truthy.
 * Stale time: 2 minutes; GC time: 10 minutes.
 *
 * @param groupId - The group ID to fetch
 * @returns TanStack Query result with { success_message, data: GroupApi }
 */
export const useSingleGroup = (groupId: string) => {
  return useQuery({
    queryKey: groupsKeys.detail(groupId),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(`/groups/${groupId}`);
        return data as { success_message: string; data: GroupApi };
      } catch (error) {
        logApiError(error, "single-group-query-failed", { groupId });
        throw error;
      }
    },
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * GET /groups/:id -- Imperative fetch for a single group (non-hook).
 *
 * @param groupId - The group ID to fetch
 * @returns Response with { success_message, data: GroupApi }
 */
export const getSingleGroup = async (groupId: string) => {
  try {
    const { data } = await axiosInstance.get(`/groups/${groupId}`);
    return data as { success_message: string; data: GroupApi };
  } catch (error) {
    logApiError(error, "get-single-group-failed", { groupId });
    throw error;
  }
};

/** Payload for updating (patching) a group. */
export type PatchGroupDto = {
  companyId: string;
  projectId?: string;
  groupName?: string;
  description?: string;
  equipmentID?: string;
  type?: "arrangement" | "equipment";
  // Password protection (group-level)
  passwordActivated?: boolean;
  password?: string;
  timezone?: string;
  weekdayPassword?: boolean;
  weekdayPasswordTimeStart?: string;
  weekdayPasswordTimeEnd?: string;
  weekendPassword?: boolean;
  weekendPasswordTimeStart?: string;
  weekendPasswordTimeEnd?: string;
};

/**
 * PATCH /groups/:id -- Updates a group's details.
 *
 * Supports updating group name, description, equipment ID, type,
 * and password protection settings. Transforms Axios errors into
 * user-friendly Error messages.
 *
 * @param groupId - The group ID to update
 * @param formData - The update payload
 * @returns Response with { success_message, data: GroupApi }
 */
export const patchGroup = async (
  groupId: string,
  formData: PatchGroupDto,
): Promise<{ success_message: string; data: GroupApi }> => {
  try {
    const { data } = await axiosInstance.patch(`/groups/${groupId}`, formData, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    // Log to Rollbar first
    logApiError(error, "patch-group-failed", { groupId });
    // Preserve existing error transformation
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(
          error.response.data.message ||
            `Failed to update group: ${error.response.statusText}`,
        );
      }
      throw new Error("Network error while updating group");
    }
    throw new Error("Unexpected error while updating group");
  }
};

/**
 * DELETE /groups/:id -- Deletes a single group.
 *
 * @param companyId - The company ID (sent in the request body)
 * @param groupId - The group ID to delete
 * @returns Response with { success_message, data: GroupApi }
 */
export const deleteSingleGroup = async (
  companyId: string,
  groupId: string,
): Promise<{ success_message: string; data: GroupApi }> => {
  try {
    const response = await axiosInstance.delete(`/groups/${groupId}`, {
      data: { companyId },
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error) {
    logApiError(error, "delete-single-group-failed", { companyId, groupId });
    throw error;
  }
};

/**
 * DELETE /groups/bulk -- Deletes multiple groups in a single request.
 *
 * Validates that the count does not exceed MAX_BULK_DELETE_COUNT.
 * Returns early with a no-op result if the array is empty.
 *
 * @param companyId - The company ID
 * @param groupIds - Set or array of group IDs to delete
 * @param projectId - Optional project ID for scoped deletion
 * @returns Response with success message, total count, and deleted groups
 */
export const deleteManyGroups = async (
  companyId: string,
  groupIds: Set<string> | string[],
  projectId?: string,
) => {
  const ids = Array.from(groupIds);
  if (ids.length === 0) {
    return { success_message: "No groups to delete", total_items: 0, data: [] };
  }
  if (ids.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${ids.length}.`,
    );
  }
  const form: Record<string, string | string[] | undefined> = {
    companyId,
    groupIds: ids,
    projectId,
  };
  try {
    // Bulk delete via DELETE /groups/bulk (controller: @Delete('bulk'))
    const response = await axiosInstance.delete(`/groups/bulk`, {
      data: form,
      headers: { "Content-Type": "application/json" },
    });
    return response.data as {
      success_message: string;
      total_items: number;
      data: GroupApi[];
    };
  } catch (error) {
    logApiError(error, "delete-many-groups-failed", {
      companyId,
      groupCount: ids.length,
    });
    throw error;
  }
};

/**
 * Delete a single group asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const deleteGroupAsync = async (
  companyId: string,
  groupId: string,
): Promise<{ jobId: string; message: string }> => {
  const response = await axiosInstance.post("/groups/delete-async", {
    companyId,
    groupId,
  });
  return response.data;
};

/**
 * Create a bulk group delete job that processes asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const createBulkGroupDeleteJob = async (
  companyId: string,
  groupIds: string[],
  projectId?: string,
): Promise<{ jobId: string; message: string }> => {
  const response = await axiosInstance.post("/groups/bulk-delete-async", {
    companyId,
    groupIds,
    projectId,
  });
  return response.data;
};

/** Payload for creating a new group. */
export type CreateGroupPayload = {
  companyId: string;
  projectId: string;
  groupName: string;
  type?: "arrangement" | "equipment" | "group" | "procore-drawing-codes";
  /** @deprecated Use type: "procore-drawing-codes" instead */
  arrangementType?: string;
  equipmentID?: string;
  description?: string;
  categories?: string[];
};

/**
 * POST /groups -- Creates a new group (arrangement, equipment, or procore-drawing-codes).
 *
 * @param form - Group creation payload including companyId, projectId, groupName, and type
 * @returns Response with { success_message, data: GroupApi }
 */
export const createGroup = async (
  form: CreateGroupPayload,
): Promise<{ success_message: string; data: GroupApi }> => {
  try {
    const { data } = await axiosInstance.post(`/groups`, form, {
      headers: { "Content-Type": "application/json" },
    });
    return data as { success_message: string; data: GroupApi };
  } catch (error) {
    logApiError(error, "create-group-failed", {
      companyId: form.companyId,
      projectId: form.projectId,
      type: form.type,
    });
    throw error;
  }
};

/**
 * GET /groups/:id/procore-fetch-global -- Fetches Procore global fetch status for a group.
 *
 * Returns whether this group has globally fetched Procore data.
 *
 * @param groupId - The group ID to query
 * @returns Procore fetch global status data
 */
export const getProcoreFetchGlobal = async (groupId: string) => {
  try {
    const { data } = await axiosInstance.get(
      `/groups/${groupId}/procore-fetch-global`,
    );
    return data;
  } catch (error) {
    logProcoreError(error, "procore-fetch-global-failed", { groupId });
    throw error;
  }
};

/**
 * Hook wrapper around getProcoreFetchGlobal.
 *
 * Enabled when groupId is truthy.
 *
 * @param groupId - The group ID to query
 * @returns TanStack Query result with Procore fetch global status
 */
export const useProcoreFetchGlobal = (groupId: string) => {
  return useQuery({
    queryKey: [...groupsKeys.detail(groupId), "procore-fetch-global"],
    queryFn: () => getProcoreFetchGlobal(groupId),
    enabled: !!groupId,
    refetchOnWindowFocus: false,
  });
};

/**
 * GET /groups/:id/procore-fetch-global?tool=... -- Fetches Procore global fetch status
 * for a specific Procore tool within a group.
 *
 * @param groupId - The group ID to query
 * @param tool - The Procore tool name to filter by
 * @returns Procore fetch global status data for the specified tool
 */
export const getProcoreFetchGlobalTool = async (
  groupId: string,
  tool: string,
) => {
  try {
    const { data } = await axiosInstance.get(
      `/groups/${groupId}/procore-fetch-global?tool=${encodeURIComponent(tool)}`,
    );
    return data;
  } catch (error) {
    logProcoreError(error, "procore-fetch-global-tool-failed", {
      groupId,
      tool,
    });
    throw error;
  }
};

/**
 * Hook wrapper around getProcoreFetchGlobalTool.
 *
 * Enabled when both groupId and tool are truthy.
 *
 * @param groupId - The group ID to query
 * @param tool - The Procore tool name to filter by
 * @returns TanStack Query result with Procore fetch global status for the tool
 */
export const useProcoreFetchGlobalTool = (groupId: string, tool: string) => {
  return useQuery({
    queryKey: [...groupsKeys.detail(groupId), "procore-fetch-global", tool],
    queryFn: () => getProcoreFetchGlobalTool(groupId, tool),
    enabled: !!groupId && !!tool,
    refetchOnWindowFocus: false,
  });
};
