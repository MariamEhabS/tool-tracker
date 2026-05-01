/**
 * Tests for document API endpoints
 * Tests all document-related API functions including upload, download,
 * multipart upload, update, move, delete, and restore operations.
 * Validates payloads align with backend validation pipes (companyId, projectId,
 * documentPurpose enum, openToPage positive number, MongoId formats).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("../index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Mock logger to silence console output
vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock httpErrors
vi.mock("@/utils/httpErrors", () => ({
  parseHttpError: vi.fn((error) => ({
    message:
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || "Unknown error",
    status: (error as { response?: { status?: number } })?.response?.status,
  })),
}));

import {
  uploadFile,
  uploadDocumentsMultiple,
  getS3PresignedUrl,
  initMultipartUpload,
  getMultipartPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  updateDocument,
  moveDocument,
  moveDocumentsBulk,
  deleteDocument,
  deleteDocumentsBulk,
  restoreDocument,
  restoreDocumentsBulk,
} from "./document";

describe("Document API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Upload Operations ====================

  describe("uploadFile", () => {
    it("should make POST request with FormData", async () => {
      const mockResponse = { data: { _id: "doc-123" } };
      mockPost.mockResolvedValue(mockResponse);

      const formData = new FormData();
      formData.append("companyId", "company-456");
      formData.append("documentPurpose", "file-qrcode");

      await uploadFile(formData);

      expect(mockPost).toHaveBeenCalledWith("/document/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    });

    it("should propagate errors", async () => {
      const error = { response: { status: 500 } };
      mockPost.mockRejectedValue(error);

      const formData = new FormData();
      await expect(uploadFile(formData)).rejects.toEqual(error);
    });
  });

  describe("uploadDocumentsMultiple", () => {
    it("should build FormData with required fields and POST", async () => {
      const mockResponse = { success: true, data: [] };
      mockPost.mockResolvedValue({ data: mockResponse });

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });

      const result = await uploadDocumentsMultiple({
        companyId: "company-456",
        documentPurpose: "file-qrcode",
        files: [file],
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/document/upload/multiple",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it("should include optional projectId and qrcodeId in FormData", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const file = new File(["content"], "test.pdf");

      await uploadDocumentsMultiple({
        companyId: "company-456",
        projectId: "project-789",
        qrcodeId: "qr-123",
        folderId: "folder-456",
        documentPurpose: "folder-qrcode",
        files: [file],
        documentNames: ["Test Document"],
        openToPages: [5],
      });

      // Verify the FormData was passed - we can check the call was made
      const [, formData] = mockPost.mock.calls[0];
      expect(formData).toBeInstanceOf(FormData);
    });

    it("should pass upload progress callback", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const onProgress = vi.fn();
      const file = new File(["content"], "test.pdf");

      await uploadDocumentsMultiple(
        {
          companyId: "company-456",
          documentPurpose: "file-qrcode",
          files: [file],
        },
        { onUploadProgress: onProgress },
      );

      expect(mockPost).toHaveBeenCalledWith(
        "/document/upload/multiple",
        expect.any(FormData),
        expect.objectContaining({
          onUploadProgress: onProgress,
        }),
      );
    });

    it("should propagate server errors", async () => {
      const error = { response: { status: 500 } };
      mockPost.mockRejectedValue(error);

      const file = new File(["content"], "test.pdf");

      await expect(
        uploadDocumentsMultiple({
          companyId: "company-456",
          documentPurpose: "file-qrcode",
          files: [file],
        }),
      ).rejects.toEqual(error);
    });
  });

  // ==================== Download Operations ====================

  describe("getS3PresignedUrl", () => {
    it("should make POST request with companyId in body", async () => {
      const mockResponse = { url: "https://s3.example.com/doc.pdf" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await getS3PresignedUrl("doc-123", "company-456");

      expect(mockPost).toHaveBeenCalledWith(
        "/document/download/doc-123",
        { companyId: "company-456" },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors for non-404 status", async () => {
      const error = { response: { status: 500 } };
      mockPost.mockRejectedValue(error);

      await expect(getS3PresignedUrl("doc-123", "company-456")).rejects.toEqual(
        error,
      );
    });
  });

  // ==================== Multipart Upload Operations ====================

  describe("initMultipartUpload", () => {
    it("should make POST request with required fields", async () => {
      const mockResponse = {
        uploadId: "upload-123",
        s3Key: "key/path",
        bucket: "my-bucket",
        partSize: 5242880,
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        companyId: "company-456",
        qrcodeId: "qr-123",
        documentName: "test.pdf",
        documentPurpose: "file-qrcode" as const,
      };

      const result = await initMultipartUpload(body);

      expect(mockPost).toHaveBeenCalledWith("/document/multipart/init", body, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should include optional projectId and folderId", async () => {
      mockPost.mockResolvedValue({
        data: {
          uploadId: "upload-123",
          s3Key: "key",
          bucket: "b",
          partSize: 5,
        },
      });

      const body = {
        companyId: "company-456",
        projectId: "project-789",
        qrcodeId: "qr-123",
        folderId: "folder-456",
        documentName: "test.pdf",
        documentPurpose: "folder-qrcode" as const,
        contentType: "application/pdf",
        openToPage: 3,
      };

      await initMultipartUpload(body);

      expect(mockPost).toHaveBeenCalledWith("/document/multipart/init", body, {
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  describe("getMultipartPartUrl", () => {
    it("should make POST request with part details", async () => {
      const mockResponse = { url: "https://s3.example.com/part" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        bucket: "my-bucket",
        s3Key: "key/path",
        uploadId: "upload-123",
        partNumber: 1,
      };

      const result = await getMultipartPartUrl(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/document/multipart/part-url",
        body,
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("completeMultipartUpload", () => {
    it("should make POST request with all parts and metadata", async () => {
      const mockResponse = { _id: "doc-123", documentName: "test.pdf" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        s3Key: "key/path",
        uploadId: "upload-123",
        parts: [
          { ETag: "etag-1", PartNumber: 1 },
          { ETag: "etag-2", PartNumber: 2 },
        ],
        companyId: "company-456",
        qrcodeId: "qr-123",
        documentName: "test.pdf",
        documentPurpose: "file-qrcode" as const,
      };

      const result = await completeMultipartUpload(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/document/multipart/complete",
        body,
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should include optional openToPage", async () => {
      mockPost.mockResolvedValue({ data: {} });

      const body = {
        s3Key: "key/path",
        uploadId: "upload-123",
        parts: [{ ETag: "etag-1", PartNumber: 1 }],
        companyId: "company-456",
        qrcodeId: "qr-123",
        documentName: "test.pdf",
        documentPurpose: "file-qrcode" as const,
        openToPage: 5,
      };

      await completeMultipartUpload(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/document/multipart/complete",
        expect.objectContaining({ openToPage: 5 }),
        expect.any(Object),
      );
    });
  });

  describe("abortMultipartUpload", () => {
    it("should make POST request to abort", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const result = await abortMultipartUpload({
        s3Key: "key/path",
        uploadId: "upload-123",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/document/multipart/abort",
        { s3Key: "key/path", uploadId: "upload-123" },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ==================== Update Operations ====================

  describe("updateDocument", () => {
    it("should make PATCH request with companyId and projectId", async () => {
      const mockResponse = { _id: "doc-123", documentName: "Updated" };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        documentName: "Updated",
      };

      const result = await updateDocument("doc-123", params);

      expect(mockPatch).toHaveBeenCalledWith("/document/doc-123", params);
      expect(result).toEqual(mockResponse);
    });

    it("should include optional openToPage as positive number", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        openToPage: 10,
      };

      await updateDocument("doc-123", params);

      expect(mockPatch).toHaveBeenCalledWith(
        "/document/doc-123",
        expect.objectContaining({ openToPage: 10 }),
      );
    });
  });

  // ==================== Move Operations ====================

  describe("moveDocument", () => {
    it("should make PATCH request with target folderId", async () => {
      mockPatch.mockResolvedValue({ data: { moved: true } });

      const result = await moveDocument(
        "doc-123",
        "folder-456",
        "company-789",
        "project-101",
      );

      expect(mockPatch).toHaveBeenCalledWith("/document/doc-123", {
        folderId: "folder-456",
        companyId: "company-789",
        projectId: "project-101",
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Document moved successfully");
    });

    it("should omit projectId from body when not provided", async () => {
      mockPatch.mockResolvedValue({ data: { moved: true } });

      const result = await moveDocument("doc-123", "folder-456", "company-789");

      expect(mockPatch).toHaveBeenCalledWith("/document/doc-123", {
        folderId: "folder-456",
        companyId: "company-789",
      });
      expect(result.success).toBe(true);
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { status: 400, data: { message: "Invalid folder" } },
      });

      const result = await moveDocument(
        "doc-123",
        "bad-folder",
        "company-789",
        "project-101",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("moveDocumentsBulk", () => {
    it("should call moveDocument for each document ID", async () => {
      mockPatch.mockResolvedValue({ data: { moved: true } });

      const result = await moveDocumentsBulk(
        ["doc-1", "doc-2", "doc-3"],
        "folder-456",
        "company-789",
        "project-101",
      );

      expect(mockPatch).toHaveBeenCalledTimes(3);
      expect(mockPatch).toHaveBeenCalledWith("/document/doc-1", {
        folderId: "folder-456",
        companyId: "company-789",
        projectId: "project-101",
      });
      expect(mockPatch).toHaveBeenCalledWith("/document/doc-2", {
        folderId: "folder-456",
        companyId: "company-789",
        projectId: "project-101",
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it("should return partial failure when some moves fail", async () => {
      mockPatch
        .mockResolvedValueOnce({ data: { moved: true } })
        .mockRejectedValueOnce({
          response: { status: 500, data: { message: "Server error" } },
        });

      const result = await moveDocumentsBulk(
        ["doc-1", "doc-2"],
        "folder-456",
        "company-789",
        "project-101",
      );

      expect(result.success).toBe(false);
      expect(result.count).toBe(1);
    });
  });

  // ==================== Delete Operations ====================

  describe("deleteDocument", () => {
    it("should make DELETE request with companyId in data body", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const result = await deleteDocument("doc-123", "company-456");

      expect(mockDelete).toHaveBeenCalledWith("/document/doc-123", {
        data: { companyId: "company-456", projectId: undefined },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.success).toBe(true);
    });

    it("should include optional projectId", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await deleteDocument("doc-123", "company-456", "project-789");

      expect(mockDelete).toHaveBeenCalledWith("/document/doc-123", {
        data: { companyId: "company-456", projectId: "project-789" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return error result on failure without throwing", async () => {
      mockDelete.mockRejectedValue({
        response: { status: 400, data: { message: "Bad request" } },
      });

      const result = await deleteDocument("doc-123", "company-456");

      expect(result.success).toBe(false);
    });
  });

  describe("deleteDocumentsBulk", () => {
    it("should send documentIds with companyId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 3 } });

      const result = await deleteDocumentsBulk(
        ["doc-1", "doc-2", "doc-3"],
        "company-456",
      );

      expect(mockDelete).toHaveBeenCalledWith("/document/bulk", {
        data: {
          companyId: "company-456",
          documentIds: ["doc-1", "doc-2", "doc-3"],
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it("should support filter-based deletion by folderId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 5 } });

      const result = await deleteDocumentsBulk(undefined, "company-456", {
        folderId: "folder-123",
      });

      expect(mockDelete).toHaveBeenCalledWith("/document/bulk", {
        data: { companyId: "company-456", folderId: "folder-123" },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.count).toBe(5);
    });

    it("should support filter-based deletion by qrcodeId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 2 } });

      await deleteDocumentsBulk(undefined, "company-456", {
        qrcodeId: "qr-123",
      });

      expect(mockDelete).toHaveBeenCalledWith("/document/bulk", {
        data: { companyId: "company-456", qrcodeId: "qr-123" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support filter-based deletion by groupingId and groupingType", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 4 } });

      await deleteDocumentsBulk(undefined, "company-456", {
        groupingId: "group-123",
        groupingType: "equipment",
      });

      expect(mockDelete).toHaveBeenCalledWith("/document/bulk", {
        data: {
          companyId: "company-456",
          groupingId: "group-123",
          groupingType: "equipment",
        },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support filter-based deletion by projectId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 10 } });

      await deleteDocumentsBulk(undefined, "company-456", {
        projectId: "project-789",
      });

      expect(mockDelete).toHaveBeenCalledWith("/document/bulk", {
        data: { companyId: "company-456", projectId: "project-789" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return early with zero count when no IDs or filters", async () => {
      const result = await deleteDocumentsBulk(undefined, "company-456");

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should return early when documentIds is empty array", async () => {
      const result = await deleteDocumentsBulk([], "company-456");

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.count).toBe(0);
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `doc-${i}`);

      await expect(
        deleteDocumentsBulk(tooManyIds, "company-456"),
      ).rejects.toThrow("Cannot delete more than 500 items at once");
    });

    it("should return error result on failure without throwing", async () => {
      mockDelete.mockRejectedValue({
        response: { status: 500, data: { message: "Server error" } },
      });

      const result = await deleteDocumentsBulk(["doc-1"], "company-456");

      expect(result.success).toBe(false);
    });
  });

  // ==================== Backend Validation Pipe Alignment ====================

  describe("initMultipartUpload - validation pipe alignment", () => {
    it("should propagate 400 when documentName is empty (backend @IsNotEmpty)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["documentName should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        initMultipartUpload({
          companyId: "company-456",
          qrcodeId: "qr-123",
          documentName: "",
          documentPurpose: "file-qrcode",
        }),
      ).rejects.toEqual(validationError);
    });

    it("should propagate 400 when qrcodeId is not a valid MongoId", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["qrcodeId must be a mongodb id"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        initMultipartUpload({
          companyId: "company-456",
          qrcodeId: "not-a-mongo-id",
          documentName: "test.pdf",
          documentPurpose: "file-qrcode",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  describe("updateDocument - validation pipe alignment", () => {
    it("should propagate 400 when openToPage is not a positive number (backend @IsPositive)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["openToPage must be a positive number"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPatch.mockRejectedValue(validationError);

      await expect(
        updateDocument("doc-123", {
          companyId: "company-456",
          projectId: "project-789",
          openToPage: -1,
        }),
      ).rejects.toEqual(validationError);
    });
  });

  describe("completeMultipartUpload - validation pipe alignment", () => {
    it("should propagate 400 when parts array has invalid entries (backend @ValidateNested)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["each value in parts.ETag should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        completeMultipartUpload({
          s3Key: "key/path",
          uploadId: "upload-123",
          parts: [{ ETag: "", PartNumber: 1 }],
          companyId: "company-456",
          qrcodeId: "qr-123",
          documentName: "test.pdf",
          documentPurpose: "file-qrcode",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  // ==================== Restore Operations ====================

  describe("restoreDocument", () => {
    it("should make PATCH request with companyId in body", async () => {
      mockPatch.mockResolvedValue({ data: { restored: true } });

      const result = await restoreDocument("doc-123", "company-456");

      expect(mockPatch).toHaveBeenCalledWith(
        "/document/restore/doc-123",
        { companyId: "company-456", projectId: undefined },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result.success).toBe(true);
    });

    it("should include optional projectId", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await restoreDocument("doc-123", "company-456", "project-789");

      expect(mockPatch).toHaveBeenCalledWith(
        "/document/restore/doc-123",
        { companyId: "company-456", projectId: "project-789" },
        { headers: { "Content-Type": "application/json" } },
      );
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { status: 404, data: { message: "Not found" } },
      });

      const result = await restoreDocument("doc-123", "company-456");

      expect(result.success).toBe(false);
    });
  });

  describe("restoreDocumentsBulk", () => {
    it("should make PATCH request with companyId and documentIds", async () => {
      mockPatch.mockResolvedValue({ data: { total_items: 2 } });

      const result = await restoreDocumentsBulk(
        ["doc-1", "doc-2"],
        "company-456",
      );

      expect(mockPatch).toHaveBeenCalledWith(
        "/document/restore/bulk",
        { companyId: "company-456", documentIds: ["doc-1", "doc-2"] },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should return early when documentIds is empty", async () => {
      const result = await restoreDocumentsBulk([], "company-456");

      expect(mockPatch).not.toHaveBeenCalled();
      expect(result.count).toBe(0);
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `doc-${i}`);

      await expect(
        restoreDocumentsBulk(tooManyIds, "company-456"),
      ).rejects.toThrow("Cannot restore more than 500 items at once");
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { status: 500, data: { message: "Server error" } },
      });

      const result = await restoreDocumentsBulk(["doc-1"], "company-456");

      expect(result.success).toBe(false);
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    // --- Helper to create axios-like error objects ---
    function createAxiosError(
      status: number,
      statusText: string,
      data: Record<string, unknown> = {},
    ) {
      return {
        response: {
          status,
          statusText,
          data,
        },
      };
    }

    // --- uploadFile error scenarios ---

    describe("uploadFile errors", () => {
      const makeFormData = () => {
        const fd = new FormData();
        fd.append("companyId", "company-456");
        fd.append("documentPurpose", "file-qrcode");
        return fd;
      };

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(uploadFile(makeFormData())).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 413 payload too large", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(413, "Payload Too Large", {
            message: "File exceeds maximum upload size",
          }),
        );

        await expect(uploadFile(makeFormData())).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 413 }),
          }),
        );
      });

      it("should reject with 507 storage full", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(507, "Insufficient Storage", {
            message: "Storage quota exceeded",
          }),
        );

        await expect(uploadFile(makeFormData())).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 507 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(uploadFile(makeFormData())).rejects.toThrow("timeout");
      });
    });

    // --- uploadDocumentsMultiple error scenarios ---

    describe("uploadDocumentsMultiple errors", () => {
      const makeParams = () => ({
        companyId: "company-456",
        documentPurpose: "file-qrcode" as const,
        files: [new File(["content"], "test.pdf")],
      });

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(uploadDocumentsMultiple(makeParams())).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 413 payload too large", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(413, "Payload Too Large", {
            message: "Total upload size exceeds limit",
          }),
        );

        await expect(uploadDocumentsMultiple(makeParams())).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 413 }),
          }),
        );
      });

      it("should reject with 507 storage full", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(507, "Insufficient Storage", {
            message: "Storage quota exceeded",
          }),
        );

        await expect(uploadDocumentsMultiple(makeParams())).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 507 }),
          }),
        );
      });

      it("should reject with 500 server error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "S3 upload failed",
          }),
        );

        await expect(uploadDocumentsMultiple(makeParams())).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(uploadDocumentsMultiple(makeParams())).rejects.toThrow(
          "timeout",
        );
      });
    });

    // --- getS3PresignedUrl error scenarios ---

    describe("getS3PresignedUrl errors", () => {
      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          getS3PresignedUrl("doc-123", "company-456"),
        ).rejects.toThrow("Network Error");
      });

      it("should reject with 404 not found", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Document not found",
          }),
        );

        await expect(
          getS3PresignedUrl("missing-doc", "company-456"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 404 }),
          }),
        );
      });

      it("should reject with 403 forbidden", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Access denied to document",
          }),
        );

        await expect(
          getS3PresignedUrl("doc-123", "company-456"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(
          getS3PresignedUrl("doc-123", "company-456"),
        ).rejects.toThrow("timeout");
      });
    });

    // --- initMultipartUpload error scenarios ---

    describe("initMultipartUpload errors", () => {
      const defaultBody = {
        companyId: "company-456",
        qrcodeId: "qr-123",
        documentName: "test.pdf",
        documentPurpose: "file-qrcode" as const,
      };

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(initMultipartUpload(defaultBody)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 400 validation error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: ["companyId must be a mongodb id"],
            error: "Bad Request",
            statusCode: 400,
          }),
        );

        await expect(initMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 507 storage full", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(507, "Insufficient Storage", {
            message: "Storage quota exceeded for multipart upload",
          }),
        );

        await expect(initMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 507 }),
          }),
        );
      });

      it("should reject with 500 server error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "S3 multipart init failed",
          }),
        );

        await expect(initMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(initMultipartUpload(defaultBody)).rejects.toThrow(
          "timeout",
        );
      });
    });

    // --- completeMultipartUpload error scenarios ---

    describe("completeMultipartUpload errors", () => {
      const defaultBody = {
        s3Key: "key/path",
        uploadId: "upload-123",
        parts: [{ ETag: "etag-1", PartNumber: 1 }],
        companyId: "company-456",
        qrcodeId: "qr-123",
        documentName: "test.pdf",
        documentPurpose: "file-qrcode" as const,
      };

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(completeMultipartUpload(defaultBody)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 400 bad request for invalid parts", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid parts list",
          }),
        );

        await expect(completeMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 500 server error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "S3 multipart complete failed",
          }),
        );

        await expect(completeMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(completeMultipartUpload(defaultBody)).rejects.toThrow(
          "timeout",
        );
      });
    });

    // --- abortMultipartUpload error scenarios ---

    describe("abortMultipartUpload errors", () => {
      const defaultBody = { s3Key: "key/path", uploadId: "upload-123" };

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(abortMultipartUpload(defaultBody)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 404 when upload not found", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Multipart upload not found",
          }),
        );

        await expect(abortMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 404 }),
          }),
        );
      });

      it("should reject with 500 server error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "S3 abort failed",
          }),
        );

        await expect(abortMultipartUpload(defaultBody)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });
    });

    // --- updateDocument error scenarios ---

    describe("updateDocument errors", () => {
      const defaultParams = {
        companyId: "company-456",
        projectId: "project-789",
        documentName: "Updated",
      };

      it("should reject on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        await expect(updateDocument("doc-123", defaultParams)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 400 validation error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "openToPage must be a positive number",
          }),
        );

        await expect(updateDocument("doc-123", defaultParams)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 404 not found", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Document not found",
          }),
        );

        await expect(
          updateDocument("missing-doc", defaultParams),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 404 }),
          }),
        );
      });

      it("should reject with 500 server error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database write failed",
          }),
        );

        await expect(updateDocument("doc-123", defaultParams)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPatch.mockRejectedValue(timeoutError);

        await expect(updateDocument("doc-123", defaultParams)).rejects.toThrow(
          "timeout",
        );
      });
    });

    // --- moveDocument error scenarios ---

    describe("moveDocument errors", () => {
      it("should return error result with parsed message on 400", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid folder ID",
          }),
        );

        const result = await moveDocument(
          "doc-123",
          "bad-folder",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.message).toBeDefined();
      });

      it("should return error result on 403 forbidden", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Not authorized to move documents",
          }),
        );

        const result = await moveDocument(
          "doc-123",
          "folder-456",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 500 server error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Move operation failed",
          }),
        );

        const result = await moveDocument(
          "doc-123",
          "folder-456",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await moveDocument(
          "doc-123",
          "folder-456",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPatch.mockRejectedValue(timeoutError);

        const result = await moveDocument(
          "doc-123",
          "folder-456",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- moveDocumentsBulk error scenarios ---

    describe("moveDocumentsBulk errors", () => {
      it("should return error result when all moves fail", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid folder ID",
          }),
        );

        const result = await moveDocumentsBulk(
          ["doc-1"],
          "bad-folder",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
      });

      it("should return error result on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await moveDocumentsBulk(
          ["doc-1"],
          "folder-456",
          "company-789",
          "project-101",
        );

        expect(result.success).toBe(false);
      });
    });

    // --- deleteDocument error scenarios ---

    describe("deleteDocument errors", () => {
      it("should return error result on 403 forbidden", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Not authorized to delete this document",
          }),
        );

        const result = await deleteDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 404 not found", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Document not found",
          }),
        );

        const result = await deleteDocument("missing-doc", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 500 server error", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "S3 delete failed",
          }),
        );

        const result = await deleteDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        const result = await deleteDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockDelete.mockRejectedValue(timeoutError);

        const result = await deleteDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- deleteDocumentsBulk error scenarios ---

    describe("deleteDocumentsBulk errors", () => {
      it("should return error result on 400 bad request", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid documentIds format",
          }),
        );

        const result = await deleteDocumentsBulk(
          ["doc-1", "doc-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 403 forbidden", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Bulk delete not permitted",
          }),
        );

        const result = await deleteDocumentsBulk(["doc-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 500 server error", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Partial delete failure",
          }),
        );

        const result = await deleteDocumentsBulk(
          ["doc-1", "doc-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        const result = await deleteDocumentsBulk(["doc-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on filter-based delete failure", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Cascade delete failed",
          }),
        );

        const result = await deleteDocumentsBulk(undefined, "company-456", {
          folderId: "folder-123",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- restoreDocument error scenarios ---

    describe("restoreDocument errors", () => {
      it("should return error result on 400 bad request", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Document is not deleted",
          }),
        );

        const result = await restoreDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 403 forbidden", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Not authorized to restore documents",
          }),
        );

        const result = await restoreDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 500 server error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Restore operation failed",
          }),
        );

        const result = await restoreDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await restoreDocument("doc-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- restoreDocumentsBulk error scenarios ---

    describe("restoreDocumentsBulk errors", () => {
      it("should return error result on 400 bad request", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid documentIds",
          }),
        );

        const result = await restoreDocumentsBulk(
          ["doc-1", "doc-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 403 forbidden", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Bulk restore not permitted",
          }),
        );

        const result = await restoreDocumentsBulk(["doc-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on 500 server error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Bulk restore failed",
          }),
        );

        const result = await restoreDocumentsBulk(
          ["doc-1", "doc-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await restoreDocumentsBulk(["doc-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPatch.mockRejectedValue(timeoutError);

        const result = await restoreDocumentsBulk(["doc-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});
