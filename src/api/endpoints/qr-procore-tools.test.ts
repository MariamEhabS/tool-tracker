/**
 * Tests for QR Procore Tools API endpoints (qr-procore-tools.ts)
 * Tests the useQrProcoreTools hook and QrProcoreToolsKeys factory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock the axios instance
const mockGet = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
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

import { QrProcoreToolsKeys, useQrProcoreTools } from "./qr-procore-tools";

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

describe("QR Procore Tools API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("QrProcoreToolsKeys", () => {
    it("should generate correct all key", () => {
      expect(QrProcoreToolsKeys.all).toEqual(["QrProcoreTools"]);
    });

    it("should generate correct detail key", () => {
      const key = QrProcoreToolsKeys.detail("qr-123");
      expect(key).toEqual(["QrProcoreTools", "qr-123"]);
    });

    it("should generate detail key with empty string for undefined", () => {
      // The hook passes qrCodeId || "" to detail()
      const key = QrProcoreToolsKeys.detail("");
      expect(key).toEqual(["QrProcoreTools", ""]);
    });
  });

  // ==================== useQrProcoreTools ====================

  describe("useQrProcoreTools", () => {
    it("should fetch procore tools for a QR code", async () => {
      const mockData = {
        procoreTools: [
          { tool: "drawings", count: 5, linkedIds: ["1", "2"] },
          { tool: "documents", count: 3, linkedIds: ["3"] },
        ],
        qrType: "procore-tool",
        procoreCategory: "drawings",
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code/qr-123/procore-tools");
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when qrCodeId is undefined", async () => {
      const { result } = renderHook(() => useQrProcoreTools(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled when qrCodeId is empty string", async () => {
      const { result } = renderHook(() => useQrProcoreTools(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return tools with null count", async () => {
      const mockData = {
        procoreTools: [{ tool: "drawings", count: null, linkedIds: [] }],
        qrType: "procore-tool",
        procoreCategory: null,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.procoreTools[0].count).toBeNull();
      expect(result.current.data?.procoreCategory).toBeNull();
    });

    it("should return empty procoreTools array", async () => {
      const mockData = {
        procoreTools: [],
        qrType: "file",
        procoreCategory: null,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.procoreTools).toEqual([]);
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should return error state on 404", async () => {
      mockGet.mockRejectedValue({
        response: { status: 404, data: { message: "QR code not found" } },
      });

      const { result } = renderHook(() => useQrProcoreTools("qr-missing"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should return error state on 500", async () => {
      mockGet.mockRejectedValue({
        response: {
          status: 500,
          data: { message: "Internal Server Error" },
        },
      });

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should return error state on 401 Unauthorized", async () => {
      mockGet.mockRejectedValue({
        response: { status: 401, data: { message: "Unauthorized" } },
      });

      const { result } = renderHook(() => useQrProcoreTools("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
