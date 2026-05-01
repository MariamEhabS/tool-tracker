/**
 * Tests for Activity Log API endpoints
 * Tests getActivityLog function with various filter combinations
 * and activityLogKeys cache key generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

import {
  getActivityLog,
  activityLogKeys,
  ActivityCategoryEnum,
  ActivityActionEnum,
} from "./activity-log";

describe("Activity Log API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Query Keys ====================

  describe("activityLogKeys", () => {
    it("should have correct base key", () => {
      expect(activityLogKeys.all).toEqual(["activity-log"]);
    });

    it("should generate list key with companyId and params", () => {
      const params = { page: 1, limit: 20 };
      const key = activityLogKeys.list("company-123", params);

      expect(key).toEqual(["activity-log", "company-123", params]);
    });

    it("should generate list key with empty params", () => {
      const key = activityLogKeys.list("company-123", {});

      expect(key).toEqual(["activity-log", "company-123", {}]);
    });

    it("should generate distinct keys for different params", () => {
      const key1 = activityLogKeys.list("company-123", { page: 1 });
      const key2 = activityLogKeys.list("company-123", { page: 2 });

      expect(key1).not.toEqual(key2);
    });
  });

  // ==================== getActivityLog ====================

  describe("getActivityLog", () => {
    it("should fetch activity log with default params (no query string)", async () => {
      const mockResponse = {
        success_message: "OK",
        total_pages: 1,
        current_page: 1,
        total_items: 0,
        has_next: false,
        has_prev: false,
        data: [],
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getActivityLog("company-123");

      expect(mockGet).toHaveBeenCalledWith("/company/company-123/activity-log");
      expect(result).toEqual(mockResponse);
    });

    it("should append page and limit as query params", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", { page: 2, limit: 50 });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("limit=50");
    });

    it("should append category filter", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", {
        category: ActivityCategoryEnum.SECURITY,
      });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain("category=security");
    });

    it("should append action filter", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", {
        action: ActivityActionEnum.USER_INVITED,
      });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain("action=user_invited");
    });

    it("should append userId filter", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", { userId: "user-456" });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain("userId=user-456");
    });

    it("should append date range filters", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain("startDate=2026-01-01");
      expect(calledUrl).toContain("endDate=2026-01-31");
    });

    it("should build correct query string with combined filters", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", {
        page: 1,
        limit: 10,
        category: ActivityCategoryEnum.USERS,
        action: ActivityActionEnum.USER_REMOVED,
        userId: "user-789",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/^\/company\/company-123\/activity-log\?/);
      expect(calledUrl).toContain("page=1");
      expect(calledUrl).toContain("limit=10");
      expect(calledUrl).toContain("category=users");
      expect(calledUrl).toContain("action=user_removed");
      expect(calledUrl).toContain("userId=user-789");
      expect(calledUrl).toContain("startDate=2026-01-01");
      expect(calledUrl).toContain("endDate=2026-01-31");
    });

    it("should omit falsy params from query string", async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });

      await getActivityLog("company-123", {
        page: undefined,
        limit: undefined,
        category: undefined,
      });

      expect(mockGet).toHaveBeenCalledWith("/company/company-123/activity-log");
    });

    it("should return response data", async () => {
      const mockResponse = {
        success_message: "Activity log fetched",
        total_pages: 3,
        current_page: 2,
        total_items: 25,
        has_next: true,
        has_prev: true,
        data: [
          {
            _id: "log-1",
            companyId: "company-123",
            userId: "user-1",
            userName: "John Doe",
            action: ActivityActionEnum.LOGIN_SUCCESS,
            category: ActivityCategoryEnum.SECURITY,
            details: {},
            createdAt: "2026-01-15T10:00:00Z",
          },
        ],
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getActivityLog("company-123", { page: 2 });

      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
      expect(result.has_next).toBe(true);
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      await expect(getActivityLog("company-123")).rejects.toThrow(
        "Network Error",
      );
    });

    it("should propagate 401 Unauthorized", async () => {
      const error = {
        response: { status: 401, data: { message: "Unauthorized" } },
      };
      mockGet.mockRejectedValue(error);

      await expect(getActivityLog("company-123")).rejects.toEqual(error);
    });

    it("should propagate 500 Server Error", async () => {
      const error = {
        response: {
          status: 500,
          data: { message: "Internal Server Error" },
        },
      };
      mockGet.mockRejectedValue(error);

      await expect(getActivityLog("company-123")).rejects.toEqual(error);
    });
  });
});
