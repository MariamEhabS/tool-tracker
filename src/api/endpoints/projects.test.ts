/**
 * Tests for project API endpoints
 * Tests all project-related API functions including CRUD, bulk delete,
 * and query hooks for listing and single project retrieval.
 * Validates payloads align with backend validation pipes (companyId/projectId MongoIds,
 * projectName/city/state/ZIP required on create, userId for permission validation).
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

import {
  useAllProjects,
  useListProjects,
  useSingleProject,
  useSingleProjectByIdOnly,
  deleteManyProjects,
  deleteSingleProject,
  patchProject,
  createProject,
  projectKeys,
} from "./projects";

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

describe("Projects API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("projectKeys", () => {
    it("should generate correct list key", () => {
      const key = projectKeys.list("company-456");

      expect(key).toEqual(["Projects", "list", "company-456"]);
    });

    it("should generate correct paginated list key", () => {
      const key = projectKeys.listPaginated({
        companyId: "company-456",
        page: 2,
        perPage: 10,
      });

      expect(key[0]).toBe("Projects");
      expect(key[1]).toBe("listPaginated");
      expect(key[2]).toBe("company-456");
      expect(key[3]).toBe("2");
      expect(key[4]).toBe("10");
    });

    it("should generate correct single key", () => {
      const key = projectKeys.single("project-789");

      expect(key).toEqual(["Projects", "single", "project-789"]);
    });
  });

  // ==================== Query Hooks ====================

  describe("useAllProjects", () => {
    it("should fetch all projects for company", async () => {
      const mockData = [
        { _id: "project-1", projectName: "Project A" },
        { _id: "project-2", projectName: "Project B" },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useAllProjects("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/aggregation/all-projects/company-456",
      );
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useAllProjects(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("useListProjects", () => {
    it("should fetch paginated projects with correct query params", async () => {
      const mockData = {
        success_message: "Success",
        data: [{ _id: "project-1" }],
        total_items: 1,
        total_pages: 1,
        current_page: 1,
        has_next: false,
        has_prev: false,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        page: 1,
        perPage: 20,
        search: "test",
        status: "active",
        sortKey: "projectName",
        sortDir: "asc" as const,
      };

      const { result } = renderHook(() => useListProjects(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/project", {
        params: {
          companyId: "company-456",
          current_page: 1,
          per_page: 20,
          search: "test",
          status: "active",
          sort_by: "projectName",
          sort_dir: "asc",
        },
      });
    });

    it("should omit undefined optional params", async () => {
      mockGet.mockResolvedValue({
        data: { data: [], total_items: 0 },
      });

      const { result } = renderHook(
        () => useListProjects({ companyId: "company-456" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/project", {
        params: {
          companyId: "company-456",
          current_page: 1,
          per_page: 20,
          search: undefined,
          status: undefined,
          sort_by: undefined,
          sort_dir: undefined,
        },
      });
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useListProjects({ companyId: "" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("useSingleProject", () => {
    it("should fetch single project with companyId query param", async () => {
      const mockData = { _id: "project-789", projectName: "Test" };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useSingleProject("company-456", "project-789"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/project/project-789?companyId=company-456",
      );
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(() => useSingleProject("company-456", ""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useSingleProject("", "project-789"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("useSingleProjectByIdOnly", () => {
    it("should fetch project by ID without companyId", async () => {
      const mockData = {
        success_message: "Found",
        data: { _id: "project-789" },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useSingleProjectByIdOnly("project-789"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/project/by-id/project-789");
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(() => useSingleProjectByIdOnly(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Delete Operations ====================

  describe("deleteManyProjects", () => {
    it("should make DELETE request with companyId and projectIds", async () => {
      const mockResponse = {
        success_message: "Deleted",
        total_items: 2,
        data: [],
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteManyProjects({
        companyId: "company-456",
        projectIds: ["project-1", "project-2"],
      });

      expect(mockDelete).toHaveBeenCalledWith("/project/bulk", {
        data: {
          companyId: "company-456",
          projectIds: ["project-1", "project-2"],
        },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should throw when projectIds is empty", async () => {
      await expect(
        deleteManyProjects({ companyId: "company-456", projectIds: [] }),
      ).rejects.toThrow("projectIds is required for bulk project deletion");
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `project-${i}`);

      await expect(
        deleteManyProjects({
          companyId: "company-456",
          projectIds: tooManyIds,
        }),
      ).rejects.toThrow("Cannot delete more than 500 items at once");
    });

    it("should propagate server errors", async () => {
      mockDelete.mockRejectedValue(new Error("Server error"));

      await expect(
        deleteManyProjects({
          companyId: "company-456",
          projectIds: ["project-1"],
        }),
      ).rejects.toThrow("Server error");
    });
  });

  describe("deleteSingleProject", () => {
    it("should make DELETE request with companyId in data body", async () => {
      const mockResponse = {
        success_message: "Deleted",
        data: { _id: "project-789" },
      };
      mockDelete.mockResolvedValue({ data: mockResponse });

      const result = await deleteSingleProject("company-456", "project-789");

      expect(mockDelete).toHaveBeenCalledWith("/project/project-789", {
        data: { companyId: "company-456" },
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  // ==================== Patch Project ====================

  describe("patchProject", () => {
    it("should make PATCH request with companyId and update fields", async () => {
      const mockResponse = {
        success_message: "Updated",
        data: { _id: "project-789", projectName: "Updated" },
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const dto = {
        companyId: "company-456",
        projectName: "Updated Project",
      };

      const result = await patchProject("project-789", dto);

      expect(mockPatch).toHaveBeenCalledWith("/project/project-789", dto, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should support archived field", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", data: { _id: "project-789" } },
      });

      await patchProject("project-789", {
        companyId: "company-456",
        archived: "true",
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/project/project-789",
        expect.objectContaining({ archived: "true" }),
        expect.any(Object),
      );
    });

    it("should support projectStatus field", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", data: { _id: "project-789" } },
      });

      await patchProject("project-789", {
        companyId: "company-456",
        projectStatus: "completed",
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/project/project-789",
        expect.objectContaining({ projectStatus: "completed" }),
        expect.any(Object),
      );
    });

    it("should support Procore fields", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", data: {} },
      });

      await patchProject("project-789", {
        companyId: "company-456",
        procoreProjectID: "procore-123",
        procoreCompanyID: "procore-company-456",
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/project/project-789",
        expect.objectContaining({
          procoreProjectID: "procore-123",
          procoreCompanyID: "procore-company-456",
        }),
        expect.any(Object),
      );
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Update failed"));

      await expect(
        patchProject("project-789", { companyId: "company-456" }),
      ).rejects.toThrow("Update failed");
    });
  });

  // ==================== Backend Validation Pipe Alignment ====================

  describe("patchProject - validation pipe alignment", () => {
    it("should propagate 400 when companyId is not a valid MongoId", async () => {
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
        patchProject("project-789", { companyId: "not-a-mongo-id" }),
      ).rejects.toEqual(validationError);
    });
  });

  describe("createProject - validation pipe alignment", () => {
    it("should propagate 400 when required fields are missing", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: [
              "projectName should not be empty",
              "projectCity should not be empty",
              "projectState should not be empty",
              "projectZIP should not be empty",
            ],
            error: "Bad Request",
            statusCode: 400,
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(
        createProject({
          companyId: "company-456",
          userId: "user-123",
          projectName: "",
          projectCity: "",
          projectState: "",
          projectZIP: "",
        }),
      ).rejects.toEqual(validationError);
    });
  });

  // ==================== Create Project ====================

  describe("createProject", () => {
    it("should make POST request with all required fields", async () => {
      const mockResponse = {
        success_message: "Created",
        data: { _id: "project-new" },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const dto = {
        companyId: "company-456",
        userId: "user-123",
        projectName: "New Project",
        projectCity: "New York",
        projectState: "NY",
        projectZIP: "10001",
      };

      const result = await createProject(dto);

      expect(mockPost).toHaveBeenCalledWith("/project", dto, {
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("should include optional address and client name", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: { _id: "project-new" } },
      });

      const dto = {
        companyId: "company-456",
        userId: "user-123",
        projectName: "Full Project",
        projectAddress: "123 Main St",
        projectCity: "Los Angeles",
        projectState: "CA",
        projectZIP: "90001",
        clientName: "Acme Corp",
      };

      await createProject(dto);

      expect(mockPost).toHaveBeenCalledWith(
        "/project",
        expect.objectContaining({
          projectAddress: "123 Main St",
          clientName: "Acme Corp",
        }),
        expect.any(Object),
      );
    });

    it("should always include userId for backend permission validation", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: {} },
      });

      const dto = {
        companyId: "company-456",
        userId: "user-123",
        projectName: "Test",
        projectCity: "City",
        projectState: "ST",
        projectZIP: "12345",
      };

      await createProject(dto);

      expect(mockPost).toHaveBeenCalledWith(
        "/project",
        expect.objectContaining({ userId: "user-123" }),
        expect.any(Object),
      );
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Create failed"));

      await expect(
        createProject({
          companyId: "company-456",
          userId: "user-123",
          projectName: "Test",
          projectCity: "City",
          projectState: "ST",
          projectZIP: "12345",
        }),
      ).rejects.toThrow("Create failed");
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

    // --- useAllProjects error scenarios ---

    describe("useAllProjects errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useAllProjects("company-456"), {
          wrapper: createWrapper(),
        });

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

        const { result } = renderHook(() => useAllProjects("company-456"), {
          wrapper: createWrapper(),
        });

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

        const { result } = renderHook(() => useAllProjects("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(() => useAllProjects("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- useListProjects error scenarios ---

    describe("useListProjects errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useListProjects({ companyId: "company-456" }),
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
          () => useListProjects({ companyId: "company-456" }),
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
          () => useListProjects({ companyId: "company-456" }),
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
          () => useListProjects({ companyId: "company-456" }),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- useSingleProject error scenarios ---

    describe("useSingleProject errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useSingleProject("company-456", "project-789"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 404 not found as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Project not found",
          }),
        );

        const { result } = renderHook(
          () => useSingleProject("company-456", "project-789"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database connection failed",
          }),
        );

        const { result } = renderHook(
          () => useSingleProject("company-456", "project-789"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    // --- useSingleProjectByIdOnly error scenarios ---

    describe("useSingleProjectByIdOnly errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useSingleProjectByIdOnly("project-789"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 404 not found as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(404, "Not Found", {
            message: "Project not found",
          }),
        );

        const { result } = renderHook(
          () => useSingleProjectByIdOnly("project-789"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    // --- createProject error scenarios ---

    describe("createProject errors", () => {
      const validCreateDto = {
        companyId: "company-456",
        userId: "user-123",
        projectName: "Test",
        projectCity: "City",
        projectState: "ST",
        projectZIP: "12345",
      };

      it("should reject on network failure", async () => {
        const networkError = new Error("Network Error");
        Object.assign(networkError, { code: "ERR_NETWORK" });
        mockPost.mockRejectedValue(networkError);

        await expect(createProject(validCreateDto)).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject with 400 on validation error", async () => {
        const validationError = createAxiosError(400, "Bad Request", {
          message: [
            "projectName should not be empty",
            "projectCity should not be empty",
          ],
          error: "Bad Request",
          statusCode: 400,
        });
        mockPost.mockRejectedValue(validationError);

        await expect(createProject(validCreateDto)).rejects.toEqual(
          validationError,
        );
      });

      it("should reject with 401 when unauthorized", async () => {
        const unauthorizedError = createAxiosError(401, "Unauthorized", {
          message: "Unauthorized",
          statusCode: 401,
        });
        mockPost.mockRejectedValue(unauthorizedError);

        await expect(createProject(validCreateDto)).rejects.toEqual(
          unauthorizedError,
        );
      });

      it("should reject with 403 when permission denied", async () => {
        const forbiddenError = createAxiosError(403, "Forbidden", {
          message: "Insufficient permissions to create projects",
          statusCode: 403,
        });
        mockPost.mockRejectedValue(forbiddenError);

        await expect(createProject(validCreateDto)).rejects.toEqual(
          forbiddenError,
        );
      });

      it("should reject with 500 on server error", async () => {
        const serverError = createAxiosError(500, "Internal Server Error", {
          message: "Internal server error",
          statusCode: 500,
        });
        mockPost.mockRejectedValue(serverError);

        await expect(createProject(validCreateDto)).rejects.toEqual(
          serverError,
        );
      });

      it("should reject on request timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(createProject(validCreateDto)).rejects.toThrow(
          "timeout of 30000ms exceeded",
        );
      });
    });

    // --- patchProject error scenarios ---

    describe("patchProject errors", () => {
      it("should reject on network failure", async () => {
        const networkError = new Error("Network Error");
        Object.assign(networkError, { code: "ERR_NETWORK" });
        mockPatch.mockRejectedValue(networkError);

        await expect(
          patchProject("project-789", { companyId: "company-456" }),
        ).rejects.toThrow("Network Error");
      });

      it("should reject with 400 on validation error", async () => {
        const validationError = createAxiosError(400, "Bad Request", {
          message: ["companyId must be a mongodb id"],
          error: "Bad Request",
          statusCode: 400,
        });
        mockPatch.mockRejectedValue(validationError);

        await expect(
          patchProject("project-789", { companyId: "not-a-mongo-id" }),
        ).rejects.toEqual(validationError);
      });

      it("should reject with 401 when unauthorized", async () => {
        const unauthorizedError = createAxiosError(401, "Unauthorized", {
          message: "Unauthorized",
          statusCode: 401,
        });
        mockPatch.mockRejectedValue(unauthorizedError);

        await expect(
          patchProject("project-789", { companyId: "company-456" }),
        ).rejects.toEqual(unauthorizedError);
      });

      it("should reject with 403 when permission denied", async () => {
        const forbiddenError = createAxiosError(403, "Forbidden", {
          message: "Insufficient permissions",
          statusCode: 403,
        });
        mockPatch.mockRejectedValue(forbiddenError);

        await expect(
          patchProject("project-789", { companyId: "company-456" }),
        ).rejects.toEqual(forbiddenError);
      });

      it("should reject with 404 when project not found", async () => {
        const notFoundError = createAxiosError(404, "Not Found", {
          message: "Project not found",
          statusCode: 404,
        });
        mockPatch.mockRejectedValue(notFoundError);

        await expect(
          patchProject("nonexistent-project", { companyId: "company-456" }),
        ).rejects.toEqual(notFoundError);
      });

      it("should reject with 500 on server error", async () => {
        const serverError = createAxiosError(500, "Internal Server Error", {
          message: "Internal server error",
          statusCode: 500,
        });
        mockPatch.mockRejectedValue(serverError);

        await expect(
          patchProject("project-789", {
            companyId: "company-456",
            archived: "true",
          }),
        ).rejects.toEqual(serverError);
      });

      it("should reject on request timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPatch.mockRejectedValue(timeoutError);

        await expect(
          patchProject("project-789", { companyId: "company-456" }),
        ).rejects.toThrow("timeout of 30000ms exceeded");
      });
    });

    // --- deleteSingleProject error scenarios ---

    describe("deleteSingleProject errors", () => {
      it("should reject on network failure", async () => {
        const networkError = new Error("Network Error");
        Object.assign(networkError, { code: "ERR_NETWORK" });
        mockDelete.mockRejectedValue(networkError);

        await expect(
          deleteSingleProject("company-456", "project-789"),
        ).rejects.toThrow("Network Error");
      });

      it("should reject with 401 when unauthorized", async () => {
        const unauthorizedError = createAxiosError(401, "Unauthorized", {
          message: "Unauthorized",
          statusCode: 401,
        });
        mockDelete.mockRejectedValue(unauthorizedError);

        await expect(
          deleteSingleProject("company-456", "project-789"),
        ).rejects.toEqual(unauthorizedError);
      });

      it("should reject with 403 when permission denied", async () => {
        const forbiddenError = createAxiosError(403, "Forbidden", {
          message: "Insufficient permissions to delete projects",
          statusCode: 403,
        });
        mockDelete.mockRejectedValue(forbiddenError);

        await expect(
          deleteSingleProject("company-456", "project-789"),
        ).rejects.toEqual(forbiddenError);
      });

      it("should reject with 404 when project not found", async () => {
        const notFoundError = createAxiosError(404, "Not Found", {
          message: "Project not found",
          statusCode: 404,
        });
        mockDelete.mockRejectedValue(notFoundError);

        await expect(
          deleteSingleProject("company-456", "nonexistent-project"),
        ).rejects.toEqual(notFoundError);
      });

      it("should reject with 500 on cascade failure", async () => {
        const serverError = createAxiosError(500, "Internal Server Error", {
          message: "Failed to delete associated groups",
          statusCode: 500,
        });
        mockDelete.mockRejectedValue(serverError);

        await expect(
          deleteSingleProject("company-456", "project-789"),
        ).rejects.toEqual(serverError);
      });

      it("should reject on request timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockDelete.mockRejectedValue(timeoutError);

        await expect(
          deleteSingleProject("company-456", "project-789"),
        ).rejects.toThrow("timeout of 30000ms exceeded");
      });
    });

    // --- deleteManyProjects error scenarios ---

    describe("deleteManyProjects errors", () => {
      it("should reject on network failure", async () => {
        const networkError = new Error("Network Error");
        Object.assign(networkError, { code: "ERR_NETWORK" });
        mockDelete.mockRejectedValue(networkError);

        await expect(
          deleteManyProjects({
            companyId: "company-456",
            projectIds: ["project-1"],
          }),
        ).rejects.toThrow("Network Error");
      });

      it("should reject with 401 when unauthorized", async () => {
        const unauthorizedError = createAxiosError(401, "Unauthorized", {
          message: "Unauthorized",
          statusCode: 401,
        });
        mockDelete.mockRejectedValue(unauthorizedError);

        await expect(
          deleteManyProjects({
            companyId: "company-456",
            projectIds: ["project-1"],
          }),
        ).rejects.toEqual(unauthorizedError);
      });

      it("should reject with 403 when permission denied", async () => {
        const forbiddenError = createAxiosError(403, "Forbidden", {
          message: "Insufficient permissions for bulk delete",
          statusCode: 403,
        });
        mockDelete.mockRejectedValue(forbiddenError);

        await expect(
          deleteManyProjects({
            companyId: "company-456",
            projectIds: ["project-1", "project-2"],
          }),
        ).rejects.toEqual(forbiddenError);
      });

      it("should reject with 500 on cascade failure", async () => {
        const serverError = createAxiosError(500, "Internal Server Error", {
          message: "Cascade deletion failed for some projects",
          statusCode: 500,
        });
        mockDelete.mockRejectedValue(serverError);

        await expect(
          deleteManyProjects({
            companyId: "company-456",
            projectIds: ["project-1", "project-2"],
          }),
        ).rejects.toEqual(serverError);
      });

      it("should reject on request timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockDelete.mockRejectedValue(timeoutError);

        await expect(
          deleteManyProjects({
            companyId: "company-456",
            projectIds: ["project-1"],
          }),
        ).rejects.toThrow("timeout of 30000ms exceeded");
      });
    });
  });
});
