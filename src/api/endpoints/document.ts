/**
 * @fileoverview Document API endpoints for file upload, download, management, and multipart uploads.
 *
 * Provides API functions for: uploading files (single and multiple), fetching S3
 * pre-signed download URLs, direct-to-S3 multipart upload flow (init, part URL,
 * complete, abort), updating document metadata, moving documents (single and bulk),
 * deleting documents (single and bulk), and restoring soft-deleted documents
 * (single and bulk).
 *
 * This file does not define TanStack Query hooks or query keys -- documents are
 * typically fetched as part of QR code or folder queries.
 */
import { axiosInstance } from "../index";
import type { AxiosProgressEvent } from "axios";
import { parseHttpError, type HttpErrorResult } from "@/utils/httpErrors";
import { logger } from "@/utils/logger";
import { logDocumentError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Standardized result envelope for document API operations. */
export interface DocumentApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: HttpErrorResult;
  message: string;
}

/**
 * POST /document/upload -- Uploads a single file via multipart/form-data.
 *
 * @param formData - FormData containing the file and metadata
 * @returns Axios response with the created document data
 */
export const uploadFile = async (formData: FormData) => {
  try {
    return axiosInstance.post("/document/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  } catch (error) {
    logDocumentError(error, "upload-file-failed");
    logger.error("Upload file error:", error);
    throw error;
  }
};

/**
 * POST /document/upload/multiple -- Uploads multiple files in a single request.
 *
 * Supports upload progress tracking and cancellation via Axios options.
 *
 * @param params - Upload parameters including companyId, files array, document purpose, and optional names/pages
 * @param opts - Optional Axios config for progress tracking and cancellation
 * @returns The created documents data from the server
 */
export const uploadDocumentsMultiple = async (
  params: {
    companyId: string;
    projectId?: string;
    qrcodeId?: string;
    folderId?: string;
    documentPurpose: "file-qrcode" | "folder-qrcode";
    files: File[];
    documentNames?: string[];
    openToPages?: Array<number | string>;
  },
  opts?: {
    onUploadProgress?: (e: AxiosProgressEvent) => void;
    cancelToken?: import("axios").CancelToken;
  },
) => {
  const fd = new FormData();
  fd.append("companyId", params.companyId);
  if (params.projectId) fd.append("projectId", params.projectId);
  if (params.qrcodeId) fd.append("qrcodeId", params.qrcodeId);
  if (params.folderId) fd.append("folderId", params.folderId);
  fd.append("documentPurpose", params.documentPurpose);
  if (Array.isArray(params.documentNames)) {
    params.documentNames.forEach((n) => fd.append("documentNames", n));
  }
  if (Array.isArray(params.openToPages)) {
    params.openToPages.forEach((p) => fd.append("openToPages", String(p)));
  }
  params.files.forEach((f) => fd.append("files", f, f.name));

  try {
    const resp = await axiosInstance.post("/document/upload/multiple", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: opts?.onUploadProgress,
      cancelToken: opts?.cancelToken,
    });
    return resp.data;
  } catch (error) {
    logDocumentError(error, "upload-documents-multiple-failed", {
      fileCount: params.files.length,
      qrcodeId: params.qrcodeId,
      hasFolderId: Boolean(params.folderId),
    });
    throw error;
  }
};

/**
 * POST /document/download/:id -- Fetches a pre-signed S3 URL for downloading a document.
 *
 * @param documentId - The document ID to generate a download URL for
 * @param companyId - The company ID for authorization
 * @returns Response data containing the pre-signed download URL
 */
