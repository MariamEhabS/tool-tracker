/**
 * Contract Test: Categories API
 *
 * Validates that the frontend Categories API client (categories.ts) sends
 * request bodies and hits URL paths that align with the backend specification
 * defined in backend-contracts.ts.
 *
 * Because the categories module uses React Query hooks (useMutation, useQuery),
 * tests use renderHook with a QueryClient wrapper to invoke the underlying
 * axios calls.
 *
 * When the backend changes a category DTO or route, update backend-contracts.ts
 * first, then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend contract definitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  BackendCreateCategoryDto,
  BackendUpdateCategoryDto,
  BackendDeleteManyCategoriesDto,
  BackendBasicRequestDto,
  BackendProcoreToolEnum,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPost = vi.fn().mockResolvedValue({ data: { data: {} } });
const mockGet = vi.fn().mockResolvedValue({ data: { data: [] } });
const mockPatch = vi.fn().mockResolvedValue({ data: { data: {} } });
const mockDelete = vi.fn().mockResolvedValue({ data: { data: {} } });

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Import frontend types and hooks AFTER mocks are registered
import {
  type CreateCategoryInput,
  type UpdateCategoryInput,
  PROCORE_TOOL_OPTIONS,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useDeleteManyCategories,
} from "@api/endpoints/categories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all string values from a TypeScript enum object. */
function enumValues<T extends Record<string, string>>(e: T): string[] {
  return Object.values(e);
}

/** Return the keys of a TypeScript interface at runtime via a sample object. */
function keysOf<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj);
}

