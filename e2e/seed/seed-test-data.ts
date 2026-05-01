/**
 * E2E Test Data Seeding Script
 *
 * This script creates the test data required for running E2E tests against a real backend.
 * Run this script before executing real backend tests.
 *
 * Usage:
 *   npx tsx e2e/seed/seed-test-data.ts
 *
 * Prerequisites:
 *   1. Backend server running at VITE_BACKEND_URL
 *   2. .env.test file configured with test credentials
 *   3. Test admin user already registered in the system
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { getBackendUrl } from "../utils/runtime-env";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  backendUrl: getBackendUrl(),
  adminEmail: process.env.E2E_TEST_ADMIN_EMAIL || "e2e-admin@testcompany.com",
  adminPassword: process.env.E2E_TEST_ADMIN_PASSWORD || "E2ETestPassword123!",
  adminFirstName: process.env.E2E_TEST_ADMIN_FIRST_NAME || "E2E",
  adminLastName: process.env.E2E_TEST_ADMIN_LAST_NAME || "Admin",
  companyName: process.env.E2E_TEST_COMPANY_NAME || "E2E Test Company",
  companyAddress: process.env.E2E_TEST_COMPANY_ADDRESS || "123 Test Street",
  companyCity: process.env.E2E_TEST_COMPANY_CITY || "San Francisco",
  companyState: process.env.E2E_TEST_COMPANY_STATE || "CA",
  companyZip: process.env.E2E_TEST_COMPANY_ZIP || "94102",
};

// ============================================================================
// API CLIENT
// ============================================================================

class SeedApiClient {
  private accessToken: string | null = null;
  private apiKey: string;

  constructor(
    private baseUrl: string,
    apiKey: string,
  ) {
    this.apiKey = apiKey;
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
        `API ${method} ${endpoint} failed: ${response.status} - ${errorText}`,
      );
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async login(email: string, password: string): Promise<void> {
    const result = await this.request<{ accessToken: string }>(
      "POST",
      "/auth/login",
      { email, password },
    );
    this.accessToken = result.accessToken;
    console.log("✅ Logged in successfully");
  }

  async getMe(): Promise<{ _id: string; companyID: string }> {
    return this.request("GET", "/auth/me");
  }

  async createProject(data: {
    projectName: string;
    projectStatus?: string;
    companyID: string;
  }): Promise<{ _id: string }> {
    return this.request("POST", "/project", data);
  }

  async createGroup(data: {
    groupName: string;
    projectID: string;
    companyID: string;
  }): Promise<{ _id: string }> {
    return this.request("POST", "/groups", data);
  }

  async createQRCode(data: {
    qrcodeName: string;
    project: string;
    companyID: string;
    groupID?: string;
  }): Promise<{ _id: string; data?: { _id: string } }> {
    return this.request("POST", "/qr-code", data);
  }

  async createCategory(data: {
    categoryName: string;
    color: string;
    companyID: string;
  }): Promise<{ _id: string }> {
    return this.request("POST", "/category", data);
  }

  async getCompany(companyId: string): Promise<unknown> {
    return this.request("GET", `/company/${companyId}`);
  }
}

// ============================================================================
// SEED DATA
// ============================================================================

interface SeededData {
  userId: string;
  companyId: string;
  projectId: string;
  groupId: string;
  qrCodeId: string;
  categoryIds: string[];
}

async function seedTestData(): Promise<SeededData> {
  console.log("\n🌱 Starting E2E Test Data Seeding...\n");
  console.log(`Backend URL: ${config.backendUrl}`);
  console.log(`Admin Email: ${config.adminEmail}\n`);

  const api = new SeedApiClient(
    config.backendUrl,
    process.env.VITE_TALIHO_API_KEY || "",
  );

  // Step 1: Login as admin
  console.log("📝 Step 1: Logging in as test admin...");
  await api.login(config.adminEmail, config.adminPassword);

  // Step 2: Get user info
  console.log("📝 Step 2: Getting user info...");
  const user = await api.getMe();
  console.log(`   User ID: ${user._id}`);
  console.log(`   Company ID: ${user.companyID}`);

  // Step 3: Create test project
  console.log("📝 Step 3: Creating test project...");
  const project = await api.createProject({
    projectName: "E2E Test Project",
    projectStatus: "active",
    companyID: user.companyID,
  });
  console.log(`   ✅ Created project: ${project._id}`);

  // Step 4: Create test group
  console.log("📝 Step 4: Creating test group...");
  const group = await api.createGroup({
    groupName: "E2E Test Group",
    projectID: project._id,
    companyID: user.companyID,
  });
  console.log(`   ✅ Created group: ${group._id}`);

  // Step 5: Create test QR code
  console.log("📝 Step 5: Creating test QR code...");
  const qrCode = await api.createQRCode({
    qrcodeName: "E2E Test QR Code",
    project: project._id,
    companyID: user.companyID,
    groupID: group._id,
  });
  const qrCodeId = qrCode.data?._id || qrCode._id;
  console.log(`   ✅ Created QR code: ${qrCodeId}`);

  // Step 6: Create test categories
  console.log("📝 Step 6: Creating test categories...");
  const categories = [
    { categoryName: "E2E Electrical", color: "#3B82F6" },
    { categoryName: "E2E HVAC", color: "#10B981" },
    { categoryName: "E2E Plumbing", color: "#F59E0B" },
  ];

  const categoryIds: string[] = [];
  for (const cat of categories) {
    try {
      const category = await api.createCategory({
        ...cat,
        companyID: user.companyID,
      });
      categoryIds.push(category._id);
      console.log(`   ✅ Created category: ${cat.categoryName}`);
    } catch (_error) {
      console.log(`   ⚠️ Category may already exist: ${cat.categoryName}`);
    }
  }

  const seededData: SeededData = {
    userId: user._id,
    companyId: user.companyID,
    projectId: project._id,
    groupId: group._id,
    qrCodeId,
    categoryIds,
  };

  // Update .env.test with seeded IDs
  await updateEnvFile(seededData);

  console.log("\n✅ Seeding complete!\n");
  console.log("Seeded Data:");
  console.log(JSON.stringify(seededData, null, 2));

  return seededData;
}

// ============================================================================
// UPDATE ENV FILE
// ============================================================================

async function updateEnvFile(data: SeededData): Promise<void> {
  const envPath = path.resolve(__dirname, "../../.env.test");

  try {
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Update the IDs in the env file
    envContent = envContent.replace(
      /E2E_TEST_COMPANY_ID=".*"/,
      `E2E_TEST_COMPANY_ID="${data.companyId}"`,
    );
    envContent = envContent.replace(
      /E2E_TEST_PROJECT_ID=".*"/,
      `E2E_TEST_PROJECT_ID="${data.projectId}"`,
    );
    envContent = envContent.replace(
      /E2E_TEST_GROUP_ID=".*"/,
      `E2E_TEST_GROUP_ID="${data.groupId}"`,
    );
    envContent = envContent.replace(
      /E2E_TEST_QR_CODE_ID=".*"/,
      `E2E_TEST_QR_CODE_ID="${data.qrCodeId}"`,
    );

    fs.writeFileSync(envPath, envContent);
    console.log("\n📝 Updated .env.test with seeded IDs");
  } catch (error) {
    console.warn("⚠️ Could not update .env.test file:", error);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    await seedTestData();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
