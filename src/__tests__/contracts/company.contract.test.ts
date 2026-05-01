/**
 * Contract Test: Company API
 *
 * Validates that the frontend Company API client aligns with the backend
 * specification defined in backend-contracts.ts. These tests catch
 * frontend/backend drift in DTOs, route paths, and request shapes.
 *
 * Covers: getCompany, patchCompany, addStripeAddon, procoreStatus,
 * procoreIntegrationStatus, updateProcoreSettings, procoreLogout,
 * procoreIntegrationDetails, changeIntegrationOwner, storageStats,
 * dashboardStats.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import {
  BackendPatchCompanyDto,
  BackendAddAddonDto,
  BackendUpdateProcoreSettingsDto,
  BackendProcoreLogoutDto,
  BackendChangeIntegrationOwnerDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ============================================================
// Mocks — must be declared before imports that depend on them
// ============================================================

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockPut = vi.fn();

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    put: (...args: unknown[]) => mockPut(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================
// Frontend imports (after mocks are wired)
// ============================================================

import {
  useCompany,
  patchCompany,
  addStripeAddon,
  useProcoreStatus,
  useProcoreIntegrationStatus,
  updateProcoreSettings,
  procoreLogout,
  useProcoreIntegrationDetails,
  useChangeIntegrationOwner,
  useStorageStats,
  useDashboardStats,
} from "@api/endpoints/company";

// ============================================================
// Test helpers
// ============================================================

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

/** Minimal single-item response so hooks resolve successfully. */
const STUB_SINGLE_RESPONSE = {
  data: { success_message: "OK", data: {} },
};

/** Minimal ProcoreStatus response. */
const STUB_PROCORE_STATUS = {
  data: { isConnected: false, editProcoreItemsAllowed: false },
};

/** Minimal ExtendedProcoreStatus response. */
const STUB_EXTENDED_PROCORE_STATUS = {
  data: {
    connected: false,
    projectsCount: 0,
    documentsCount: 0,
    inspectionsCount: 0,
    syncHealthStatus: "healthy",
    editProcoreItemsAllowed: false,
  },
};

/** Minimal ProcoreIntegrationDetails response. */
const STUB_INTEGRATION_DETAILS = {
  data: {
    connected: false,
    connectedUsers: [],
    syncHealth: "healthy",
    accessStatus: { allowed: false, reason: "trial_expired" },
  },
};

/** Minimal StorageStats response (nested data.data). */
const STUB_STORAGE_STATS = {
  data: {
    data: {
      documentStorageUsed: 0,
      qrCodeStorageUsed: 0,
      documentsCount: 0,
      qrCodesCount: 0,
      documentStorageCapacity: 0,
      qrCodeStorageCapacity: 0,
      documentsWithoutSize: 0,
    },
  },
};

/** Minimal DashboardStats response (nested data.data). */
const STUB_DASHBOARD_STATS = {
  data: {
    data: {
      qrCodesCount: 0,
      qrScansCount: 0,
      documentsCount: 0,
      projectsCount: 0,
      groupsCount: 0,
      arrangementsCount: 0,
      equipmentCount: 0,
    },
  },
};

/** Minimal ChangeIntegrationOwnerResult response. */
const STUB_CHANGE_OWNER_RESULT = {
  data: { success: true, newOwnerId: "user-new", message: "Owner changed" },
};

// ============================================================
// Tests
// ============================================================

