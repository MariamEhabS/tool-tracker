/**
 * @fileoverview Procore integration API endpoints and TanStack Query hooks.
 *
 * Wraps the Taliho backend's Procore proxy endpoints, which in turn call the
 * Procore REST API v1. All requests are authenticated via Taliho's OAuth token
 * management -- the frontend never calls Procore directly.
 *
 * Provides hooks for: fetching Procore locations, permissions, tools,
 * inspection templates, drawings (single and paginated/infinite), and
 * searching Procore projects across companies.
 *
 * Provides API functions for: triggering Procore sync for a group and
 * creating bulk Procore inspections.
 *
 * Query keys: procoreKeys.all, procoreKeys.sync(...), procoreKeys.locations(...),
 *             procoreKeys.permissions(...), procoreKeys.tools(...)
 *
 * Caching note: Most Procore hooks use staleTime: 0 to always fetch fresh data
 * when query key parameters change (e.g., on project switch), with retry: 1 to
 * limit retries on Procore API failures.
 */
import { axiosInstance } from "../index";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { logProcoreError } from "@/utils/rollbar";

/** Query key factory for Procore data queries -- ensures consistent cache invalidation. */
export const procoreKeys = {
  /** Base key for all Procore queries. */
  all: ["procore"] as const,
  /** Key for a Procore sync operation scoped to company, project, and grouping. */
  sync: (companyId: string, projectId: string, groupingId: string) =>
    [...procoreKeys.all, "sync", companyId, projectId, groupingId] as const,
  /**
   * Key for Procore locations query.
   * Includes both Taliho IDs and Procore IDs for precise cache targeting.
   */
  locations: (
    companyId: string,
    projectId: string,
    procoreCompanyId: string,
    procoreProjectId: string,
  ) =>
    [
      ...procoreKeys.all,
      "locations",
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
    ] as const,
  /**
   * Key for Procore permissions query.
   * Includes both Taliho IDs and Procore IDs for precise cache targeting.
   */
  permissions: (
    companyId: string,
    projectId: string,
    procoreCompanyId: string,
    procoreProjectId: string,
  ) =>
    [
      ...procoreKeys.all,
      "permissions",
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
    ] as const,
  /** Key for Procore tools list scoped to company and project. */
  tools: (companyId: string, projectId: string) =>
    [...procoreKeys.all, "tools", companyId, projectId] as const,
};

/**
 * Fetches Procore location hierarchy for a project.
 *
 * Wraps Procore REST API: GET /rest/v1.0/projects/{procore_project_id}/locations
 * via GET /procore/locations on the Taliho backend.
 *
 * Enabled when all four IDs are truthy and procoreProjectId is not "none".
 * Uses staleTime: 0 so data is always fresh on project switch.
 *
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @param procoreCompanyId - Procore company ID
 * @param procoreProjectId - Procore project ID
 * @returns TanStack Query result with Procore location data
 */
export const useProcoreLocations = (
  companyId: string,
  projectId: string, // Taliho project _id
  procoreCompanyId: string,
  procoreProjectId: string,
) => {
  return useQuery({
    queryKey: procoreKeys.locations(
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
    ),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/procore/locations", {
          params: {
            companyId, // Taliho company _id
            projectId, // Taliho project _id
          },
        });
        return data;
      } catch (error) {
        logProcoreError(error, "procore-locations-query-failed", {
          companyId,
          projectId,
          procoreCompanyId,
          procoreProjectId,
        });
        throw error;
      }
    },
    enabled:
      Boolean(companyId) &&
      Boolean(projectId) &&
      Boolean(procoreCompanyId) &&
      Boolean(procoreProjectId) &&
      procoreProjectId !== "none",
    staleTime: 0, // Always fetch fresh data on project change
    refetchOnMount: false, // Don't refetch on mount, only when query key changes
    retry: 1, // Only retry once on failure
  });
};

/**
 * Fetches Procore tool-level permissions for a project.
 *
 * Wraps Procore REST API permissions check via GET /procore/permissions
 * on the Taliho backend. Returns which Procore tools the user can access.
 *
 * Enabled when all four IDs are truthy and procoreProjectId is not "none".
 * Uses staleTime: 0 so data is always fresh on project switch.
 *
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @param procoreCompanyId - Procore company ID
 * @param procoreProjectId - Procore project ID
 * @returns TanStack Query result with Procore permissions data
 */
