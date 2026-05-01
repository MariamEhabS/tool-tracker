/**
 * Playwright Global Setup for Real Backend Tests
 *
 * This runs once before all tests to:
 * 1. Verify backend is accessible
 * 2. Verify test credentials work
 * 3. Optionally seed test data
 */

import { FullConfig } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getBackendUrl } from "../utils/runtime-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

const config = {
  backendUrl: getBackendUrl(),
  apiKey: process.env.VITE_TALIHO_API_KEY || "",
  adminEmail: process.env.E2E_TEST_ADMIN_EMAIL || "e2e-admin@testcompany.com",
  adminPassword: process.env.E2E_TEST_ADMIN_PASSWORD || "E2ETestPassword123!",
};

async function globalSetup(_playwrightConfig: FullConfig) {
  console.log("\n🔧 Real Backend E2E Test Setup\n");
  console.log(`Backend URL: ${config.backendUrl}`);
  console.log(`Test User: ${config.adminEmail}\n`);

  // Step 1: Check backend health
  console.log("📝 Step 1: Checking backend health...");
  try {
    const healthResponse = await fetch(`${config.backendUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!healthResponse.ok) {
      throw new Error(`Backend health check failed: ${healthResponse.status}`);
    }
    console.log("   ✅ Backend is healthy\n");
  } catch (error) {
    console.error("   ❌ Backend health check failed");
    console.error("   Make sure the backend is running at:", config.backendUrl);
    throw error;
  }

  // Step 2: Verify test credentials
  console.log("📝 Step 2: Verifying test credentials...");
  try {
    const loginResponse = await fetch(`${config.backendUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        email: config.adminEmail,
        password: config.adminPassword,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${errorText}`);
    }

    const loginData = await loginResponse.json();
    if (!loginData.accessToken) {
      throw new Error("Login response missing accessToken");
    }

    console.log("   ✅ Test credentials verified\n");
  } catch (error) {
    console.error("   ❌ Test credentials verification failed");
    console.error("   Make sure the test user exists:");
    console.error(`   Email: ${config.adminEmail}`);
    console.error(`   Password: ${config.adminPassword}`);
    throw error;
  }

  // Step 3: Verify test IDs exist (if configured)
  const testIds = {
    companyId: process.env.E2E_TEST_COMPANY_ID,
    projectId: process.env.E2E_TEST_PROJECT_ID,
    groupId: process.env.E2E_TEST_GROUP_ID,
    qrCodeId: process.env.E2E_TEST_QR_CODE_ID,
  };

  const hasTestIds = Object.values(testIds).some((id) => id && id.length > 0);

  if (hasTestIds) {
    console.log("📝 Step 3: Test IDs configured");
    console.log(`   Company ID: ${testIds.companyId || "(not set)"}`);
    console.log(`   Project ID: ${testIds.projectId || "(not set)"}`);
    console.log(`   Group ID: ${testIds.groupId || "(not set)"}`);
    console.log(`   QR Code ID: ${testIds.qrCodeId || "(not set)"}\n`);
  } else {
    console.log("📝 Step 3: No test IDs configured");
    console.log(
      "   Run 'npx tsx e2e/seed/seed-test-data.ts' to create test data\n",
    );
  }

  console.log("✅ Global setup complete!\n");
  console.log("═".repeat(60) + "\n");
}

export default globalSetup;
