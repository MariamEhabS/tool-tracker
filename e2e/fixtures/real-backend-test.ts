import { test as base, expect, Page } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getBackendUrl } from "../utils/runtime-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// ============================================================================
// TYPES
// ============================================================================

interface TestUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: Record<string, unknown>;
}

interface TestFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
  authTokens: AuthTokens;
  apiClient: ApiClient;
}

type ApiRecord = Record<string, unknown>;

function unwrapApiData<T>(payload: T | { data?: T }): T {
  if (
    payload != null &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    const data = (payload as { data?: T }).data;
    if (data !== undefined) {
      return data;
    }
  }

  return payload as T;
}

function normalizeUser(
  user: ApiRecord | undefined,
  accessToken?: string,
): ApiRecord {
  const normalizedCompanyId =
    user?.companyId ?? user?.companyID ?? user?.company ?? "";

  return {
    ...(user ?? {}),
    _id: user?._id ?? user?.userId,
    userId: user?.userId ?? user?._id,
    companyId: normalizedCompanyId,
    companyID: user?.companyID ?? normalizedCompanyId,
    company: user?.company ?? normalizedCompanyId,
    accessToken: accessToken ?? user?.accessToken,
  };
}

// ============================================================================
// API CLIENT
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>("GET", endpoint);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", endpoint, body);
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", endpoint, body);
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", endpoint, body);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>("DELETE", endpoint);
  }

  // Auth endpoints
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: unknown }> {
    const result = await this.post<{ accessToken: string; user?: unknown }>(
      "/auth/login",
      { email, password },
    );
    this.setAccessToken(result.accessToken);
    const rawUser =
      (result.user as ApiRecord | undefined) ?? (result as ApiRecord);

    return {
      accessToken: result.accessToken,
      user: normalizeUser(rawUser, result.accessToken),
    };
  }

  async getMe(): Promise<unknown> {
    const result = await this.get<unknown>("/auth/me");
    return normalizeUser(
      unwrapApiData(result) as ApiRecord,
      this.accessToken ?? undefined,
    );
  }

  // Company endpoints
  async getCompany(companyId: string): Promise<unknown> {
    return this.get(`/company/${companyId}`);
  }

  // QR Code endpoints
  async getQRCodes(params?: Record<string, string>): Promise<unknown> {
    const queryString = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.get(`/qr-code${queryString}`);
  }

  async createQRCode(data: unknown): Promise<unknown> {
    return this.post("/qr-code", data);
  }

  async deleteQRCode(qrCodeId: string, companyId: string): Promise<unknown> {
    return this.request("DELETE", `/qr-code/${qrCodeId}`, { companyId });
  }

  // Project endpoints
  async getProjects(companyId: string): Promise<unknown> {
    const result = await this.get<unknown>(
      `/aggregation/all-projects/${companyId}`,
    );
    return unwrapApiData(result);
  }

  async createProject(data: unknown): Promise<unknown> {
    return this.post("/project", data);
  }

  async deleteProject(projectId: string): Promise<unknown> {
    return this.delete(`/project/${projectId}`);
  }

  // Group endpoints
  async getGroups(params?: Record<string, string>): Promise<unknown> {
    const queryString = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.get(`/groups${queryString}`);
  }

  async createGroup(data: unknown): Promise<unknown> {
    return this.post("/groups", data);
  }

  async deleteGroup(groupId: string): Promise<unknown> {
    return this.delete(`/groups/${groupId}`);
  }
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const getTestConfig = () => {
  const backendUrl = getBackendUrl();

  return {
    backendUrl,
    apiKey: process.env.VITE_TALIHO_API_KEY || "",
    adminUser: {
      email: process.env.E2E_TEST_ADMIN_EMAIL || "e2e-admin@testcompany.com",
      password: process.env.E2E_TEST_ADMIN_PASSWORD || "E2ETestPassword123!",
      firstName: process.env.E2E_TEST_ADMIN_FIRST_NAME || "E2E",
      lastName: process.env.E2E_TEST_ADMIN_LAST_NAME || "Admin",
    },
    pmUser: {
      email: process.env.E2E_TEST_PM_EMAIL || "e2e-pm@testcompany.com",
      password: process.env.E2E_TEST_PM_PASSWORD || "E2ETestPassword123!",
    },
    regularUser: {
      email: process.env.E2E_TEST_USER_EMAIL || "e2e-user@testcompany.com",
      password: process.env.E2E_TEST_USER_PASSWORD || "E2ETestPassword123!",
    },
    testIds: {
      companyId: process.env.E2E_TEST_COMPANY_ID || "",
      projectId: process.env.E2E_TEST_PROJECT_ID || "",
      groupId: process.env.E2E_TEST_GROUP_ID || "",
      qrCodeId: process.env.E2E_TEST_QR_CODE_ID || "",
    },
  };
};

// ============================================================================
// FIXTURE
// ============================================================================

export const test = base.extend<TestFixtures>({
  // eslint-disable-next-line no-empty-pattern
  testUser: async ({}, use) => {
    const config = getTestConfig();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(config.adminUser);
  },

  // eslint-disable-next-line no-empty-pattern
  apiClient: async ({}, use) => {
    const config = getTestConfig();
    const client = new ApiClient(config.backendUrl, config.apiKey);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(client);
  },

  authTokens: async ({ apiClient, testUser }, use) => {
    // Login via API to get tokens and full user data
    const result = await apiClient.login(testUser.email, testUser.password);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use({
      accessToken: result.accessToken,
      user: (result.user as Record<string, unknown>) ?? {},
    });
  },

  authenticatedPage: async ({ page, authTokens }, use) => {
    // Set up authentication in browser using the full user object from the login response
    // (includes _id, companyId, permission, etc. needed by dashboard and other pages)
    await page.addInitScript(
      (data) => {
        window.localStorage.setItem("accessToken", data.accessToken);
        window.localStorage.setItem("user", JSON.stringify(data.user));
      },
      {
        accessToken: authTokens.accessToken,
        user: authTokens.user,
      },
    );

    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wait for the backend to be available
 */
export async function waitForBackend(
  baseUrl: string,
  timeoutMs = 30000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // Backend not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Create test data cleanup function
 */
export function createCleanupFn(apiClient: ApiClient) {
  const createdResources: Array<{
    type: string;
    id: string;
    companyId?: string;
  }> = [];

  return {
    track(type: string, id: string, metadata?: { companyId?: string }) {
      createdResources.push({ type, id, companyId: metadata?.companyId });
    },

    async cleanup() {
      for (const resource of createdResources.reverse()) {
        try {
          switch (resource.type) {
            case "qrCode":
              if (resource.companyId) {
                await apiClient.deleteQRCode(resource.id, resource.companyId);
              }
              break;
            case "project":
              await apiClient.deleteProject(resource.id);
              break;
            case "group":
              await apiClient.deleteGroup(resource.id);
              break;
          }
        } catch (error) {
          console.warn(
            `Failed to cleanup ${resource.type} ${resource.id}:`,
            error,
          );
        }
      }
    },
  };
}
