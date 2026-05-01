import type { Page, Route } from "@playwright/test";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// TYPES
// ============================================================================

/** NFC resolve response shape matching the backend API */
export interface NfcResolveResponse {
  type: "customer" | "marketing" | "unassigned";
  qrcodeId?: string;
  redirectUrl?: string;
  nfcId?: string;
}

/** NFC tag shape matching the admin API list response */
export interface MockNfcTag {
  _id: string;
  url: string;
  assigned: boolean;
  purpose?: string;
  tagType?: string;
  websiteOverrideRedirect?: string;
  qrcodeRedirect?: string;
  company?: string;
  project?: string;
  batchId?: string;
  batchName?: string;
  createdAt: string;
}

/** NFC stats shape matching the admin API stats response */
export interface MockNfcStats {
  total: number;
  byPurpose: Record<string, number>;
  byTagType: Record<string, number>;
  assigned: number;
  unassigned: number;
}

/** NFC list response shape matching the admin API list response */
export interface MockNfcListResponse {
  tags: MockNfcTag[];
  total: number;
  page: number;
  limit: number;
}

/** NFC batch creation response shape */
export interface MockNfcBatchResponse {
  batchId: string;
  batchName: string;
  count: number;
  tags: { _id: string; url: string }[];
}

// ============================================================================
// BUILDERS
// ============================================================================

let _nfcIdCounter = 0;

/** Generate a unique NFC ID for test isolation */
export function uniqueNfcId(): string {
  _nfcIdCounter += 1;
  return `nfc-test-${_nfcIdCounter.toString().padStart(4, "0")}`;
}

/** Reset the NFC ID counter (call between test files if determinism is needed) */
export function resetNfcIdCounter(): void {
  _nfcIdCounter = 0;
}

