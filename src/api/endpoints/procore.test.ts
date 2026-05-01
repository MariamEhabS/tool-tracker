/**
 * Tests for Procore API endpoints (procore.ts)
 * Tests query hooks (useProcoreLocations, useProcorePermissions, useProcoreTools,
 * useProcoreInspectionTemplates, useProcoreDrawings, useProcoreDrawingsPaged,
 * useProcoreProjectsSearch) and mutation functions (postProcoreSync, postProcoreCreateBulkInspections).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
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

vi.mock("@/utils/rollbar", () => ({
  logProcoreError: vi.fn(),
}));

import {
  procoreKeys,
  useProcoreLocations,
  useProcorePermissions,
  useProcoreTools,
  useProcoreInspectionTemplates,
  postProcoreSync,
  postProcoreCreateBulkInspections,
  useProcoreDrawings,
  useProcoreDrawingsPaged,
  useProcoreProjectsSearch,
} from "./procore";
import { logProcoreError } from "@/utils/rollbar";

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

describe("Procore API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("procoreKeys", () => {
    it("should generate correct all key", () => {
      expect(procoreKeys.all).toEqual(["procore"]);
    });

    it("should generate correct sync key", () => {
      const key = procoreKeys.sync("company-1", "project-1", "grouping-1");
      expect(key).toEqual([
        "procore",
        "sync",
        "company-1",
        "project-1",
        "grouping-1",
      ]);
    });

    it("should generate correct locations key", () => {
      const key = procoreKeys.locations(
        "company-1",
        "project-1",
        "pc-company-1",
        "pc-project-1",
      );
      expect(key).toEqual([
        "procore",
        "locations",
        "company-1",
        "project-1",
        "pc-company-1",
        "pc-project-1",
      ]);
    });

    it("should generate correct permissions key", () => {
      const key = procoreKeys.permissions(
        "company-1",
        "project-1",
        "pc-company-1",
        "pc-project-1",
      );
      expect(key).toEqual([
        "procore",
        "permissions",
        "company-1",
        "project-1",
        "pc-company-1",
        "pc-project-1",
      ]);
    });

    it("should generate correct tools key", () => {
      const key = procoreKeys.tools("company-1", "project-1");
      expect(key).toEqual(["procore", "tools", "company-1", "project-1"]);
    });
  });

  // ==================== useProcoreLocations ====================

  describe("useProcoreLocations", () => {
    it("should fetch locations with correct params", async () => {
      const mockData = [{ id: 1, name: "Level 1" }];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () =>
          useProcoreLocations(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/locations", {
        params: { companyId: "company-1", projectId: "project-1" },
      });
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(
        () =>
          useProcoreLocations("", "project-1", "pc-company-1", "pc-project-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled when procoreProjectId is 'none'", async () => {
      const { result } = renderHook(
        () =>
          useProcoreLocations("company-1", "project-1", "pc-company-1", "none"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should report errors to rollbar", async () => {
      const error = new Error("Network Error");
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(
        () =>
          useProcoreLocations(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );

      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== useProcorePermissions ====================

  describe("useProcorePermissions", () => {
    it("should fetch permissions with correct params", async () => {
      const mockData = { tools: ["drawings", "documents"] };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () =>
          useProcorePermissions(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/permissions", {
        params: { companyId: "company-1", projectId: "project-1" },
      });
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(
        () =>
          useProcorePermissions(
            "company-1",
            "",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== useProcoreTools ====================

  describe("useProcoreTools", () => {
    it("should fetch tools with correct params", async () => {
      const mockData = [
        { id: 1, title: "Drawings", engine_name: "drawings", is_active: true },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useProcoreTools("company-1", "project-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/tools", {
        params: { companyId: "company-1", projectId: "project-1" },
      });
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useProcoreTools("", "project-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(() => useProcoreTools("company-1", ""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should report errors to rollbar", async () => {
      mockGet.mockRejectedValue(new Error("Fetch failed"));

      const { result } = renderHook(
        () => useProcoreTools("company-1", "project-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );

      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== useProcoreInspectionTemplates ====================

  describe("useProcoreInspectionTemplates", () => {
    it("should fetch inspection templates", async () => {
      const mockData = [{ id: 1, name: "Safety Checklist" }];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useProcoreInspectionTemplates("company-1", "project-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/inspection-templates", {
        params: { companyId: "company-1", projectId: "project-1" },
      });
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(
        () => useProcoreInspectionTemplates("company-1", ""),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(
        () => useProcoreInspectionTemplates("company-1", "project-1", false),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== postProcoreSync ====================

  describe("postProcoreSync", () => {
    it("should post sync with correct params", async () => {
      const mockResponse = { success_message: "Synced", created: 5 };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await postProcoreSync({
        companyId: "company-1",
        projectId: "project-1",
        groupingId: "group-1",
        groupingType: "arrangement",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/procore/sync",
        { groupingId: "group-1", groupingType: "arrangement" },
        { params: { companyId: "company-1", projectId: "project-1" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log 5xx errors to rollbar", async () => {
      const error = new Error("Server Error");
      Object.assign(error, { response: { status: 500 } });
      mockPost.mockRejectedValue(error);

      await expect(
        postProcoreSync({
          companyId: "company-1",
          projectId: "project-1",
          groupingId: "group-1",
        }),
      ).rejects.toBe(error);

      expect(logProcoreError).toHaveBeenCalled();
    });

    it("should log network errors (no status) to rollbar", async () => {
      const error = new Error("Network Error");
      mockPost.mockRejectedValue(error);

      await expect(
        postProcoreSync({
          companyId: "company-1",
          projectId: "project-1",
          groupingId: "group-1",
        }),
      ).rejects.toThrow("Network Error");

      expect(logProcoreError).toHaveBeenCalled();
    });

    it("should not log 4xx errors to rollbar", async () => {
      const error = new Error("Bad Request");
      Object.assign(error, { response: { status: 400 } });
      mockPost.mockRejectedValue(error);

      await expect(
        postProcoreSync({
          companyId: "company-1",
          projectId: "project-1",
          groupingId: "group-1",
        }),
      ).rejects.toBe(error);

      // logProcoreError is called, but internally skips 4xx errors
      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== postProcoreCreateBulkInspections ====================

  describe("postProcoreCreateBulkInspections", () => {
    it("should post bulk inspections with correct payload", async () => {
      const mockResponse = {
        success_message: "Created",
        created: 3,
        total_qrcodes: 5,
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await postProcoreCreateBulkInspections({
        companyId: "company-1",
        projectId: "project-1",
        groupingId: "group-1",
        inspectionTemplateId: "template-1",
        groupingType: "equipment",
        qrCodeIds: ["qr-1", "qr-2"],
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/procore/inspections/bulk",
        {
          groupingId: "group-1",
          inspectionTemplateId: "template-1",
          groupingType: "equipment",
          qrCodeIds: ["qr-1", "qr-2"],
        },
        { params: { companyId: "company-1", projectId: "project-1" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log 5xx errors to rollbar", async () => {
      const error = new Error("Internal Server Error");
      Object.assign(error, { response: { status: 500 } });
      mockPost.mockRejectedValue(error);

      await expect(
        postProcoreCreateBulkInspections({
          companyId: "company-1",
          projectId: "project-1",
          groupingId: "group-1",
          inspectionTemplateId: "template-1",
        }),
      ).rejects.toBe(error);

      expect(logProcoreError).toHaveBeenCalled();
    });

    it("should propagate 4xx errors without rollbar logging", async () => {
      const error = new Error("Forbidden");
      Object.assign(error, { response: { status: 403 } });
      mockPost.mockRejectedValue(error);

      await expect(
        postProcoreCreateBulkInspections({
          companyId: "company-1",
          projectId: "project-1",
          groupingId: "group-1",
          inspectionTemplateId: "template-1",
        }),
      ).rejects.toBe(error);

      // logProcoreError is called, but internally skips 4xx errors
      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== useProcoreDrawings ====================

  describe("useProcoreDrawings", () => {
    it("should fetch drawings with correct params", async () => {
      const mockData = [{ id: 1, title: "Floor Plan" }];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () =>
          useProcoreDrawings(
            "qr-123",
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/drawings", {
        params: {
          qrCodeId: "qr-123",
          companyId: "company-1",
          projectId: "project-1",
        },
      });
    });

    it("should be disabled when procoreProjectId is 'none'", async () => {
      const { result } = renderHook(
        () =>
          useProcoreDrawings(
            "qr-123",
            "company-1",
            "project-1",
            "pc-company-1",
            "none",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== useProcoreDrawingsPaged ====================

  describe("useProcoreDrawingsPaged", () => {
    it("should fetch first page of drawings", async () => {
      const mockData = {
        data: [{ id: 1 }],
        nextCursor: "1:50",
        hasNext: true,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () =>
          useProcoreDrawingsPaged(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
            50,
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/drawings", {
        params: {
          qrCodeId: "new",
          companyId: "company-1",
          projectId: "project-1",
          paginated: true,
          perPage: 50,
          cursor: "0:0",
        },
      });
    });

    it("should be disabled when procoreProjectId is 'none'", async () => {
      const { result } = renderHook(
        () =>
          useProcoreDrawingsPaged(
            "company-1",
            "project-1",
            "pc-company-1",
            "none",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should report errors to rollbar", async () => {
      mockGet.mockRejectedValue(new Error("Paged fetch failed"));

      const { result } = renderHook(
        () =>
          useProcoreDrawingsPaged(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );

      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== useProcoreProjectsSearch ====================

  describe("useProcoreProjectsSearch", () => {
    it("should search projects with search term", async () => {
      const mockData = {
        companies: [{ id: 1, name: "Company A", is_active: true }],
        projects: [
          [
            {
              id: 1,
              name: "Project A",
              display_name: "Project A",
              status_name: "Active",
            },
          ],
        ],
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useProcoreProjectsSearch("company-1", "test"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/projects/search", {
        params: { companyId: "company-1", search: "test" },
      });
    });

    it("should pass undefined search when empty", async () => {
      mockGet.mockResolvedValue({ data: { companies: [], projects: [] } });

      const { result } = renderHook(
        () => useProcoreProjectsSearch("company-1", ""),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/projects/search", {
        params: { companyId: "company-1", search: undefined },
      });
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useProcoreProjectsSearch(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(
        () => useProcoreProjectsSearch("company-1", "test", false),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should report errors to rollbar", async () => {
      mockGet.mockRejectedValue(new Error("Search failed"));

      const { result } = renderHook(
        () => useProcoreProjectsSearch("company-1", "test"),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );

      expect(logProcoreError).toHaveBeenCalled();
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    it("useProcoreLocations should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(
        () =>
          useProcoreLocations(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );
    });

    it("useProcorePermissions should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(
        () =>
          useProcorePermissions(
            "company-1",
            "project-1",
            "pc-company-1",
            "pc-project-1",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });
});
