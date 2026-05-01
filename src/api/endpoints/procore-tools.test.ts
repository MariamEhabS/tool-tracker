/**
 * Tests for Procore Tools query hook (procore-tools.ts)
 * Tests the useProcoreToolQuery hook and procoreToolKeys factory,
 * including response normalization for different API response shapes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Must mock toolMap before importing the module under test
const mockFetch = vi.fn();

vi.mock("@/utils/toolMap", () => ({
  toolsMap: {
    drawing: {
      title: "Drawings",
      fetch: (...args: unknown[]) => mockFetch(...args),
      procoreApiName: "drawings",
      backendEnumValue: "drawings",
    },
    document: {
      title: "Documents",
      fetch: (...args: unknown[]) => mockFetch(...args),
      procoreApiName: "documents",
      backendEnumValue: "documents",
    },
    inspection: {
      title: "Inspections",
      fetch: (...args: unknown[]) => mockFetch(...args),
      procoreApiName: "inspections",
      backendEnumValue: "inspections",
    },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { procoreToolKeys, useProcoreToolQuery } from "./procore-tools";

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

describe("Procore Tools API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("procoreToolKeys", () => {
    it("should generate correct all key", () => {
      expect(procoreToolKeys.all).toEqual(["ProcoreTool"]);
    });

    it("should generate correct tool key with all params", () => {
      const key = procoreToolKeys.tool(
        "drawing",
        "qr-123",
        "company-456",
        "project-789",
        true,
      );
      expect(key).toEqual([
        "ProcoreTool",
        "drawing",
        "qr-123",
        "company-456",
        "project-789",
        true,
      ]);
    });

    it("should generate tool key with default fetchPage=false", () => {
      const key = procoreToolKeys.tool(
        "drawing",
        "qr-123",
        "company-456",
        "project-789",
      );
      expect(key).toEqual([
        "ProcoreTool",
        "drawing",
        "qr-123",
        "company-456",
        "project-789",
        false,
      ]);
    });
  });

  // ==================== useProcoreToolQuery ====================

  describe("useProcoreToolQuery", () => {
    it("should fetch tool data with data envelope response", async () => {
      const apiResponse = {
        data: [{ id: 1, name: "Drawing 1" }],
        hiddenIds: ["hidden-1"],
      };
      mockFetch.mockResolvedValue(apiResponse);

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        data: [{ id: 1, name: "Drawing 1" }],
        hiddenIds: ["hidden-1"],
      });
    });

    it("should handle array response (legacy)", async () => {
      const apiResponse = [
        { id: 1, name: "Doc 1" },
        { id: 2, name: "Doc 2" },
      ];
      mockFetch.mockResolvedValue(apiResponse);

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "document",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        data: [
          { id: 1, name: "Doc 1" },
          { id: 2, name: "Doc 2" },
        ],
        hiddenIds: undefined,
      });
    });

    it("should handle legacy { items } response", async () => {
      const apiResponse = { items: [{ id: 1 }] };
      mockFetch.mockResolvedValue(apiResponse);

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        data: [{ id: 1 }],
        hiddenIds: undefined,
      });
    });

    it("should handle plain object response (not envelope or items)", async () => {
      const apiResponse = { total: 5, status: "ok" };
      mockFetch.mockResolvedValue(apiResponse);

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Object without 'data' or 'items' key should be returned as-is
      expect(result.current.data).toEqual({
        data: { total: 5, status: "ok" },
        hiddenIds: undefined,
      });
    });

    it("should handle non-API response (primitive)", async () => {
      mockFetch.mockResolvedValue("unexpected string");

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        data: [],
        hiddenIds: undefined,
      });
    });

    it("should handle data envelope with null data", async () => {
      mockFetch.mockResolvedValue({ data: null, hiddenIds: [] });

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        data: [],
        hiddenIds: [],
      });
    });

    it("should filter non-string/number hiddenIds", async () => {
      mockFetch.mockResolvedValue({
        data: [{ id: 1 }],
        hiddenIds: ["id-1", 2, null, undefined, { obj: true }],
      });

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.hiddenIds).toEqual(["id-1", 2]);
    });

    it("should pass correct args to fetcher", async () => {
      mockFetch.mockResolvedValue([]);

      renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
            { desktop: true, fetchPage: true },
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "qr-123",
        "company-456",
        "project-789",
        "",
        true,
        true,
      );
    });

    it("should use default desktop=true and fetchPage=false", async () => {
      mockFetch.mockResolvedValue([]);

      renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "qr-123",
        "company-456",
        "project-789",
        "",
        true,
        false,
      );
    });

    it("should be disabled when tool is empty", async () => {
      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "" as keyof typeof import("@/utils/toolMap").toolsMap,
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should be disabled when qrId is empty", async () => {
      const { result } = renderHook(
        () => useProcoreToolQuery("drawing", "", "company-456", "project-789"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(
        () => useProcoreToolQuery("drawing", "qr-123", "", "project-789"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(
        () => useProcoreToolQuery("drawing", "qr-123", "company-456", ""),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return error state on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Fetch failed"));

      const { result } = renderHook(
        () =>
          useProcoreToolQuery(
            "drawing",
            "qr-123",
            "company-456",
            "project-789",
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});
