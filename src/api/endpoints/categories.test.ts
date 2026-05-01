/**
 * Tests for categories API endpoints
 * Tests all category-related API functions including queries, CRUD mutations,
 * bulk delete, cache invalidation, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
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

vi.mock("@/utils/rollbar", () => ({
  logApiError: vi.fn(),
}));

import {
  categoryKeys,
  useCategories,
  useCategoryClasses,
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useDeleteManyCategories,
  PROCORE_TOOL_OPTIONS,
} from "./categories";
import { logApiError } from "@/utils/rollbar";

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

describe("Categories API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("categoryKeys", () => {
    it("should generate correct all key", () => {
      expect(categoryKeys.all).toEqual(["categories"]);
    });

    it("should generate correct byCompany key", () => {
      expect(categoryKeys.byCompany("company-123")).toEqual([
        "categories",
        "company",
        "company-123",
      ]);
    });

    it("should generate correct classes key", () => {
      expect(categoryKeys.classes("company-123")).toEqual([
        "categories",
        "classes",
        "company-123",
      ]);
    });

    it("should generate correct single key", () => {
      expect(categoryKeys.single("cat-456")).toEqual([
        "categories",
        "single",
        "cat-456",
      ]);
    });
  });

  // ==================== Constants ====================

  describe("PROCORE_TOOL_OPTIONS", () => {
    it("should contain expected tool options", () => {
      expect(PROCORE_TOOL_OPTIONS.length).toBeGreaterThan(0);
      const values = PROCORE_TOOL_OPTIONS.map((o) => o.value);
      expect(values).toContain("drawings");
      expect(values).toContain("documents");
      expect(values).toContain("rfis");
      expect(values).toContain("submittals");
    });

    it("should have value and label for each option", () => {
      for (const option of PROCORE_TOOL_OPTIONS) {
        expect(option.value).toBeTruthy();
        expect(option.label).toBeTruthy();
      }
    });
  });

  // ==================== Query Hooks ====================

  describe("useCategories", () => {
    it("should fetch categories for a company", async () => {
      const mockCategories = [
        {
          _id: "cat-1",
          categoryName: "Safety",
          categoryClass: "ClassA",
          company: "company-123",
        },
        {
          _id: "cat-2",
          categoryName: "Electrical",
          categoryClass: "ClassB",
          company: "company-123",
        },
      ];
      mockGet.mockResolvedValue({ data: { data: mockCategories } });

      const { result } = renderHook(() => useCategories("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/categories", {
        params: { companyId: "company-123" },
      });
      expect(result.current.data).toEqual(mockCategories);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useCategories(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(() => useCategories("company-123", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should return empty array on 401 instead of throwing", async () => {
      mockGet.mockRejectedValue({
        response: { status: 401, data: { message: "Unauthorized" } },
      });

      const { result } = renderHook(() => useCategories("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(logApiError).toHaveBeenCalled();
    });

    it("should throw on non-401 errors", async () => {
      mockGet.mockRejectedValue({
        response: { status: 500, data: { message: "Server Error" } },
      });

      const { result } = renderHook(() => useCategories("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useCategoryClasses", () => {
    it("should fetch category classes for a company", async () => {
      const mockClasses = ["ClassA", "ClassB", "ClassC"];
      mockGet.mockResolvedValue({ data: { data: mockClasses } });

      const { result } = renderHook(() => useCategoryClasses("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/categories/classes", {
        params: { companyId: "company-123" },
      });
      expect(result.current.data).toEqual(mockClasses);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useCategoryClasses(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(
        () => useCategoryClasses("company-123", false),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return error state on failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useCategoryClasses("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useCategory", () => {
    it("should fetch a single category by ID", async () => {
      const mockCategory = {
        _id: "cat-1",
        categoryName: "Safety",
        categoryClass: "ClassA",
        company: "company-123",
      };
      mockGet.mockResolvedValue({ data: { data: mockCategory } });

      const { result } = renderHook(() => useCategory("cat-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/categories/cat-1");
      expect(result.current.data).toEqual(mockCategory);
    });

    it("should be disabled when categoryId is empty", async () => {
      const { result } = renderHook(() => useCategory(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(() => useCategory("cat-1", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return error state on failure", async () => {
      mockGet.mockRejectedValue({
        response: { status: 404, data: { message: "Not found" } },
      });

      const { result } = renderHook(() => useCategory("cat-missing"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== Mutations ====================

  describe("useCreateCategory", () => {
    it("should create a category with correct payload", async () => {
      const newCategory = {
        _id: "cat-new",
        categoryName: "Plumbing",
        categoryClass: "ClassC",
        company: "company-123",
        createdAt: "2026-01-01T00:00:00.000Z",
      };
      mockPost.mockResolvedValue({ data: { data: newCategory } });

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryName: "Plumbing",
          categoryClass: "ClassC",
          companyId: "company-123",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/categories", {
        categoryName: "Plumbing",
        categoryClass: "ClassC",
        companyId: "company-123",
      });
    });

    it("should include optional procoreTool in payload", async () => {
      mockPost.mockResolvedValue({
        data: { data: { _id: "cat-new" } },
      });

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryName: "RFIs",
          categoryClass: "Procore",
          companyId: "company-123",
          procoreTool: "rfis",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/categories",
        expect.objectContaining({ procoreTool: "rfis" }),
      );
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Create failed");
      mockPost.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryName: "Test",
          categoryClass: "ClassA",
          companyId: "company-123",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(logApiError).toHaveBeenCalledWith(error, "create-category-failed");
    });

    it("should propagate 400 validation error", async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: ["categoryName should not be empty"],
            error: "Bad Request",
          },
        },
      };
      mockPost.mockRejectedValue(validationError);

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryName: "",
          categoryClass: "ClassA",
          companyId: "company-123",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useUpdateCategory", () => {
    it("should update a category with correct payload", async () => {
      const updatedCategory = {
        _id: "cat-1",
        categoryName: "Updated Safety",
        categoryClass: "ClassA",
        company: "company-123",
      };
      mockPatch.mockResolvedValue({ data: { data: updatedCategory } });

      const { result } = renderHook(() => useUpdateCategory("company-123"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryId: "cat-1",
          input: { categoryName: "Updated Safety" },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith("/categories/cat-1", {
        categoryName: "Updated Safety",
      });
    });

    it("should support updating procoreTool to null", async () => {
      mockPatch.mockResolvedValue({
        data: { data: { _id: "cat-1" } },
      });

      const { result } = renderHook(() => useUpdateCategory("company-123"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryId: "cat-1",
          input: { procoreTool: null },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith("/categories/cat-1", {
        procoreTool: null,
      });
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Update failed");
      mockPatch.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateCategory("company-123"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          categoryId: "cat-1",
          input: { categoryName: "Test" },
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "update-category-failed",
        {
          categoryId: "cat-1",
        },
      );
    });
  });

  describe("useDeleteCategory", () => {
    it("should delete a category with companyId in data body", async () => {
      const deletedCategory = {
        _id: "cat-1",
        categoryName: "Safety",
        categoryClass: "ClassA",
      };
      mockDelete.mockResolvedValue({ data: { data: deletedCategory } });

      const { result } = renderHook(() => useDeleteCategory("company-123"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("cat-1");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDelete).toHaveBeenCalledWith("/categories/cat-1", {
        data: { companyId: "company-123" },
      });
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Delete failed");
      mockDelete.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteCategory("company-123"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("cat-1");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(logApiError).toHaveBeenCalledWith(error, "delete-category-failed");
    });
  });

  describe("useDeleteManyCategories", () => {
    it("should bulk delete categories with correct payload", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 2 },
      });

      const { result } = renderHook(
        () => useDeleteManyCategories("company-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.mutate(["cat-1", "cat-2"]);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDelete).toHaveBeenCalledWith("/categories/bulk", {
        data: { companyId: "company-123", categoryIds: ["cat-1", "cat-2"] },
      });
    });

    it("should throw when exceeding MAX_BULK_DELETE_COUNT", async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `cat-${i}`);

      const { result } = renderHook(
        () => useDeleteManyCategories("company-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.mutate(tooManyIds);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain(
        "Cannot delete more than 500 items at once",
      );
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Bulk delete failed");
      mockDelete.mockRejectedValue(error);

      const { result } = renderHook(
        () => useDeleteManyCategories("company-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.mutate(["cat-1"]);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "delete-categories-bulk-failed",
        {
          count: 1,
        },
      );
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    describe("useCategories - network failure", () => {
      it("should return error state on network failure for non-401 errors", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useCategories("company-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe("useCategoryClasses - HTTP errors", () => {
      it("should surface 500 Server Error", async () => {
        mockGet.mockRejectedValue({
          response: { status: 500, data: { message: "Internal Server Error" } },
        });

        const { result } = renderHook(() => useCategoryClasses("company-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe("useCategory - HTTP errors", () => {
      it("should surface 404 Not Found", async () => {
        mockGet.mockRejectedValue({
          response: { status: 404, data: { message: "Category not found" } },
        });

        const { result } = renderHook(() => useCategory("cat-missing"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });
});
