/**
 * @fileoverview Project API endpoints and TanStack Query hooks.
 *
 * Provides hooks for: listing all projects (deprecated), listing projects with
 * server-side pagination, fetching a single project by ID (with or without companyId).
 *
 * Provides API functions for: creating, patching, and deleting projects
 * (single, bulk, and async).
 *
 * Query keys: projectKeys.all, projectKeys.list(companyId), projectKeys.listPaginated(params),
 *             projectKeys.single(id), projectKeys.detail(id)
 */
import { axiosInstance } from "../index";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Project } from "../../types";
import { logApiError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Payload for updating (patching) a project. */
export type PatchProjectDto = {
  companyId: string;
  projectName?: string;
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  projectZIP?: string;
  clientName?: string;
  archived?: boolean;
  status?: string; // legacy (to be removed)
  projectStatus?: string;
  procoreProjectID?: string;
  procoreCompanyID?: string;
};

/** Response envelope for single project operations. */
export type SingleProjectResponseDto = {
  success_message: string;
  data: Project;
};

/** Payload for bulk project deletion. */
export type DeleteManyProjectsDto = {
  companyId: string;
  projectIds: string[];
};

/** Response envelope for operations that return multiple projects. */
export type MultipleProjectResponseDto = {
  success_message: string;
  total_items: number;
  data: Project[];
};

/** Payload for creating a new project. */
export type CreateProjectDto = {
  companyId: string;
  userId: string; // Required for permission validation
  projectName: string;
  projectAddress?: string;
  projectCity: string;
  projectState: string;
  projectZIP: string;
  clientName?: string;
};

/** Parameters for paginated project list queries. */
export type ListProjectsParams = {
  companyId: string;
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};

/** Paginated response envelope for project list queries. */
export type ProjectsResponse = {
  success_message: string;
  total_pages: number;
  current_page: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  data: Project[];
};

/** Query key factory for project queries -- ensures consistent cache invalidation. */
export const projectKeys = {
  /** Base key for all project queries. */
  all: ["Projects"] as const,
  /**
   * Key for the legacy all-projects query.
   * @deprecated Use listPaginated for server-side pagination.
   */
  list: (companyId: string) => [...projectKeys.all, "list", companyId] as const,
  /** Key for a paginated project list, incorporating all filter parameters for cache stability. */
  listPaginated: (params: ListProjectsParams) =>
    [
      ...projectKeys.all,
      "listPaginated",
      params.companyId ?? "",
      String(params.page ?? 1),
      String(params.perPage ?? 20),
      params.search ?? "",
      params.status ?? "",
      params.sortKey ?? "",
      params.sortDir ?? "",
    ] as const,
  /** Key for a single project by ID. */
  single: (id: string) => [...projectKeys.all, "single", id] as const,
  /** Alternative detail key for a single project. */
  detail: (id: string) => [...projectKeys.all, id] as const,
};

/**
 * @deprecated Use useListProjects for server-side pagination.
 * This hook fetches ALL projects which causes performance issues for large datasets.
 */
export const useAllProjects = (companyId: string) => {
  return useQuery({
    queryKey: projectKeys.list(companyId),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<Project[]>(
          `/aggregation/all-projects/${companyId}`,
        );
        return data;
      } catch (error) {
        logApiError(error, "all-projects-query-failed", { companyId });
        throw error;
      }
    },
    enabled: Boolean(companyId),
    // Caching configuration for stale-while-revalidate behavior
    staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });
};

/**
 * Fetch projects with server-side pagination.
 * Supports pagination, search, filtering, and sorting.
 */
