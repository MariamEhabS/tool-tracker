/**
 * Tests for scanned QR code API endpoints
 * Tests the useScannedQR hook and verifyQrPassword function
 * including verify token handling, disabled state, and password verification.
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

import { QrKeys, useScannedQR, verifyQrPassword } from "./scanned-qr";

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
  return createWrapperWithClient(queryClient);
}

function createWrapperWithClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("Scanned QR API endpoints", () => {
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
  });

  // ==================== useScannedQR ====================

  describe("useScannedQR", () => {
    it("should fetch scanned QR code data without verify token", async () => {
      const mockData = {
        _id: "qr-123",
        name: "Test QR",
        type: "file",
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useScannedQR("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/qr-code/scanned/qr-123",
        undefined,
      );
      expect(result.current.data).toEqual(mockData);
    });

    it("should include X-QR-Verify-Token header when verifyToken is provided", async () => {
      const mockData = { _id: "qr-123", name: "Test QR" };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useScannedQR("qr-123", "token-abc-123"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/qr-code/scanned/qr-123", {
        headers: { "X-QR-Verify-Token": "token-abc-123" },
      });
    });

    it("should be disabled when qrCodeId is undefined", async () => {
      const { result } = renderHook(() => useScannedQR(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled when qrCodeId is empty string", async () => {
      const { result } = renderHook(() => useScannedQR(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should honor queryOptions.enabled override", async () => {
      const { result } = renderHook(
        () => useScannedQR("qr-123", undefined, { enabled: false }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should accept refetchOnMount option and refetch cached query on remount", async () => {
      mockGet.mockResolvedValue({ data: { _id: "qr-123" } });
      const queryClient = createTestQueryClient();
      const wrapper = createWrapperWithClient(queryClient);

      const firstRender = renderHook(
        () => useScannedQR("qr-123", undefined, { refetchOnMount: "always" }),
        { wrapper },
      );

      await waitFor(() => {
        expect(firstRender.result.current.isSuccess).toBe(true);
      });
      firstRender.unmount();

      renderHook(
        () => useScannedQR("qr-123", undefined, { refetchOnMount: "always" }),
        { wrapper },
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
      });
    });

    it("should include verifyToken in query key for cache separation", async () => {
      mockGet.mockResolvedValue({ data: { _id: "qr-123" } });

      const { result: result1 } = renderHook(() => useScannedQR("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(
        () => useScannedQR("qr-123", "token-xyz"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should have been called because different query keys
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useScannedQR("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should surface 404 Not Found error", async () => {
      mockGet.mockRejectedValue({
        response: { status: 404, data: { message: "QR code not found" } },
      });

      const { result } = renderHook(() => useScannedQR("qr-missing"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should surface 401 Unauthorized error", async () => {
      mockGet.mockRejectedValue({
        response: { status: 401, data: { message: "Unauthorized" } },
      });

      const { result } = renderHook(() => useScannedQR("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should surface 403 password required error", async () => {
      mockGet.mockRejectedValue({
        response: {
          status: 403,
          data: { message: "Password required", requiresPassword: true },
        },
      });

      const { result } = renderHook(() => useScannedQR("qr-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== verifyQrPassword ====================

  describe("verifyQrPassword", () => {
    it("should verify password and return valid result with token", async () => {
      const mockResponse = {
        valid: true,
        requiredBy: "owner",
        verifyToken: "token-abc-123",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await verifyQrPassword("qr-123", "correct-password");

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/scanned/qr-123/verify-password",
        { password: "correct-password" },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return invalid result with null token for wrong password", async () => {
      const mockResponse = {
        valid: false,
        requiredBy: "owner",
        verifyToken: null,
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await verifyQrPassword("qr-123", "wrong-password");

      expect(mockPost).toHaveBeenCalledWith(
        "/qr-code/scanned/qr-123/verify-password",
        { password: "wrong-password" },
      );
      expect(result.valid).toBe(false);
      expect(result.verifyToken).toBeNull();
    });

    it("should throw on network failure", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      await expect(verifyQrPassword("qr-123", "password")).rejects.toThrow(
        "Network Error",
      );
    });

    it("should throw on 404 when QR code not found", async () => {
      const error = {
        response: { status: 404, data: { message: "QR code not found" } },
      };
      mockPost.mockRejectedValue(error);

      await expect(verifyQrPassword("qr-missing", "password")).rejects.toEqual(
        error,
      );
    });

    it("should throw on 429 rate limit exceeded", async () => {
      const error = {
        response: {
          status: 429,
          data: { message: "Too many attempts, try again later" },
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(verifyQrPassword("qr-123", "password")).rejects.toEqual(
        error,
      );
    });

    it("should throw on 500 Server Error", async () => {
      const error = {
        response: { status: 500, data: { message: "Internal Server Error" } },
      };
      mockPost.mockRejectedValue(error);

      await expect(verifyQrPassword("qr-123", "password")).rejects.toEqual(
        error,
      );
    });

    it("should throw on timeout", async () => {
      mockPost.mockRejectedValue({
        code: "ECONNABORTED",
        message: "timeout of 30000ms exceeded",
      });

      await expect(
        verifyQrPassword("qr-123", "password"),
      ).rejects.toMatchObject({ code: "ECONNABORTED" });
    });
  });
});
