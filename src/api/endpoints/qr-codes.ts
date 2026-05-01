/**
 * @fileoverview QR Code API endpoints and TanStack Query hooks.
 *
 * Provides hooks for: listing QR codes (paginated), fetching a single QR code,
 * fetching QR image signed URLs, and listing quick codes.
 *
 * Provides API functions for: creating, updating, and deleting QR codes (single and bulk),
 * adding custom links, generating bulk QR codes, async job-based bulk operations
 * (create, delete) with SSE streaming, bulk group/project assignment, bulk password
 * setting, and downloading QR codes.
 *
 * Query keys: QrKeys.all, QrKeys.single(id), QrKeys.list(filters), QrKeys.quickCodes(filters)
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { axiosInstance } from "..";
import { QRCode } from "../../types";
import { logger } from "@/utils/logger";
import { logQRError, logJobError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Parameters for paginated QR code list queries. */
export interface QRCodeListParams {
  companyId?: string;
  projectId?: string;
  groupingId?: string;
  groupingType?: string;
  // Optional: array of grouping types for multi-select filtering (e.g., ['arrangement', 'none'])
  groupingTypes?: string[];
  filter_ids?: string[];
  current_page?: number;
  per_page?: number;
  search?: string;
  types?: string[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  // Optional: further narrow arrangements by specific arrangementType (e.g., 'Procore Drawings Codes')
  arrangementType?: string;
  // Optional: project status buckets to filter by (active, archived, completed, on-hold, others)
  projectStatus?: string[];
}

/** Payload for bulk QR code deletion. */
interface DeleteManyQRCodesDto {
  companyId: string;
  qrcodeIds?: string[];
  groupingId?: string;
  groupingType?: string;
  projectId?: string;
}

/** Response envelope for operations that return multiple QR codes. */
interface MultipleQRCodeResponseDto {
  success_message: string;
  total_items: number;
  data: QRCode[];
}

/** Query key factory for QR code queries -- ensures consistent cache invalidation. */
export const QrKeys = {
  /** Base key for all QR queries. */
  all: ["Qrs"] as const,
  /** Key for a single QR code by ID. */
  single: (id: string) => [...QrKeys.all, "single", id] as const,
  /** Key for a paginated QR code list, incorporating all filter parameters for cache stability. */
  list: (filters: QRCodeListParams) =>
    [
      ...QrKeys.all,
      "list",
      // Flatten to a stable tuple to avoid referential key traps
      filters.companyId ?? "",
      filters.projectId ?? "",
      filters.groupingId ?? "",
      filters.groupingType ?? "",
      (filters.groupingTypes ?? []).join(","),
      String(filters.current_page ?? ""),
      String(filters.per_page ?? ""),
      filters.search ?? "",
      (filters.types ?? []).join(","),
      filters.sortBy ?? "",
      filters.sortDir ?? "",
      filters.arrangementType ?? "",
      (filters.projectStatus ?? []).join(","),
    ] as const,
  /** Key for the quick codes aggregation query. */
  quickCodes: (filters: Record<string, unknown>) =>
    [...QrKeys.all, "list", filters] as const,
};

/**
 * Fetches a paginated list of QR codes for the current company.
 *
 * GET /qr-code -- Server-side pagination, sorting, and search.
 * Enabled when companyId or projectId is provided.
 * Uses keepPreviousData for seamless pagination transitions.
 * Stale time: 5 minutes; GC time: 30 minutes.
 *
 * @param params - Pagination, sort, search, and filter parameters
 * @returns TanStack Query result with paginated QR code data
 */
export const useListQRCodes = (params: QRCodeListParams) => {
  return useQuery({
    queryKey: QrKeys.list(params),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/qr-code", {
          params,
        });
        return data;
      } catch (error) {
        logQRError(error, "list-qr-codes-query-failed", undefined, {
          companyId: params.companyId,
          projectId: params.projectId,
          page: params.current_page,
        });
        throw error;
      }
    },
    enabled: !!params.companyId || !!params.projectId,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

/**
 * Fetches a single QR code by ID.
 *
 * GET /qr-code/:id -- Resolves companyId from localStorage if not provided.
 * Enabled when both qrCodeId and companyId are available.
 * Stale time: 2 minutes; GC time: 10 minutes.
 *
 * @param qrCodeId - The QR code ID to fetch
 * @param companyId - Optional company ID (falls back to stored user's companyId)
 * @returns TanStack Query result with the QR code data
 */
