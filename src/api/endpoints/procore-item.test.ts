/**
 * Tests for Procore Item API endpoints (procore-item.ts)
 * Tests CRUD operations: create, bulk create, toggle visibility (single/bulk),
 * delete (single/bulk with batching).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  createProcoreItem,
  createProcoreItemsBulk,
  toggleVisibilitySingleProcoreItem,
  deleteSingleProcoreItem,
  deleteManyProcoreItems,
  toggleVisibilityBulkProcoreItems,
} from "./procore-item";

describe("Procore Item API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== createProcoreItem ====================

  describe("createProcoreItem", () => {
    it("should create a single procore item", async () => {
      const mockResponse = { _id: "pi-1", procoreItemID: "123" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        companyId: "company-456",
        projectId: "project-789",
        qrcodeId: "qr-123",
        procoreToolName: "drawings",
        procoreItemID: "123",
      };

      const result = await createProcoreItem(payload);

      expect(mockPost).toHaveBeenCalledWith("/procore-item", payload, {
        headers: { "x-skip-401-reload": "true" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Create failed"));

      await expect(
        createProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          qrcodeId: "qr-123",
          procoreToolName: "drawings",
          procoreItemID: "123",
        }),
      ).rejects.toThrow("Create failed");
    });
  });

  // ==================== createProcoreItemsBulk ====================

  describe("createProcoreItemsBulk", () => {
    it("should create multiple procore items in bulk", async () => {
      const mockResponse = {
        success_message: "Created",
        total_items: 2,
        data: [],
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        companyId: "company-456",
        projectId: "project-789",
        items: [
          {
            qrcodeId: "qr-1",
            procoreToolName: "drawings",
            procoreItemID: "111",
          },
          {
            qrcodeId: "qr-2",
            procoreToolName: "documents",
            procoreItemID: "222",
          },
        ],
      };

      const result = await createProcoreItemsBulk(payload);

      expect(mockPost).toHaveBeenCalledWith("/procore-item/bulk", payload);
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Bulk create failed"));

      await expect(
        createProcoreItemsBulk({
          companyId: "company-456",
          projectId: "project-789",
          items: [],
        }),
      ).rejects.toThrow("Bulk create failed");
    });

    it("should send duplicate procoreItemIDs as-is (frontend does not deduplicate)", async () => {
      // The frontend intentionally does NOT deduplicate items.
      // Deduplication is the responsibility of the calling component or the backend.
      // This test documents that createProcoreItemsBulk forwards all items,
      // even when multiple items share the same procoreItemID.
      const mockResponse = {
        success_message: "Created",
        total_items: 3,
        data: [],
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        companyId: "company-456",
        projectId: "project-789",
        items: [
          {
            qrcodeId: "qr-1",
            procoreToolName: "drawings",
            procoreItemID: "111",
          },
          {
            qrcodeId: "qr-2",
            procoreToolName: "drawings",
            procoreItemID: "111",
          },
          {
            qrcodeId: "qr-3",
            procoreToolName: "drawings",
            procoreItemID: "111",
          },
        ],
      };

      const result = await createProcoreItemsBulk(payload);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith("/procore-item/bulk", payload);
      // All 3 items sent even though they share the same procoreItemID
      const sentItems = mockPost.mock.calls[0][1].items;
      expect(sentItems).toHaveLength(3);
      expect(sentItems[0].procoreItemID).toBe("111");
      expect(sentItems[1].procoreItemID).toBe("111");
      expect(sentItems[2].procoreItemID).toBe("111");
      // Each has a different qrcodeId
      expect(sentItems[0].qrcodeId).toBe("qr-1");
      expect(sentItems[1].qrcodeId).toBe("qr-2");
      expect(sentItems[2].qrcodeId).toBe("qr-3");
      expect(result).toEqual(mockResponse);
    });
  });

  // ==================== toggleVisibilitySingleProcoreItem ====================

  describe("toggleVisibilitySingleProcoreItem", () => {
    it("should toggle visibility of a single procore item", async () => {
      const mockResponse = {
        success_message: "Updated",
        data: { hidden: true },
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        procoreItemID: "123",
        qrcodeId: "qr-123",
        hidden: true,
        procoreToolName: "drawings",
      };

      const result = await toggleVisibilitySingleProcoreItem(formData);

      expect(mockPatch).toHaveBeenCalledWith(
        "/procore-item/toggle-visibility/single",
        formData,
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Toggle failed"));

      await expect(
        toggleVisibilitySingleProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          procoreItemID: "123",
          qrcodeId: "qr-123",
        }),
      ).rejects.toThrow("Toggle failed");
    });
  });

  // ==================== deleteSingleProcoreItem ====================

  describe("deleteSingleProcoreItem", () => {
    it("should delete a single procore item", async () => {
      const mockResponse = {
        success_message: "Deleted",
        data: { _id: "pi-1" },
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        procoreItemID: "123",
        qrcodeId: "qr-123",
      };

      const result = await deleteSingleProcoreItem(formData);

      expect(mockDelete).toHaveBeenCalledWith("/procore-item/delete/single", {
        data: formData,
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      await expect(
        deleteSingleProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          procoreItemID: "123",
          qrcodeId: "qr-123",
        }),
      ).rejects.toThrow("Delete failed");
    });
  });

  // ==================== deleteManyProcoreItems ====================

  describe("deleteManyProcoreItems", () => {
    it("should return early with empty result when no IDs provided", async () => {
      const result = await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: [],
      });

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        success_message: "No procore items to delete",
        total_items: 0,
        data: [],
      });
    });

    it("should delete single batch when under 500 items", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 3,
        data: [{ _id: "pi-1" }, { _id: "pi-2" }, { _id: "pi-3" }],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ["pi-1", "pi-2", "pi-3"],
      });

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith("/procore-item/bulk", {
        data: {
          companyId: "company-456",
          procoreItemIdsDB: ["pi-1", "pi-2", "pi-3"],
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should batch delete when over 500 items", async () => {
      const ids = Array.from({ length: 750 }, (_, i) => `pi-${i}`);

      const batch1Response = {
        success_message: "Batch 1 deleted",
        total_items: 500,
        data: ids.slice(0, 500).map((id) => ({ _id: id })),
      };
      const batch2Response = {
        success_message: "Batch 2 deleted",
        total_items: 250,
        data: ids.slice(500).map((id) => ({ _id: id })),
      };

      mockDelete
        .mockResolvedValueOnce({ data: batch1Response })
        .mockResolvedValueOnce({ data: batch2Response });

      const result = await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ids,
      });

      expect(mockDelete).toHaveBeenCalledTimes(2);

      // First batch should have 500 items
      const firstCallData = mockDelete.mock.calls[0][1].data;
      expect(firstCallData.procoreItemIdsDB).toHaveLength(500);

      // Second batch should have 250 items
      const secondCallData = mockDelete.mock.calls[1][1].data;
      expect(secondCallData.procoreItemIdsDB).toHaveLength(250);

      // Aggregated result
      expect(result.total_items).toBe(750);
      expect(result.data).toHaveLength(750);
      expect(result.success_message).toBe("Batch 2 deleted");
    });

    it("should include optional filter fields", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ["pi-1", "pi-2"],
        qrcodeId: "qr-123",
        groupingId: "group-1",
        groupingType: "arrangement",
        projectId: "project-789",
      });

      expect(mockDelete).toHaveBeenCalledWith("/procore-item/bulk", {
        data: expect.objectContaining({
          qrcodeId: "qr-123",
          groupingId: "group-1",
          groupingType: "arrangement",
          projectId: "project-789",
        }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support dryRun option", async () => {
      const mockResponse = {
        success_message: "Dry run",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ["pi-1", "pi-2"],
        dryRun: true,
      });

      expect(mockDelete).toHaveBeenCalledWith("/procore-item/bulk", {
        data: expect.objectContaining({ dryRun: true }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should propagate errors from delete", async () => {
      mockDelete.mockRejectedValue(new Error("Bulk delete failed"));

      await expect(
        deleteManyProcoreItems({
          companyId: "company-456",
          procoreItemIdsDB: ["pi-1"],
        }),
      ).rejects.toThrow("Bulk delete failed");
    });

    it("should make exactly 1 API call for exactly 500 items", async () => {
      const ids = Array.from({ length: 500 }, (_, i) => `pi-${i}`);
      const mockResponse = {
        success_message: "Deleted",
        total_items: 500,
        data: ids.map((id) => ({ _id: id })),
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ids,
      });

      // Exactly 500 items should use the single-batch path (no loop)
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith("/procore-item/bulk", {
        data: {
          companyId: "company-456",
          procoreItemIdsDB: ids,
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result.total_items).toBe(500);
      expect(result.data).toHaveLength(500);
    });

    it("should make exactly 2 API calls for 501 items", async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `pi-${i}`);

      const batch1Response = {
        success_message: "Batch 1 deleted",
        total_items: 500,
        data: ids.slice(0, 500).map((id) => ({ _id: id })),
      };
      const batch2Response = {
        success_message: "Batch 2 deleted",
        total_items: 1,
        data: [{ _id: ids[500] }],
      };

      mockDelete
        .mockResolvedValueOnce({ data: batch1Response })
        .mockResolvedValueOnce({ data: batch2Response });

      const result = await deleteManyProcoreItems({
        companyId: "company-456",
        procoreItemIdsDB: ids,
      });

      expect(mockDelete).toHaveBeenCalledTimes(2);

      // First call should have 500 IDs
      const firstCallData = mockDelete.mock.calls[0][1].data;
      expect(firstCallData.procoreItemIdsDB).toHaveLength(500);

      // Second call should have exactly 1 ID
      const secondCallData = mockDelete.mock.calls[1][1].data;
      expect(secondCallData.procoreItemIdsDB).toHaveLength(1);
      expect(secondCallData.procoreItemIdsDB[0]).toBe("pi-500");

      // Aggregated result
      expect(result.total_items).toBe(501);
      expect(result.data).toHaveLength(501);
      expect(result.success_message).toBe("Batch 2 deleted");
    });

    it("should propagate error from second batch failure (no partial result)", async () => {
      const ids = Array.from({ length: 750 }, (_, i) => `pi-${i}`);

      const batch1Response = {
        success_message: "Batch 1 deleted",
        total_items: 500,
        data: ids.slice(0, 500).map((id) => ({ _id: id })),
      };
      const networkError = new Error("Network Error");

      mockDelete
        .mockResolvedValueOnce({ data: batch1Response })
        .mockRejectedValueOnce(networkError);

      // The function should reject with the network error from the second batch.
      // The first batch's successful result is lost because the function
      // does not catch errors within the batching loop.
      await expect(
        deleteManyProcoreItems({
          companyId: "company-456",
          procoreItemIdsDB: ids,
        }),
      ).rejects.toThrow("Network Error");

      // Verify both batches were attempted
      expect(mockDelete).toHaveBeenCalledTimes(2);

      // First batch had 500 items
      const firstCallData = mockDelete.mock.calls[0][1].data;
      expect(firstCallData.procoreItemIdsDB).toHaveLength(500);

      // Second batch had 250 items
      const secondCallData = mockDelete.mock.calls[1][1].data;
      expect(secondCallData.procoreItemIdsDB).toHaveLength(250);
    });
  });

  // ==================== toggleVisibilityBulkProcoreItems ====================

  describe("toggleVisibilityBulkProcoreItems", () => {
    it("should toggle visibility for multiple procore items", async () => {
      const mockResponse = {
        success_message: "Updated",
        total_items: 3,
        data: [],
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        procoreItemIDs: ["123", "456", "789"],
        qrcodeId: "qr-123",
        hidden: true,
      };

      const result = await toggleVisibilityBulkProcoreItems(formData);

      expect(mockPatch).toHaveBeenCalledWith(
        "/procore-item/toggle-visibility/bulk",
        formData,
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should toggle visibility to false (unhide)", async () => {
      const mockResponse = {
        success_message: "Updated",
        total_items: 2,
        data: [],
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        procoreItemIDs: ["123", "456"],
        qrcodeId: "qr-123",
        hidden: false,
      };

      const result = await toggleVisibilityBulkProcoreItems(formData);

      expect(mockPatch).toHaveBeenCalledWith(
        "/procore-item/toggle-visibility/bulk",
        expect.objectContaining({ hidden: false }),
        expect.any(Object),
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Bulk toggle failed"));

      await expect(
        toggleVisibilityBulkProcoreItems({
          companyId: "company-456",
          projectId: "project-789",
          procoreItemIDs: ["123"],
          qrcodeId: "qr-123",
          hidden: true,
        }),
      ).rejects.toThrow("Bulk toggle failed");
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    it("createProcoreItem should throw on 400 Bad Request", async () => {
      const error = {
        response: {
          status: 400,
          data: { message: "Invalid procoreToolName" },
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        createProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          qrcodeId: "qr-123",
          procoreToolName: "invalid",
          procoreItemID: "123",
        }),
      ).rejects.toEqual(error);
    });

    it("createProcoreItem should throw on 500 Server Error", async () => {
      const error = {
        response: { status: 500, data: { message: "Internal Server Error" } },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        createProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          qrcodeId: "qr-123",
          procoreToolName: "drawings",
          procoreItemID: "123",
        }),
      ).rejects.toEqual(error);
    });

    it("deleteSingleProcoreItem should throw on 404 Not Found", async () => {
      const error = {
        response: { status: 404, data: { message: "Procore item not found" } },
      };
      mockDelete.mockRejectedValue(error);

      await expect(
        deleteSingleProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          procoreItemID: "999",
          qrcodeId: "qr-123",
        }),
      ).rejects.toEqual(error);
    });

    it("toggleVisibilitySingleProcoreItem should throw on 403 Forbidden", async () => {
      const error = {
        response: {
          status: 403,
          data: { message: "Insufficient permissions" },
        },
      };
      mockPatch.mockRejectedValue(error);

      await expect(
        toggleVisibilitySingleProcoreItem({
          companyId: "company-456",
          projectId: "project-789",
          procoreItemID: "123",
          qrcodeId: "qr-123",
          hidden: true,
        }),
      ).rejects.toEqual(error);
    });

    it("createProcoreItemsBulk should throw on network failure", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      await expect(
        createProcoreItemsBulk({
          companyId: "company-456",
          projectId: "project-789",
          items: [
            {
              qrcodeId: "qr-1",
              procoreToolName: "drawings",
              procoreItemID: "111",
            },
          ],
        }),
      ).rejects.toThrow("Network Error");
    });
  });
});
