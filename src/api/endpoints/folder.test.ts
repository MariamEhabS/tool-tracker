/**
 * Tests for folder API endpoints
 * Tests all folder-related API functions including create, update, delete,
 * bulk delete (with filter-based and partial failure detection), and cascade count.
 * Validates payloads align with backend validation pipes (companyId, projectId,
 * qrcodeId as MongoId, folderName required, parentFolderId optional MongoId).
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

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/utils/httpErrors", () => ({
  parseHttpError: vi.fn((error) => ({
    message:
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || "Unknown error",
    status: (error as { response?: { status?: number } })?.response?.status,
  })),
}));

import {
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFoldersBulk,
  getFolderCascadeCount,
} from "./folder";

describe("Folder API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Create Folder ====================

  describe("createFolder", () => {
    it("should make POST request with required fields", async () => {
      const mockResponse = { data: { _id: "folder-123" } };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        companyId: "company-456",
        qrcodeId: "qr-123",
        folderName: "Test Folder",
      };

      const result = await createFolder(payload);

      expect(mockPost).toHaveBeenCalledWith("/folder", payload, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual({ _id: "folder-123" });
    });

    it("should include optional projectId and parentFolderId", async () => {
      mockPost.mockResolvedValue({
        data: { data: { _id: "folder-123" } },
      });

      const payload = {
        companyId: "company-456",
        projectId: "project-789",
        qrcodeId: "qr-123",
        folderName: "Sub Folder",
        parentFolderId: "parent-folder-456",
      };

      await createFolder(payload);

      expect(mockPost).toHaveBeenCalledWith("/folder", payload, {
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should propagate errors", async () => {
      const error = new Error("Validation failed");
      mockPost.mockRejectedValue(error);

      await expect(
        createFolder({
          companyId: "company-456",
          qrcodeId: "qr-123",
          folderName: "Test",
        }),
      ).rejects.toThrow("Validation failed");
    });
  });

  // ==================== Update Folder ====================

  describe("updateFolder", () => {
    it("should make PATCH request with companyId and projectId", async () => {
      mockPatch.mockResolvedValue({ data: { folderName: "Updated" } });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        folderName: "Updated Folder",
      };

      const result = await updateFolder("folder-123", params);

      expect(mockPatch).toHaveBeenCalledWith("/folder/folder-123", params, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Folder updated successfully");
    });

    it("should include optional qrcodeId", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        qrcodeId: "qr-new-123",
      };

      await updateFolder("folder-123", params);

      expect(mockPatch).toHaveBeenCalledWith(
        "/folder/folder-123",
        expect.objectContaining({ qrcodeId: "qr-new-123" }),
        expect.any(Object),
      );
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { status: 400, data: { message: "Bad request" } },
      });

      const result = await updateFolder("folder-123", {
        companyId: "company-456",
        projectId: "project-789",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==================== Delete Folder ====================

  describe("deleteFolder", () => {
    it("should make DELETE request with companyId in data body", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const result = await deleteFolder("folder-123", "company-456");

      expect(mockDelete).toHaveBeenCalledWith("/folder/folder-123", {
        data: { companyId: "company-456", projectId: undefined },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.success).toBe(true);
    });

    it("should include optional projectId", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await deleteFolder("folder-123", "company-456", "project-789");

      expect(mockDelete).toHaveBeenCalledWith("/folder/folder-123", {
        data: { companyId: "company-456", projectId: "project-789" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return error result on failure without throwing", async () => {
      mockDelete.mockRejectedValue({
        response: { status: 500, data: { message: "Server error" } },
      });

      const result = await deleteFolder("folder-123", "company-456");

      expect(result.success).toBe(false);
    });
  });

  // ==================== Bulk Delete Folders ====================

  describe("deleteFoldersBulk", () => {
    it("should send folderIds with companyId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 2 } });

      const result = await deleteFoldersBulk(
        ["folder-1", "folder-2"],
        "company-456",
      );

      expect(mockDelete).toHaveBeenCalledWith("/folder/bulk", {
        data: {
          companyId: "company-456",
          folderIds: ["folder-1", "folder-2"],
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should support filter-based deletion by qrcodeId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 5 } });

      await deleteFoldersBulk(undefined, "company-456", {
        qrcodeId: "qr-123",
      });

      expect(mockDelete).toHaveBeenCalledWith("/folder/bulk", {
        data: { companyId: "company-456", qrcodeId: "qr-123" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support filter-based deletion by groupingId and groupingType", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 3 } });

      await deleteFoldersBulk(undefined, "company-456", {
        groupingId: "group-123",
        groupingType: "arrangement",
      });

      expect(mockDelete).toHaveBeenCalledWith("/folder/bulk", {
        data: {
          companyId: "company-456",
          groupingId: "group-123",
          groupingType: "arrangement",
        },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support filter-based deletion by projectId", async () => {
      mockDelete.mockResolvedValue({ data: { total_items: 8 } });

      await deleteFoldersBulk(undefined, "company-456", {
        projectId: "project-789",
      });

      expect(mockDelete).toHaveBeenCalledWith("/folder/bulk", {
        data: { companyId: "company-456", projectId: "project-789" },
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return early when no IDs or filters provided", async () => {
      const result = await deleteFoldersBulk(undefined, "company-456");

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should return early when folderIds is empty array and no filters", async () => {
      const result = await deleteFoldersBulk([], "company-456");

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.count).toBe(0);
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `folder-${i}`);

      await expect(
        deleteFoldersBulk(tooManyIds, "company-456"),
      ).rejects.toThrow("Cannot delete more than 500 items at once");
    });

    it("should detect partial failure from backend cascade delete", async () => {
      mockDelete.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message:
              "Cascade delete partially failed: 3/5 folder cleanups completed. 2 folders failed.",
          },
        },
      });

      const result = await deleteFoldersBulk(
        ["folder-1", "folder-2", "folder-3", "folder-4", "folder-5"],
        "company-456",
      );

      expect(result.success).toBe(false);
      expect(result.partialResult).toEqual({
        succeeded: 3,
        failed: 2,
        total: 5,
      });
    });

    it("should detect partial failure from bulk delete message", async () => {
      mockDelete.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message:
              "Bulk delete partially failed: 7/10 root folders deleted. 3 folders failed.",
          },
        },
      });

      const result = await deleteFoldersBulk(
        Array.from({ length: 10 }, (_, i) => `folder-${i}`),
        "company-456",
      );

      expect(result.success).toBe(false);
      expect(result.partialResult).toEqual({
        succeeded: 7,
        failed: 3,
        total: 10,
      });
    });

    it("should return generic error when failure message does not match partial pattern", async () => {
      mockDelete.mockRejectedValue({
        response: { status: 500, data: { message: "Generic server error" } },
      });

      const result = await deleteFoldersBulk(["folder-1"], "company-456");

      expect(result.success).toBe(false);
      expect(result.partialResult).toBeUndefined();
    });
  });

  // ==================== Backend Validation Pipe Alignment ====================

  describe("createFolder - validation pipe alignment", () => {
    it("should propagate 400 when folderName is empty (backend @IsNotEmpty)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["folderName should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createFolder({
          companyId: "company-456",
          qrcodeId: "qr-123",
          folderName: "",
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
        createFolder({
          companyId: "company-456",
          qrcodeId: "not-valid",
          folderName: "Test",
        }),
      ).rejects.toEqual(validationError);
    });

    it("should propagate 400 when parentFolderId is not a valid MongoId", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["parentFolderId must be a mongodb id"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createFolder({
          companyId: "company-456",
          qrcodeId: "qr-123",
          folderName: "Test",
          parentFolderId: "not-valid",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  describe("deleteFoldersBulk - validation pipe alignment", () => {
    it("should support all groupingType enum values from backend", async () => {
      const groupingTypes = [
        "arrangement",
        "equipment",
        "group",
        "procore-drawing-codes",
      ];

      for (const groupingType of groupingTypes) {
        mockDelete.mockResolvedValue({ data: { total_items: 1 } });

        await deleteFoldersBulk(undefined, "company-456", {
          groupingId: "group-123",
          groupingType,
        });

        expect(mockDelete).toHaveBeenLastCalledWith("/folder/bulk", {
          data: {
            companyId: "company-456",
            groupingId: "group-123",
            groupingType,
          },
          headers: { "Content-Type": "application/json" },
        });
      }
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    // --- createFolder errors ---

    describe("createFolder errors", () => {
      it("should reject with 409 when folder name already exists in parent", async () => {
        const conflictError = {
          response: {
            status: 409,
            data: {
              message: "A folder with this name already exists",
              error: "Conflict",
              statusCode: 409,
            },
          },
        };
        mockPost.mockRejectedValue(conflictError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Duplicate Folder",
            parentFolderId: "parent-folder-456",
          }),
        ).rejects.toEqual(conflictError);
      });

      it("should reject with 404 when parent folder does not exist", async () => {
        const notFoundError = {
          response: {
            status: 404,
            data: {
              message: "Parent folder not found",
              error: "Not Found",
              statusCode: 404,
            },
          },
        };
        mockPost.mockRejectedValue(notFoundError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Orphan Folder",
            parentFolderId: "nonexistent-parent",
          }),
        ).rejects.toEqual(notFoundError);
      });

      it("should reject on network failure", async () => {
        const networkError = new Error("Network Error");
        (networkError as unknown as Record<string, string>).code =
          "ERR_NETWORK";
        mockPost.mockRejectedValue(networkError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Test",
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should reject on request timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        (timeoutError as unknown as Record<string, string>).code =
          "ECONNABORTED";
        mockPost.mockRejectedValue(timeoutError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Test",
          }),
        ).rejects.toThrow("timeout of 30000ms exceeded");
      });

      it("should reject with 401 when unauthorized", async () => {
        const unauthorizedError = {
          response: {
            status: 401,
            data: { message: "Unauthorized", statusCode: 401 },
          },
        };
        mockPost.mockRejectedValue(unauthorizedError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Test",
          }),
        ).rejects.toEqual(unauthorizedError);
      });

      it("should reject with 500 on server error", async () => {
        const serverError = {
          response: {
            status: 500,
            data: { message: "Internal server error", statusCode: 500 },
          },
        };
        mockPost.mockRejectedValue(serverError);

        await expect(
          createFolder({
            companyId: "company-456",
            qrcodeId: "qr-123",
            folderName: "Test",
          }),
        ).rejects.toEqual(serverError);
      });
    });

    // --- updateFolder errors ---

    describe("updateFolder errors", () => {
      it("should return error result with 409 for duplicate folder name", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 409,
            data: { message: "A folder with this name already exists" },
          },
        });

        const result = await updateFolder("folder-123", {
          companyId: "company-456",
          projectId: "project-789",
          folderName: "Duplicate Name",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.message).toBe("A folder with this name already exists");
      });

      it("should return error result with 404 when folder not found", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 404,
            data: { message: "Folder not found" },
          },
        });

        const result = await updateFolder("nonexistent-folder", {
          companyId: "company-456",
          projectId: "project-789",
          folderName: "Updated",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Folder not found");
      });

      it("should return error result with 403 when permission denied", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const result = await updateFolder("folder-123", {
          companyId: "company-456",
          projectId: "project-789",
          folderName: "Renamed",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Insufficient permissions");
      });

      it("should return error result on network failure", async () => {
        const networkError = new Error("Network Error");
        mockPatch.mockRejectedValue(networkError);

        const result = await updateFolder("folder-123", {
          companyId: "company-456",
          projectId: "project-789",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        (timeoutError as unknown as Record<string, string>).code =
          "ECONNABORTED";
        mockPatch.mockRejectedValue(timeoutError);

        const result = await updateFolder("folder-123", {
          companyId: "company-456",
          projectId: "project-789",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- deleteFolder errors ---

    describe("deleteFolder errors", () => {
      it("should return error result with 404 when folder not found", async () => {
        mockDelete.mockRejectedValue({
          response: {
            status: 404,
            data: { message: "Folder not found" },
          },
        });

        const result = await deleteFolder("nonexistent-folder", "company-456");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Folder not found");
      });

      it("should return error result with 403 when permission denied", async () => {
        mockDelete.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const result = await deleteFolder("folder-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Insufficient permissions");
      });

      it("should return error result when folder has children and cascade fails", async () => {
        mockDelete.mockRejectedValue({
          response: {
            status: 500,
            data: {
              message:
                "Cascade delete failed: unable to remove child documents",
            },
          },
        });

        const result = await deleteFolder("folder-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.message).toBe(
          "Cascade delete failed: unable to remove child documents",
        );
      });

      it("should return error result on network failure", async () => {
        const networkError = new Error("Network Error");
        mockDelete.mockRejectedValue(networkError);

        const result = await deleteFolder("folder-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        (timeoutError as unknown as Record<string, string>).code =
          "ECONNABORTED";
        mockDelete.mockRejectedValue(timeoutError);

        const result = await deleteFolder("folder-123", "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    // --- deleteFoldersBulk errors ---

    describe("deleteFoldersBulk errors", () => {
      it("should return error result with 403 when permission denied for bulk delete", async () => {
        mockDelete.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions for bulk delete" },
          },
        });

        const result = await deleteFoldersBulk(
          ["folder-1", "folder-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Insufficient permissions for bulk delete");
        expect(result.partialResult).toBeUndefined();
      });

      it("should return error result on network failure for bulk delete", async () => {
        const networkError = new Error("Network Error");
        mockDelete.mockRejectedValue(networkError);

        const result = await deleteFoldersBulk(["folder-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result on timeout for bulk delete", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        (timeoutError as unknown as Record<string, string>).code =
          "ECONNABORTED";
        mockDelete.mockRejectedValue(timeoutError);

        const result = await deleteFoldersBulk(
          ["folder-1", "folder-2"],
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should return error result with 401 when unauthorized for bulk delete", async () => {
        mockDelete.mockRejectedValue({
          response: {
            status: 401,
            data: { message: "Unauthorized" },
          },
        });

        const result = await deleteFoldersBulk(["folder-1"], "company-456");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unauthorized");
      });
    });

    // --- getFolderCascadeCount errors ---

    describe("getFolderCascadeCount errors", () => {
      it("should return null on 404 when folder not found", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 404,
            data: { message: "Folder not found" },
          },
        });

        const result = await getFolderCascadeCount(
          "nonexistent-folder",
          "company-456",
        );

        expect(result).toBeNull();
      });

      it("should return null on 403 permission denied", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const result = await getFolderCascadeCount("folder-123", "company-456");

        expect(result).toBeNull();
      });

      it("should return null on 500 server error", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 500,
            data: { message: "Internal server error" },
          },
        });

        const result = await getFolderCascadeCount("folder-123", "company-456");

        expect(result).toBeNull();
      });

      it("should return null on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        (timeoutError as unknown as Record<string, string>).code =
          "ECONNABORTED";
        mockGet.mockRejectedValue(timeoutError);

        const result = await getFolderCascadeCount("folder-123", "company-456");

        expect(result).toBeNull();
      });
    });
  });

  // ==================== Cascade Count ====================

  describe("getFolderCascadeCount", () => {
    it("should make GET request with companyId as query param", async () => {
      const mockResponse = { subfolderCount: 3, documentCount: 15 };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getFolderCascadeCount("folder-123", "company-456");

      expect(mockGet).toHaveBeenCalledWith("/folder/folder-123/cascade-count", {
        params: { companyId: "company-456" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should return null on error (non-critical fallback)", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));

      const result = await getFolderCascadeCount("folder-123", "company-456");

      expect(result).toBeNull();
    });
  });
});
