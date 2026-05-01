/**
 * Playwright Global Teardown for Real Backend Tests
 *
 * This runs once after all tests to optionally clean up test data.
 * By default, it does NOT clean up data to allow inspection after test runs.
 *
 * Set E2E_CLEANUP_AFTER_TESTS=true in .env.test to enable auto-cleanup.
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
  adminEmail: process.env.E2E_TEST_ADMIN_EMAIL || "e2e-admin@testcompany.com",
  adminPassword: process.env.E2E_TEST_ADMIN_PASSWORD || "E2ETestPassword123!",
  autoCleanup: process.env.E2E_CLEANUP_AFTER_TESTS === "true",
};

async function globalTeardown(_playwrightConfig: FullConfig) {
  console.log("\n═".repeat(60));
  console.log("\n🧹 Real Backend E2E Test Teardown\n");

  if (!config.autoCleanup) {
    console.log("   Auto-cleanup is disabled.");
    console.log("   Test data has been preserved for inspection.\n");
    console.log("   To clean up manually, run:");
    console.log("   npx tsx e2e/seed/cleanup-test-data.ts --all\n");
    console.log(
      "   To enable auto-cleanup, set E2E_CLEANUP_AFTER_TESTS=true in .env.test\n",
    );
    return;
  }

  console.log("   Auto-cleanup is enabled. Cleaning up test data...\n");

  try {
    // Login
    const loginResponse = await fetch(`${config.backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: config.adminEmail,
        password: config.adminPassword,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error("Failed to login for cleanup");
    }

    const { accessToken } = await loginResponse.json();

    // Get user info
    const meResponse = await fetch(`${config.backendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meResponse.ok) {
      throw new Error("Failed to get user info for cleanup");
    }

    const user = await meResponse.json();
    const companyId = user.companyID;

    // Get and delete E2E QR codes
    const qrResponse = await fetch(
      `${config.backendUrl}/qr-code?companyID=${companyId}&limit=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (qrResponse.ok) {
      const qrData = await qrResponse.json();
      const e2eQRCodes = (qrData.data || []).filter(
        (qr: { qrcodeName?: string }) =>
          qr.qrcodeName?.startsWith("E2E") ||
          qr.qrcodeName?.includes("E2E Test"),
      );

      for (const qr of e2eQRCodes) {
        await fetch(`${config.backendUrl}/qr-code/${qr._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      console.log(`   Deleted ${e2eQRCodes.length} E2E QR codes`);
    }

    // Get and delete E2E groups
    const groupsResponse = await fetch(
      `${config.backendUrl}/groups?companyID=${companyId}&limit=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      const e2eGroups = (groupsData.data || []).filter(
        (g: { groupName?: string }) =>
          g.groupName?.startsWith("E2E") || g.groupName?.includes("E2E Test"),
      );

      for (const group of e2eGroups) {
        await fetch(`${config.backendUrl}/groups/${group._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      console.log(`   Deleted ${e2eGroups.length} E2E groups`);
    }

    // Get and delete E2E projects
    const projectsResponse = await fetch(
      `${config.backendUrl}/aggregation/all-projects/${companyId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      const e2eProjects = (projects || []).filter(
        (p: { projectName?: string }) =>
          p.projectName?.startsWith("E2E") ||
          p.projectName?.includes("E2E Test"),
      );

      for (const project of e2eProjects) {
        await fetch(`${config.backendUrl}/project/${project._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      console.log(`   Deleted ${e2eProjects.length} E2E projects`);
    }

    console.log("\n   ✅ Cleanup complete!\n");
  } catch (error) {
    console.error("\n   ⚠️ Cleanup failed:", error);
    console.log("   You can manually clean up with:");
    console.log("   npx tsx e2e/seed/cleanup-test-data.ts --all\n");
  }
}

export default globalTeardown;