describe("Contract: Company API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------
  // 1. patchCompany sends body matching BackendPatchCompanyDto
  // ----------------------------------------------------------
  it("patchCompany sends body matching BackendPatchCompanyDto", async () => {
    mockPatch.mockResolvedValue(STUB_SINGLE_RESPONSE);

    const payload = {
      companyName: "Updated Corp",
      companyAddress: "123 Main St",
      companyCity: "Denver",
      companyState: "CO",
      companyZIP: "80202",
      companyIndustry: "Construction",
      companyWebsite: "https://example.com",
      companyPhone: "555-1234",
    };

    await patchCompany("64f1a2b3c4d5e6f7a8b9c0d1", payload);

    const [url, sentBody] = mockPatch.mock.calls[0];

    // Route matches backend pattern /company/:companyId
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1");

    // All sent keys must be valid BackendPatchCompanyDto fields
    const validKeys: (keyof BackendPatchCompanyDto)[] = [
      "companyName",
      "companyAddress",
      "companyCity",
      "companyState",
      "companyZIP",
      "companyIndustry",
      "companyWebsite",
      "companyPhone",
      "procoreCompanyID",
      "stripeAddons",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }

    // Verify actual values
    expect(sentBody.companyName).toBe("Updated Corp");
    expect(sentBody.companyAddress).toBe("123 Main St");
    expect(sentBody.companyCity).toBe("Denver");
    expect(sentBody.companyState).toBe("CO");
    expect(sentBody.companyZIP).toBe("80202");
    expect(sentBody.companyIndustry).toBe("Construction");
    expect(sentBody.companyWebsite).toBe("https://example.com");
    expect(sentBody.companyPhone).toBe("555-1234");
  });

  // ----------------------------------------------------------
  // 2. addStripeAddon sends body matching BackendAddAddonDto
  // ----------------------------------------------------------
  it("addStripeAddon sends body matching BackendAddAddonDto", async () => {
    mockPost.mockResolvedValue(STUB_SINGLE_RESPONSE);

    await addStripeAddon("64f1a2b3c4d5e6f7a8b9c0d1", "cs_test_session_123");

    const [url, sentBody] = mockPost.mock.calls[0];

    // Route matches backend pattern /company/:companyId/addons
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1/addons");

    // Required field is present
    expect(sentBody).toHaveProperty("sessionId");
    expect(sentBody.sessionId).toBe("cs_test_session_123");

    // All sent keys must be valid BackendAddAddonDto fields
    const validKeys: (keyof BackendAddAddonDto)[] = ["sessionId"];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 3. updateProcoreSettings sends body matching BackendUpdateProcoreSettingsDto
  // ----------------------------------------------------------
  it("updateProcoreSettings sends body matching BackendUpdateProcoreSettingsDto", async () => {
    mockPatch.mockResolvedValue(STUB_SINGLE_RESPONSE);

    await updateProcoreSettings("64f1a2b3c4d5e6f7a8b9c0d1", true);

    const [url, sentBody] = mockPatch.mock.calls[0];

    // Route matches backend
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1/procore-settings");

    // Required field is present
    expect(sentBody).toHaveProperty("editProcoreItemsAllowed");
    expect(sentBody.editProcoreItemsAllowed).toBe(true);

    // All sent keys must be valid BackendUpdateProcoreSettingsDto fields
    const validKeys: (keyof BackendUpdateProcoreSettingsDto)[] = [
      "editProcoreItemsAllowed",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 4. procoreLogout sends body matching BackendProcoreLogoutDto
  // ----------------------------------------------------------
  it("procoreLogout sends body matching BackendProcoreLogoutDto", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    await procoreLogout("64f1a2b3c4d5e6f7a8b9c0d1");

    const [url, sentBody] = mockPost.mock.calls[0];

    // Route matches backend
    expect(url).toBe("/oauth/procore/logout");

    // Required field is present
    expect(sentBody).toHaveProperty("companyId");
    expect(sentBody.companyId).toBe("64f1a2b3c4d5e6f7a8b9c0d1");

    // All sent keys must be valid BackendProcoreLogoutDto fields
    const validKeys: (keyof BackendProcoreLogoutDto)[] = ["companyId"];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 5. useChangeIntegrationOwner sends body matching BackendChangeIntegrationOwnerDto
  // ----------------------------------------------------------
  it("useChangeIntegrationOwner sends body matching BackendChangeIntegrationOwnerDto", async () => {
    mockPut.mockResolvedValue(STUB_CHANGE_OWNER_RESULT);

    const { result } = renderHook(() => useChangeIntegrationOwner(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      newOwnerUserId: "64f1a2b3c4d5e6f7a8b9c0d2",
      requestingUserId: "64f1a2b3c4d5e6f7a8b9c0d3",
    });

    const [url, sentBody] = mockPut.mock.calls[0];

    // Route matches backend pattern /company/:companyId/procore-integration-owner
    expect(url).toBe(
      "/company/64f1a2b3c4d5e6f7a8b9c0d1/procore-integration-owner",
    );

    // Required fields are present
    expect(sentBody).toHaveProperty("newOwnerUserId");
    expect(sentBody).toHaveProperty("requestingUserId");
    expect(sentBody.newOwnerUserId).toBe("64f1a2b3c4d5e6f7a8b9c0d2");
    expect(sentBody.requestingUserId).toBe("64f1a2b3c4d5e6f7a8b9c0d3");

    // All sent keys must be valid BackendChangeIntegrationOwnerDto fields
    const validKeys: (keyof BackendChangeIntegrationOwnerDto)[] = [
      "newOwnerUserId",
      "requestingUserId",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 6. useCompany calls GET /company/:companyId
  // ----------------------------------------------------------
  it("useCompany calls GET /company/:companyId", async () => {
    mockGet.mockResolvedValue(STUB_SINGLE_RESPONSE);

    const { result } = renderHook(
      () => useCompany("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1");
  });

  // ----------------------------------------------------------
  // 7. useProcoreStatus calls GET /company/:companyId/procore-status
  // ----------------------------------------------------------
  it("useProcoreStatus calls GET /company/:companyId/procore-status", async () => {
    mockGet.mockResolvedValue(STUB_PROCORE_STATUS);

    const { result } = renderHook(
      () => useProcoreStatus("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1/procore-status");
  });

  // ----------------------------------------------------------
  // 8. useProcoreIntegrationStatus calls GET /procore/status with companyId param
  // ----------------------------------------------------------
  it("useProcoreIntegrationStatus calls GET /procore/status with companyId param", async () => {
    mockGet.mockResolvedValue(STUB_EXTENDED_PROCORE_STATUS);

    const { result } = renderHook(
      () => useProcoreIntegrationStatus("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/procore/status");

    // companyId is sent as a query parameter
    expect(config.params).toEqual({
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
    });
  });

  // ----------------------------------------------------------
  // 9. useProcoreIntegrationDetails calls GET /company/:companyId/procore-integration-details
  // ----------------------------------------------------------
  it("useProcoreIntegrationDetails calls GET /company/:companyId/procore-integration-details", async () => {
    mockGet.mockResolvedValue(STUB_INTEGRATION_DETAILS);

    const { result } = renderHook(
      () => useProcoreIntegrationDetails("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe(
      "/company/64f1a2b3c4d5e6f7a8b9c0d1/procore-integration-details",
    );
  });

  // ----------------------------------------------------------
  // 10. useStorageStats calls GET /company/:companyId/storage-stats
  // ----------------------------------------------------------
  it("useStorageStats calls GET /company/:companyId/storage-stats", async () => {
    mockGet.mockResolvedValue(STUB_STORAGE_STATS);

    const { result } = renderHook(
      () => useStorageStats("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1/storage-stats");
  });

  // ----------------------------------------------------------
  // 11. useDashboardStats calls GET /company/:companyId/dashboard-stats
  // ----------------------------------------------------------
  it("useDashboardStats calls GET /company/:companyId/dashboard-stats", async () => {
    mockGet.mockResolvedValue(STUB_DASHBOARD_STATS);

    const { result } = renderHook(
      () => useDashboardStats("64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/64f1a2b3c4d5e6f7a8b9c0d1/dashboard-stats");
  });

  // ----------------------------------------------------------
  // 12. Route paths match backend specification
  // ----------------------------------------------------------
  describe("Route paths match backend specification", () => {
    it("company.get route is GET /company/:companyId", () => {
      const route = BACKEND_ROUTES["company.get"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/company/:companyId");
    });

    it("company.patch route is PATCH /company/:companyId", () => {
      const route = BACKEND_ROUTES["company.patch"];
      expect(route.method).toBe("PATCH");
      expect(route.path).toBe("/company/:companyId");
    });

    it("company.addon route is POST /company/:companyId/addons", () => {
      const route = BACKEND_ROUTES["company.addon"];
      expect(route.method).toBe("POST");
      expect(route.path).toBe("/company/:companyId/addons");
      expect(route.requiredFields).toContain("sessionId");
    });

    it("company.procore-status route is GET /company/:companyId/procore-status", () => {
      const route = BACKEND_ROUTES["company.procore-status"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/company/:companyId/procore-status");
    });

    it("company.dashboard-stats route is GET /company/:companyId/dashboard-stats", () => {
      const route = BACKEND_ROUTES["company.dashboard-stats"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/company/:companyId/dashboard-stats");
    });

    it("company.storage-stats route is GET /company/:companyId/storage-stats", () => {
      const route = BACKEND_ROUTES["company.storage-stats"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/company/:companyId/storage-stats");
    });

    it("company.procore-integration-status route is GET /procore/status", () => {
      const route = BACKEND_ROUTES["company.procore-integration-status"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/procore/status");
    });

    it("company.procore-settings route is PATCH /company/:companyId/procore-settings", () => {
      const route = BACKEND_ROUTES["company.procore-settings"];
      expect(route.method).toBe("PATCH");
      expect(route.path).toBe("/company/:companyId/procore-settings");
      expect(route.requiredFields).toContain("editProcoreItemsAllowed");
    });

    it("company.procore-integration-details route is GET /company/:companyId/procore-integration-details", () => {
      const route = BACKEND_ROUTES["company.procore-integration-details"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe(
        "/company/:companyId/procore-integration-details",
      );
    });

    it("company.procore-integration-owner route is PUT /company/:companyId/procore-integration-owner", () => {
      const route = BACKEND_ROUTES["company.procore-integration-owner"];
      expect(route.method).toBe("PUT");
      expect(route.path).toBe("/company/:companyId/procore-integration-owner");
      expect(route.requiredFields).toContain("newOwnerUserId");
      expect(route.requiredFields).toContain("requestingUserId");
    });

    it("oauth.procore-logout route is POST /oauth/procore/logout", () => {
      const route = BACKEND_ROUTES["oauth.procore-logout"];
      expect(route.method).toBe("POST");
      expect(route.path).toBe("/oauth/procore/logout");
      expect(route.requiredFields).toContain("companyId");
    });

    // Verify actual frontend functions call the correct URLs

    it("useCompany calls the correct URL", async () => {
      mockGet.mockResolvedValue(STUB_SINGLE_RESPONSE);

      const { result } = renderHook(() => useCompany("comp-abc"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet.mock.calls[0][0]).toBe("/company/comp-abc");
    });

    it("patchCompany calls the correct URL", async () => {
      mockPatch.mockResolvedValue(STUB_SINGLE_RESPONSE);
      await patchCompany("comp-abc", { companyName: "Test" } as never);
      expect(mockPatch.mock.calls[0][0]).toBe("/company/comp-abc");
    });

    it("addStripeAddon calls the correct URL", async () => {
      mockPost.mockResolvedValue(STUB_SINGLE_RESPONSE);
      await addStripeAddon("comp-abc", "session-1");
      expect(mockPost.mock.calls[0][0]).toBe("/company/comp-abc/addons");
    });

    it("updateProcoreSettings calls the correct URL", async () => {
      mockPatch.mockResolvedValue(STUB_SINGLE_RESPONSE);
      await updateProcoreSettings("comp-abc", false);
      expect(mockPatch.mock.calls[0][0]).toBe(
        "/company/comp-abc/procore-settings",
      );
    });

    it("procoreLogout calls the correct URL", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      await procoreLogout("comp-abc");
      expect(mockPost.mock.calls[0][0]).toBe(
        BACKEND_ROUTES["oauth.procore-logout"].path,
      );
    });
  });
});
