/**
 * Tests for QR code API endpoints
 * Tests all QR code-related API functions including CRUD, bulk operations,
 * job management, bulk assign, bulk password, and download.
 * Validates payloads align with backend validation pipes (QRCodeTypeEnum,
 * conditional url/procoreTool, companyId/projectId MongoIds, groupingType enum,
 * filter_ids Transform from comma-separated string, sortBy @IsIn whitelist,
 * current_page/per_page @IsInt @Min(1), groupingTypes/projectStatus array transforms).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

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
  useListQRCodes,
  useSingleQRCode,
  useQRImageSignedUrl,
  fetchSignedUrl,
  fetchSignedUrlsBatch,
  useListQuickCodes,
  deleteSingleQRCode,
  deleteManyQRCodes,
  updateQRCodeDetails,
  createQRCode,
  addCustomLinkToQRCode,
  generateBulkQRCodes,
  createBulkQRJob,
  createBulkQRItemsJob,
  getJobStatus,
  cancelJob,
  bulkAssignQRCodesToGroup,
  bulkAssignQRCodesToProject,
  bulkSetQRCodePassword,
  downloadQRCodes,
  QrKeys,
} from "./qr-codes";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("QR Code API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("QrKeys", () => {
    it("should generate correct list key with filters", () => {
      const key = QrKeys.list({
        companyId: "company-456",
        projectId: "project-789",
      });

      expect(key[0]).toBe("Qrs");
      expect(key[1]).toBe("list");
      expect(key[2]).toBe("company-456");
      expect(key[3]).toBe("project-789");
    });

    it("should generate correct single key", () => {
      const key = QrKeys.single("qr-123");

      expect(key).toEqual(["Qrs", "single", "qr-123"]);
    });
  });

  // ==================== Query Hooks ====================

  describe("useListQRCodes", () => {
    it("should fetch QR codes with params", async () => {
      const mockData = {
        data: [{ _id: "qr-1" }, { _id: "qr-2" }],
        total_items: 2,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const params = { companyId: "company-456", projectId: "project-789" };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });

    it("should be disabled when companyId and projectId are both missing", async () => {
      const { result } = renderHook(() => useListQRCodes({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useListQRCodes - advanced filters (backend DTO alignment)", () => {
    it("should pass filter_ids array as query param", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        filter_ids: ["id-1", "id-2", "id-3"],
      };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });

    it("should pass groupingTypes array filter", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        groupingTypes: ["arrangement", "equipment"],
      };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });

    it("should pass projectStatus array filter", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        projectStatus: ["active", "completed"],
      };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });

    it("should pass sortBy with backend-whitelisted value", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        sortBy: "scans",
        sortDir: "desc" as const,
      };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });

    it("should pass pagination params matching backend @IsInt @Min(1)", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        current_page: 3,
        per_page: 25,
      };

      const { result } = renderHook(() => useListQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code", { params });
    });
  });

  describe("useSingleQRCode", () => {
    it("should fetch single QR code by ID with companyId", async () => {
      const mockData = { _id: "qr-123", name: "Test QR" };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useSingleQRCode("qr-123", "company-456"),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code/qr-123", {
        params: { companyId: "company-456" },
      });
    });

    it("should be disabled when qrCodeId is empty", async () => {
      const { result } = renderHook(() => useSingleQRCode("", "company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when companyId is not provided and not in localStorage", async () => {
      const { result } = renderHook(() => useSingleQRCode("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("useQRImageSignedUrl", () => {
    it("should fetch signed URL for QR image", async () => {
      mockGet.mockResolvedValue({
        data: { signedUrl: "https://s3.example.com/qr.png" },
      });

      const { result } = renderHook(() => useQRImageSignedUrl("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code/image/qr-123");
      expect(result.current.data).toBe("https://s3.example.com/qr.png");
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(
        () => useQRImageSignedUrl("qr-123", false),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Imperative Fetch Functions ====================

  describe("fetchSignedUrl", () => {
    it("should return signedUrl on success", async () => {
      mockGet.mockResolvedValue({
        data: { signedUrl: "https://s3.example.com/qr.png" },
      });

      const result = await fetchSignedUrl("qr-123");

      expect(mockGet).toHaveBeenCalledWith("/qr-code/image/qr-123");
      expect(result).toBe("https://s3.example.com/qr.png");
    });

    it("should return null when signedUrl is missing", async () => {
      mockGet.mockResolvedValue({ data: { signedUrl: null, exists: false } });

      const result = await fetchSignedUrl("qr-123");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockGet.mockRejectedValue({ response: { status: 500 } });

      const result = await fetchSignedUrl("qr-123");

      expect(result).toBeNull();
    });
  });

  describe("fetchSignedUrlsBatch", () => {
    it("should fetch URLs for multiple QR codes in parallel", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { signedUrl: "url-1" } })
        .mockResolvedValueOnce({ data: { signedUrl: "url-2" } });

      const result = await fetchSignedUrlsBatch(["qr-1", "qr-2"]);

      expect(result).toBeInstanceOf(Map);
      expect(result.get("qr-1")).toBe("url-1");
      expect(result.get("qr-2")).toBe("url-2");
    });

    it("should handle mixed success and failure", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { signedUrl: "url-1" } })
        .mockRejectedValueOnce({ response: { status: 404 } });

      const result = await fetchSignedUrlsBatch(["qr-1", "qr-2"]);

      expect(result.get("qr-1")).toBe("url-1");
      expect(result.get("qr-2")).toBeNull();
    });
  });

  describe("useListQuickCodes", () => {
    it("should fetch quick codes with companyId and projectId in URL", async () => {
      const mockData = { data: [{ _id: "qr-1" }] };
      mockGet.mockResolvedValue({ data: mockData });

      const params = { companyId: "company-456", projectId: "project-789" };

      const { result } = renderHook(() => useListQuickCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/aggregation/quick-codes/company-456/project-789",
        { params },
      );
    });
  });

  // ==================== Delete Operations ====================

  describe("deleteSingleQRCode", () => {
    it("should make DELETE request with companyId in data body", async () => {
      const mockResponse = {
        success_message: "Deleted",
        data: { _id: "qr-123" },
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteSingleQRCode("company-456", "qr-123");

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/qr-123", {
        data: { companyId: "company-456" },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteSingleQRCode("company-456", "qr-123")).rejects.toThrow(
        "Delete failed",
      );
    });
  });

  describe("deleteManyQRCodes", () => {
    it("should send qrcodeIds array with companyId", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteManyQRCodes("company-456", ["qr-1", "qr-2"]);

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/bulk", {
        data: { companyId: "company-456", qrcodeIds: ["qr-1", "qr-2"] },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should accept Set as qrcodeIds", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      await deleteManyQRCodes("company-456", new Set(["qr-1", "qr-2"]));

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/bulk", {
        data: expect.objectContaining({
          companyId: "company-456",
          qrcodeIds: expect.arrayContaining(["qr-1", "qr-2"]),
        }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should include optional groupingId and groupingType", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyQRCodes(
        "company-456",
        ["qr-1"],
        "group-123",
        "arrangement",
      );

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/bulk", {
        data: expect.objectContaining({
          groupingId: "group-123",
          groupingType: "arrangement",
        }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should include optional projectId", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyQRCodes(
        "company-456",
        ["qr-1"],
        undefined,
        undefined,
        "project-789",
      );

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/bulk", {
        data: expect.objectContaining({ projectId: "project-789" }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return early when qrcodeIds is empty", async () => {
      const result = await deleteManyQRCodes("company-456", []);

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.total_items).toBe(0);
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `qr-${i}`);

      await expect(
        deleteManyQRCodes("company-456", tooManyIds),
      ).rejects.toThrow("Cannot delete more than 500 items at once");
    });
  });

  // ==================== Update Operations ====================

  describe("updateQRCodeDetails", () => {
    it("should make PATCH request with form data", async () => {
      const mockResponse = { success_message: "Updated", data: [] };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        qrcodeName: "Updated QR",
      };

      const result = await updateQRCodeDetails("qr-123", formData);

      expect(mockPatch).toHaveBeenCalledWith("/qr-code/qr-123", formData, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should support password protection fields", async () => {
      mockPatch.mockResolvedValue({ data: { success_message: "Updated" } });

      const formData = {
        companyId: "company-456",
        passwordActivated: true,
        password: "secure123",
        timezone: "America/New_York",
        weekdayPassword: true,
        weekdayPasswordTimeStart: "08:00",
        weekdayPasswordTimeEnd: "17:00",
        weekendPassword: false,
      };

      await updateQRCodeDetails("qr-123", formData);

      expect(mockPatch).toHaveBeenCalledWith("/qr-code/qr-123", formData, {
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should support grouping fields", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      const formData = {
        companyId: "company-456",
        groupingId: "group-123",
        groupingType: "equipment",
      };

      await updateQRCodeDetails("qr-123", formData);

      expect(mockPatch).toHaveBeenCalledWith(
        "/qr-code/qr-123",
        expect.objectContaining({
          groupingId: "group-123",
          groupingType: "equipment",
        }),
        expect.any(Object),
      );
    });
  });

  describe("updateQRCodeDetails - validation pipe alignment", () => {
    it("should propagate 400 for invalid groupingType enum value", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: [
              "groupingType must be one of the following values: arrangement, equipment, group, procore-drawing-codes",
            ],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPatch.mockRejectedValue(validationError);

      await expect(
        updateQRCodeDetails("qr-123", {
          companyId: "company-456",
          groupingType: "invalid-type",
        }),
      ).rejects.toEqual(validationError);
    });

    it("should propagate 400 for password too short (backend @MinLength(6))", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["password must be longer than or equal to 6 characters"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPatch.mockRejectedValue(validationError);

      await expect(
        updateQRCodeDetails("qr-123", {
          companyId: "company-456",
          passwordActivated: true,
          password: "abc",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  // ==================== Create Operations ====================

  describe("createQRCode", () => {
    it("should make POST request with required fields for file type", async () => {
      const mockResponse = {
        success_message: "Created",
        data: { _id: "qr-new" },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const formData = {
        companyId: "company-456",
        name: "New QR",
        type: "file" as const,
      };

      const result = await createQRCode(formData);

      expect(mockPost).toHaveBeenCalledWith("/qr-code", formData, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should include url when type is url", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "qr-new" } },
      });

      const formData = {
        companyId: "company-456",
        name: "URL QR",
        type: "url" as const,
        url: "https://example.com",
      };

      await createQRCode(formData);

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code",
        expect.objectContaining({ url: "https://example.com", type: "url" }),
        expect.any(Object),
      );
    });

    it("should include procoreTool when type is procore-tool", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "qr-new" } },
      });

      const formData = {
        companyId: "company-456",
        name: "Procore QR",
        type: "procore-tool" as const,
        procoreTool: "daily-log",
      };

      await createQRCode(formData);

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code",
        expect.objectContaining({
          type: "procore-tool",
          procoreTool: "daily-log",
        }),
        expect.any(Object),
      );
    });

    it("should include optional grouping fields", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "qr-new" } },
      });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        name: "Grouped QR",
        type: "folder" as const,
        groupingId: "group-123",
        groupingType: "arrangement" as const,
      };

      await createQRCode(formData);

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code",
        expect.objectContaining({
          groupingId: "group-123",
          groupingType: "arrangement",
        }),
        expect.any(Object),
      );
    });

    it("should support all QR code types", async () => {
      const types = [
        "file",
        "folder",
        "url",
        "static",
        "procore-tool",
        "procore-location",
        "procore-drawing-code",
      ] as const;

      for (const type of types) {
        mockPost.mockResolvedValue({
          data: { success_message: "Created", data: { _id: "qr-new" } },
        });

        await createQRCode({
          companyId: "company-456",
          name: `QR ${type}`,
          type,
        });
      }

      expect(mockPost).toHaveBeenCalledTimes(types.length);
    });
  });

  describe("createQRCode - validation pipe alignment", () => {
    it("should include procore-drawing-codes as valid groupingType", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "qr-new" } },
      });

      await createQRCode({
        companyId: "company-456",
        projectId: "project-789",
        name: "Drawing Code QR",
        type: "procore-drawing-code",
        groupingId: "group-123",
        groupingType: "procore-drawing-codes",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code",
        expect.objectContaining({
          type: "procore-drawing-code",
          groupingType: "procore-drawing-codes",
        }),
        expect.any(Object),
      );
    });

    it("should propagate 400 from backend ValidationPipe for missing required fields", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["name should not be empty", "type should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createQRCode({
          companyId: "company-456",
          name: "",
          type: "file",
        }),
      ).rejects.toEqual(validationError);
    });

    it("should propagate 400 from backend when non-whitelisted property is sent", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["property unknownField should not exist"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createQRCode({
          companyId: "company-456",
          name: "Test",
          type: "file",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  describe("addCustomLinkToQRCode", () => {
    it("should make POST request with link payload", async () => {
      const mockResponse = { _id: "link-123" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        companyId: "company-456",
        projectId: "project-789",
        documentName: "Custom Link",
        referenceLink: "https://example.com/doc",
      };

      const result = await addCustomLinkToQRCode("qr-123", payload);

      expect(mockPost).toHaveBeenCalledWith("/qr-code/qr-123/link", payload, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should include optional folderId", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await addCustomLinkToQRCode("qr-123", {
        companyId: "company-456",
        projectId: "project-789",
        documentName: "Link",
        referenceLink: "https://example.com",
        folderId: "folder-123",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/qr-123/link",
        expect.objectContaining({ folderId: "folder-123" }),
        expect.any(Object),
      );
    });
  });

  // ==================== Bulk QR Generation ====================

  describe("generateBulkQRCodes", () => {
    it("should make POST request with equipment and count", async () => {
      const mockResponse = [{ id: "qr-1", name: "QR-001", url: "https://..." }];
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await generateBulkQRCodes({
        equipmentId: "equip-123",
        projectId: "project-789",
        numberOfCodes: 5,
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/bulk",
        {
          equipmentID: "equip-123",
          projectId: "project-789",
          createdBy: undefined,
          numberOfCodes: 5,
        },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("createBulkQRJob", () => {
    it("should make POST request for async bulk job", async () => {
      const mockResponse = { jobId: "job-123", message: "Job created" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        equipmentId: "equip-123",
        projectId: "project-789",
        numberOfCodes: 100,
        companyId: "company-456",
        groupName: "Equipment Group",
        startNumber: 1,
      };

      const result = await createBulkQRJob(payload);

      expect(mockPost).toHaveBeenCalledWith("/qr-code/bulk-async", payload, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("createBulkQRItemsJob", () => {
    it("should make POST request for explicit async bulk items job", async () => {
      const mockResponse = { jobId: "job-items-123", message: "Job created" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        projectId: "project-789",
        companyId: "company-456",
        groupId: "group-123",
        groupName: "Drawing Codes",
        items: [
          {
            companyId: "company-456",
            projectId: "project-789",
            groupingId: "group-123",
            groupingType: "group",
            name: "A1",
            type: "procore-drawing-code",
            procoreLinkedItemId: "rev-1",
          },
        ],
      };

      const result = await createBulkQRItemsJob(payload);

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/bulk-items-async",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ==================== Job Management ====================

  describe("getJobStatus", () => {
    it("should make GET request for job status", async () => {
      const mockStatus = {
        jobId: "job-123",
        status: "processing",
        progress: 50,
        total: 100,
      };
      mockGet.mockResolvedValue({ data: { data: mockStatus } });

      const result = await getJobStatus("job-123");

      expect(mockGet).toHaveBeenCalledWith("/qr-code/jobs/job-123");
      expect(result).toEqual(mockStatus);
    });
  });

  describe("cancelJob", () => {
    it("should make DELETE request with companyId", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await cancelJob("job-123", "company-456");

      expect(mockDelete).toHaveBeenCalledWith("/qr-code/jobs/job-123", {
        data: { companyId: "company-456" },
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  // ==================== Bulk Assign Operations ====================

  describe("bulkAssignQRCodesToGroup", () => {
    it("should make PATCH request with assignment payload", async () => {
      // Mock the raw API response format (success_message, data)
      const mockApiResponse = {
        success_message: "5 QR codes assigned",
        data: 5,
      };
      mockPatch.mockResolvedValue({ data: mockApiResponse });

      const result = await bulkAssignQRCodesToGroup(
        ["qr-1", "qr-2"],
        "group-123",
        "equipment",
        "company-456",
        "project-789",
      );

      expect(mockPatch).toHaveBeenCalledWith(
        "/qr-code/bulk-assign",
        {
          qrCodeIds: ["qr-1", "qr-2"],
          groupingId: "group-123",
          groupingType: "equipment",
          companyId: "company-456",
          projectId: "project-789",
        },
        { headers: { "Content-Type": "application/json" } },
      );
      // Function transforms API response to { success, message, updated }
      expect(result).toEqual({
        success: true,
        message: "5 QR codes assigned",
        updated: 5,
      });
    });

    it("should support procore-drawing-codes groupType (GroupingTypeEnum alignment)", async () => {
      // Mock the raw API response format (success_message, data)
      const mockApiResponse = {
        success_message: "3 QR codes assigned",
        data: 3,
      };
      mockPatch.mockResolvedValue({ data: mockApiResponse });

      const result = await bulkAssignQRCodesToGroup(
        ["qr-1", "qr-2", "qr-3"],
        "group-123",
        "procore-drawing-codes",
        "company-456",
        "project-789",
      );

      expect(mockPatch).toHaveBeenCalledWith(
        "/qr-code/bulk-assign",
        {
          qrCodeIds: ["qr-1", "qr-2", "qr-3"],
          groupingId: "group-123",
          groupingType: "procore-drawing-codes",
          companyId: "company-456",
          projectId: "project-789",
        },
        { headers: { "Content-Type": "application/json" } },
      );
      // Function transforms API response to { success, message, updated }
      expect(result).toEqual({
        success: true,
        message: "3 QR codes assigned",
        updated: 3,
      });
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { data: { message: "Group not found" } },
      });

      const result = await bulkAssignQRCodesToGroup(
        ["qr-1"],
        "bad-group",
        "arrangement",
        "company-456",
        "project-789",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Group not found");
    });
  });

  describe("bulkAssignQRCodesToProject", () => {
    it("should make PATCH request with project assignment payload", async () => {
      // Mock the raw API response format (success_message, data)
      const mockApiResponse = {
        success_message: "3 QR codes assigned",
        data: 3,
      };
      mockPatch.mockResolvedValue({ data: mockApiResponse });

      const result = await bulkAssignQRCodesToProject(
        ["qr-1", "qr-2", "qr-3"],
        "project-789",
        "company-456",
      );

      expect(mockPatch).toHaveBeenCalledWith(
        "/qr-code/bulk-assign-project",
        {
          qrCodeIds: ["qr-1", "qr-2", "qr-3"],
          projectId: "project-789",
          companyId: "company-456",
        },
        { headers: { "Content-Type": "application/json" } },
      );
      // Function transforms API response to { success, message, updated }
      expect(result).toEqual({
        success: true,
        message: "3 QR codes assigned",
        updated: 3,
      });
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        message: "Network error",
      });

      const result = await bulkAssignQRCodesToProject(
        ["qr-1"],
        "project-789",
        "company-456",
      );

      expect(result.success).toBe(false);
    });
  });

  // ==================== Bulk Password ====================

  describe("bulkSetQRCodePassword", () => {
    it("should make PATCH request with password data", async () => {
      const mockResponse = { success: true, updated: 2 };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const passwordData = {
        passwordActivated: true,
        password: "secure123",
        timezone: "America/New_York",
        weekdayPassword: true,
        weekdayPasswordTimeStart: "08:00",
        weekdayPasswordTimeEnd: "17:00",
        weekendPassword: false,
      };

      const result = await bulkSetQRCodePassword(
        ["qr-1", "qr-2"],
        "company-456",
        passwordData,
      );

      expect(mockPatch).toHaveBeenCalledWith(
        "/qr-code/bulk-password",
        {
          qrCodeIds: ["qr-1", "qr-2"],
          companyId: "company-456",
          ...passwordData,
        },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return error result on failure without throwing", async () => {
      mockPatch.mockRejectedValue({
        response: { data: { message: "Invalid password" } },
      });

      const result = await bulkSetQRCodePassword(["qr-1"], "company-456", {
        passwordActivated: true,
        password: "",
      });

      expect(result.success).toBe(false);
    });
  });

  // ==================== Download ====================

  describe("downloadQRCodes", () => {
    it("should make POST request with qrCodeIds", async () => {
      const mockResponse = {
        success: true,
        downloadUrl: "https://s3.example.com/qr-download.zip",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await downloadQRCodes(["qr-1", "qr-2"]);

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/download",
        { qrCodeIds: ["qr-1", "qr-2"] },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return error result on failure without throwing", async () => {
      mockPost.mockRejectedValue({
        response: { data: { message: "Download failed" } },
      });

      const result = await downloadQRCodes(["qr-1"]);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Download failed");
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    // --- Network failures for query hooks ---

    describe("useListQRCodes - network failure", () => {
      it("should return error state on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useListQRCodes({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe("useSingleQRCode - network failure", () => {
      it("should return error state on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useSingleQRCode("qr-123", "company-456"),
          {
            wrapper: createWrapper(),
          },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe("useQRImageSignedUrl - network failure", () => {
      it("should return error state on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useQRImageSignedUrl("qr-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe("useListQuickCodes - network failure", () => {
      it("should return error state on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () =>
            useListQuickCodes({
              companyId: "company-456",
              projectId: "project-789",
            }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    // --- HTTP error status codes for query hooks ---

    describe("useListQRCodes - HTTP errors", () => {
      it("should surface 403 Forbidden error", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const { result } = renderHook(
          () => useListQRCodes({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it("should surface 500 Server Error", async () => {
        mockGet.mockRejectedValue({
          response: { status: 500, data: { message: "Internal Server Error" } },
        });

        const { result } = renderHook(
          () => useListQRCodes({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe("useSingleQRCode - HTTP errors", () => {
      it("should surface 404 Not Found", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 404,
            data: { message: "QR code not found" },
          },
        });

        const { result } = renderHook(
          () => useSingleQRCode("qr-missing", "company-456"),
          {
            wrapper: createWrapper(),
          },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it("should surface 401 Unauthorized", async () => {
        mockGet.mockRejectedValue({
          response: { status: 401, data: { message: "Unauthorized" } },
        });

        const { result } = renderHook(
          () => useSingleQRCode("qr-123", "company-456"),
          {
            wrapper: createWrapper(),
          },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    // --- Mutation error propagation (functions that throw) ---

    describe("createQRCode - error handling", () => {
      it("should throw on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          createQRCode({
            companyId: "company-456",
            name: "Test",
            type: "file",
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 401 Unauthorized", async () => {
        const error = {
          response: { status: 401, data: { message: "Unauthorized" } },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          createQRCode({
            companyId: "company-456",
            name: "Test",
            type: "file",
          }),
        ).rejects.toEqual(error);
      });

      it("should throw on 403 Forbidden", async () => {
        const error = {
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          createQRCode({
            companyId: "company-456",
            name: "Test",
            type: "file",
          }),
        ).rejects.toEqual(error);
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          createQRCode({
            companyId: "company-456",
            name: "Test",
            type: "file",
          }),
        ).rejects.toEqual(error);
      });

      it("should throw on timeout", async () => {
        mockPost.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          createQRCode({
            companyId: "company-456",
            name: "Test",
            type: "file",
          }),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });
    });

    describe("updateQRCodeDetails - error handling", () => {
      it("should throw on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        await expect(
          updateQRCodeDetails("qr-123", { companyId: "company-456" }),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockPatch.mockRejectedValue(error);

        await expect(
          updateQRCodeDetails("qr-123", { companyId: "company-456" }),
        ).rejects.toEqual(error);
      });

      it("should throw on timeout", async () => {
        mockPatch.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          updateQRCodeDetails("qr-123", { companyId: "company-456" }),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });
    });

    describe("deleteSingleQRCode - error handling", () => {
      it("should throw on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        await expect(
          deleteSingleQRCode("company-456", "qr-123"),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 403 Forbidden", async () => {
        const error = {
          response: {
            status: 403,
            data: {
              message: "You do not have permission to delete this QR code",
            },
          },
        };
        mockDelete.mockRejectedValue(error);

        await expect(
          deleteSingleQRCode("company-456", "qr-123"),
        ).rejects.toEqual(error);
      });

      it("should throw on 404 Not Found", async () => {
        const error = {
          response: {
            status: 404,
            data: { message: "QR code not found" },
          },
        };
        mockDelete.mockRejectedValue(error);

        await expect(
          deleteSingleQRCode("company-456", "qr-not-exist"),
        ).rejects.toEqual(error);
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockDelete.mockRejectedValue(error);

        await expect(
          deleteSingleQRCode("company-456", "qr-123"),
        ).rejects.toEqual(error);
      });
    });

    describe("deleteManyQRCodes - error handling", () => {
      it("should throw on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        await expect(
          deleteManyQRCodes("company-456", ["qr-1", "qr-2"]),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 400 Bad Request", async () => {
        const error = {
          response: {
            status: 400,
            data: { message: "Invalid QR code IDs" },
          },
        };
        mockDelete.mockRejectedValue(error);

        await expect(
          deleteManyQRCodes("company-456", ["qr-1"]),
        ).rejects.toEqual(error);
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockDelete.mockRejectedValue(error);

        await expect(
          deleteManyQRCodes("company-456", ["qr-1"]),
        ).rejects.toEqual(error);
      });
    });

    describe("addCustomLinkToQRCode - error handling", () => {
      it("should throw on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          addCustomLinkToQRCode("qr-123", {
            companyId: "company-456",
            projectId: "project-789",
            documentName: "Link",
            referenceLink: "https://example.com",
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 400 Bad Request", async () => {
        const error = {
          response: {
            status: 400,
            data: { message: "Invalid referenceLink" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          addCustomLinkToQRCode("qr-123", {
            companyId: "company-456",
            projectId: "project-789",
            documentName: "Link",
            referenceLink: "not-a-url",
          }),
        ).rejects.toEqual(error);
      });
    });

    // --- Bulk generation error handling ---

    describe("generateBulkQRCodes - error handling", () => {
      it("should throw on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          generateBulkQRCodes({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 5,
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 400 Bad Request", async () => {
        const error = {
          response: {
            status: 400,
            data: { message: "numberOfCodes must not be greater than 500" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          generateBulkQRCodes({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 1000,
          }),
        ).rejects.toEqual(error);
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          generateBulkQRCodes({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 5,
          }),
        ).rejects.toEqual(error);
      });
    });

    describe("createBulkQRJob - error handling", () => {
      it("should throw on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          createBulkQRJob({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 100,
            companyId: "company-456",
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockPost.mockRejectedValue(error);

        await expect(
          createBulkQRJob({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 100,
            companyId: "company-456",
          }),
        ).rejects.toEqual(error);
      });
    });

    // --- Job status polling errors ---

    describe("getJobStatus - error handling", () => {
      it("should throw on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        await expect(getJobStatus("job-123")).rejects.toThrow("Network Error");
      });

      it("should throw on 404 when job not found", async () => {
        const error = {
          response: { status: 404, data: { message: "Job not found" } },
        };
        mockGet.mockRejectedValue(error);

        await expect(getJobStatus("job-missing")).rejects.toEqual(error);
      });

      it("should throw on 500 Server Error", async () => {
        const error = {
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        };
        mockGet.mockRejectedValue(error);

        await expect(getJobStatus("job-123")).rejects.toEqual(error);
      });

      it("should throw on timeout", async () => {
        mockGet.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(getJobStatus("job-123")).rejects.toMatchObject({
          code: "ECONNABORTED",
        });
      });
    });

    describe("cancelJob - error handling", () => {
      it("should throw on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        await expect(cancelJob("job-123", "company-456")).rejects.toThrow(
          "Network Error",
        );
      });

      it("should throw on 404 when job not found", async () => {
        const error = {
          response: { status: 404, data: { message: "Job not found" } },
        };
        mockDelete.mockRejectedValue(error);

        await expect(cancelJob("job-missing", "company-456")).rejects.toEqual(
          error,
        );
      });
    });

    // --- Bulk operations that return error objects (don't throw) ---

    describe("bulkAssignQRCodesToGroup - error responses", () => {
      it("should return error on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await bulkAssignQRCodesToGroup(
          ["qr-1"],
          "group-123",
          "arrangement",
          "company-456",
          "project-789",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Network Error");
      });

      it("should return error on 400 Bad Request", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 400,
            data: { message: "Invalid groupingType" },
          },
        });

        const result = await bulkAssignQRCodesToGroup(
          ["qr-1"],
          "group-123",
          "arrangement",
          "company-456",
          "project-789",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid groupingType");
      });

      it("should return error on 403 Forbidden", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const result = await bulkAssignQRCodesToGroup(
          ["qr-1"],
          "group-123",
          "arrangement",
          "company-456",
          "project-789",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Insufficient permissions");
      });

      it("should return error on 500 Server Error", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        });

        const result = await bulkAssignQRCodesToGroup(
          ["qr-1"],
          "group-123",
          "arrangement",
          "company-456",
          "project-789",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Internal Server Error");
      });

      it("should return fallback message when no response data message", async () => {
        mockPatch.mockRejectedValue(new Error(""));

        const result = await bulkAssignQRCodesToGroup(
          ["qr-1"],
          "group-123",
          "arrangement",
          "company-456",
          "project-789",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Failed to assign QR codes to group");
      });
    });

    describe("bulkAssignQRCodesToProject - error responses", () => {
      it("should return error on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await bulkAssignQRCodesToProject(
          ["qr-1"],
          "project-789",
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Network Error");
      });

      it("should return error on 400 Bad Request", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 400,
            data: { message: "Invalid project ID" },
          },
        });

        const result = await bulkAssignQRCodesToProject(
          ["qr-1"],
          "bad-id",
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid project ID");
      });

      it("should return error on 500 Server Error", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        });

        const result = await bulkAssignQRCodesToProject(
          ["qr-1"],
          "project-789",
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Internal Server Error");
      });

      it("should return fallback message when no response data message", async () => {
        mockPatch.mockRejectedValue({});

        const result = await bulkAssignQRCodesToProject(
          ["qr-1"],
          "project-789",
          "company-456",
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("Failed to assign QR codes to project");
      });
    });

    describe("bulkSetQRCodePassword - error responses", () => {
      it("should return error on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        const result = await bulkSetQRCodePassword(["qr-1"], "company-456", {
          passwordActivated: true,
          password: "secure123",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Network Error");
      });

      it("should return error on 400 Bad Request for invalid password", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 400,
            data: {
              message: "password must be longer than or equal to 6 characters",
            },
          },
        });

        const result = await bulkSetQRCodePassword(["qr-1"], "company-456", {
          passwordActivated: true,
          password: "abc",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe(
          "password must be longer than or equal to 6 characters",
        );
      });

      it("should return error on 500 Server Error", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        });

        const result = await bulkSetQRCodePassword(["qr-1"], "company-456", {
          passwordActivated: true,
          password: "secure123",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Internal Server Error");
      });

      it("should return fallback message when no response data message", async () => {
        mockPatch.mockRejectedValue({});

        const result = await bulkSetQRCodePassword(["qr-1"], "company-456", {
          passwordActivated: true,
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Failed to set password for QR codes");
      });
    });

    describe("downloadQRCodes - error responses", () => {
      it("should return error on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        const result = await downloadQRCodes(["qr-1"]);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Network Error");
      });

      it("should return error on 403 Forbidden", async () => {
        mockPost.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Insufficient permissions" },
          },
        });

        const result = await downloadQRCodes(["qr-1"]);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Insufficient permissions");
      });

      it("should return error on 500 Server Error", async () => {
        mockPost.mockRejectedValue({
          response: {
            status: 500,
            data: { message: "Internal Server Error" },
          },
        });

        const result = await downloadQRCodes(["qr-1"]);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Internal Server Error");
      });

      it("should return fallback message when no response data message", async () => {
        mockPost.mockRejectedValue({});

        const result = await downloadQRCodes(["qr-1"]);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Download failed");
      });
    });

    // --- Empty / unexpected response handling ---

    describe("Empty response handling", () => {
      it("useListQRCodes should handle empty data array", async () => {
        mockGet.mockResolvedValue({ data: { data: [], total_items: 0 } });

        const { result } = renderHook(
          () => useListQRCodes({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({ data: [], total_items: 0 });
      });

      it("fetchSignedUrl should return null on empty signedUrl", async () => {
        mockGet.mockResolvedValue({ data: { signedUrl: null, exists: false } });

        const result = await fetchSignedUrl("qr-123");

        expect(result).toBeNull();
      });

      it("fetchSignedUrlsBatch should handle all-failure batch", async () => {
        mockGet
          .mockRejectedValueOnce({ response: { status: 500 } })
          .mockRejectedValueOnce({ response: { status: 500 } });

        const result = await fetchSignedUrlsBatch(["qr-1", "qr-2"]);

        expect(result.get("qr-1")).toBeNull();
        expect(result.get("qr-2")).toBeNull();
      });

      it("fetchSignedUrlsBatch should handle empty input array", async () => {
        const result = await fetchSignedUrlsBatch([]);

        expect(result.size).toBe(0);
        expect(mockGet).not.toHaveBeenCalled();
      });
    });

    // --- Timeout scenarios ---

    describe("Timeout scenarios", () => {
      it("deleteSingleQRCode should throw on timeout", async () => {
        mockDelete.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          deleteSingleQRCode("company-456", "qr-123"),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });

      it("deleteManyQRCodes should throw on timeout", async () => {
        mockDelete.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          deleteManyQRCodes("company-456", ["qr-1"]),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });

      it("generateBulkQRCodes should throw on timeout", async () => {
        mockPost.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          generateBulkQRCodes({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 5,
          }),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });

      it("createBulkQRJob should throw on timeout", async () => {
        mockPost.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          createBulkQRJob({
            equipmentId: "equip-123",
            projectId: "project-789",
            numberOfCodes: 100,
            companyId: "company-456",
          }),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });
    });
  });
});