export const useProcorePermissions = (
  companyId: string,
  projectId: string, // Taliho project _id
  procoreCompanyId: string,
  procoreProjectId: string,
) => {
  return useQuery({
    queryKey: procoreKeys.permissions(
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
    ),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/procore/permissions", {
          params: {
            companyId, // Taliho company _id
            projectId, // Taliho project _id
          },
        });
        return data;
      } catch (error) {
        logProcoreError(error, "procore-permissions-query-failed", {
          companyId,
          projectId,
          procoreCompanyId,
          procoreProjectId,
        });
        throw error;
      }
    },
    enabled:
      Boolean(companyId) &&
      Boolean(projectId) &&
      Boolean(procoreCompanyId) &&
      Boolean(procoreProjectId) &&
      procoreProjectId !== "none",
    staleTime: 0, // Always fetch fresh data on project change
    refetchOnMount: false, // Don't refetch on mount, only when query key changes
    retry: 1, // Only retry once on failure
  });
};

/**
 * Fetches the list of available Procore tools (e.g., Observations, RFIs, Submittals)
 * for a project.
 *
 * Wraps Procore REST API: GET /rest/v1.0/projects/{id}/tools
 * via GET /procore/tools on the Taliho backend.
 *
 * Enabled when both companyId and projectId are truthy.
 *
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @returns TanStack Query result with array of Procore tool objects
 */
