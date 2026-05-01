/**
 * @fileoverview Folder API endpoints for creating, updating, deleting, and querying folders.
 *
 * Provides API functions for: creating folders (with optional nesting), updating
 * folder details (rename), deleting folders (single and bulk with filter-based
 * cascade support), and querying folder cascade delete impact counts.
 *
 * This file does not define TanStack Query hooks or query keys -- folder data is
 * typically fetched as part of QR code detail queries.
 */
import { axiosInstance } from "../index";
import { parseHttpError, type HttpErrorResult } from "@/utils/httpErrors";
import { logger } from "@/utils/logger";
import { logDocumentError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Standardized result envelope for folder API operations. */
export interface FolderApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: HttpErrorResult;
  message: string;
}

/**
 * POST /folder -- Creates a new folder, optionally nested under a parent folder.
 *
 * @param payload - Folder creation data including companyId, qrcodeId, folderName, and optional parentFolderId
 * @returns The created folder document with its _id
 */
export const createFolder = async (payload: {
  companyId: string;
  projectId?: string;
  qrcodeId: string;
  folderName: string;
  parentFolderId?: string;
}) => {
  try {
    // Only include optional fields if they have valid values
    const requestPayload = {
      companyId: payload.companyId,
      qrcodeId: payload.qrcodeId,
      folderName: payload.folderName,
      ...(payload.projectId && { projectId: payload.projectId }),
      ...(payload.parentFolderId && { parentFolderId: payload.parentFolderId }),
    };
    const { data } = await axiosInstance.post("/folder", requestPayload, {
      headers: { "Content-Type": "application/json" },
    });
    // Return the created folder document; API returns { data }
    return (data?.data ?? data) as { _id: string };
  } catch (error) {
    logDocumentError(error, "create-folder-failed", {
      folderName: payload.folderName,
      hasParent: Boolean(payload.parentFolderId),
    });
    throw error;
  }
};

/**
 * Update a folder's details (e.g., rename)
 * @param folderId - The ID of the folder to update
 * @param params - Update parameters
 * @returns Success status and updated folder data
 */
export const updateFolder = async (
  folderId: string,
  params: {
    companyId: string;
    projectId?: string;
    folderName?: string;
    qrcodeId?: string;
  },
): Promise<FolderApiResult> => {
  try {
    const { data } = await axiosInstance.patch(`/folder/${folderId}`, params, {
      headers: { "Content-Type": "application/json" },
    });
    return {
      success: true,
      data,
      message: "Folder updated successfully",
    };
  } catch (error: unknown) {
    logDocumentError(error, "update-folder-failed", { folderId });
    logger.error("Update folder error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Delete a single folder
 * @param folderId - The ID of the folder to delete
 * @param companyId - The company ID
 * @param projectId - The project ID (optional)
 * @returns Success status and message
 */
export const deleteFolder = async (
  folderId: string,
  companyId: string,
  projectId?: string,
): Promise<FolderApiResult> => {
  try {
    const { data } = await axiosInstance.delete(`/folder/${folderId}`, {
      data: { companyId, projectId },
      headers: { "Content-Type": "application/json" },
    });
    return {
      success: true,
      data,
      message: "Folder deleted successfully",
    };
  } catch (error: unknown) {
    logDocumentError(error, "delete-folder-failed", { folderId });
    logger.error("Delete folder error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Delete multiple folders by explicit IDs or by filter.
 *
 * **WARNING — Filter-based deletion**: When `folderIds` is empty/undefined and a filter
 * option is provided, this function will delete ALL folders matching that filter. This can
 * affect hundreds of folder trees and cascade-delete all their documents. Only use
 * filter-based deletion for cascade operations where the parent entity (QR code, project,
 * group) is also being deleted.
 *
 * @param folderIds - Explicit folder IDs to delete (preferred, user-selected).
 *                    Pass undefined or empty array to use filter-based deletion.
 * @param companyId - The company ID
 * @param options   - Filter options (only used when folderIds is empty/undefined).
 *                    Only ONE filter may be active per request.
 * @returns Success status, count, and optional partial failure details
 */
export const deleteFoldersBulk = async (
  folderIds: string[] | undefined,
  companyId: string,
  options?: {
    projectId?: string;
    qrcodeId?: string;
    groupingId?: string;
    groupingType?: string;
  },
): Promise<
  FolderApiResult & {
    count?: number;
    partialResult?: { succeeded: number; failed: number; total: number };
  }
> => {
  const hasFolderIds = Array.isArray(folderIds) && folderIds.length > 0;
  const hasFilterOption = !!(
    options?.qrcodeId ||
    (options?.groupingId && options?.groupingType) ||
    options?.projectId
  );

  if (!hasFolderIds && !hasFilterOption) {
    return { success: true, count: 0, message: "No folders to delete" };
  }

  if (!hasFolderIds && hasFilterOption) {
    logger.warn(
      "[deleteFoldersBulk] Filter-based deletion active — all matching folders will be deleted.",
      {
        qrcodeId: options?.qrcodeId,
        projectId: options?.projectId,
        groupingId: options?.groupingId,
      },
    );
  }

  if (folderIds && folderIds.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${folderIds.length}.`,
    );
  }

  const payload: Record<string, unknown> = { companyId };
  if (folderIds && folderIds.length > 0) {
    payload.folderIds = folderIds;
  } else if (options?.qrcodeId) {
    payload.qrcodeId = options.qrcodeId;
  } else if (options?.groupingId && options?.groupingType) {
    payload.groupingId = options.groupingId;
    payload.groupingType = options.groupingType;
  } else if (options?.projectId) {
    payload.projectId = options.projectId;
  }

  try {
    const { data } = await axiosInstance.delete("/folder/bulk", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    const count = data?.total_items ?? folderIds?.length ?? 0;
    return {
      success: true,
      data,
      count,
      message: `Deleted ${count} folder(s) successfully`,
    };
  } catch (error: unknown) {
    logDocumentError(error, "delete-folders-bulk-failed", {
      folderIds,
      folderCount: folderIds?.length ?? 0,
    });
    logger.error("Bulk delete folders error:", error);
    const parsedError = parseHttpError(error);

    // Detect partial failure from backend cascade delete (e.g.,
    // "Cascade delete partially failed: 3/5 folder cleanups completed. 2 folders failed."
    // or bulk delete: "Bulk delete partially failed: 3/5 root folders deleted. 2 folders failed.")
    const axiosError = error as {
      response?: { data?: { message?: string } };
    };
    const errorMessage = axiosError?.response?.data?.message;
    if (errorMessage) {
      const match = errorMessage.match(
        /(\d+)\/(\d+)\s+(?:root\s+)?folders?\s+(?:cleanups?\s+completed|deleted).*?(\d+)\s+folders?\s+failed/i,
      );
      if (match) {
        return {
          success: false,
          partialResult: {
            succeeded: parseInt(match[1]),
            failed: parseInt(match[3]),
            total: parseInt(match[2]),
          },
          message: `${match[1]} of ${match[2]} folders deleted. ${match[3]} failed.`,
          error: parsedError,
        };
      }
    }

    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Get the cascade delete impact count for a folder.
 * Uses the dedicated cascade-count endpoint to accurately count all
 * subfolders and documents across the entire folder tree.
 */
export const getFolderCascadeCount = async (
  folderId: string,
  companyId: string,
): Promise<{ subfolderCount: number; documentCount: number } | null> => {
  try {
    const { data } = await axiosInstance.get(
      `/folder/${folderId}/cascade-count`,
      { params: { companyId } },
    );
    return data;
  } catch {
    // Non-critical — return null so the modal falls back to generic message
    return null;
  }
};
