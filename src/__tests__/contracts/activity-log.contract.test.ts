/**
 * Contract Test: Activity Log API
 *
 * Validates that the frontend Activity Log API client (activity-log.ts) sends
 * request parameters and hits URL paths that align with the backend specification
 * defined in backend-contracts.ts.
 *
 * When the backend changes the activity log DTO, enums, or routes, update
 * backend-contracts.ts first, then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend contract definitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  BackendGetActivityLogDto,
  BackendActivityActionEnum,
  BackendActivityCategoryEnum,
  BackendPaginatedResponseDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGet = vi.fn().mockResolvedValue({ data: {} });
const mockPost = vi.fn().mockResolvedValue({ data: {} });
const mockPatch = vi.fn().mockResolvedValue({ data: {} });
const mockDelete = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Import frontend types and functions AFTER mocks are registered
import {
  type GetActivityLogParams,
  type PaginatedActivityLogResponse,
  ActivityActionEnum as FrontendActivityActionEnum,
  ActivityCategoryEnum as FrontendActivityCategoryEnum,
  getActivityLog,
} from "@api/endpoints/activity-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all string values from a TypeScript enum object. */
function enumValues<T extends Record<string, string>>(e: T): string[] {
  return Object.values(e);
}

/** Return the keys of a TypeScript interface at runtime via a sample object. */
function keysOf<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Activity Log API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: {
        success_message: "OK",
        total_pages: 1,
        current_page: 1,
        total_items: 0,
        has_next: false,
        has_prev: false,
        data: [],
      },
    });
  });

  // =========================================================================
  // 1. getActivityLog calls correct URL pattern and HTTP method
  // =========================================================================
  it("getActivityLog calls correct URL pattern and HTTP method", async () => {
    await getActivityLog("companyId123", { page: 1, limit: 20 });

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/companyId123/activity-log?page=1&limit=20");

    // Verify the URL pattern matches the backend route definition
    // Backend route: /company/:companyId/activity-log
    const route = BACKEND_ROUTES["activity-log.list"];
    const expectedBase = route.path.replace(":companyId", "companyId123");
    expect(url).toContain(expectedBase);

    // Verify HTTP method matches backend specification
    expect(route.method).toBe("GET");
  });

  it("getActivityLog calls URL without query params when none provided", async () => {
    await getActivityLog("companyId123", {});

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/company/companyId123/activity-log");
  });

  it("getActivityLog includes all filter params in URL", async () => {
    await getActivityLog("companyId123", {
      page: 2,
      limit: 50,
      category: FrontendActivityCategoryEnum.SECURITY,
      action: FrontendActivityActionEnum.LOGIN_SUCCESS,
      userId: "user456",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0] as [string];

    // Verify each param is present in the URL query string
    expect(url).toContain("page=2");
    expect(url).toContain("limit=50");
    expect(url).toContain("category=security");
    expect(url).toContain("action=login_success");
    expect(url).toContain("userId=user456");
    expect(url).toContain("startDate=2026-01-01");
    expect(url).toContain("endDate=2026-01-31");
  });

  // =========================================================================
  // 2. GetActivityLogParams fields match BackendGetActivityLogDto
  // =========================================================================
  it("GetActivityLogParams fields match BackendGetActivityLogDto", () => {
    // Build sample frontend params with all fields populated
    const frontendParams: GetActivityLogParams = {
      page: 1,
      limit: 20,
      category: FrontendActivityCategoryEnum.USERS,
      action: FrontendActivityActionEnum.USER_INVITED,
      userId: "user123",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    };

    // Build the backend DTO keys for comparison
    const backendDtoKeys = keysOf<BackendGetActivityLogDto>({
      page: 1,
      limit: 20,
      category: BackendActivityCategoryEnum.USERS,
      action: BackendActivityActionEnum.USER_INVITED,
      userId: "user123",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    // Every field in the frontend params type should be a valid backend DTO field
    const frontendKeys = Object.keys(frontendParams);
    for (const key of frontendKeys) {
      expect(backendDtoKeys).toContain(key);
    }

    // Every backend DTO field should be represented in the frontend params type
    for (const key of backendDtoKeys) {
      expect(frontendKeys).toContain(key);
    }

    // Verify field count matches exactly (no extra fields on either side)
    expect(frontendKeys.length).toBe(backendDtoKeys.length);
  });

  // =========================================================================
  // 3. PaginatedActivityLogResponse matches backend shape
  // =========================================================================
  it("PaginatedActivityLogResponse matches backend shape", () => {
    // Build a sample response matching the frontend type
    const frontendResponse: PaginatedActivityLogResponse = {
      success_message: "Activity log retrieved successfully",
      total_pages: 5,
      current_page: 1,
      total_items: 100,
      has_next: true,
      has_prev: false,
      data: [],
    };

    // Verify the frontend response has all the fields expected by
    // BackendPaginatedResponseDto<T>
    expect(frontendResponse).toHaveProperty("success_message");
    expect(frontendResponse).toHaveProperty("total_pages");
    expect(frontendResponse).toHaveProperty("current_page");
    expect(frontendResponse).toHaveProperty("total_items");
    expect(frontendResponse).toHaveProperty("has_next");
    expect(frontendResponse).toHaveProperty("has_prev");
    expect(frontendResponse).toHaveProperty("data");

    // Verify the types of each field
    expect(typeof frontendResponse.success_message).toBe("string");
    expect(typeof frontendResponse.total_pages).toBe("number");
    expect(typeof frontendResponse.current_page).toBe("number");
    expect(typeof frontendResponse.total_items).toBe("number");
    expect(typeof frontendResponse.has_next).toBe("boolean");
    expect(typeof frontendResponse.has_prev).toBe("boolean");
    expect(Array.isArray(frontendResponse.data)).toBe(true);

    // Verify the backend generic pagination shape keys match
    const backendPaginationKeys = keysOf<BackendPaginatedResponseDto<unknown>>({
      success_message: "",
      total_pages: 0,
      current_page: 0,
      total_items: 0,
      has_next: false,
      has_prev: false,
      data: [],
    });

    const frontendResponseKeys = Object.keys(frontendResponse);
    for (const backendKey of backendPaginationKeys) {
      expect(frontendResponseKeys).toContain(backendKey);
    }
  });

  // =========================================================================
  // 4. Frontend ActivityActionEnum is SUBSET of backend
  // =========================================================================
  it("Frontend ActivityActionEnum is SUBSET of backend", () => {
    const backendValues = enumValues(BackendActivityActionEnum);
    const frontendValues = enumValues(
      FrontendActivityActionEnum as unknown as Record<string, string>,
    );

    // Every frontend enum value MUST exist in the backend
    for (const frontendVal of frontendValues) {
      expect(backendValues).toContain(frontendVal);
    }

    // ------------------------------------------------------------------
    // DOCUMENTED MISSING VALUES
    //
    // The following backend ActivityAction values are NOT present in the
    // frontend enum. These represent newer backend actions that the
    // frontend activity log UI does not yet display or filter by.
    //
    // When the frontend adds support for these actions, add them to the
    // ActivityActionEnum in activity-log.ts and update this test.
    // ------------------------------------------------------------------
    const knownMissingActions = [
      BackendActivityActionEnum.PROCORE_USER_DISCONNECTED,
      BackendActivityActionEnum.PROCORE_OWNER_CHANGED,
      BackendActivityActionEnum.RESOURCE_UPDATED,
      BackendActivityActionEnum.RESOURCE_DELETED,
      BackendActivityActionEnum.BACKFILL_EXECUTED,
    ];

    // Verify these are indeed missing from the frontend
    for (const missing of knownMissingActions) {
      expect(frontendValues).not.toContain(missing);
    }

    // Verify these are the ONLY missing values (detect new gaps early)
    const allMissing = backendValues.filter((v) => !frontendValues.includes(v));
    expect(allMissing.sort()).toEqual(knownMissingActions.map(String).sort());
  });

  // =========================================================================
  // 5. Frontend ActivityCategoryEnum is SUBSET of backend
  // =========================================================================
  it("Frontend ActivityCategoryEnum is SUBSET of backend", () => {
    const backendValues = enumValues(BackendActivityCategoryEnum);
    const frontendValues = enumValues(
      FrontendActivityCategoryEnum as unknown as Record<string, string>,
    );

    // Every frontend enum value MUST exist in the backend
    for (const frontendVal of frontendValues) {
      expect(backendValues).toContain(frontendVal);
    }

    // ------------------------------------------------------------------
    // DOCUMENTED MISSING VALUES
    //
    // The following backend ActivityCategory values are NOT present in the
    // frontend enum. These represent newer backend categories that the
    // frontend activity log UI does not yet display or filter by.
    //
    // When the frontend adds support for these categories, add them to
    // the ActivityCategoryEnum in activity-log.ts and update this test.
    // ------------------------------------------------------------------
    const knownMissingCategories = [
      BackendActivityCategoryEnum.ADMIN,
      BackendActivityCategoryEnum.GROUPS,
      BackendActivityCategoryEnum.QR_CODES,
      BackendActivityCategoryEnum.PROJECTS,
      BackendActivityCategoryEnum.DOCUMENTS,
      BackendActivityCategoryEnum.FOLDERS,
      BackendActivityCategoryEnum.PROCORE_ITEMS,
      BackendActivityCategoryEnum.CATEGORIES,
    ];

    // Verify these are indeed missing from the frontend
    for (const missing of knownMissingCategories) {
      expect(frontendValues).not.toContain(missing);
    }

    // Verify these are the ONLY missing values (detect new gaps early)
    const allMissing = backendValues.filter((v) => !frontendValues.includes(v));
    expect(allMissing.sort()).toEqual(
      knownMissingCategories.map(String).sort(),
    );
  });
});
