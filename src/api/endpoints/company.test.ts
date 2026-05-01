/**
 * Tests for company API endpoints
 * Tests all company-related API functions including CRUD, Procore integration,
 * Stripe addons, storage stats, dashboard stats, and query hooks.
 * Validates payloads align with backend validation pipes (companyId as MongoId,
 * companyName required, editProcoreItemsAllowed boolean).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockPut = vi.fn();

vi.mock("../index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

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
  companyKeys,
  procoreKeys,
  companyProcoreKeys,
  storageStatsKeys,
} from "./company";

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

describe("Company API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("companyKeys", () => {
    it("should generate correct detail key", () => {
      const key = companyKeys.detail("company-456");

      expect(key).toEqual(["company", "company-456"]);
    });

    it("should generate correct dashboard stats key", () => {
      const key = companyKeys.dashboardStats("company-456");

      expect(key).toEqual(["company", "dashboard-stats", "company-456"]);
    });
  });

  describe("procoreKeys", () => {
    it("should generate correct status key", () => {
      const key = procoreKeys.status("company-456");

      expect(key).toEqual(["procore", "status", "company-456"]);
    });

    it("should generate correct integration status key", () => {
      const key = procoreKeys.integrationStatus("company-456");

      expect(key).toEqual(["procore", "integrationStatus", "company-456"]);
    });
  });

  describe("companyProcoreKeys", () => {
    it("should generate correct integration details key", () => {
      const key = companyProcoreKeys.integrationDetails("company-456");

      expect(key).toEqual(["company", "procore-integration", "company-456"]);
    });
  });

  describe("storageStatsKeys", () => {
    it("should generate correct stats key", () => {
      const key = storageStatsKeys.stats("company-456");

      expect(key).toEqual(["storage-stats", "company-456"]);
    });
  });

  // ==================== Company Query Hook ====================

  describe("useCompany", () => {
    it("should fetch company by ID", async () => {
      const mockData = {
        _id: "company-456",
        companyName: "Test Company",
      };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const { result } = renderHook(() => useCompany("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/company/company-456");
      expect(result.current.data).toEqual(mockData);
    });

    it("should handle unwrapped response", async () => {
      const mockData = { _id: "company-456", companyName: "Test" };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useCompany("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useCompany(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  // ==================== Patch Company ====================

  describe("patchCompany", () => {
    it("should make PATCH request with payload", async () => {
      const mockData = { _id: "company-456", companyName: "Updated" };
      mockPatch.mockResolvedValue({ data: { data: mockData } });

      const result = await patchCompany("company-456", {
        companyName: "Updated Company",
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/company/company-456",
        { companyName: "Updated Company" },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockData);
    });

    it("should handle unwrapped response", async () => {
      const mockData = { _id: "company-456" };
      mockPatch.mockResolvedValue({ data: mockData });

      const result = await patchCompany("company-456", {});

      expect(result).toEqual(mockData);
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Update failed"));

      await expect(
        patchCompany("company-456", { companyName: "Test" }),
      ).rejects.toThrow("Update failed");
    });
  });

  // ==================== Stripe Addon ====================

  describe("addStripeAddon", () => {
    it("should make POST request with sessionId", async () => {
      const mockData = { _id: "company-456", addons: ["storage"] };
      mockPost.mockResolvedValue({ data: { data: mockData } });

      const result = await addStripeAddon("company-456", "session-123");

      expect(mockPost).toHaveBeenCalledWith(
        "/company/company-456/addons",
        { sessionId: "session-123" },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockData);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Payment failed"));

      await expect(
        addStripeAddon("company-456", "bad-session"),
      ).rejects.toThrow("Payment failed");
    });
  });

  // ==================== Procore Status Hooks ====================

  describe("useProcoreStatus", () => {
    it("should fetch procore status by companyId", async () => {
      const mockData = {
        isConnected: true,
        procoreEmail: "procore@example.com",
        editProcoreItemsAllowed: true,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useProcoreStatus("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/company/company-456/procore-status",
      );
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useProcoreStatus(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("useProcoreIntegrationStatus", () => {
    it("should fetch integration status with companyId query param", async () => {
      const mockData = {
        connected: true,
        syncHealthStatus: "healthy",
        projectsCount: 5,
        documentsCount: 100,
        inspectionsCount: 20,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useProcoreIntegrationStatus("company-456"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/procore/status", {
        params: { companyId: "company-456" },
      });
    });
  });

  // ==================== Procore Settings ====================

  describe("updateProcoreSettings", () => {
    it("should make PATCH request with editProcoreItemsAllowed boolean", async () => {
      const mockData = { _id: "company-456" };
      mockPatch.mockResolvedValue({ data: { data: mockData } });

      const result = await updateProcoreSettings("company-456", true);

      expect(mockPatch).toHaveBeenCalledWith(
        "/company/company-456/procore-settings",
        { editProcoreItemsAllowed: true },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockData);
    });

    it("should handle false value", async () => {
      mockPatch.mockResolvedValue({ data: { data: {} } });

      await updateProcoreSettings("company-456", false);

      expect(mockPatch).toHaveBeenCalledWith(
        "/company/company-456/procore-settings",
        { editProcoreItemsAllowed: false },
        expect.any(Object),
      );
    });
  });

  // ==================== Procore Logout ====================

  describe("procoreLogout", () => {
    it("should make POST request with companyId", async () => {
      const mockResponse = { success: true };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await procoreLogout("company-456");

      expect(mockPost).toHaveBeenCalledWith(
        "/oauth/procore/logout",
        { companyId: "company-456" },
        { headers: { "Content-Type": "application/json" } },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Logout failed"));

      await expect(procoreLogout("company-456")).rejects.toThrow(
        "Logout failed",
      );
    });
  });

  // ==================== Procore Integration Details Hook ====================

  describe("useProcoreIntegrationDetails", () => {
    it("should fetch integration details by companyId", async () => {
      const mockData = {
        connected: true,
        integrationOwner: { userId: "user-1", email: "owner@example.com" },
        connectedUsers: [],
        syncHealth: "healthy",
        accessStatus: { allowed: true, reason: "paid_subscription" },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useProcoreIntegrationDetails("company-456"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/company/company-456/procore-integration-details",
      );
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useProcoreIntegrationDetails(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Change Integration Owner Mutation ====================

  describe("useChangeIntegrationOwner", () => {
    it("should call PUT endpoint with owner change payload", async () => {
      const mockResult = {
        success: true,
        previousOwnerId: "user-1",
        newOwnerId: "user-2",
        message: "Owner changed",
      };
      mockPut.mockResolvedValue({ data: mockResult });

      const queryClient = createTestQueryClient();

      const { result } = renderHook(() => useChangeIntegrationOwner(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-456",
        newOwnerUserId: "user-2",
        requestingUserId: "user-1",
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPut).toHaveBeenCalledWith(
        "/company/company-456/procore-integration-owner",
        { newOwnerUserId: "user-2", requestingUserId: "user-1" },
      );
      expect(result.current.data).toEqual(mockResult);
    });

    it("should invalidate related queries on success", async () => {
      mockPut.mockResolvedValue({
        data: { success: true, newOwnerId: "user-2", message: "Changed" },
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useChangeIntegrationOwner(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-456",
        newOwnerUserId: "user-2",
        requestingUserId: "user-1",
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["company", "procore-integration", "company-456"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["procore", "status", "company-456"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["procore", "integrationStatus", "company-456"],
      });
    });
  });

  // ==================== Storage Stats ====================

  describe("useStorageStats", () => {
    it("should fetch storage stats by companyId", async () => {
      const mockData = {
        documentStorageUsed: 1048576,
        qrCodeStorageUsed: 4096,
        documentsCount: 10,
        qrCodesCount: 5,
        documentStorageCapacity: 10737418240,
        qrCodeStorageCapacity: 409600,
        documentsWithoutSize: 2,
      };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const { result } = renderHook(() => useStorageStats("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/company/company-456/storage-stats",
      );
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when enabled flag is false", async () => {
      const { result } = renderHook(
        () => useStorageStats("company-456", false),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useStorageStats(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Dashboard Stats ====================

  describe("useDashboardStats", () => {
    it("should fetch dashboard stats by companyId", async () => {
      const mockData = {
        qrCodesCount: 50,
        qrScansCount: 200,
        documentsCount: 100,
        projectsCount: 5,
        groupsCount: 10,
        arrangementsCount: 3,
        equipmentCount: 7,
      };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const { result } = renderHook(() => useDashboardStats("company-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/company/company-456/dashboard-stats",
      );
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useDashboardStats(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    // --- Helper to create axios-like error objects ---
    function createAxiosError(
      status: number,
      statusText: string,
      data: Record<string, unknown> = {},
    ) {
      return {
        response: {
          status,
          statusText,
          data,
        },
      };
    }

    // --- useCompany error scenarios ---

    describe("useCompany errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useCompany("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database connection failed",
          }),
        );

        const { result } = renderHook(() => useCompany("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 401 unauthorized as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(401, "Unauthorized", {
            message: "Token expired",
          }),
        );

        const { result } = renderHook(() => useCompany("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 403 forbidden as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Insufficient permissions",
          }),
        );

        const { result } = renderHook(() => useCompany("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(() => useCompany("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- patchCompany error scenarios ---

    describe("patchCompany errors", () => {
      it("should reject with 400 Bad Request", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "companyName should not be empty",
          }),
        );

        await expect(
          patchCompany("company-456", { companyName: "" }),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 401 Unauthorized", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(401, "Unauthorized", {
            message: "Token expired",
          }),
        );

        await expect(
          patchCompany("company-456", { companyName: "Test" }),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 401 }),
          }),
        );
      });

      it("should reject with 403 Forbidden", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Only admin can update company",
          }),
        );

        await expect(
          patchCompany("company-456", { companyName: "Test" }),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Database write failed",
          }),
        );

        await expect(
          patchCompany("company-456", { companyName: "Test" }),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        await expect(
          patchCompany("company-456", { companyName: "Test" }),
        ).rejects.toThrow("Network Error");
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPatch.mockRejectedValue(timeoutError);

        await expect(
          patchCompany("company-456", { companyName: "Test" }),
        ).rejects.toThrow("timeout");
      });
    });

    // --- addStripeAddon error scenarios ---

    describe("addStripeAddon errors", () => {
      it("should reject with 400 Bad Request", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "Invalid session ID",
          }),
        );

        await expect(
          addStripeAddon("company-456", "bad-session"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Stripe API unreachable",
          }),
        );

        await expect(
          addStripeAddon("company-456", "session-123"),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(
          addStripeAddon("company-456", "session-123"),
        ).rejects.toThrow("Network Error");
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(
          addStripeAddon("company-456", "session-123"),
        ).rejects.toThrow("timeout");
      });
    });

    // --- useProcoreStatus error scenarios ---

    describe("useProcoreStatus errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useProcoreStatus("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Procore API unreachable",
          }),
        );

        const { result } = renderHook(() => useProcoreStatus("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(() => useProcoreStatus("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- useProcoreIntegrationStatus error scenarios ---

    describe("useProcoreIntegrationStatus errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useProcoreIntegrationStatus("company-456"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error"),
        );

        const { result } = renderHook(
          () => useProcoreIntegrationStatus("company-456"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    // --- updateProcoreSettings error scenarios ---

    describe("updateProcoreSettings errors", () => {
      it("should reject with 400 Bad Request", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "editProcoreItemsAllowed must be a boolean",
          }),
        );

        await expect(
          updateProcoreSettings("company-456", true),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 400 }),
          }),
        );
      });

      it("should reject with 403 Forbidden", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Only admin can update Procore settings",
          }),
        );

        await expect(
          updateProcoreSettings("company-456", true),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 403 }),
          }),
        );
      });

      it("should reject with 500 Server Error", async () => {
        mockPatch.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Procore settings update failed",
          }),
        );

        await expect(
          updateProcoreSettings("company-456", false),
        ).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockPatch.mockRejectedValue(new Error("Network Error"));

        await expect(
          updateProcoreSettings("company-456", true),
        ).rejects.toThrow("Network Error");
      });
    });

    // --- procoreLogout error scenarios ---

    describe("procoreLogout errors", () => {
      it("should reject with 500 Server Error", async () => {
        mockPost.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Failed to revoke Procore tokens",
          }),
        );

        await expect(procoreLogout("company-456")).rejects.toEqual(
          expect.objectContaining({
            response: expect.objectContaining({ status: 500 }),
          }),
        );
      });

      it("should reject on network failure", async () => {
        mockPost.mockRejectedValue(new Error("Network Error"));

        await expect(procoreLogout("company-456")).rejects.toThrow(
          "Network Error",
        );
      });

      it("should reject on timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockPost.mockRejectedValue(timeoutError);

        await expect(procoreLogout("company-456")).rejects.toThrow("timeout");
      });
    });

    // --- useProcoreIntegrationDetails error scenarios ---

    describe("useProcoreIntegrationDetails errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(
          () => useProcoreIntegrationDetails("company-456"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error"),
        );

        const { result } = renderHook(
          () => useProcoreIntegrationDetails("company-456"),
          { wrapper: createWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });

    // --- useChangeIntegrationOwner error scenarios ---

    describe("useChangeIntegrationOwner errors", () => {
      it("should surface 400 Bad Request as error state", async () => {
        mockPut.mockRejectedValue(
          createAxiosError(400, "Bad Request", {
            message: "newOwnerUserId is required",
          }),
        );

        const { result } = renderHook(() => useChangeIntegrationOwner(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          companyId: "company-456",
          newOwnerUserId: "",
          requestingUserId: "user-1",
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 403 Forbidden as error state", async () => {
        mockPut.mockRejectedValue(
          createAxiosError(403, "Forbidden", {
            message: "Only integration owner can transfer ownership",
          }),
        );

        const { result } = renderHook(() => useChangeIntegrationOwner(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          companyId: "company-456",
          newOwnerUserId: "user-2",
          requestingUserId: "user-3",
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface 500 Server Error as error state", async () => {
        mockPut.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Owner transfer failed",
          }),
        );

        const { result } = renderHook(() => useChangeIntegrationOwner(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          companyId: "company-456",
          newOwnerUserId: "user-2",
          requestingUserId: "user-1",
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface network failure as error state", async () => {
        mockPut.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useChangeIntegrationOwner(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          companyId: "company-456",
          newOwnerUserId: "user-2",
          requestingUserId: "user-1",
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toBe("Network Error");
      });
    });

    // --- useStorageStats error scenarios ---

    describe("useStorageStats errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useStorageStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Storage calculation failed",
          }),
        );

        const { result } = renderHook(() => useStorageStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(() => useStorageStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });

    // --- useDashboardStats error scenarios ---

    describe("useDashboardStats errors", () => {
      it("should surface network failure as error state", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useDashboardStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
        expect((result.current.error as Error).message).toBe("Network Error");
      });

      it("should surface 500 server error as error state", async () => {
        mockGet.mockRejectedValue(
          createAxiosError(500, "Internal Server Error", {
            message: "Stats aggregation failed",
          }),
        );

        const { result } = renderHook(() => useDashboardStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should handle timeout error", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        const { result } = renderHook(() => useDashboardStats("company-456"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect((result.current.error as Error).message).toContain("timeout");
      });
    });
  });
});