export const useSingleQRCode = (qrCodeId: string, companyId?: string) => {
  // Get companyId from localStorage if not provided
  const resolvedCompanyId = companyId || getStoredUser()?.companyId || "";

  return useQuery({
    queryKey: QrKeys.single(qrCodeId),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(`/qr-code/${qrCodeId}`, {
          params: { companyId: resolvedCompanyId },
        });
        return data;
      } catch (error) {
        logQRError(error, "single-qr-code-query-failed", qrCodeId);
        throw error;
      }
    },
    enabled: !!qrCodeId && !!resolvedCompanyId,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Fetches a pre-signed S3 URL for the QR code image.
 *
 * GET /qr-code/image/:id -- Returns a signed URL valid for 60 minutes.
 * Cached for 50 minutes to avoid fetching an expired URL.
 *
 * @param qrCodeId - The QR code ID whose image URL to fetch
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns TanStack Query result with the signed URL string
 */
export const useQRImageSignedUrl = (
  qrCodeId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QrKeys.single(qrCodeId), "image"],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(`/qr-code/image/${qrCodeId}`);
        return data.signedUrl as string;
      } catch (error) {
        // logQRError already skips 4xx errors, so we can simplify this
        logQRError(error, "qr-image-signed-url-failed", qrCodeId);
        throw error;
      }
    },
    enabled: enabled && !!qrCodeId,
    staleTime: 1000 * 60 * 50, // Cache for 50 minutes (signed URL is valid for 60 minutes)
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch a single signed URL for a QR code image
 * Returns null if the request fails or if the S3 object doesn't exist
 */
export const fetchSignedUrl = async (
  qrCodeId: string,
): Promise<string | null> => {
  try {
    const { data } = await axiosInstance.get(`/qr-code/image/${qrCodeId}`);
    // Backend now returns { signedUrl: string | null, exists: boolean }
    // signedUrl will be null if the S3 object doesn't exist
    return data.signedUrl ?? null;
  } catch (error) {
    // logQRError already skips 4xx errors (including 404s)
    logQRError(error, "fetch-signed-url", qrCodeId);
    return null;
  }
};

/**
 * Fetch signed URLs for multiple QR codes in parallel
 * Returns a map of qrCodeId -> signedUrl (or null if fetch failed)
 */
export const fetchSignedUrlsBatch = async (
  qrCodeIds: string[],
): Promise<Map<string, string | null>> => {
  const results = await Promise.all(
    qrCodeIds.map(async (id) => {
      const signedUrl = await fetchSignedUrl(id);
      return [id, signedUrl] as const;
    }),
  );
  return new Map(results);
};

/**
 * Fetches quick codes (aggregated QR code data) for a company and project.
 *
 * GET /aggregation/quick-codes/:companyId/:projectId
 * Enabled when companyId or projectId is provided.
 *
 * @param params - Parameters including companyId and projectId
 * @returns TanStack Query result with aggregated quick code data
 */
export const useListQuickCodes = (params: QRCodeListParams) => {
  return useQuery({
    queryKey: QrKeys.quickCodes(params as Record<string, unknown>),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          `/aggregation/quick-codes/${params.companyId}/${params.projectId}`,
          {
            params,
          },
        );
        return data;
      } catch (error) {
        logQRError(error, "quick-codes-query-failed", undefined, {
          companyId: params.companyId,
          projectId: params.projectId,
        });
        throw error;
      }
    },
    enabled: !!params.companyId || !!params.projectId,
    // keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
};

/**
 * DELETE /qr-code/:id -- Deletes a single QR code.
 *
 * @param companyId - The company ID (sent in the request body)
 * @param qrcodeId - The QR code ID to delete
 * @returns The deleted QR code response envelope
 */