export const useProcoreTools = (companyId: string, projectId: string) => {
  return useQuery({
    queryKey: procoreKeys.tools(companyId, projectId),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/procore/tools", {
          params: { companyId, projectId },
        });
        return data as Array<{
          id: string | number;
          title?: string;
          name?: string;
          engine_name?: string;
          is_active?: boolean;
        }>;
      } catch (error) {
        logProcoreError(error, "procore-tools-query-failed", {
          companyId,
          projectId,
        });
        throw error;
      }
    },
    enabled: Boolean(companyId) && Boolean(projectId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/**
 * Fetches available Procore inspection templates for a project.
 *
 * Wraps Procore REST API: GET /rest/v1.0/projects/{id}/checklist/list_templates
 * via GET /procore/inspection-templates on the Taliho backend.
 *
 * Enabled when companyId, projectId, and the enabled flag are all truthy.
 *
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @param enabled - Whether to enable the query (default: true)
 * @returns TanStack Query result with array of { id, name } template objects
 */
export const useProcoreInspectionTemplates = (
  companyId: string,
  projectId: string,
  enabled = true,
) => {
  return useQuery({
    queryKey: [
      ...procoreKeys.all,
      "inspection-templates",
      companyId,
      projectId,
    ],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          "/procore/inspection-templates",
          {
            params: { companyId, projectId },
          },
        );
        return data as Array<{ id: string | number; name: string }>;
      } catch (error) {
        logProcoreError(error, "procore-inspection-templates-query-failed", {
          companyId,
          projectId,
        });
        throw error;
      }
    },
    enabled: enabled && Boolean(companyId) && Boolean(projectId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/**
 * POST /procore/sync -- Triggers a Procore sync for a group (arrangement/equipment).
 *
 * Pulls items from Procore into the specified Taliho group and creates
 * corresponding QR codes. Returns the count of newly created items.
 *
 * @param params - Sync parameters including companyId, projectId, groupingId, and optional groupingType
 * @returns Object with success message and optional created count
 */
export const postProcoreSync = async (params: {
  companyId: string;
  projectId: string;
  groupingId: string;
  groupingType?: "arrangement" | "equipment";
}) => {
  const { companyId, projectId, groupingId, groupingType } = params;
  try {
    const { data } = await axiosInstance.post(
      "/procore/sync",
      { groupingId, groupingType },
      {
        params: { companyId, projectId },
      },
    );
    return data as { success_message: string; created?: number };
  } catch (error) {
    logProcoreError(error, "procore-sync-failed", {
      companyId,
      projectId,
      groupingId,
      groupingType,
    });
    throw error;
  }
};

/**
 * POST /procore/inspections/bulk -- Creates Procore inspections in bulk for QR codes
 * within a group, using a specified inspection template.
 *
 * Wraps the Procore Inspections API to create checklist-based inspections
 * for each QR code in the group.
 *
 * @param params - Bulk inspection parameters including groupingId, inspectionTemplateId,
 *                 and optional qrCodeIds for targeted creation
 * @returns Object with success message, created count, and total QR codes processed
 */
export const postProcoreCreateBulkInspections = async (params: {
  companyId: string;
  projectId: string;
  groupingId: string;
  inspectionTemplateId: string;
  groupingType?: "arrangement" | "equipment";
  qrCodeIds?: string[];
}) => {
  const {
    companyId,
    projectId,
    groupingId,
    inspectionTemplateId,
    groupingType,
    qrCodeIds,
  } = params;
  try {
    const { data } = await axiosInstance.post(
      "/procore/inspections/bulk",
      { groupingId, inspectionTemplateId, groupingType, qrCodeIds },
      {
        params: { companyId, projectId },
      },
    );
    return data as {
      success_message: string;
      created: number;
      total_qrcodes: number;
    };
  } catch (error) {
    logProcoreError(error, "procore-create-bulk-inspections-failed", {
      companyId,
      projectId,
      groupingId,
      inspectionTemplateId,
    });
    throw error;
  }
};

export const postProcoreCreateBulkInspectionsAsync = async (params: {
  companyId: string;
  projectId: string;
  groupingId: string;
  inspectionTemplateId: string;
  groupingType?: "arrangement" | "equipment" | "group";
  qrCodeIds?: string[];
}) => {
  const {
    companyId,
    projectId,
    groupingId,
    inspectionTemplateId,
    groupingType,
    qrCodeIds,
  } = params;
  try {
    const { data } = await axiosInstance.post(
      "/procore/inspections/bulk-async",
      { groupingId, inspectionTemplateId, groupingType, qrCodeIds },
      {
        params: { companyId, projectId },
      },
    );
    return data as {
      jobId: string;
      message: string;
      total: number;
    };
  } catch (error) {
    logProcoreError(error, "procore-create-bulk-inspections-async-failed", {
      companyId,
      projectId,
      groupingId,
      inspectionTemplateId,
    });
    throw error;
  }
};

/**
 * Fetches Procore drawings associated with a specific QR code.
 *
 * Wraps Procore REST API: GET /rest/v1.0/projects/{id}/drawings
 * via GET /procore/drawings on the Taliho backend.
 *
 * Enabled when all IDs are truthy and procoreProjectId is not "none".
 * Uses staleTime: 0 for fresh data on project switch.
 *
 * @param qrCodeId - The Taliho QR code _id
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @param procoreCompanyId - Procore company ID
 * @param procoreProjectId - Procore project ID
 * @returns TanStack Query result with Procore drawings data
 */
export const useProcoreDrawings = (
  qrCodeId: string,
  companyId: string,
  projectId: string, // Taliho project _id
  procoreCompanyId: string,
  procoreProjectId: string,
) => {
  return useQuery({
    queryKey: [
      ...procoreKeys.all,
      "drawings",
      qrCodeId,
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
    ],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/procore/drawings", {
          params: {
            qrCodeId,
            companyId, // Taliho company _id
            projectId, // Taliho project _id
          },
        });
        return data;
      } catch (error) {
        logProcoreError(error, "procore-drawings-query-failed", {
          qrCodeId,
          companyId,
          projectId,
          procoreCompanyId,
          procoreProjectId,
        });
        throw error;
      }
    },
    enabled:
      Boolean(companyId) &&
      Boolean(projectId) &&
      Boolean(procoreCompanyId) &&
      Boolean(procoreProjectId) &&
      procoreProjectId !== "none",
    staleTime: 0, // Always fetch fresh data on project change
    refetchOnMount: false, // Don't refetch on mount, only when query key changes
    retry: 1, // Only retry once on failure
  });
};

