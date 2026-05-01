/**
 * Tests for aggregation API endpoints
 * Tests QR company/project aggregation, folder aggregation, and project QR codes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

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
  QrKeys,
  useQrCompanyProjectAggregation,
  useAllQrCodeItems,
  useProjectQRCodes,
} from "./aggregation";

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

describe("Aggregation API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("QrKeys", () => {
    it("should generate correct all key", () => {
      expect(QrKeys.all).toEqual(["Qrs"]);
    });

    it("should generate correct detail key", () => {
      expect(QrKeys.detail("qr-123")).toEqual(["Qrs", "qr-123"]);
    });

    it("should generate correct listItems key", () => {
      expect(QrKeys.listItems("qr-456")).toEqual(["Qrs", "qr-456"]);
    });
  });

  // ==================== useQrCompanyProjectAggregation ====================

  describe("useQrCompanyProjectAggregation", () => {
    it("should fetch aggregation data for a QR code", async () => {
      const mockData = [
        { _id: "qr-123", companyId: "company-456", projectId: "project-789" },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useQrCompanyProjectAggregation("qr-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/aggregation/qr-company-project/qr-123",
      );
      expect(result.current.data).toEqual(mockData[0]);
    });

    it("should return the first element from the response array", async () => {
      const mockData = [{ _id: "first" }, { _id: "second" }];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useQrCompanyProjectAggregation("qr-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ _id: "first" });
    });

    it("should be disabled when qrCodeId is undefined", async () => {
      const { result } = renderHook(
        () => useQrCompanyProjectAggregation(undefined),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled when qrCodeId is empty string", async () => {
      const { result } = renderHook(() => useQrCompanyProjectAggregation(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(
        () => useQrCompanyProjectAggregation("qr-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  // ==================== useAllQrCodeItems ====================

  describe("useAllQrCodeItems", () => {
    it("should fetch all QR code items for a folder", async () => {
      const mockData = [
        { _id: "qr-123", items: [{ name: "doc1" }, { name: "doc2" }] },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useAllQrCodeItems("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/aggregation/qr-folder/qr-123");
      expect(result.current.data).toEqual(mockData[0]);
    });

    it("should return the first element from the response array", async () => {
      const mockData = [
        { _id: "first", items: [] },
        { _id: "second", items: [] },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useAllQrCodeItems("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ _id: "first", items: [] });
    });

    it("should be disabled when qrCodeId is empty string", async () => {
      const { result } = renderHook(() => useAllQrCodeItems(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useAllQrCodeItems("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  // ==================== useProjectQRCodes ====================

  describe("useProjectQRCodes", () => {
    it("should fetch project QR codes with required params", async () => {
      const mockData = {
        success_message: "OK",
        current_page: 1,
        per_page: 20,
        total_items: 2,
        data: [{ _id: "qr-1" }, { _id: "qr-2" }],
      };
      mockGet.mockResolvedValue({ data: mockData });

      const params = { projectId: "project-789" };

      const { result } = renderHook(() => useProjectQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/aggregation/project-qrcodes", {
        params,
      });
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when projectId is empty", async () => {
      const { result } = renderHook(
        () => useProjectQRCodes({ projectId: "" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should pass all optional params", async () => {
      const mockData = {
        success_message: "OK",
        current_page: 2,
        per_page: 10,
        total_items: 50,
        data: [],
      };
      mockGet.mockResolvedValue({ data: mockData });

      const params = {
        companyId: "company-456",
        projectId: "project-789",
        current_page: 2,
        per_page: 10,
        search: "test",
        groupingType: "equipment",
        groupingTypes: ["arrangement", "equipment"],
        arrangementType: "Procore Drawings Codes",
        types: ["file", "folder"],
        sortBy: "createdAt",
        sortDir: "desc" as const,
      };

      const { result } = renderHook(() => useProjectQRCodes(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/aggregation/project-qrcodes", {
        params,
      });
    });

    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(
        () => useProjectQRCodes({ projectId: "project-789" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should surface 500 Server Error", async () => {
      mockGet.mockRejectedValue({
        response: { status: 500, data: { message: "Internal Server Error" } },
      });

      const { result } = renderHook(
        () => useProjectQRCodes({ projectId: "project-789" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should handle empty data response", async () => {
      mockGet.mockResolvedValue({
        data: {
          success_message: "OK",
          current_page: 1,
          per_page: 20,
          total_items: 0,
          data: [],
        },
      });

      const { result } = renderHook(
        () => useProjectQRCodes({ projectId: "project-789" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual([]);
      expect(result.current.data?.total_items).toBe(0);
    });
  });
});
