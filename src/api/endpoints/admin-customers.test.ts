/**
 * Tests for admin customers API endpoints
 * Tests all admin customer-related API functions including company management,
 * user management, email domains, trial refresh, notifications, and React Query hooks.
 * Validates Rollbar error logging and query invalidation patterns.
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
  },
}));

// Mock rollbar logger
const mockLogApiError = vi.fn();
vi.mock("@/utils/rollbar", () => ({
  logApiError: (...args: unknown[]) => mockLogApiError(...args),
}));

import {
  getAdminCompanies,
  getAdminCompany,
  getAdminCompanyUsers,
  updateEmailDomains,
  approvePendingDomains,
  transferUser,
  updateAdminUser,
  deleteAdminUser,
  inviteUser,
  refreshCompanyTrial,
  notifyCompanyAdmins,
  updateCompanyStatus,
  deleteAdminCompany,
  useAdminCompanies,
  useAdminCompany,
  useAdminCompanyUsers,
  useUpdateEmailDomains,
  useApprovePendingDomains,
  useTransferUser,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useInviteUser,
  useRefreshCompanyTrial,
  useNotifyCompanyAdmins,
  useUpdateCompanyStatus,
  useDeleteAdminCompany,
  adminCustomersKeys,
} from "./admin-customers";

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

describe("Admin Customers API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("adminCustomersKeys", () => {
    it("should generate correct companies key with params", () => {
      const params = { page: 1, limit: 10 };
      const key = adminCustomersKeys.companies(params);

      expect(key).toEqual(["admin-customers", "companies", params]);
    });

    it("should generate correct companies key without params", () => {
      const key = adminCustomersKeys.companies();

      expect(key).toEqual(["admin-customers", "companies", undefined]);
    });

    it("should generate correct company detail key", () => {
      const key = adminCustomersKeys.companyDetail("company-123");

      expect(key).toEqual(["admin-customers", "company", "company-123"]);
    });

    it("should generate correct company users key", () => {
      const key = adminCustomersKeys.companyUsers("company-123");

      expect(key).toEqual([
        "admin-customers",
        "company",
        "company-123",
        "users",
      ]);
    });
  });

  // ==================== API Functions - Companies ====================

  describe("getAdminCompanies", () => {
    it("should make GET request with params", async () => {
      const mockResponse = {
        companies: [
          { _id: "company-1", companyName: "Company 1" },
          { _id: "company-2", companyName: "Company 2" },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };
      mockGet.mockResolvedValue({ data: { data: mockResponse } });

      const params = { page: 1, limit: 10, search: "test" };
      const result = await getAdminCompanies(params);

      expect(mockGet).toHaveBeenCalledWith("/admin/customers/companies", {
        params,
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle unwrapped response", async () => {
      const mockResponse = { companies: [], total: 0, page: 1, limit: 10 };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getAdminCompanies();

      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Network Error");
      mockGet.mockRejectedValue(error);

      const params = { page: 1, limit: 10 };

      await expect(getAdminCompanies(params)).rejects.toThrow("Network Error");

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-list-companies-failed",
        { params },
      );
    });
  });

  describe("getAdminCompany", () => {
    it("should make GET request with companyId", async () => {
      const mockResponse = {
        _id: "company-123",
        companyName: "Test Company",
        emailDomains: ["test.com"],
        paidAccount: true,
      };
      mockGet.mockResolvedValue({ data: { data: mockResponse } });

      const result = await getAdminCompany("company-123");

      expect(mockGet).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle unwrapped response", async () => {
      const mockResponse = { _id: "company-123", companyName: "Test" };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getAdminCompany("company-123");

      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Not Found");
      mockGet.mockRejectedValue(error);

      await expect(getAdminCompany("company-123")).rejects.toThrow("Not Found");

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-get-company-failed",
        { companyId: "company-123" },
      );
    });
  });

  describe("getAdminCompanyUsers", () => {
    it("should make GET request and extract users array", async () => {
      const mockUsers = [
        { _id: "user-1", email: "user1@test.com", permission: "admin" },
        { _id: "user-2", email: "user2@test.com", permission: "user" },
      ];
      mockGet.mockResolvedValue({ data: { data: { users: mockUsers } } });

      const result = await getAdminCompanyUsers("company-123");

      expect(mockGet).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/users",
      );
      expect(result).toEqual(mockUsers);
    });

    it("should handle direct users array response", async () => {
      const mockUsers = [{ _id: "user-1", email: "user1@test.com" }];
      mockGet.mockResolvedValue({ data: { data: mockUsers } });

      const result = await getAdminCompanyUsers("company-123");

      expect(result).toEqual(mockUsers);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Server Error");
      mockGet.mockRejectedValue(error);

      await expect(getAdminCompanyUsers("company-123")).rejects.toThrow(
        "Server Error",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-list-company-users-failed",
        { companyId: "company-123" },
      );
    });
  });

  // ==================== API Functions - Email Domains ====================

  describe("updateEmailDomains", () => {
    it("should make PATCH request with emailDomains", async () => {
      const mockResponse = {
        _id: "company-123",
        emailDomains: ["test.com", "example.com"],
      };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const domains = ["test.com", "example.com"];
      const result = await updateEmailDomains("company-123", domains);

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/email-domains",
        { emailDomains: domains },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Update failed");
      mockPatch.mockRejectedValue(error);

      const domains = ["test.com"];

      await expect(updateEmailDomains("company-123", domains)).rejects.toThrow(
        "Update failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-update-email-domains-failed",
        { companyId: "company-123", emailDomains: domains },
      );
    });
  });

  describe("approvePendingDomains", () => {
    it("should make POST request with domains array", async () => {
      const mockResponse = {
        success_message: "Domains approved",
        data: {
          _id: "company-123",
          emailDomains: ["approved.com"],
          pendingDomainReview: [],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const domains = ["approved.com"];
      const result = await approvePendingDomains("company-123", domains);

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/approve-domains",
        { domains },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Approval failed");
      mockPost.mockRejectedValue(error);

      await expect(
        approvePendingDomains("company-123", ["test.com"]),
      ).rejects.toThrow("Approval failed");

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-approve-domains-failed",
        { companyId: "company-123" },
      );
    });
  });

  // ==================== API Functions - User Management ====================

  describe("transferUser", () => {
    it("should make POST request with transfer params", async () => {
      const mockResponse = {
        _id: "user-123",
        email: "user@test.com",
        company: "company-456",
      };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const params = { targetCompanyId: "company-456", makeAdmin: true };
      const result = await transferUser("user-123", params);

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/users/user-123/transfer",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Transfer failed");
      mockPost.mockRejectedValue(error);

      const params = { targetCompanyId: "company-456" };

      await expect(transferUser("user-123", params)).rejects.toThrow(
        "Transfer failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-transfer-user-failed",
        { userId: "user-123", params },
      );
    });
  });

  describe("updateAdminUser", () => {
    it("should make PATCH request with user update params", async () => {
      const mockResponse = {
        _id: "user-123",
        firstName: "John",
        lastName: "Doe",
        permission: "pm",
      };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const params = { firstName: "John", lastName: "Doe", permission: "pm" };
      const result = await updateAdminUser("user-123", params);

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/users/user-123",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Update failed");
      mockPatch.mockRejectedValue(error);

      const params = { firstName: "John" };

      await expect(updateAdminUser("user-123", params)).rejects.toThrow(
        "Update failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-update-user-failed",
        { userId: "user-123", params },
      );
    });
  });

  describe("deleteAdminUser", () => {
    it("should make DELETE request", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      await deleteAdminUser("user-123");

      expect(mockDelete).toHaveBeenCalledWith(
        "/admin/customers/users/user-123",
      );
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Delete failed");
      mockDelete.mockRejectedValue(error);

      await expect(deleteAdminUser("user-123")).rejects.toThrow(
        "Delete failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-delete-user-failed",
        { userId: "user-123" },
      );
    });
  });

  describe("inviteUser", () => {
    it("should make POST request with invite params", async () => {
      const mockResponse = {
        _id: "user-456",
        email: "newuser@test.com",
        permission: "user",
      };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const params = {
        email: "newuser@test.com",
        firstName: "New",
        lastName: "User",
        permission: "user",
      };
      const result = await inviteUser("company-123", params);

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/invite",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Invite failed");
      mockPost.mockRejectedValue(error);

      const params = { email: "test@test.com", permission: "user" };

      await expect(inviteUser("company-123", params)).rejects.toThrow(
        "Invite failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-invite-user-failed",
        { companyId: "company-123", params },
      );
    });
  });

  // ==================== API Functions - Company Operations ====================

  describe("refreshCompanyTrial", () => {
    it("should make PATCH request with duration params", async () => {
      const mockResponse = {
        _id: "company-123",
        freeTrialActive: true,
        freeTrialRefreshDate: "2024-03-01",
      };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const params = { durationDays: 30 };
      const result = await refreshCompanyTrial("company-123", params);

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/refresh-trial",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle empty params", async () => {
      const mockResponse = { _id: "company-123", freeTrialActive: true };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      await refreshCompanyTrial("company-123");

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/refresh-trial",
        {},
      );
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Refresh failed");
      mockPatch.mockRejectedValue(error);

      await expect(refreshCompanyTrial("company-123")).rejects.toThrow(
        "Refresh failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-refresh-trial-failed",
        { companyId: "company-123" },
      );
    });
  });

  describe("notifyCompanyAdmins", () => {
    it("should make POST request with notification params", async () => {
      const mockResponse = { sentCount: 3 };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const params = {
        subject: "Important Update",
        body: "Please review...",
        template: "custom" as const,
      };
      const result = await notifyCompanyAdmins("company-123", params);

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/notify-admins",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Notification failed");
      mockPost.mockRejectedValue(error);

      const params = { subject: "Test", body: "Test" };

      await expect(notifyCompanyAdmins("company-123", params)).rejects.toThrow(
        "Notification failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-notify-admins-failed",
        { companyId: "company-123" },
      );
    });
  });

  describe("updateCompanyStatus", () => {
    it("should make PATCH request with deactivation status", async () => {
      const mockResponse = { _id: "company-123", deactivated: true };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const params = { deactivated: true };
      const result = await updateCompanyStatus("company-123", params);

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/status",
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Status update failed");
      mockPatch.mockRejectedValue(error);

      await expect(
        updateCompanyStatus("company-123", { deactivated: false }),
      ).rejects.toThrow("Status update failed");

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-update-company-status-failed",
        { companyId: "company-123" },
      );
    });
  });

  describe("deleteAdminCompany", () => {
    it("should make DELETE request", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      await deleteAdminCompany("company-123");

      expect(mockDelete).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123",
      );
    });

    it("should log error with Rollbar on failure", async () => {
      const error = new Error("Delete failed");
      mockDelete.mockRejectedValue(error);

      await expect(deleteAdminCompany("company-123")).rejects.toThrow(
        "Delete failed",
      );

      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        "admin-delete-company-failed",
        { companyId: "company-123" },
      );
    });
  });

  // ==================== React Query Hooks - Queries ====================

  describe("useAdminCompanies", () => {
    it("should fetch companies list", async () => {
      const mockData = {
        companies: [{ _id: "company-1", companyName: "Test" }],
        total: 1,
        page: 1,
        limit: 10,
      };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const params = { page: 1, limit: 10 };
      const { result } = renderHook(() => useAdminCompanies(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/admin/customers/companies", {
        params,
      });
      expect(result.current.data).toEqual(mockData);
    });

    it("should handle error state", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useAdminCompanies(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("useAdminCompany", () => {
    it("should fetch single company", async () => {
      const mockData = { _id: "company-123", companyName: "Test Company" };
      mockGet.mockResolvedValue({ data: { data: mockData } });

      const { result } = renderHook(() => useAdminCompany("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123",
      );
      expect(result.current.data).toEqual(mockData);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useAdminCompany(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useAdminCompanyUsers", () => {
    it("should fetch company users", async () => {
      const mockUsers = [{ _id: "user-1", email: "test@test.com" }];
      mockGet.mockResolvedValue({ data: { data: { users: mockUsers } } });

      const { result } = renderHook(() => useAdminCompanyUsers("company-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/users",
      );
      expect(result.current.data).toEqual(mockUsers);
    });

    it("should be disabled when companyId is empty", async () => {
      const { result } = renderHook(() => useAdminCompanyUsers(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ==================== React Query Hooks - Mutations ====================

  describe("useUpdateEmailDomains", () => {
    it("should call updateEmailDomains and invalidate queries", async () => {
      const mockResponse = { _id: "company-123", emailDomains: ["test.com"] };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateEmailDomains(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-123",
        emailDomains: ["test.com"],
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/email-domains",
        { emailDomains: ["test.com"] },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyDetail("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useApprovePendingDomains", () => {
    it("should call approvePendingDomains and invalidate queries", async () => {
      const mockResponse = {
        success_message: "Approved",
        data: { _id: "company-123" },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useApprovePendingDomains(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-123",
        domains: ["approved.com"],
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/approve-domains",
        { domains: ["approved.com"] },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyDetail("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useTransferUser", () => {
    it("should call transferUser and invalidate source/target queries", async () => {
      const mockResponse = { _id: "user-123", company: "company-456" };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useTransferUser(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        userId: "user-123",
        params: { targetCompanyId: "company-456" },
        sourceCompanyId: "company-123",
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/users/user-123/transfer",
        { targetCompanyId: "company-456" },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyUsers("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyUsers("company-456"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useUpdateAdminUser", () => {
    it("should call updateAdminUser and invalidate user queries", async () => {
      const mockResponse = { _id: "user-123", firstName: "Updated" };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateAdminUser(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        userId: "user-123",
        params: { firstName: "Updated" },
        companyId: "company-123",
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/users/user-123",
        { firstName: "Updated" },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyUsers("company-123"),
      });
    });
  });

  describe("useDeleteAdminUser", () => {
    it("should call deleteAdminUser and invalidate queries", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteAdminUser(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({ userId: "user-123", companyId: "company-123" });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDelete).toHaveBeenCalledWith(
        "/admin/customers/users/user-123",
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyUsers("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useInviteUser", () => {
    it("should call inviteUser and invalidate queries", async () => {
      const mockResponse = { _id: "user-456", email: "new@test.com" };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useInviteUser(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-123",
        params: { email: "new@test.com", permission: "user" },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/invite",
        { email: "new@test.com", permission: "user" },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyUsers("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useRefreshCompanyTrial", () => {
    it("should call refreshCompanyTrial and invalidate queries", async () => {
      const mockResponse = { _id: "company-123", freeTrialActive: true };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRefreshCompanyTrial(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-123",
        params: { durationDays: 30 },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/refresh-trial",
        { durationDays: 30 },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyDetail("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companies(),
      });
    });
  });

  describe("useNotifyCompanyAdmins", () => {
    it("should call notifyCompanyAdmins without invalidation", async () => {
      const mockResponse = { sentCount: 2 };
      mockPost.mockResolvedValue({ data: { data: mockResponse } });

      const { result } = renderHook(() => useNotifyCompanyAdmins(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        companyId: "company-123",
        params: { subject: "Test", body: "Test message" },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/notify-admins",
        { subject: "Test", body: "Test message" },
      );

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useUpdateCompanyStatus", () => {
    it("should call updateCompanyStatus and invalidate queries", async () => {
      const mockResponse = { _id: "company-123", deactivated: true };
      mockPatch.mockResolvedValue({ data: { data: mockResponse } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateCompanyStatus(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({
        companyId: "company-123",
        params: { deactivated: true },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123/status",
        { deactivated: true },
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: adminCustomersKeys.companyDetail("company-123"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin-customers", "companies"],
      });
    });
  });

  describe("useDeleteAdminCompany", () => {
    it("should call deleteAdminCompany and invalidate companies queries", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteAdminCompany(), {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      });

      result.current.mutate({ companyId: "company-123" });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDelete).toHaveBeenCalledWith(
        "/admin/customers/companies/company-123",
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin-customers", "companies"],
      });
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
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

    describe("API function errors", () => {
      it("should handle 401 unauthorized for getAdminCompanies", async () => {
        const error = createAxiosError(401, "Unauthorized");
        mockGet.mockRejectedValue(error);

        await expect(getAdminCompanies()).rejects.toEqual(error);
        expect(mockLogApiError).toHaveBeenCalled();
      });

      it("should handle 403 forbidden for updateEmailDomains", async () => {
        const error = createAxiosError(403, "Forbidden", {
          message: "Admin access required",
        });
        mockPatch.mockRejectedValue(error);

        await expect(
          updateEmailDomains("company-123", ["test.com"]),
        ).rejects.toEqual(error);
        expect(mockLogApiError).toHaveBeenCalled();
      });

      it("should handle 404 not found for getAdminCompany", async () => {
        const error = createAxiosError(404, "Not Found", {
          message: "Company not found",
        });
        mockGet.mockRejectedValue(error);

        await expect(getAdminCompany("nonexistent")).rejects.toEqual(error);
        expect(mockLogApiError).toHaveBeenCalled();
      });

      it("should handle 500 server error for deleteAdminCompany", async () => {
        const error = createAxiosError(500, "Internal Server Error");
        mockDelete.mockRejectedValue(error);

        await expect(deleteAdminCompany("company-123")).rejects.toEqual(error);
        expect(mockLogApiError).toHaveBeenCalled();
      });

      it("should handle network timeout", async () => {
        const timeoutError = new Error("timeout of 30000ms exceeded");
        Object.assign(timeoutError, { code: "ECONNABORTED" });
        mockGet.mockRejectedValue(timeoutError);

        await expect(getAdminCompanies()).rejects.toThrow("timeout");
        expect(mockLogApiError).toHaveBeenCalled();
      });
    });

    describe("Hook error handling", () => {
      it("should surface errors in useAdminCompanies", async () => {
        mockGet.mockRejectedValue(new Error("Network Error"));

        const { result } = renderHook(() => useAdminCompanies(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });

      it("should surface errors in mutation hooks", async () => {
        mockPatch.mockRejectedValue(new Error("Update failed"));

        const { result } = renderHook(() => useUpdateEmailDomains(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          companyId: "company-123",
          emailDomains: ["test.com"],
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
      });
    });
  });
});