/**
 * Fetches Procore drawings with cursor-based infinite pagination.
 *
 * Wraps Procore REST API: GET /rest/v1.0/projects/{id}/drawings (paginated)
 * via GET /procore/drawings?paginated=true on the Taliho backend.
 *
 * Uses TanStack useInfiniteQuery with cursor-based pagination ("areaIndex:drawingIndex"
 * format). Each page returns perPage items. Passes qrCodeId="new" for unpaged listing.
 *
 * Enabled when all IDs are truthy and procoreProjectId is not "none".
 *
 * @param companyId - Taliho company _id
 * @param projectId - Taliho project _id
 * @param procoreCompanyId - Procore company ID
 * @param procoreProjectId - Procore project ID
 * @param perPage - Number of drawings per page (default: 50)
 * @returns TanStack InfiniteQuery result with paginated drawings data
 */
export const useProcoreDrawingsPaged = (
  companyId: string,
  projectId: string, // Taliho project _id
  procoreCompanyId: string,
  procoreProjectId: string,
  perPage: number = 50,
) => {
  return useInfiniteQuery({
    queryKey: [
      ...procoreKeys.all,
      "drawingsPaged",
      companyId,
      projectId,
      procoreCompanyId,
      procoreProjectId,
      perPage,
    ],
    queryFn: async ({
      pageParam,
    }): Promise<{ data: unknown[]; nextCursor?: string; hasNext: boolean }> => {
      try {
        const cursor = (typeof pageParam === "string" && pageParam) || "0:0";
        const { data } = await axiosInstance.get("/procore/drawings", {
          params: {
            qrCodeId: "new",
            companyId,
            projectId,
            paginated: true,
            perPage,
            cursor,
          },
        });
        return data;
      } catch (error) {
        logProcoreError(error, "procore-drawings-paged-query-failed", {
          companyId,
          projectId,
          procoreCompanyId,
          procoreProjectId,
        });
        throw error;
      }
    },
    getNextPageParam: (lastPage: {
      data: unknown[];
      nextCursor?: string;
      hasNext: boolean;
    }) => lastPage?.nextCursor,
    initialPageParam: "0:0",
    enabled:
      Boolean(companyId) &&
      Boolean(projectId) &&
      Boolean(procoreCompanyId) &&
      Boolean(procoreProjectId) &&
      procoreProjectId !== "none",
    staleTime: 0,
    refetchOnMount: false,
    retry: 1,
  });
};

/** A Procore company object from the search results. */
export interface ProcoreCompany {
  id: number;
  name: string;
  is_active: boolean;
}

/** A Procore project object from the search results, including optional address fields. */
export interface ProcoreProject {
  id: number;
  name: string;
  display_name: string;
  status_name: string;
  company?: {
    id: number;
    name: string;
  };
  // Address fields from Procore API
  address?: string;
  city?: string;
  state_code?: string;
  zip?: string;
}

/** Grouped search result: companies with their associated projects. */
export interface ProcoreProjectsSearchResult {
  companies: ProcoreCompany[];
  projects: ProcoreProject[][];
}

/**
 * Searches Procore projects across all connected Procore companies.
 *
 * Wraps Procore REST API: GET /rest/v1.0/companies/{id}/projects (with search)
 * via GET /procore/projects/search on the Taliho backend.
 *
 * Returns companies and their projects grouped together. Results are cached
 * for 1 minute (staleTime: 60000) to reduce Procore API calls during typing.
 *
 * @param companyId - Taliho company _id
 * @param search - Optional search string to filter projects by name
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns TanStack Query result with ProcoreProjectsSearchResult
 */
export const useProcoreProjectsSearch = (
  companyId: string,
  search?: string,
  enabled = true,
) => {
  return useQuery({
    queryKey: [...procoreKeys.all, "projectsSearch", companyId, search || ""],
    queryFn: async (): Promise<ProcoreProjectsSearchResult> => {
      try {
        const { data } = await axiosInstance.get("/procore/projects/search", {
          params: {
            companyId,
            search: search || undefined,
          },
        });
        return data;
      } catch (error) {
        logProcoreError(error, "procore-projects-search-query-failed", {
          companyId,
          search,
        });
        throw error;
      }
    },
    enabled: Boolean(companyId) && enabled,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
};