export const deleteSingleQRCode = async (
  companyId: string,
  qrcodeId: string,
): Promise<SingleQRCodeResponseDto> => {
  try {
    const response = await axiosInstance.delete(`/qr-code/${qrcodeId}`, {
      data: { companyId },
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    logQRError(error, "delete-qr-code-failed", qrcodeId);
    logger.error(`Error deleting QR code with ID ${qrcodeId}:`, error);
    throw error;
  }
};

/**
 * DELETE /qr-code/bulk -- Deletes multiple QR codes in a single request.
 *
 * Validates that the count does not exceed MAX_BULK_DELETE_COUNT.
 * Returns early with a no-op result if the array is empty.
 *
 * @param companyId - The company ID
 * @param qrcodeIds - Set or array of QR code IDs to delete
 * @param groupingId - Optional grouping ID for scoped deletion
 * @param groupingType - Optional grouping type for scoped deletion
 * @param projectId - Optional project ID for scoped deletion
 * @returns Response with success message, total count, and deleted QR codes
 */
export const deleteManyQRCodes = async (
  companyId: string,
  qrcodeIds: Set<string> | string[],
  groupingId?: string,
  groupingType?: string,
  projectId?: string,
): Promise<MultipleQRCodeResponseDto> => {
  const qrcodeIdsArray = Array.from(qrcodeIds);
  if (qrcodeIdsArray.length === 0) {
    return {
      success_message: "No QR codes to delete",
      total_items: 0,
      data: [],
    };
  }
  if (qrcodeIdsArray.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${qrcodeIdsArray.length}.`,
    );
  }
  try {
    const formData: DeleteManyQRCodesDto = {
      companyId,
      qrcodeIds: qrcodeIdsArray,
    };

    if (groupingId) formData.groupingId = groupingId;
    if (groupingType) formData.groupingType = groupingType;
    if (projectId) formData.projectId = projectId;

    const response = await axiosInstance.delete("/qr-code/bulk", {
      data: formData,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    logQRError(error, "delete-qr-codes-bulk-failed", undefined, {
      count: qrcodeIdsArray.length,
    });
    logger.error("Error deleting QR codes:", error);
    throw error;
  }
};

/**
 * PATCH /qr-code/:id -- Updates a QR code's details.
 *
 * Supports updating name, description, project/group assignment,
 * Procore fetch flag, and password protection settings.
 *
 * @param qrcodeId - The QR code ID to update
 * @param formData - The update payload including companyId and optional fields
 * @returns Response with success message and updated QR code data
 */
export const updateQRCodeDetails = async (
  qrcodeId: string,
  formData: {
    companyId: string;
    projectId?: string;
    groupingId?: string;
    groupingType?: string;
    qrcodeName?: string;
    description?: string;
    procoreFetch?: boolean;
    // Password protection
    passwordActivated?: boolean;
    password?: string;
    timezone?: string;
    weekdayPassword?: boolean;
    weekdayPasswordTimeStart?: string;
    weekdayPasswordTimeEnd?: string;
    weekendPassword?: boolean;
    weekendPasswordTimeStart?: string;
    weekendPasswordTimeEnd?: string;
  },
): Promise<MultipleQRCodeResponseDto> => {
  try {
    const response = await axiosInstance.patch(
      `/qr-code/${qrcodeId}`,
      formData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (error) {
    logQRError(error, "update-qr-code-failed", qrcodeId);
    logger.error("Error updating QR code details:", error);
    throw error;
  }
};

/** Payload for creating a new QR code. */
export interface CreateQRCodeDto {
  companyId: string;
  projectId?: string;
  name: string;
  type:
    | "file"
    | "folder"
    | "url"
    | "static"
    | "procore-tool"
    | "procore-location"
    | "procore-drawing-code";
  groupingId?: string;
  groupingType?:
    | "arrangement"
    | "equipment"
    | "group"
    | "procore-drawing-codes";
  url?: string;
  description?: string;
  procoreTool?: string;
  procoreLinkedItemId?: string;
}

/** Response envelope for single QR code operations. */
export interface SingleQRCodeResponseDto {
  success_message: string;
  data: QRCode;
}

/**
 * POST /qr-code -- Creates a new QR code.
 *
 * @param formData - QR code creation payload (name, type, companyId, optional projectId, grouping, etc.)
 * @returns Response with success message and the created QR code
 */
export const createQRCode = async (
  formData: CreateQRCodeDto,
): Promise<SingleQRCodeResponseDto> => {
  try {
    const response = await axiosInstance.post("/qr-code", formData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    logQRError(error, "create-qr-code-failed", undefined, {
      type: formData.type,
      hasGrouping: Boolean(formData.groupingId),
    });
    throw error;
  }
};

/**
 * POST /qr-code/:id/link -- Adds a custom reference link (URL document) to a QR code.
 *
 * @param qrcodeId - The QR code ID to add the link to
 * @param payload - Link details including companyId, documentName, referenceLink, and optional projectId/folderId
 * @returns The created document data
 */
export const addCustomLinkToQRCode = async (
  qrcodeId: string,
  payload: {
    companyId: string;
    projectId?: string;
    documentName: string;
    referenceLink: string;
    folderId?: string;
  },
) => {
  try {
    // Only include projectId in the request if it has a value
    const requestPayload = {
      companyId: payload.companyId,
      documentName: payload.documentName,
      referenceLink: payload.referenceLink,
      ...(payload.projectId && { projectId: payload.projectId }),
      ...(payload.folderId && { folderId: payload.folderId }),
    };
    const { data } = await axiosInstance.post(
      `/qr-code/${qrcodeId}/link`,
      requestPayload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    logQRError(error, "add-custom-link-failed", qrcodeId);
    throw error;
  }
};

/** Shape of a QR code returned from bulk generation. */
export type GeneratedBulkQr = {
  id: string;
  name: string;
  url: string;
  qrImageUrl?: string;
};

/**
 * POST /qr-code/bulk -- Synchronously generates multiple QR codes for an equipment group.
 *
 * For large batches, prefer the async job-based approach (createBulkQRJob).
 *
 * @param params - Equipment ID, project ID, number of codes, and optional creator
 * @returns Array of generated QR code records
 */
export const generateBulkQRCodes = async (params: {
  equipmentId: string; // Mongo _id of equipment
  projectId: string;
  numberOfCodes: number;
  createdBy?: string;
}): Promise<GeneratedBulkQr[]> => {
  try {
    const payload = {
      equipmentID: params.equipmentId,
      projectId: params.projectId,
      createdBy: params.createdBy,
      numberOfCodes: params.numberOfCodes,
    } as const;
    const { data } = await axiosInstance.post(`/qr-code/bulk`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data as GeneratedBulkQr[];
  } catch (error) {
    logQRError(error, "bulk-qr-sync-failed", undefined, {
      numberOfCodes: params.numberOfCodes,
      equipmentId: params.equipmentId,
    });
    throw error;
  }
};

/** Payload for async job-based bulk QR code creation (MongoDB + SSE). */
export interface CreateBulkAsyncDto {
  equipmentId: string;
  projectId: string;
  numberOfCodes: number;
  companyId: string;
  createdBy?: string;
  groupName?: string;
  startNumber?: number;
  excludeNumbers?: number[];
}

/** Payload for async bulk creation of explicit QR code items. */
export interface CreateBulkItemsAsyncDto {
  projectId: string;
  companyId: string;
  createdBy?: string;
  groupId?: string;
  groupName?: string;
  items: CreateQRCodeDto[];
}

/** Server-side job status for async bulk operations (polling response). */
export interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "paused";
  progress: number;
  total: number;
  groupId?: string;
  groupName?: string;
  currentOperation?: string;
  result?: {
    qrCodes?: GeneratedBulkQr[];
    groupId?: string;
    count?: number;
    failedCount?: number;
    totalRequested?: number;
  };
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  estimatedCompletionAt?: string;
  estimatedRemainingMs?: number;
  deadLetterCount?: number;
  startedAt?: string;
  avgItemTimeMs?: number;
}

/** Shape of an SSE event emitted during async job streaming. */
export interface JobStreamEvent {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "paused";
  progress: number;
  total: number;
  groupId?: string;
  groupName?: string;
  currentOperation?: string;
  result?: {
    qrCodes?: GeneratedBulkQr[];
    groupId?: string;
    count?: number;
    failedCount?: number;
    totalRequested?: number;
  };
  error?: string;
  estimatedCompletionAt?: string;
  estimatedRemainingMs?: number;
  deadLetterCount?: number;
  startedAt?: string;
  avgItemTimeMs?: number;
}

/**
 * Create a bulk QR job that processes asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const createBulkQRJob = async (
  payload: CreateBulkAsyncDto,
): Promise<{ jobId: string; message: string }> => {
  try {
    const { data } = await axiosInstance.post("/qr-code/bulk-async", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    logJobError(error, "bulk-qr-job-create-failed", undefined, {
      numberOfCodes: payload.numberOfCodes,
    });
    throw error;
  }
};

/**
 * Create a bulk QR job for explicit QR payloads that processes asynchronously.
 * Returns job ID for tracking via SSE or polling.
 */
export const createBulkQRItemsJob = async (
  payload: CreateBulkItemsAsyncDto,
): Promise<{ jobId: string; message: string }> => {
  try {
    const { data } = await axiosInstance.post(
      "/qr-code/bulk-items-async",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    logJobError(error, "bulk-qr-items-job-create-failed", undefined, {
      numberOfCodes: payload.items.length,
    });
    throw error;
  }
};

/**
 * Get job status via REST (polling fallback)
 */
export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
  try {
    const { data } = await axiosInstance.get(`/qr-code/jobs/${jobId}`);
    return data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Cancel a running job
 */
export const cancelJob = async (
  jobId: string,
  companyId: string,
): Promise<void> => {
  try {
    await axiosInstance.delete(`/qr-code/jobs/${jobId}`, {
      data: { companyId },
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logJobError(error, "cancel-job-failed", jobId, { companyId });
    throw error;
  }
};

/**
 * Pause a running job
 */
export const pauseJob = async (
  jobId: string,
  companyId: string,
): Promise<void> => {
  try {
    await axiosInstance.post(`/qr-code/jobs/${jobId}/pause`, { companyId });
  } catch (error) {
    logJobError(error, "pause-job-failed", jobId, { companyId });
    throw error;
  }
};

/**
 * Resume a paused job
 */
export const resumeJob = async (
  jobId: string,
  companyId: string,
): Promise<void> => {
  try {
    await axiosInstance.post(`/qr-code/jobs/${jobId}/resume`, { companyId });
  } catch (error) {
    logJobError(error, "resume-job-failed", jobId, { companyId });
    throw error;
  }
};

/**
 * Get dead letter queue items for a job
 */
export const getJobDeadLetters = async (
  jobId: string,
): Promise<{
  items: Array<{ index: number; error: string; data: unknown }>;
}> => {
  try {
    const { data } = await axiosInstance.get(
      `/qr-code/jobs/${jobId}/dead-letter`,
    );
    return data;
  } catch (error) {
    logJobError(error, "get-dead-letters-failed", jobId);
    throw error;
  }
};

/**
 * Connect to SSE stream for real-time job updates
 * Returns EventSource that emits job progress events
 */
export const connectJobStream = (
  jobId: string,
  onMessage: (event: JobStreamEvent) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void,
): EventSource => {
  const baseURL = axiosInstance.defaults.baseURL || "";

  // Get the auth token from localStorage
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");

  // EventSource doesn't support custom headers, so we pass the token as a query parameter
  const url = token
    ? `${baseURL}/qr-code/jobs/${jobId}/stream?token=${encodeURIComponent(token)}`
    : `${baseURL}/qr-code/jobs/${jobId}/stream`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);

      // Close connection when job is completed or failed
      if (data.status === "completed" || data.status === "failed") {
        eventSource.close();
        onComplete?.();
      }
    } catch (error) {
      logJobError(error, "sse-parse-error", jobId, {
        eventData: event.data?.slice(0, 200),
      });
    }
  };

  eventSource.onerror = (error) => {
    eventSource.close();
    onError?.(error);
  };

  return eventSource;
};

/**
 * Create a bulk QR delete job that processes asynchronously
 * Returns job ID for tracking via SSE or polling
 */
export const createBulkQRDeleteJob = async (
  companyId: string,
  qrcodeIds: string[],
  projectId?: string,
): Promise<{ jobId: string; message: string }> => {
  try {
    const response = await axiosInstance.post("/qr-code/bulk-delete-async", {
      companyId,
      qrcodeIds,
      projectId,
    });
    return response.data;
  } catch (error) {
    logJobError(error, "bulk-qr-delete-job-create-failed", undefined, {
      count: qrcodeIds.length,
    });
    throw error;
  }
};

/**
 * Download QR codes as a ZIP file
 * @param qrCodeIds - Array of QR code IDs to download
 * @returns Response with download URL or error
 *
 * NOTE: This endpoint is not yet implemented on the backend.
 * When the backend is ready, this function will work automatically.
 */
/**
 * Bulk assign QR codes to a group
 * @param qrCodeIds - Array of QR code IDs to assign
 * @param groupId - The group ID to assign to
 * @param groupType - The type of group ('arrangement' | 'equipment' | 'group')
 * @param companyId - The company ID
 * @param projectId - The project ID (required by backend)
 * @returns Response with success status
 */
export const bulkAssignQRCodesToGroup = async (
  qrCodeIds: string[],
  groupId: string,
  groupType: "arrangement" | "equipment" | "group" | "procore-drawing-codes",
  companyId: string,
  projectId: string,
): Promise<{ success: boolean; message?: string; updated?: number }> => {
  try {
    const response = await axiosInstance.patch(
      "/qr-code/bulk-assign",
      {
        qrCodeIds,
        groupingId: groupId,
        groupingType: groupType,
        companyId,
        projectId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    // Transform backend response { success_message, data } to expected format
    const data = response.data as {
      success_message?: string;
      data?: number;
    };
    return {
      success: true,
      message: data.success_message,
      updated: data.data,
    };
  } catch (error: unknown) {
    logQRError(error, "bulk-assign-qr-to-group-failed", undefined, {
      count: qrCodeIds.length,
      groupId,
      groupType,
    });
    logger.error("Error bulk assigning QR codes to group:", error);
    const axiosError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      success: false,
      message:
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        "Failed to assign QR codes to group",
    };
  }
};

/**
 * Bulk assign QR codes to a project
 * @param qrCodeIds - Array of QR code IDs to assign
 * @param projectId - The project ID to assign to
 * @param companyId - The company ID
 * @returns Response with success status
 */
export const bulkAssignQRCodesToProject = async (
  qrCodeIds: string[],
  projectId: string,
  companyId: string,
): Promise<{ success: boolean; message?: string; updated?: number }> => {
  try {
    const response = await axiosInstance.patch(
      "/qr-code/bulk-assign-project",
      {
        qrCodeIds,
        projectId,
        companyId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    // Transform backend response { success_message, data } to expected format
    const data = response.data as {
      success_message?: string;
      data?: number;
    };
    return {
      success: true,
      message: data.success_message,
      updated: data.data,
    };
  } catch (error: unknown) {
    logQRError(error, "bulk-assign-qr-to-project-failed", undefined, {
      count: qrCodeIds.length,
      projectId,
    });
    logger.error("Error bulk assigning QR codes to project:", error);
    const axiosError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      success: false,
      message:
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        "Failed to assign QR codes to project",
    };
  }
};

/**
 * Bulk set password for multiple QR codes
 * @param qrCodeIds - Array of QR code IDs to update
 * @param companyId - The company ID
 * @param passwordData - Password configuration
 * @returns Response with success status
 */
export const bulkSetQRCodePassword = async (
  qrCodeIds: string[],
  companyId: string,
  passwordData: {
    passwordActivated: boolean;
    password?: string;
    timezone?: string;
    weekdayPassword?: boolean;
    weekdayPasswordTimeStart?: string;
    weekdayPasswordTimeEnd?: string;
    weekendPassword?: boolean;
    weekendPasswordTimeStart?: string;
    weekendPasswordTimeEnd?: string;
  },
): Promise<{ success: boolean; message?: string; updated?: number }> => {
  try {
    const response = await axiosInstance.patch(
      "/qr-code/bulk-password",
      {
        qrCodeIds,
        companyId,
        ...passwordData,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (error: unknown) {
    logQRError(error, "bulk-set-qr-password-failed", undefined, {
      count: qrCodeIds.length,
    });
    logger.error("Error bulk setting password for QR codes:", error);
    const axiosError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      success: false,
      message:
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        "Failed to set password for QR codes",
    };
  }
};

/**
 * POST /qr-code/download -- Requests a ZIP download of QR code images.
 *
 * @param qrCodeIds - Array of QR code IDs to include in the download
 * @returns Object with success flag and optional downloadUrl or error message
 */
export const downloadQRCodes = async (
  qrCodeIds: string[],
): Promise<{ success: boolean; downloadUrl?: string; message?: string }> => {
  try {
    const response = await axiosInstance.post(
      "/qr-code/download",
      { qrCodeIds },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (error: unknown) {
    logQRError(error, "download-qr-codes-failed", undefined, {
      count: qrCodeIds.length,
    });
    logger.error("Error downloading QR codes:", error);
    const axiosError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    // Return structured error for better handling
    return {
      success: false,
      message:
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        "Download failed",
    };
  }
};