/** Create a fresh QueryClient wrapper for renderHook tests. */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Categories API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: {} } });
    mockGet.mockResolvedValue({ data: { data: [] } });
    mockPatch.mockResolvedValue({ data: { data: {} } });
    mockDelete.mockResolvedValue({ data: { data: {} } });
  });

  // =========================================================================
  // 1. CreateCategoryInput fields match BackendCreateCategoryDto
  // =========================================================================
  it("CreateCategoryInput fields match BackendCreateCategoryDto", () => {
    // Build a sample CreateCategoryInput with all fields
    const frontendInput: CreateCategoryInput = {
      categoryName: "Test Category",
      categoryClass: "Test Class",
      companyId: "abc123",
      procoreTool: "documents",
    };

    // Build the backend DTO keys for comparison
    const backendDtoKeys = keysOf<BackendCreateCategoryDto>({
      categoryName: "",
      categoryClass: "",
      companyId: "",
      procoreTool: BackendProcoreToolEnum.DOCUMENTS,
    });

    // Every field the frontend sends should be a valid backend DTO field
    for (const frontendKey of Object.keys(frontendInput)) {
      expect(backendDtoKeys).toContain(frontendKey);
    }

    // Verify required backend fields are present in the frontend type
    const requiredFields =
      BACKEND_ROUTES["categories.create"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(frontendInput).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 2. UpdateCategoryInput fields match BackendUpdateCategoryDto
  // =========================================================================
  it("UpdateCategoryInput fields match BackendUpdateCategoryDto", () => {
    // Build a sample UpdateCategoryInput with all optional fields populated
    const frontendInput: UpdateCategoryInput = {
      categoryName: "Updated Name",
      categoryClass: "Updated Class",
      procoreTool: "drawings",
    };

    // Build the backend DTO keys for comparison
    const backendDtoKeys = keysOf<BackendUpdateCategoryDto>({
      categoryName: "",
      categoryClass: "",
      procoreTool: BackendProcoreToolEnum.DRAWINGS,
    });

    // Every field the frontend sends should be a valid backend DTO field
    for (const frontendKey of Object.keys(frontendInput)) {
      expect(backendDtoKeys).toContain(frontendKey);
    }

    // All fields should be optional (backend allows partial updates)
    const emptyUpdate: UpdateCategoryInput = {};
    expect(Object.keys(emptyUpdate)).toHaveLength(0);

    // procoreTool can be null (to clear it) - verify type compatibility
    const clearToolUpdate: UpdateCategoryInput = { procoreTool: null };
    expect(clearToolUpdate.procoreTool).toBeNull();
  });

  // =========================================================================
  // 3. PROCORE_TOOL_OPTIONS values are subset of BackendProcoreToolEnum
  // =========================================================================
  it("PROCORE_TOOL_OPTIONS values are subset of BackendProcoreToolEnum", () => {
    const backendValues = enumValues(BackendProcoreToolEnum);

    // Every value in PROCORE_TOOL_OPTIONS should be a valid backend enum value
    for (const option of PROCORE_TOOL_OPTIONS) {
      expect(backendValues).toContain(option.value);
    }

    // Verify options have labels
    for (const option of PROCORE_TOOL_OPTIONS) {
      expect(option.label).toBeTruthy();
      expect(typeof option.label).toBe("string");
    }
  });

  // =========================================================================
  // 4. useCreateCategory posts to /categories with correct body
  // =========================================================================
  it("useCreateCategory posts to /categories with correct body", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    const input: CreateCategoryInput = {
      categoryName: "Safety",
      categoryClass: "Compliance",
      companyId: "company123",
      procoreTool: "inspections",
    };

    await act(async () => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/categories");
    expect(body).toEqual(input);

    // Verify URL matches backend route
    expect(url).toBe(BACKEND_ROUTES["categories.create"].path);

    // Verify all required backend fields are present
    const requiredFields =
      BACKEND_ROUTES["categories.create"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 5. useUpdateCategory patches to /categories/:id with correct body
  // =========================================================================
  it("useUpdateCategory patches to /categories/:id with correct body", async () => {
    const wrapper = createWrapper();
    const companyId = "company123";
    const categoryId = "cat456";

    const { result } = renderHook(() => useUpdateCategory(companyId), {
      wrapper,
    });

    const input: UpdateCategoryInput = {
      categoryName: "Updated Safety",
      categoryClass: "Updated Compliance",
      procoreTool: "forms",
    };

    await act(async () => {
      result.current.mutate({ categoryId, input });
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    const [url, body] = mockPatch.mock.calls[0];
    expect(url).toBe(`/categories/${categoryId}`);
    expect(body).toEqual(input);

    // Verify URL pattern matches backend route (/categories/:id)
    const backendPath = BACKEND_ROUTES["categories.update"].path;
    expect(url).toMatch(
      new RegExp("^" + backendPath.replace(":id", "[\\w]+") + "$"),
    );
  });

  // =========================================================================
  // 6. useDeleteCategory deletes /categories/:id with companyId
  // =========================================================================
  it("useDeleteCategory deletes /categories/:id with companyId", async () => {
    const wrapper = createWrapper();
    const companyId = "company123";
    const categoryId = "cat789";

    const { result } = renderHook(() => useDeleteCategory(companyId), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate(categoryId);
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    const [url, config] = mockDelete.mock.calls[0];
    expect(url).toBe(`/categories/${categoryId}`);

    // Verify the companyId is sent in the request data (body of DELETE)
    expect(config).toEqual({ data: { companyId } });

    // Verify companyId matches BackendBasicRequestDto pattern
    const basicDtoKeys = keysOf<BackendBasicRequestDto>({
      companyId: "",
      projectId: "",
    });
    expect(basicDtoKeys).toContain("companyId");

    // Verify URL pattern matches backend route (/categories/:id)
    const backendPath = BACKEND_ROUTES["categories.delete"].path;
    expect(url).toMatch(
      new RegExp("^" + backendPath.replace(":id", "[\\w]+") + "$"),
    );

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["categories.delete"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(config.data).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 7. useDeleteManyCategories deletes /categories/bulk with correct body
  // =========================================================================
  it("useDeleteManyCategories deletes /categories/bulk with correct body", async () => {
    const wrapper = createWrapper();
    const companyId = "company123";
    const categoryIds = ["cat1", "cat2", "cat3"];

    const { result } = renderHook(() => useDeleteManyCategories(companyId), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate(categoryIds);
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    const [url, config] = mockDelete.mock.calls[0];
    expect(url).toBe("/categories/bulk");
    expect(config).toEqual({
      data: { companyId, categoryIds },
    });

    // Verify against BackendDeleteManyCategoriesDto
    const backendDtoKeys = keysOf<BackendDeleteManyCategoriesDto>({
      companyId: "",
      categoryIds: [],
    });
    for (const sentKey of Object.keys(config.data)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify URL matches backend route
    expect(url).toBe(BACKEND_ROUTES["categories.delete-bulk"].path);

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["categories.delete-bulk"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(config.data).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 8. Route paths and HTTP methods match backend
  // =========================================================================
  describe("Route paths and HTTP methods match backend", () => {
    it("create category URL and method match BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateCategory(), { wrapper });

      await act(async () => {
        result.current.mutate({
          categoryName: "Test",
          categoryClass: "Class",
          companyId: "c1",
        });
      });

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledTimes(1);
      });

      const route = BACKEND_ROUTES["categories.create"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
    });

    it("update category URL and method match BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateCategory("c1"), { wrapper });

      await act(async () => {
        result.current.mutate({
          categoryId: "cat1",
          input: { categoryName: "X" },
        });
      });

      await waitFor(() => {
        expect(mockPatch).toHaveBeenCalledTimes(1);
      });

      const route = BACKEND_ROUTES["categories.update"];
      const [url] = mockPatch.mock.calls[0];
      // /categories/:id -> /categories/cat1
      const expectedPattern = route.path.replace(":id", "cat1");
      expect(url).toBe(expectedPattern);
      expect(route.method).toBe("PATCH");
    });

    it("delete category URL and method match BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteCategory("c1"), { wrapper });

      await act(async () => {
        result.current.mutate("cat1");
      });

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledTimes(1);
      });

      const route = BACKEND_ROUTES["categories.delete"];
      const [url] = mockDelete.mock.calls[0];
      const expectedPattern = route.path.replace(":id", "cat1");
      expect(url).toBe(expectedPattern);
      expect(route.method).toBe("DELETE");
    });

    it("bulk delete categories URL and method match BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteManyCategories("c1"), {
        wrapper,
      });

      await act(async () => {
        result.current.mutate(["cat1"]);
      });

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledTimes(1);
      });

      const route = BACKEND_ROUTES["categories.delete-bulk"];
      const [url] = mockDelete.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("DELETE");
    });
  });
});