export const useListProjects = (params: ListProjectsParams) => {
  return useQuery({
    queryKey: projectKeys.listPaginated(params),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<ProjectsResponse>(`/project`, {
          params: {
            companyId: params.companyId,
            current_page: params.page ?? 1,
            per_page: params.perPage ?? 20,
            search: params.search || undefined,
            status: params.status || undefined,
            sort_by: params.sortKey || undefined,
            sort_dir: params.sortDir || undefined,
          },
        });
        return data;
      } catch (error) {
        logApiError(error, "list-projects-query-failed", {
          companyId: params.companyId,
          page: params.page,
        });
        throw error;
      }
    },
    enabled: Boolean(params.companyId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetches a single project by ID, scoped to a company.
 *
 * GET /project/:id?companyId=... -- Enabled when both projectId and companyId are truthy.
 * Stale time: 2 minutes; GC time: 10 minutes.
 *
 * @param companyId - The company ID for authorization
 * @param projectId - The project ID to fetch
 * @returns TanStack Query result with the Project data
 */
export const useSingleProject = (companyId: string, projectId: string) => {
  return useQuery({
    queryKey: projectKeys.single(projectId), // Update this line
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<Project>(
          `/project/${projectId}?companyId=${companyId}`,
        ); // Include companyId in the request
        return data;
      } catch (error) {
        logApiError(error, "single-project-query-failed", { projectId });
        throw error;
      }
    },
    enabled: Boolean(projectId) && Boolean(companyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch a single project by ID only, without requiring companyId.
 * Useful for cases where the caller only has projectId (e.g., legacy QR codes
 * that have a project reference but no company reference).
 */
export const useSingleProjectByIdOnly = (projectId: string) => {
  return useQuery({
    queryKey: [...projectKeys.single(projectId), "by-id-only"] as const,
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<SingleProjectResponseDto>(
          `/project/by-id/${projectId}`,
        );
        return data;
      } catch (error) {
        logApiError(error, "project-by-id-query-failed", { projectId });
        throw error;
      }
    },
    enabled: Boolean(projectId),
  });
};

/**
 * DELETE /project/bulk -- Deletes multiple projects in a single request.
 *
 * Validates that projectIds is non-empty and does not exceed MAX_BULK_DELETE_COUNT.
 *
 * @param dto - Deletion payload with companyId and projectIds array
 * @returns Response with success message, total count, and deleted projects
 */
export async function deleteManyProjects(
  dto: DeleteManyProjectsDto,
): Promise<MultipleProjectResponseDto> {
  if (!dto.projectIds || dto.projectIds.length === 0) {
    throw new Error("projectIds is required for bulk project deletion");
  }
  if (dto.projectIds.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${dto.projectIds.length}.`,
    );
  }
  try {
    const response = await axiosInstance.delete("/project/bulk", {
      data: dto,
      headers: { "Content-Type": "application/json" },
    });
    return response.data as MultipleProjectResponseDto;
  } catch (error) {
    logApiError(error, "delete-many-projects-failed", {
      companyId: dto.companyId,
      projectCount: dto.projectIds?.length,
    });
    throw error;
  }
}

/**
 * DELETE /project/:id -- Deletes a single project.
 *
 * @param companyId - The company ID (sent in the request body)
 * @param projectId - The project ID to delete
 * @returns Response with success message and deleted project data
 */
export async function deleteSingleProject(
  companyId: string,
  projectId: string,
): Promise<SingleProjectResponseDto> {
  try {
    const response = await axiosInstance.delete(`/project/${projectId}`, {
      data: { companyId },
      headers: { "Content-Type": "application/json" },
    });
    return response.data as SingleProjectResponseDto;
  } catch (error) {
    logApiError(error, "delete-single-project-failed", {
      companyId,
      projectId,
    });
    throw error;
  }
}

/**
 * Delete a single project asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const deleteProjectAsync = async (
  companyId: string,
  projectId: string,
): Promise<{ jobId: string; message: string }> => {
  const response = await axiosInstance.post("/project/delete-async", {
    companyId,
    projectId,
  });
  return response.data;
};

/**
 * Create a bulk project delete job that processes asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const createBulkProjectDeleteJob = async (
  companyId: string,
  projectIds: string[],
): Promise<{ jobId: string; message: string }> => {
  const response = await axiosInstance.post("/project/bulk-delete-async", {
    companyId,
    projectIds,
  });
  return response.data;
};

/**
 * PATCH /project/:id -- Updates a project's details.
 *
 * @param projectId - The project ID to update
 * @param dto - The update payload including companyId and optional project fields
 * @returns Response with success message and updated project data
 */
export async function patchProject(
  projectId: string,
  dto: PatchProjectDto,
): Promise<SingleProjectResponseDto> {
  try {
    const response = await axiosInstance.patch(`/project/${projectId}`, dto, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data as SingleProjectResponseDto;
  } catch (error) {
    logApiError(error, "patch-project-failed", {
      companyId: dto.companyId,
      projectId,
    });
    throw error;
  }
}

/**
 * POST /project -- Creates a new project.
 *
 * @param dto - Project creation payload including companyId, userId, projectName, and address fields
 * @returns Response with success message and the created project
 */
export async function createProject(
  dto: CreateProjectDto,
): Promise<SingleProjectResponseDto> {
  try {
    const response = await axiosInstance.post(`/project`, dto, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data as SingleProjectResponseDto;
  } catch (error) {
    logApiError(error, "create-project-failed", { companyId: dto.companyId });
    throw error;
  }
}