/** Build a mock NFC tag with sensible defaults */
export function createMockNfcTag(
  overrides: Partial<MockNfcTag> = {},
): MockNfcTag {
  const id = overrides._id ?? uniqueNfcId();
  return {
    _id: id,
    url: `/nfc/v1/${id}`,
    assigned: false,
    purpose: "unassigned",
    tagType: "other",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Build mock NFC stats */
export function createMockNfcStats(
  overrides: Partial<MockNfcStats> = {},
): MockNfcStats {
  return {
    total: 100,
    byPurpose: { customer: 30, marketing: 20, unassigned: 50 },
    byTagType: { card: 40, sticker: 30, other: 30 },
    assigned: 50,
    unassigned: 50,
    ...overrides,
  };
}

/** Build a mock NFC list response */
export function createMockNfcListResponse(
  tags: MockNfcTag[],
  overrides: Partial<Omit<MockNfcListResponse, "tags">> = {},
): MockNfcListResponse {
  return {
    tags,
    total: overrides.total ?? tags.length,
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
  };
}

/** Build a mock batch creation response */
export function createMockNfcBatchResponse(
  count: number,
  overrides: Partial<MockNfcBatchResponse> = {},
): MockNfcBatchResponse {
  const batchId = overrides.batchId ?? `batch-${Date.now()}`;
  const tags = [];
  for (let i = 0; i < count; i++) {
    const id = uniqueNfcId();
    tags.push({ _id: id, url: `/nfc/v1/${id}` });
  }

  return {
    batchId,
    batchName: overrides.batchName ?? "Test Batch",
    count,
    tags: overrides.tags ?? tags,
  };
}

// ============================================================================
// ROUTE MOCKING HELPERS
// ============================================================================

/**
 * Mock the NFC resolve endpoint to return a specific response.
 * Useful for setting up resolution test scenarios.
 */
export async function mockNfcResolve(
  page: Page,
  response: NfcResolveResponse,
  options?: { status?: number; delay?: number },
): Promise<void> {
  const { status = 200, delay = 0 } = options ?? {};

  await safeRoute(page, "**/nfc/resolve/**", async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock the NFC resolve endpoint to return an error.
 */
export async function mockNfcResolveError(
  page: Page,
  statusCode: number,
  message: string,
): Promise<void> {
  await safeRoute(page, "**/nfc/resolve/**", async (route: Route) => {
    await route.fulfill({
      status: statusCode,
      contentType: "application/json",
      body: JSON.stringify({
        statusCode,
        message,
        error: statusCode === 404 ? "Not Found" : "Bad Request",
      }),
    });
  });
}

/**
 * Mock the admin NFC stats endpoint.
 */
export async function mockAdminNfcStats(
  page: Page,
  stats: MockNfcStats,
): Promise<void> {
  await safeRoute(page, "**/admin/nfc/stats**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(stats),
    });
  });
}

/**
 * Mock the admin NFC list endpoint with a static response.
 * For dynamic responses based on query params, use mockAdminNfcListDynamic.
 */
export async function mockAdminNfcList(
  page: Page,
  response: MockNfcListResponse,
): Promise<void> {
  await safeRoute(page, "**/admin/nfc?**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  // Also match requests without query params
  await page.route(/\/admin\/nfc$/, async (route: Route) => {
    if (route.request().url().includes("/admin/nfc/")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock the admin NFC batch creation endpoint.
 */
export async function mockAdminNfcBatchCreate(
  page: Page,
  response: MockNfcBatchResponse,
): Promise<void> {
  await safeRoute(page, "**/admin/nfc/batch", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the admin NFC batch CSV download endpoint.
 */
export async function mockAdminNfcBatchCsv(
  page: Page,
  csvContent?: string,
): Promise<void> {
  const defaultCsv =
    "id,url\nnfc-001,/nfc/v1/nfc-001\nnfc-002,/nfc/v1/nfc-002\n";
  await safeRoute(page, "**/admin/nfc/batch/*/csv**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: csvContent ?? defaultCsv,
    });
  });
}

/**
 * Mock the admin NFC update (PATCH) endpoint.
 */
export async function mockAdminNfcUpdate(
  page: Page,
  nfcId: string,
  updatedTag: MockNfcTag,
): Promise<void> {
  await safeRoute(page, `**/admin/nfc/${nfcId}`, async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updatedTag),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the admin NFC delete endpoint.
 */
export async function mockAdminNfcDelete(
  page: Page,
  nfcId: string,
): Promise<void> {
  await safeRoute(page, `**/admin/nfc/${nfcId}`, async (route: Route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

// ============================================================================
// ADMIN USER SETUP
// ============================================================================

/**
 * Taliho admin user mock data for admin NFC page access.
 * Uses a whitelisted email that passes the isAdminUser() check.
 */
export const ADMIN_NFC_USER = {
  _id: "user-admin-nfc-e2e",
  firstName: "Admin",
  lastName: "NFC",
  email: "jpmitra.swe@gmail.com", // Must be in ADMIN_EMAILS whitelist
  permission: "admin" as const,
  isVerified: true,
  company: "comp-test-001",
  companyId: "comp-test-001",
};

/**
 * Inject admin user localStorage for the NFC admin page.
 * The standard `authenticatedPage` fixture uses a non-whitelisted email;
 * this function overrides it with a whitelisted admin email.
 */
export async function setupAdminNfcAuth(
  page: Page,
  options?: {
    accessToken?: string;
    user?: Record<string, unknown>;
    company?: Record<string, unknown>;
  },
): Promise<void> {
  const { accessToken, user, company } = options ?? {};

  await page.addInitScript(
    (data) => {
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("user", JSON.stringify(data.user));
      if (data.company) {
        window.localStorage.setItem("company", JSON.stringify(data.company));
      }
    },
    {
      accessToken: accessToken ?? "mock-jwt-access-token-for-e2e-testing",
      user: user ?? ADMIN_NFC_USER,
      company: company ?? undefined,
    },
  );
}
