/**
 * Tests for QR Style API endpoints
 * Tests query hooks (useQRStylePresets, useCompanyQRStyleConfig),
 * mutation hooks (useUpdateQRStyleConfig, useBatchRegenerateQRCodes),
 * imperative function (previewQRStyle), and cache invalidation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

import {
  qrStyleKeys,
  useQRStylePresets,
  useCompanyQRStyleConfig,
  useUpdateQRStyleConfig,
  previewQRStyle,
  useBatchRegenerateQRCodes,
} from "./qr-style";

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

describe("QR Style API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("qrStyleKeys", () => {
    it("should have correct base key", () => {
      expect(qrStyleKeys.all).toEqual(["qrStyle"]);
    });

    it("should generate presets key", () => {
      expect(qrStyleKeys.presets()).toEqual(["qrStyle", "presets"]);
    });

    it("should generate companyConfig key with companyId", () => {
      expect(qrStyleKeys.companyConfig("company-123")).toEqual([
        "qrStyle",
        "config",
        "company-123",
      ]);
    });

    it("should generate preview key with text and preset", () => {
      expect(qrStyleKeys.preview("hello", "modern")).toEqual([
        "qrStyle",
        "preview",
        "hello",
        "modern",
      ]);
    });

    it("should generate distinct keys for different companies", () => {
      const key1 = qrStyleKeys.companyConfig("company-1");
      const key2 = qrStyleKeys.companyConfig("company-2");

      expect(key1).not.toEqual(key2);
    });
  });

  // ==================== useQRStylePresets ====================

  describe("useQRStylePresets", () => {
    it("should fetch presets on mount", async () => {
      const mockData = {
        presets: ["basic", "modern", "gradient"],
        presetsByCategory: {
          basic: [
            {
              name: "basic",
              displayName: "Basic",
              description: "Simple QR",
              category: "basic",
            },
          ],
        },
      };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const { result } = renderHook(() => useQRStylePresets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code/admin/presets");
      expect(result.current.data).toEqual(mockData);
    });

    it("should handle response without nested data wrapper", async () => {
      const mockData = {
        presets: ["basic"],
        presetsByCategory: {},
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useQRStylePresets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it("should return error state on failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useQRStylePresets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== useCompanyQRStyleConfig ====================

  describe("useCompanyQRStyleConfig", () => {
    it("should fetch company config with companyId", async () => {
      const mockConfig = {
        useStyledQRCodes: true,
        qrStyleConfig: { presetName: "modern" },
      };
      mockGet.mockResolvedValue({ data: { data: mockConfig } });

      const { result } = renderHook(
        () => useCompanyQRStyleConfig("company-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/company/company-123/qr-style");
      expect(result.current.data).toEqual(mockConfig);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useCompanyQRStyleConfig(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should return error state on failure", async () => {
      mockGet.mockRejectedValue({
        response: { status: 404, data: { message: "Not found" } },
      });

      const { result } = renderHook(
        () => useCompanyQRStyleConfig("company-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== useUpdateQRStyleConfig ====================

  describe("useUpdateQRStyleConfig", () => {
    it("should send PATCH request with config payload", async () => {
      const mockResponse = { useStyledQRCodes: true };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateQRStyleConfig(), {
        wrapper,
      });

      result.current.mutate({
        companyId: "company-123",
        useStyledQRCodes: true,
        presetName: "modern",
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith("/company/company-123/qr-style", {
        companyId: "company-123",
        useStyledQRCodes: true,
        presetName: "modern",
        customStyle: undefined,
      });

      // Verify cache invalidation was triggered
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it("should include customStyle in payload", async () => {
      mockPatch.mockResolvedValue({ data: { data: {} } });

      const { result } = renderHook(() => useUpdateQRStyleConfig(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        useStyledQRCodes: true,
        customStyle: { color: "#FF0000", dotStyle: "rounded" },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/company/company-123/qr-style",
        expect.objectContaining({
          customStyle: { color: "#FF0000", dotStyle: "rounded" },
        }),
      );
    });

    it("should invalidate company config and company queries on success", async () => {
      mockPatch.mockResolvedValue({ data: { data: {} } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateQRStyleConfig(), {
        wrapper,
      });

      result.current.mutate({
        companyId: "company-123",
        useStyledQRCodes: false,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["qrStyle", "config", "company-123"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["company", "company-123"],
      });
    });

    it("should return error state on failure", async () => {
      mockPatch.mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useUpdateQRStyleConfig(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        useStyledQRCodes: true,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== previewQRStyle ====================

  describe("previewQRStyle", () => {
    it("should send preset name as string payload", async () => {
      const mockPreview = {
        dataUri: "data:image/png;base64,abc",
        svgString: "<svg></svg>",
        text: "https://example.com",
      };
      mockPost.mockResolvedValue({ data: { data: mockPreview } });

      const result = await previewQRStyle("https://example.com", "modern");

      expect(mockPost).toHaveBeenCalledWith("/qr-code/admin/preview", {
        text: "https://example.com",
        presetName: "modern",
      });
      expect(result).toEqual(mockPreview);
    });

    it("should send custom style as object payload", async () => {
      const customStyle = { color: "#FF0000", dotStyle: "rounded" };
      const mockPreview = {
        dataUri: "data:image/png;base64,xyz",
        svgString: "<svg></svg>",
        text: "test-text",
      };
      mockPost.mockResolvedValue({ data: { data: mockPreview } });

      const result = await previewQRStyle("test-text", customStyle);

      expect(mockPost).toHaveBeenCalledWith("/qr-code/admin/preview", {
        text: "test-text",
        customStyle,
      });
      expect(result).toEqual(mockPreview);
    });

    it("should handle response without nested data wrapper", async () => {
      const mockPreview = {
        dataUri: "data:image/png;base64,abc",
        svgString: "<svg></svg>",
        text: "hello",
      };
      mockPost.mockResolvedValue({ data: mockPreview });

      const result = await previewQRStyle("hello", "basic");

      expect(result).toEqual(mockPreview);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Preview failed"));

      await expect(previewQRStyle("text", "modern")).rejects.toThrow(
        "Preview failed",
      );
    });

    it("should propagate 400 Bad Request", async () => {
      const error = {
        response: {
          status: 400,
          data: { message: "Invalid preset name" },
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(previewQRStyle("text", "invalid-preset")).rejects.toEqual(
        error,
      );
    });
  });

  // ==================== useBatchRegenerateQRCodes ====================

  describe("useBatchRegenerateQRCodes", () => {
    it("should send POST request with specific qrcodeIds", async () => {
      const mockResult = {
        total: 3,
        success: 3,
        failed: 0,
        errors: [],
      };
      mockPost.mockResolvedValue({ data: { data: mockResult } });

      const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        qrcodeIds: ["qr-1", "qr-2", "qr-3"],
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/qr-code/admin/batch-regenerate", {
        companyId: "company-123",
        qrcodeIds: ["qr-1", "qr-2", "qr-3"],
        applyToAll: undefined,
        enableLogo: undefined,
      });
      expect(result.current.data).toEqual(mockResult);
    });

    it("should send POST request with applyToAll flag", async () => {
      const mockResult = {
        total: 100,
        success: 98,
        failed: 2,
        errors: ["qr-50: image not found"],
      };
      mockPost.mockResolvedValue({ data: { data: mockResult } });

      const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        applyToAll: true,
        enableLogo: true,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/admin/batch-regenerate",
        expect.objectContaining({
          applyToAll: true,
          enableLogo: true,
        }),
      );
    });

    it("should invalidate qr-codes queries on success", async () => {
      mockPost.mockResolvedValue({
        data: { data: { total: 1, success: 1, failed: 0, errors: [] } },
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
        wrapper,
      });

      result.current.mutate({
        companyId: "company-123",
        qrcodeIds: ["qr-1"],
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["Qrs"],
      });
    });

    it("should return error state on failure", async () => {
      mockPost.mockRejectedValue(new Error("Batch failed"));

      const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        qrcodeIds: ["qr-1"],
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
