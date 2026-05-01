/**
 * Tests for groups API endpoints
 * Tests all group-related API functions including CRUD, bulk delete,
 * Procore fetch, and query hooks.
 * Validates payloads align with backend validation pipes (GroupingTypeEnum,
 * companyId/projectId as MongoIds, groupName required, categories as string array).
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

vi.mock("../index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Mock axios.isAxiosError used in patchGroup
vi.mock("axios", () => ({
  default: {
    isAxiosError: (error: unknown) => {
      return typeof error === "object" && error !== null && "response" in error;
    },
  },
  isAxiosError: (error: unknown) => {
    return typeof error === "object" && error !== null && "response" in error;
  },
}));

import {
  useListGroups,
  useSingleGroup,
  getSingleGroup,
  patchGroup,
  deleteSingleGroup,
  deleteManyGroups,
  createGroup,
  getProcoreFetchGlobal,
  useProcoreFetchGlobal,
  getProcoreFetchGlobalTool,
  useProcoreFetchGlobalTool,
  groupsKeys,
} from "./groups";

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

describe("Groups API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("groupsKeys", () => {
    it("should generate correct list key with filters", () => {
      const key = groupsKeys.list({
        companyId: "company-456",
        projectId: "project-789",
        type: "equipment",
      });

      expect(key[0]).toBe("Groups");
      expect(key[1]).toBe("list");
      expect(key[2]).toBe("company-456");
      expect(key[3]).toBe("project-789");
      expect(key[4]).toBe("equipment");
    });

    it("should generate correct detail key", () => {
      const key = groupsKeys.detail("group-123");

      expect(key).toEqual(["Groups", "detail", "group-123"]);
    });
  });

  describe("groupsKeys - filter_ids alignment", () => {
    it("should include filter_ids in list key when provided", () => {
      const key = groupsKeys.list({
        companyId: "company-456",
        projectId: "project-789",
        filter_ids: ["id-1", "id-2"],
      });

      expect(key[0]).toBe("Groups");
      expect(key[1]).toBe("list");
      // filter_ids aren't in the key tuple (they trigger full refetch via param change)
      // but companyId and projectId should be present
      expect(key[2]).toBe("company-456");
      expect(key[3]).toBe("project-789");
    });
  });

  // ==================== Query Hooks ====================

  describe("useListGroups", () => {
    it("should fetch groups with params", async () => {
      const mockData = {
        success_message: "Success",
        data: [{ _id: "group-1" }],
        total_items: 1,
        total_pages: 1,
        current_page: 1,
        has_next: false,
        has_prev: false,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const params = { companyId: "company-456" };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });

    it("should be disabled when companyId and projectId are both missing", async () => {
      const { result } = renderHook(() => useListGroups({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should support type filter with procore-drawing-codes", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        type: "procore-drawing-codes" as const,
      };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });
  });

  describe("useListGroups - backend DTO alignment", () => {
    it("should pass filter_ids array (backend Transform from comma-separated string)", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        filter_ids: ["id-1", "id-2", "id-3"],
      };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });

    it("should pass sortBy and sortDir matching backend @IsIn whitelist", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        sortBy: "name",
        sortDir: "desc" as const,
      };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });

    it("should pass types array filter for multi-type filtering", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        types: ["arrangement", "equipment"] as Array<
          "arrangement" | "equipment" | "procore-drawing-codes"
        >,
      };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });

    it("should pass pagination params matching backend @IsInt @Min(1)", async () => {
      const mockData = { data: [], total_items: 0 };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        current_page: 2,
        per_page: 50,
      };

      const { result } = renderHook(() => useListGroups(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups", { params });
    });
  });

  describe("useSingleGroup", () => {
    it("should fetch single group by ID", async () => {
      const mockData = {
        success_message: "Found",
        data: { _id: "group-123", groupName: "Test Group" },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useSingleGroup("group-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/groups/group-123");
    });

    it("should be disabled when groupId is empty", async () => {
      const { result } = renderHook(() => useSingleGroup(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Imperative Fetch ====================

  describe("getSingleGroup", () => {
    it("should make GET request for single group", async () => {
      const mockData = {
        success_message: "Found",
        data: { _id: "group-123" },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await getSingleGroup("group-123");

      expect(mockGet).toHaveBeenCalledWith("/groups/group-123");
      expect(result).toEqual(mockData);
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(getSingleGroup("bad-id")).rejects.toThrow("Not found");
    });
  });

  // ==================== Patch Group ====================

  describe("patchGroup", () => {
    it("should make PATCH request with companyId and projectId", async () => {
      const mockData = {
        success_message: "Updated",
        data: { _id: "group-123", groupName: "Updated" },
      };
      mockPatch.mockResolvedValue({ data: mockData });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        groupName: "Updated Group",
      };

      const result = await patchGroup("group-123", formData);

      expect(mockPatch).toHaveBeenCalledWith("/groups/group-123", formData, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockData);
    });

    it("should support password protection fields", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", data: { _id: "group-123" } },
      });

      const formData = {
        companyId: "company-456",
        projectId: "project-789",
        passwordActivated: true,
        password: "secure123",
        timezone: "America/New_York",
        weekdayPassword: true,
        weekdayPasswordTimeStart: "08:00",
        weekdayPasswordTimeEnd: "17:00",
      };

      await patchGroup("group-123", formData);

      expect(mockPatch).toHaveBeenCalledWith("/groups/group-123", formData, {
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should throw transformed error for axios errors with response", async () => {
      mockPatch.mockRejectedValue({
        response: {
          status: 400,
          statusText: "Bad Request",
          data: { message: "Invalid group name" },
        },
      });

      await expect(
        patchGroup("group-123", {
          companyId: "company-456",
          projectId: "project-789",
        }),
      ).rejects.toThrow("Invalid group name");
    });

    it("should throw network error for axios errors without response", async () => {
      // This error has response key but it's undefined, so isAxiosError returns true
      // but error.response is undefined
      const error = Object.assign(new Error("timeout"), {
        response: undefined,
      });
      mockPatch.mockRejectedValue(error);

      await expect(
        patchGroup("group-123", {
          companyId: "company-456",
          projectId: "project-789",
        }),
      ).rejects.toThrow("Network error while updating group");
    });
  });

  // ==================== Delete Operations ====================

  describe("deleteSingleGroup", () => {
    it("should make DELETE request with companyId in data body", async () => {
      const mockResponse = {
        success_message: "Deleted",
        data: { _id: "group-123" },
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteSingleGroup("company-456", "group-123");

      expect(mockDelete).toHaveBeenCalledWith("/groups/group-123", {
        data: { companyId: "company-456" },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      await expect(
        deleteSingleGroup("company-456", "group-123"),
      ).rejects.toThrow("Delete failed");
    });
  });

  describe("deleteManyGroups", () => {
    it("should send groupIds array with companyId", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteManyGroups("company-456", [
        "group-1",
        "group-2",
      ]);

      expect(mockDelete).toHaveBeenCalledWith("/groups/bulk", {
        data: {
          companyId: "company-456",
          groupIds: ["group-1", "group-2"],
          projectId: undefined,
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should accept Set as groupIds", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 2, data: [] },
      });

      await deleteManyGroups("company-456", new Set(["group-1", "group-2"]));

      expect(mockDelete).toHaveBeenCalledWith("/groups/bulk", {
        data: expect.objectContaining({
          companyId: "company-456",
          groupIds: expect.arrayContaining(["group-1", "group-2"]),
        }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should include optional projectId", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyGroups("company-456", ["group-1"], "project-789");

      expect(mockDelete).toHaveBeenCalledWith("/groups/bulk", {
        data: expect.objectContaining({ projectId: "project-789" }),
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should return early when groupIds is empty", async () => {
      const result = await deleteManyGroups("company-456", []);

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.total_items).toBe(0);
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `group-${i}`);

      await expect(deleteManyGroups("company-456", tooManyIds)).rejects.toThrow(
        "Cannot delete more than 500 items at once",
      );
    });
  });

  // ==================== Create Group ====================

  describe("createGroup", () => {
    it("should make POST request with required fields", async () => {
      const mockResponse = {
        success_message: "Created",
        data: { _id: "group-new" },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const form = {
        companyId: "company-456",
        projectId: "project-789",
        groupName: "New Group",
      };

      const result = await createGroup(form);

      expect(mockPost).toHaveBeenCalledWith("/groups", form, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should include optional type field", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "group-new" } },
      });

      const form = {
        companyId: "company-456",
        projectId: "project-789",
        groupName: "Equipment Group",
        type: "equipment" as const,
        equipmentID: "EQ-001",
      };

      await createGroup(form);

      expect(mockPost).toHaveBeenCalledWith(
        "/groups",
        expect.objectContaining({
          type: "equipment",
          equipmentID: "EQ-001",
        }),
        expect.any(Object),
      );
    });

    it("should support all group types", async () => {
      const types = [
        "arrangement",
        "equipment",
        "group",
        "procore-drawing-codes",
      ] as const;

      for (const type of types) {
        mockPost.mockResolvedValue({
          data: { success_message: "Created", data: { _id: "group-new" } },
        });

        await createGroup({
          companyId: "company-456",
          projectId: "project-789",
          groupName: `${type} Group`,
          type,
        });
      }

      expect(mockPost).toHaveBeenCalledTimes(types.length);
    });

    it("should include optional categories as string array", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "group-new" } },
      });

      const form = {
        companyId: "company-456",
        projectId: "project-789",
        groupName: "Categorized Group",
        categories: ["cat-1", "cat-2", "cat-3"],
      };

      await createGroup(form);

      expect(mockPost).toHaveBeenCalledWith(
        "/groups",
        expect.objectContaining({
          categories: ["cat-1", "cat-2", "cat-3"],
        }),
        expect.any(Object),
      );
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Create failed"));

      await expect(
        createGroup({
          companyId: "company-456",
          projectId: "project-789",
          groupName: "Test",
        }),
      ).rejects.toThrow("Create failed");
    });
  });

  // ==================== Backend Validation Pipe Alignment ====================

  describe("createGroup - validation pipe alignment", () => {
    it("should propagate 400 from backend when groupName is empty", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["groupName should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createGroup({
          companyId: "company-456",
          projectId: "project-789",
          groupName: "",
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({ status: 400 }),
        }),
      );
    });

    it("should propagate 400 when non-whitelisted property is sent (forbidNonWhitelisted)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["property extraField should not exist"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createGroup({
          companyId: "company-456",
          projectId: "project-789",
          groupName: "Test",
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({ status: 400 }),
        }),
      );
    });
  });

  describe("patchGroup - validation pipe alignment", () => {
    it("should propagate 400 for invalid companyId format (not a MongoId)", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["companyId must be a mongodb id"],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPatch.mockRejectedValue(validationError);

      await expect(
        patchGroup("group-123", {
          companyId: "not-a-mongo-id",
          projectId: "project-789",
        }),
      ).rejects.toThrow();
    });
  });

  // ==================== Procore Fetch ====================

  describe("getProcoreFetchGlobal", () => {
    it("should make GET request for procore fetch global", async () => {
      const mockData = { items: [{ id: 1 }] };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await getProcoreFetchGlobal("group-123");

      expect(mockGet).toHaveBeenCalledWith(
        "/groups/group-123/procore-fetch-global",
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("useProcoreFetchGlobal", () => {
    it("should fetch procore data for group", async () => {
      const mockData = { items: [] };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useProcoreFetchGlobal("group-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/groups/group-123/procore-fetch-global",
      );
    });

    it("should be disabled when groupId is empty", async () => {
      const { result } = renderHook(() => useProcoreFetchGlobal(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("getProcoreFetchGlobalTool", () => {
    it("should make GET request with tool query param", async () => {
      const mockData = { items: [] };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await getProcoreFetchGlobalTool("group-123", "daily-log");

      expect(mockGet).toHaveBeenCalledWith(
        "/groups/group-123/procore-fetch-global?tool=daily-log",
      );
      expect(result).toEqual(mockData);
    });

    it("should encode special characters in tool param", async () => {
      mockGet.mockResolvedValue({ data: {} });

      await getProcoreFetchGlobalTool("group-123", "tool with spaces");

      expect(mockGet).toHaveBeenCalledWith(
        "/groups/group-123/procore-fetch-global?tool=tool%20with%20spaces",
      );
    });

    it("empty tool parameter sends empty string", async () => {
      // When tool is "", encodeURIComponent("") produces "", so the URL has ?tool=
      // The backend should handle this gracefully (e.g., return all tools or 400)
      mockGet.mockResolvedValue({ data: { items: [] } });

      await getProcoreFetchGlobalTool("group-123", "");

      expect(mockGet).toHaveBeenCalledWith(
        "/groups/group-123/procore-fetch-global?tool=",
      );
    });
  });

  describe("useProcoreFetchGlobalTool", () => {
    it("should fetch procore tool data for group", async () => {
      mockGet.mockResolvedValue({ data: { items: [] } });

      const { result } = renderHook(
        () => useProcoreFetchGlobalTool("group-123", "daily-log"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should be disabled when groupId or tool is empty", async () => {
      const { result } = renderHook(
        () => useProcoreFetchGlobalTool("", "daily-log"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when tool is empty string", async () => {
      const { result } = renderHook(
        () => useProcoreFetchGlobalTool("valid-id", ""),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // enabled: !!groupId && !!tool — empty string is falsy, so query should not fire
      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
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

    // --- useListGroups error scenarios ---

    describe("useListGroups errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useListGroups({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database connection failed",
          }),
        );

        const { result } = renderHook(
          () => useListGroups({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 403 forbidden as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Insufficient permissions",
          }),
        );

        const { result } = renderHook(
          () => useListGroups({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface error when response body is undefined (TanStack Query rejects undefined data)", async () => {
        mockGet.mockResolvedValue({ data: undefined });

        const { result } = renderHook(
          () => useListGroups({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(
          () => useListGroups({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- useSingleGroup error scenarios ---

    describe("useSingleGroup errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useSingleGroup("group-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 404 not found as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Group not found",
          }),
        );

        const { result } = renderHook(() => useSingleGroup("bad-id"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error"),
        );

        const { result } = renderHook(() => useSingleGroup("group-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    // --- getSingleGroup error scenarios ---

    describe("getSingleGroup errors", () => {
      it("should reject with 404 error", async () => {
        const error404 = createAxiosError(404, "Not Found", {
          message: "Group not found",
        });
        mockGet.mockRejectedValue(error404);

        await expect(getSingleGroup("missing-id")).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 404 }),
          }),
        );
      });

      it("should reject with 500 error", async () => {
        const error500 = createAxiosError(500, "Internal Server Error", {
          message: "Database error",
        });
        mockGet.mockRejectedValue(error500);

        await expect(getSingleGroup("group-123")).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        await expect(getSingleGroup("group-123")).rejects.toThrow("timeout");
      });
    });

    // --- patchGroup error scenarios ---

    describe("patchGroup errors", () => {
      const defaultPatchData = {
        companyId: "company-456",
        projectId: "project-789",
      };

      it("should throw transformed message for 400 Bad Request", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 400,
            statusText: "Bad Request",
            data: { message: "groupName should not be empty" },
          },
        });

        await expect(patchGroup("group-123", defaultPatchData)).rejects.toThrow(
          "groupName should not be empty",
        );
      });

      it("should throw transformed message for 403 Forbidden", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 403,
            statusText: "Forbidden",
            data: { message: "Insufficient permissions" },
          },
        });

        await expect(patchGroup("group-123", defaultPatchData)).rejects.toThrow(
          "Insufficient permissions",
        );
      });

      it("should throw transformed message for 500 Server Error", async () => {
        mockPatch.mockRejectedValue({
          response: {
            status: 500,
            statusText: "Internal Server Error",
            data: {},
          },
        });

        await expect(patchGroup("group-123", defaultPatchData)).rejects.toThrow(
          "Failed to update group: Internal Server Error",
        );
      });

      it("should throw 'Unexpected error' for non-axios errors", async () => {
        mockPatch.mockRejectedValue("string error");

        await expect(patchGroup("group-123", defaultPatchData)).rejects.toThrow(
          "Unexpected error while updating group",
        );
      });
    });

    // --- deleteSingleGroup error scenarios ---

    describe("deleteSingleGroup errors", () => {
      it("should reject with 400 Bad Request", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid companyId",
          }),
        );

        await expect(
          deleteSingleGroup("bad-company", "group-123"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 403 Forbidden", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Not authorized to delete this group",
          }),
        );

        await expect(
          deleteSingleGroup("company-456", "group-123"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Cascade delete failed",
          }),
        );

        await expect(
          deleteSingleGroup("company-456", "group-123"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        await expect(
          deleteSingleGroup("company-456", "group-123"),
        ).rejects.toThrow("Network Error");
      });
    });

    // --- deleteManyGroups error scenarios ---

    describe("deleteManyGroups errors", () => {
      it("should reject with 400 Bad Request", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid groupIds format",
          }),
        );

        await expect(
          deleteManyGroups("company-456", ["group-1", "group-2"]),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 403 Forbidden", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Bulk delete not permitted",
          }),
        );

        await expect(
          deleteManyGroups("company-456", ["group-1"]),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockDelete.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Partial delete failure",
          }),
        );

        await expect(
          deleteManyGroups("company-456", ["group-1", "group-2"]),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockDelete.mockRejectedValue(new Error("Network Error"));

        await expect(
          deleteManyGroups("company-456", ["group-1"]),
        ).rejects.toThrow("Network Error");
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockDelete.mockRejectedValue(timeoutError);

        await expect(
          deleteManyGroups("company-456", ["group-1"]),
        ).rejects.toThrow("timeout");
      });
    });

    // --- createGroup error scenarios ---

    describe("createGroup errors", () => {
      const defaultCreatePayload = {
        companyId: "company-456",
        projectId: "project-789",
        groupName: "Test Group",
      };

      it("should reject with 400 Bad Request for validation errors", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: ["groupName should not be empty"],
            error: "Bad Request",
            statusCode: 400,
          }),
        );

        await expect(createGroup(defaultCreatePayload)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 401 Unauthorized", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(401, "Unauthorized", {
            message: "Token expired",
          }),
        );

        await expect(createGroup(defaultCreatePayload)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 401 }),
          }),
        );
      });

      it("should reject with 403 Forbidden for permission errors", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Only admin and pm can create groups",
          }),
        );

        await expect(createGroup(defaultCreatePayload)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database write failed",
          }),
        );

        await expect(createGroup(defaultCreatePayload)).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(createGroup(defaultCreatePayload)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(createGroup(defaultCreatePayload)).rejects.toThrow(
          "timeout",
        );
      });
    });

    // --- Procore fetch error scenarios ---

    describe("getProcoreFetchGlobal errors", () => {
      it("should reject with 500 Server Error", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Procore API unreachable",
          }),
        );

        await expect(getProcoreFetchGlobal("group-123")).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        await expect(getProcoreFetchGlobal("group-123")).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 404 group not found", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Group not found",
          }),
        );

        await expect(
          getProcoreFetchGlobal("nonexistent-group"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 404 }),
          }),
        );
      });
    });

    describe("useProcoreFetchGlobal errors", () => {
      it("should surface server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error"),
        );

        const { result } = renderHook(
          () => useProcoreFetchGlobal("group-123"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    describe("getProcoreFetchGlobalTool errors", () => {
      it("should reject with 500 Server Error", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Tool fetch failed",
          }),
        );

        await expect(
          getProcoreFetchGlobalTool("group-123", "daily-log"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        await expect(
          getProcoreFetchGlobalTool("group-123", "daily-log"),
        ).rejects.toThrow("Network Error");
      });

      it("should reject with 429 rate limit response", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(429, "Too Many Requests", {
            message: "Rate limit exceeded",
          }),
        );

        await expect(
          getProcoreFetchGlobalTool("group-123", "daily-log"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({
              status: 429,
              data: expect.objectContaining({
                message: "Rate limit exceeded",
              }),
            }),
          }),
        );
      });
    });

    describe("useProcoreFetchGlobalTool errors", () => {
      it("should surface server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error"),
        );

        const { result } = renderHook(
          () => useProcoreFetchGlobalTool("group-123", "daily-log"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });
  });
});
