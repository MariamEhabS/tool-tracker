/**
 * Contract Test: QR Style API
 *
 * Validates that the frontend QR Style API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a QR Style DTO, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  type BackendPreviewQRStyleDto,
  type BackendUpdateCompanyQRStyleDto,
  type BackendBatchRegenerateDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks — must appear before imports that depend on them
// ---------------------------------------------------------------------------

const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } });
const mockPost = vi.fn().mockResolvedValue({ data: { data: {} } });
const mockPatch = vi.fn().mockResolvedValue({ data: { data: {} } });

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Frontend functions under test
import {
  previewQRStyle,
  useUpdateQRStyleConfig,
  useBatchRegenerateQRCodes,
  useQRStylePresets,
  useCompanyQRStyleConfig,
} from "@api/endpoints/qr-style";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_COMPANY_ID = "665af1b2c3d4e5f6a7b8c9d1";

function keysOf<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj);
}

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

describe("Contract: QR Style API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { data: {} } });
    mockPost.mockResolvedValue({ data: { data: {} } });
    mockPatch.mockResolvedValue({ data: { data: {} } });
  });

  // =========================================================================
  // 1. useQRStylePresets fetches from GET /qr-code/admin/presets
  // =========================================================================
  it("useQRStylePresets fetches from GET /qr-code/admin/presets", async () => {
    mockGet.mockResolvedValue({
      data: { data: { presets: [], presetsByCategory: {} } },
    });

    const wrapper = createWrapper();
    renderHook(() => useQRStylePresets(), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/qr-code/admin/presets");
    expect(url).toBe(BACKEND_ROUTES["qr-style.presets"].path);
  });

  // =========================================================================
  // 2. useCompanyQRStyleConfig fetches from GET /company/:companyId/qr-style
  // =========================================================================
  it("useCompanyQRStyleConfig fetches from GET /company/:companyId/qr-style", async () => {
    mockGet.mockResolvedValue({
      data: { data: { useStyledQRCodes: false } },
    });

    const wrapper = createWrapper();
    renderHook(() => useCompanyQRStyleConfig(FAKE_COMPANY_ID), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe(`/company/${FAKE_COMPANY_ID}/qr-style`);

    // Verify URL pattern matches backend route
    const backendPath = BACKEND_ROUTES["qr-style.company-config"].path;
    expect(url).toMatch(
      new RegExp("^" + backendPath.replace(":companyId", "[\\w]+") + "$"),
    );
  });

  // =========================================================================
  // 3. useUpdateQRStyleConfig sends body matching BackendUpdateCompanyQRStyleDto
  // =========================================================================
  it("useUpdateQRStyleConfig sends body matching BackendUpdateCompanyQRStyleDto via PATCH /company/:companyId/qr-style", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateQRStyleConfig(), { wrapper });

    const payload = {
      companyId: FAKE_COMPANY_ID,
      useStyledQRCodes: true,
      presetName: "modern-blue",
      customStyle: { moduleShape: "rounded" },
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    const [url, body] = mockPatch.mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/company/${FAKE_COMPANY_ID}/qr-style`);
    const backendPath = BACKEND_ROUTES["qr-style.update-company-config"].path;
    expect(url).toMatch(
      new RegExp("^" + backendPath.replace(":companyId", "[\\w]+") + "$"),
    );

    // Verify required fields
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("useStyledQRCodes", true);

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("presetName", "modern-blue");
    expect(body).toHaveProperty("customStyle");

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendUpdateCompanyQRStyleDto>({
      companyId: "",
      useStyledQRCodes: true,
      presetName: "",
      customStyle: {},
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Type-level assertion
    const _typeCheck: BackendUpdateCompanyQRStyleDto = {
      companyId: body.companyId,
      useStyledQRCodes: body.useStyledQRCodes,
      presetName: body.presetName,
      customStyle: body.customStyle,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["qr-style.update-company-config"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 4. previewQRStyle (preset name) sends body matching BackendPreviewQRStyleDto
  // =========================================================================
  it("previewQRStyle with preset name sends body matching BackendPreviewQRStyleDto via POST /qr-code/admin/preview", async () => {
    await previewQRStyle("https://example.com", "modern-blue");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];

    // Verify URL
    expect(url).toBe("/qr-code/admin/preview");
    expect(url).toBe(BACKEND_ROUTES["qr-style.preview"].path);

    // Verify required field
    expect(body).toHaveProperty("text", "https://example.com");
    expect(body).toHaveProperty("presetName", "modern-blue");
    expect(body).not.toHaveProperty("customStyle");

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendPreviewQRStyleDto>({
      text: "",
      presetName: "",
      customStyle: {},
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["qr-style.preview"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 5. previewQRStyle (custom style) sends body matching BackendPreviewQRStyleDto
  // =========================================================================
  it("previewQRStyle with custom style sends body matching BackendPreviewQRStyleDto via POST /qr-code/admin/preview", async () => {
    const customStyle = { moduleShape: "rounded", background: "#ffffff" };
    await previewQRStyle("https://example.com", customStyle);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];

    // Verify URL
    expect(url).toBe("/qr-code/admin/preview");

    // Verify required field
    expect(body).toHaveProperty("text", "https://example.com");
    expect(body).toHaveProperty("customStyle", customStyle);
    expect(body).not.toHaveProperty("presetName");

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendPreviewQRStyleDto>({
      text: "",
      presetName: "",
      customStyle: {},
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }
  });

  // =========================================================================
  // 6. useBatchRegenerateQRCodes sends body matching BackendBatchRegenerateDto
  // =========================================================================
  it("useBatchRegenerateQRCodes sends body matching BackendBatchRegenerateDto via POST /qr-code/admin/batch-regenerate", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
      wrapper,
    });

    const payload = {
      companyId: FAKE_COMPANY_ID,
      qrcodeIds: ["id1", "id2"],
      applyToAll: false,
      enableLogo: true,
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    const [url, body] = mockPost.mock.calls[0];

    // Verify URL
    expect(url).toBe("/qr-code/admin/batch-regenerate");
    expect(url).toBe(BACKEND_ROUTES["qr-style.batch-regenerate"].path);

    // Verify required field
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("qrcodeIds", ["id1", "id2"]);
    expect(body).toHaveProperty("applyToAll", false);
    expect(body).toHaveProperty("enableLogo", true);

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendBatchRegenerateDto>({
      companyId: "",
      qrcodeIds: [],
      applyToAll: false,
      enableLogo: false,
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Type-level assertion
    const _typeCheck: BackendBatchRegenerateDto = {
      companyId: body.companyId,
      qrcodeIds: body.qrcodeIds,
      applyToAll: body.applyToAll,
      enableLogo: body.enableLogo,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["qr-style.batch-regenerate"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 7. Route paths match backend specification
  // =========================================================================
  describe("Route paths match backend specification", () => {
    it("presets GET URL matches BACKEND_ROUTES", async () => {
      mockGet.mockResolvedValue({
        data: { data: { presets: [], presetsByCategory: {} } },
      });
      const wrapper = createWrapper();
      renderHook(() => useQRStylePresets(), { wrapper });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });

      const [url] = mockGet.mock.calls[0];
      expect(url).toBe(BACKEND_ROUTES["qr-style.presets"].path);
      expect(BACKEND_ROUTES["qr-style.presets"].method).toBe("GET");
    });

    it("company config GET URL pattern matches BACKEND_ROUTES", async () => {
      mockGet.mockResolvedValue({
        data: { data: { useStyledQRCodes: false } },
      });
      const wrapper = createWrapper();
      renderHook(() => useCompanyQRStyleConfig(FAKE_COMPANY_ID), { wrapper });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });

      const [url] = mockGet.mock.calls[0];
      const backendPath = BACKEND_ROUTES["qr-style.company-config"].path;
      expect(url).toMatch(
        new RegExp("^" + backendPath.replace(":companyId", "[\\w]+") + "$"),
      );
      expect(BACKEND_ROUTES["qr-style.company-config"].method).toBe("GET");
    });

    it("update company config PATCH URL pattern matches BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateQRStyleConfig(), {
        wrapper,
      });

      await act(async () => {
        result.current.mutate({
          companyId: FAKE_COMPANY_ID,
          useStyledQRCodes: true,
        });
      });

      await waitFor(() => {
        expect(mockPatch).toHaveBeenCalledTimes(1);
      });

      const [url] = mockPatch.mock.calls[0];
      const backendPath = BACKEND_ROUTES["qr-style.update-company-config"].path;
      expect(url).toMatch(
        new RegExp("^" + backendPath.replace(":companyId", "[\\w]+") + "$"),
      );
      expect(BACKEND_ROUTES["qr-style.update-company-config"].method).toBe(
        "PATCH",
      );
    });

    it("preview POST URL matches BACKEND_ROUTES", async () => {
      await previewQRStyle("test", "preset");

      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(BACKEND_ROUTES["qr-style.preview"].path);
      expect(BACKEND_ROUTES["qr-style.preview"].method).toBe("POST");
    });

    it("batch regenerate POST URL matches BACKEND_ROUTES", async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useBatchRegenerateQRCodes(), {
        wrapper,
      });

      await act(async () => {
        result.current.mutate({ companyId: FAKE_COMPANY_ID });
      });

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledTimes(1);
      });

      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(BACKEND_ROUTES["qr-style.batch-regenerate"].path);
      expect(BACKEND_ROUTES["qr-style.batch-regenerate"].method).toBe("POST");
    });

    it("backend required fields for qr-style.update-company-config include companyId, useStyledQRCodes", () => {
      const route = BACKEND_ROUTES["qr-style.update-company-config"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "useStyledQRCodes"]),
      );
    });

    it("backend required fields for qr-style.preview include text", () => {
      const route = BACKEND_ROUTES["qr-style.preview"];
      expect(route.requiredFields).toEqual(expect.arrayContaining(["text"]));
    });

    it("backend required fields for qr-style.batch-regenerate include companyId", () => {
      const route = BACKEND_ROUTES["qr-style.batch-regenerate"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId"]),
      );
    });
  });
});