export const getS3PresignedUrl = async (
  documentId: string,
  companyId: string,
) => {
  try {
    const response = await axiosInstance.post(
      `/document/download/${documentId}`,
      { companyId },
      { headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  } catch (error) {
    logDocumentError(error, "get-presigned-url-failed", { documentId });
    logger.error("Get S3 presigned URL error:", error);
    throw error;
  }
};

// ===== Direct-to-S3 multipart APIs =====

/**
 * POST /document/multipart/init -- Initializes a direct-to-S3 multipart upload.
 *
 * Returns the uploadId, S3 key, bucket, and recommended part size.
 * Use with getMultipartPartUrl and completeMultipartUpload.
 *
 * @param body - Upload metadata including companyId, qrcodeId, documentName, contentType, etc.
 * @returns Object with uploadId, s3Key, bucket, and partSize
 */
export const initMultipartUpload = async (body: {
  companyId: string;
  projectId?: string;
  qrcodeId: string;
  folderId?: string;
  documentName: string;
  documentPurpose: "file-qrcode" | "folder-qrcode";
  contentType?: string;
  openToPage?: number;
}) => {
  try {
    const { data } = await axiosInstance.post(
      "/document/multipart/init",
      body,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data as {
      uploadId: string;
      s3Key: string;
      bucket: string;
      partSize: number;
    };
  } catch (error) {
    logDocumentError(error, "multipart-init-failed", {
      documentName: body.documentName,
      qrcodeId: body.qrcodeId,
    });
    throw error;
  }
};

/**
 * POST /document/multipart/part-url -- Gets a pre-signed URL for uploading a single part
 * of a multipart upload directly to S3.
 *
 * @param body - Part metadata including bucket, s3Key, uploadId, partNumber, and optional contentType
 * @returns Object with the pre-signed upload URL
 */
export const getMultipartPartUrl = async (body: {
  bucket: string;
  s3Key: string;
  uploadId: string;
  partNumber: number;
  contentType?: string;
}) => {
  try {
    const { data } = await axiosInstance.post(
      "/document/multipart/part-url",
      body,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data as { url: string };
  } catch (error) {
    logDocumentError(error, "multipart-part-url-failed", {
      partNumber: body.partNumber,
      uploadId: body.uploadId,
    });
    throw error;
  }
};

/**
 * POST /document/multipart/complete -- Completes a multipart upload by assembling
 * all parts in S3 and creating the Document record in the database.
 *
 * @param body - Completion payload including s3Key, uploadId, parts array (ETag + PartNumber),
 *               companyId, qrcodeId, documentName, and document purpose
 * @returns The created document data
 */
export const completeMultipartUpload = async (body: {
  s3Key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  companyId: string;
  projectId?: string;
  qrcodeId: string;
  folderId?: string;
  documentName: string;
  documentPurpose: "file-qrcode" | "folder-qrcode";
  openToPage?: number;
}) => {
  try {
    const { data } = await axiosInstance.post(
      "/document/multipart/complete",
      body,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    logDocumentError(error, "multipart-complete-failed", {
      uploadId: body.uploadId,
      partCount: body.parts.length,
    });
    throw error;
  }
};

/**
 * POST /document/multipart/abort -- Aborts an in-progress multipart upload,
 * cleaning up any already-uploaded parts in S3.
 *
 * @param body - Abort payload with s3Key and uploadId
 * @returns Object with success flag
 */
export const abortMultipartUpload = async (body: {
  s3Key: string;
  uploadId: string;
}) => {
  try {
    const { data } = await axiosInstance.post(
      "/document/multipart/abort",
      body,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return data as { success: boolean };
  } catch (error) {
    logDocumentError(error, "multipart-abort-failed", {
      uploadId: body.uploadId,
    });
    throw error;
  }
};

/**
 * PATCH /document/:id -- Updates a document's metadata (e.g., name, openToPage).
 *
 * @param documentId - The document ID to update
 * @param params - Update payload including companyId, projectId, and optional documentName/openToPage
 * @returns The updated document data
 */
export const updateDocument = async (
  documentId: string,
  params: {
    companyId: string;
    projectId?: string;
    documentName?: string;
    openToPage?: number;
  },
) => {
  try {
    const { data } = await axiosInstance.patch(
      `/document/${documentId}`,
      params,
    );
    return data;
  } catch (error) {
    logDocumentError(error, "update-document-failed", { documentId });
    throw error;
  }
};

// ===== Document Move APIs =====

/**
 * Move a single document to a different folder
 * @param documentId - The ID of the document to move
 * @param targetFolderId - The ID of the destination folder
 * @param companyId - The company ID (required by PatchDocumentDto)
 * @param projectId - The project ID (required by PatchDocumentDto)
 * @returns Success status and message
 */
export const moveDocument = async (
  documentId: string,
  targetFolderId: string,
  companyId: string,
  projectId?: string,
): Promise<DocumentApiResult> => {
  try {
    const body: Record<string, string> = {
      folderId: targetFolderId,
      companyId,
    };
    if (projectId) body.projectId = projectId;
    const { data } = await axiosInstance.patch(`/document/${documentId}`, body);
    return {
      success: true,
      data,
      message: "Document moved successfully",
    };
  } catch (error: unknown) {
    logDocumentError(error, "move-document-failed", {
      documentId,
      destinationFolderId: targetFolderId,
    });
    logger.error("Move document error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Move multiple documents to a different folder by calling the single-move
 * endpoint for each document (no dedicated bulk-move route exists).
 * @param documentIds - Array of document IDs to move
 * @param targetFolderId - The ID of the destination folder
 * @param companyId - The company ID (required by PatchDocumentDto)
 * @param projectId - The project ID (required by PatchDocumentDto)
 * @returns Success status, count of moved documents, and message
 */
export const moveDocumentsBulk = async (
  documentIds: string[],
  targetFolderId: string,
  companyId: string,
  projectId?: string,
): Promise<DocumentApiResult & { count?: number }> => {
  try {
    const results = await Promise.all(
      documentIds.map((docId) =>
        moveDocument(docId, targetFolderId, companyId, projectId),
      ),
    );
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return {
        success: false,
        count: results.length - failed.length,
        message: `Moved ${results.length - failed.length}/${documentIds.length} document(s). ${failed.length} failed.`,
      };
    }
    return {
      success: true,
      count: documentIds.length,
      message: `Moved ${documentIds.length} document(s) successfully`,
    };
  } catch (error: unknown) {
    logDocumentError(error, "move-documents-bulk-failed", {
      documentCount: documentIds.length,
      destinationFolderId: targetFolderId,
    });
    logger.error("Bulk move documents error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

// ===== Document Delete APIs =====

/**
 * Delete a single document
 * @param documentId - The ID of the document to delete
 * @param companyId - The company ID
 * @param projectId - The project ID (optional)
 * @returns Success status and message
 */
export const deleteDocument = async (
  documentId: string,
  companyId: string,
  projectId?: string,
): Promise<DocumentApiResult> => {
  try {
    const { data } = await axiosInstance.delete(`/document/${documentId}`, {
      data: { companyId, projectId },
      headers: { "Content-Type": "application/json" },
    });
    return {
      success: true,
      data,
      message: "Document deleted successfully",
    };
  } catch (error: unknown) {
    logDocumentError(error, "delete-document-failed", { documentId });
    logger.error("Delete document error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Delete multiple documents by explicit IDs or by filter.
 * @param documentIds - Array of document IDs to delete (optional — omit for filter-based deletion)
 * @param companyId - The company ID
 * @param options - Optional filters (used when documentIds is empty/undefined; only one filter per request)
 * @returns Success status, count, and message
 */
export const deleteDocumentsBulk = async (
  documentIds: string[] | undefined,
  companyId: string,
  options?: {
    projectId?: string;
    qrcodeId?: string;
    folderId?: string;
    groupingId?: string;
    groupingType?: string;
  },
): Promise<
  DocumentApiResult & {
    count?: number;
    partialResult?: { succeeded: number; failed: number; total: number };
  }
> => {
  const hasDocumentIds = Array.isArray(documentIds) && documentIds.length > 0;
  const hasFilterOption = !!(
    options?.folderId ||
    options?.qrcodeId ||
    (options?.groupingId && options?.groupingType) ||
    options?.projectId
  );

  if (!hasDocumentIds && !hasFilterOption) {
    return { success: true, count: 0, message: "No documents to delete" };
  }

  if (hasDocumentIds && documentIds!.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${documentIds!.length}.`,
    );
  }

  const payload: Record<string, unknown> = { companyId };
  if (hasDocumentIds) {
    payload.documentIds = documentIds;
  } else if (options?.folderId) {
    payload.folderId = options.folderId;
  } else if (options?.qrcodeId) {
    payload.qrcodeId = options.qrcodeId;
  } else if (options?.groupingId && options?.groupingType) {
    payload.groupingId = options.groupingId;
    payload.groupingType = options.groupingType;
  } else if (options?.projectId) {
    payload.projectId = options.projectId;
  }

  try {
    const { data } = await axiosInstance.delete("/document/bulk", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    const count =
      data?.total_items ?? (hasDocumentIds ? documentIds!.length : 0);
    return {
      success: true,
      data,
      count,
      message: `Deleted ${count} document(s) successfully`,
    };
  } catch (error: unknown) {
    logDocumentError(error, "delete-documents-bulk-failed", {
      documentCount: documentIds?.length ?? 0,
    });
    logger.error("Bulk delete documents error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

// ===== Document Restore APIs =====

/**
 * Restore a single soft-deleted document
 * @param documentId - The ID of the document to restore
 * @param companyId - The company ID
 * @param projectId - The project ID (optional)
 * @returns Success status and message
 */
export const restoreDocument = async (
  documentId: string,
  companyId: string,
  projectId?: string,
): Promise<DocumentApiResult> => {
  try {
    const { data } = await axiosInstance.patch(
      `/document/restore/${documentId}`,
      { companyId, projectId },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return {
      success: true,
      data,
      message: "Document restored successfully",
    };
  } catch (error: unknown) {
    logDocumentError(error, "restore-document-failed", { documentId });
    logger.error("Restore document error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};

/**
 * Restore multiple soft-deleted documents
 * @param documentIds - Array of document IDs to restore
 * @param companyId - The company ID
 * @returns Success status, count of restored documents, and message
 */
export const restoreDocumentsBulk = async (
  documentIds: string[],
  companyId: string,
): Promise<DocumentApiResult & { count?: number }> => {
  if (!documentIds || documentIds.length === 0) {
    return { success: true, count: 0, message: "No documents to restore" };
  }
  if (documentIds.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot restore more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${documentIds.length}.`,
    );
  }
  try {
    const { data } = await axiosInstance.patch(
      "/document/restore/bulk",
      { companyId, documentIds },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    const count = data?.total_items ?? documentIds.length;
    return {
      success: true,
      data,
      count,
      message: `Restored ${count} document(s) successfully`,
    };
  } catch (error: unknown) {
    logDocumentError(error, "restore-documents-bulk-failed", {
      documentCount: documentIds.length,
    });
    logger.error("Bulk restore documents error:", error);
    const parsedError = parseHttpError(error);
    return {
      success: false,
      error: parsedError,
      message: parsedError.message,
    };
  }
};
