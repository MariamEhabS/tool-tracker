/**
 * Contract Test: Scanned QR API
 *
 * Validates that the frontend Scanned QR API client functions send requests
 * that align with the backend specification declared in backend-contracts.ts.
 *
 * Covers:
 * - useScannedQR (GET /qr-code/scanned/:qrcodeId)
 * - verifyQrPassword (POST /qr-code/scanned/:qrcodeId/verify-password)
 *
 * @see ./backend-contracts.ts for the canonical backend contract definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Backend contract types (source of truth)
import { BACKEND_ROUTES } from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks — must appear before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Frontend functions under test
import { useScannedQR, verifyQrPassword } from "@api/endpoints/scanned-qr";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_QRCODE_ID = "665af1b2c3d4e5f6a7b8c9d0";
const FAKE_VERIFY_TOKEN = "abc123-verify-token";

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

describe("Contract: Scanned QR API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. useScannedQR fetches via GET /qr-code/scanned/:qrcodeId
  // =========================================================================
  it("useScannedQR calls GET /qr-code/scanned/:qrcodeId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useScannedQR(FAKE_QRCODE_ID), { wrapper });

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    });

    const [url, config] = (axiosInstance.get as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/qr-code/scanned/${FAKE_QRCODE_ID}`);

    // Without a verify token, no special headers should be sent
    expect(config).toBeUndefined();
  });

  // =========================================================================
  // 2. useScannedQR passes X-QR-Verify-Token header when provided
  // =========================================================================
  it("useScannedQR passes X-QR-Verify-Token header when verifyToken is provided", async () => {
    const wrapper = createWrapper();

    renderHook(() => useScannedQR(FAKE_QRCODE_ID, FAKE_VERIFY_TOKEN), {
      wrapper,
    });

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    });

    const [url, config] = (axiosInstance.get as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/qr-code/scanned/${FAKE_QRCODE_ID}`);

    // Verify the custom header is included
    expect(config).toBeDefined();
    expect(config.headers).toHaveProperty(
      "X-QR-Verify-Token",
      FAKE_VERIFY_TOKEN,
    );
  });

  // =========================================================================
  // 3. useScannedQR is disabled when qrCodeId is undefined
  // =========================================================================
  it("useScannedQR does not fetch when qrCodeId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useScannedQR(undefined), { wrapper });

    // Give it a tick to ensure it doesn't fire
    await new Promise((r) => setTimeout(r, 50));

    expect(axiosInstance.get).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 4. verifyQrPassword sends body with required password field
  // =========================================================================
  it("verifyQrPassword sends { password } via POST /qr-code/scanned/:qrcodeId/verify-password", async () => {
    const testPassword = "my-secret-password";

    await verifyQrPassword(FAKE_QRCODE_ID, testPassword);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/qr-code/scanned/${FAKE_QRCODE_ID}/verify-password`);

    // Verify the body contains the required password field
    expect(body).toHaveProperty("password", testPassword);

    // Verify no extra fields are sent beyond what the backend expects
    expect(Object.keys(body)).toEqual(["password"]);
  });

  // =========================================================================
  // 5. Route paths match backend specification
  // =========================================================================
  describe("Route paths match backend specification", () => {
    it('useScannedQR URL matches BACKEND_ROUTES["qr-code.scanned"]', async () => {
      const wrapper = createWrapper();

      renderHook(() => useScannedQR(FAKE_QRCODE_ID), { wrapper });

      await waitFor(() => {
        expect(axiosInstance.get).toHaveBeenCalledTimes(1);
      });

      const [url] = (axiosInstance.get as Mock).mock.calls[0];
      expect(url).toMatch(/^\/qr-code\/scanned\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["qr-code.scanned"].path).toBe(
        "/qr-code/scanned/:qrcodeId",
      );
      expect(BACKEND_ROUTES["qr-code.scanned"].method).toBe("GET");
    });

    it('verifyQrPassword URL matches BACKEND_ROUTES["qr-code.verify-password"]', async () => {
      await verifyQrPassword(FAKE_QRCODE_ID, "test");

      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(
        /^\/qr-code\/scanned\/[a-f0-9]{24}\/verify-password$/,
      );
      expect(BACKEND_ROUTES["qr-code.verify-password"].path).toBe(
        "/qr-code/scanned/:qrcodeId/verify-password",
      );
      expect(BACKEND_ROUTES["qr-code.verify-password"].method).toBe("POST");
    });

    it("backend required fields for qr-code.verify-password include password", () => {
      const route = BACKEND_ROUTES["qr-code.verify-password"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["password"]),
      );
    });
  });
});
