/**
 * E2E Test Data Cleanup Script
 *
 * This script removes test data created during E2E testing.
 * Run this script after E2E tests complete to clean up the database.
 *
 * Usage:
 *   npx tsx e2e/seed/cleanup-test-data.ts
 *
 * Options:
 *   --all    Clean up ALL test data (projects, groups, QR codes with "E2E" prefix)
 *   --ids    Clean up only the IDs specified in .env.test
 */

import dotenv from "dotenv";
import path from "path";
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
  testIds: {
    companyId: process.env.E2E_TEST_COMPANY_ID || "",
    projectId: process.env.E2E_TEST_PROJECT_ID || "",
    groupId: process.env.E2E_TEST_GROUP_ID || "",
    qrCodeId: process.env.E2E_TEST_QR_CODE_ID || "",
  },
};

// ============================================================================
// API CLIENT
// ============================================================================

class CleanupApiClient {
  private accessToken: string | null = null;

  constructor(private baseUrl: string) {}

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T | null> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Resource already deleted
        }
        const errorText = await response.text();
        throw new Error(`${response.status} - ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const result = await this.request<{ accessToken: string }>(
      "POST",
      "/auth/login",
      { email, password },
    );
    if (result) {
      this.accessToken = result.accessToken;
      console.log("✅ Logged in successfully");
    }
  }

  async getMe(): Promise<{ _id: string; companyID: string }> {
    const result = await this.request<{ _id: string; companyID: string }>(
      "GET",
      "/auth/me",
    );
    return result || { _id: "", companyID: "" };
  }

  async deleteQRCode(qrCodeId: string): Promise<boolean> {
    const result = await this.request("DELETE", `/qr-code/${qrCodeId}`);
    return result !== null;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const result = await this.request("DELETE", `/groups/${groupId}`);
    return result !== null;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const result = await this.request("DELETE", `/project/${projectId}`);
    return result !== null;
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    const result = await this.request("DELETE", `/category/${categoryId}`);
    return result !== null;
  }

  // For --all mode: fetch and delete all E2E prefixed items
  async getQRCodes(
    companyId: string,
  ): Promise<Array<{ _id: string; qrcodeName: string }>> {
    const result = await this.request<{
      data: Array<{ _id: string; qrcodeName: string }>;
    }>("GET", `/qr-code?companyID=${companyId}&limit=1000`);
    return result?.data || [];
  }

  async getProjects(
    companyId: string,
  ): Promise<Array<{ _id: string; projectName: string }>> {
    const result = await this.request<
      Array<{ _id: string; projectName: string }>
    >("GET", `/aggregation/all-projects/${companyId}`);
    return result || [];
  }

  async getGroups(
    companyId: string,
  ): Promise<Array<{ _id: string; groupName: string }>> {
    const result = await this.request<{
      data: Array<{ _id: string; groupName: string }>;
    }>("GET", `/groups?companyID=${companyId}&limit=1000`);
    return result?.data || [];
  }

  async getCategories(
    companyId: string,
  ): Promise<Array<{ _id: string; categoryName: string }>> {
    const result = await this.request<
      Array<{ _id: string; categoryName: string }>
    >("GET", `/category?companyID=${companyId}`);
    return result || [];
  }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

async function cleanupByIds(api: CleanupApiClient): Promise<void> {
  console.log("\n🧹 Cleaning up by specific IDs...\n");

  const { testIds } = config;

  // Delete QR code first
  if (testIds.qrCodeId) {
    console.log(`   Deleting QR code: ${testIds.qrCodeId}`);
    const deleted = await api.deleteQRCode(testIds.qrCodeId);
    console.log(deleted ? "   ✅ QR code deleted" : "   ⚠️ QR code not found");
  }

  // Delete group
  if (testIds.groupId) {
    console.log(`   Deleting group: ${testIds.groupId}`);
    const deleted = await api.deleteGroup(testIds.groupId);
    console.log(deleted ? "   ✅ Group deleted" : "   ⚠️ Group not found");
  }

  // Delete project
  if (testIds.projectId) {
    console.log(`   Deleting project: ${testIds.projectId}`);
    const deleted = await api.deleteProject(testIds.projectId);
    console.log(deleted ? "   ✅ Project deleted" : "   ⚠️ Project not found");
  }
}

async function cleanupAll(api: CleanupApiClient): Promise<void> {
  console.log("\n🧹 Cleaning up ALL E2E test data...\n");

  const user = await api.getMe();
  if (!user.companyID) {
    console.error("Could not get company ID");
    return;
  }

  // Delete QR codes with E2E prefix
  console.log("📝 Finding E2E QR codes...");
  const qrCodes = await api.getQRCodes(user.companyID);
  const e2eQRCodes = qrCodes.filter(
    (qr) =>
      qr.qrcodeName?.startsWith("E2E") || qr.qrcodeName?.includes("E2E Test"),
  );
  console.log(`   Found ${e2eQRCodes.length} E2E QR codes`);

  for (const qr of e2eQRCodes) {
    console.log(`   Deleting: ${qr.qrcodeName}`);
    await api.deleteQRCode(qr._id);
  }

  // Delete groups with E2E prefix
  console.log("\n📝 Finding E2E groups...");
  const groups = await api.getGroups(user.companyID);
  const e2eGroups = groups.filter(
    (g) => g.groupName?.startsWith("E2E") || g.groupName?.includes("E2E Test"),
  );
  console.log(`   Found ${e2eGroups.length} E2E groups`);

  for (const group of e2eGroups) {
    console.log(`   Deleting: ${group.groupName}`);
    await api.deleteGroup(group._id);
  }

  // Delete projects with E2E prefix
  console.log("\n📝 Finding E2E projects...");
  const projects = await api.getProjects(user.companyID);
  const e2eProjects = projects.filter(
    (p) =>
      p.projectName?.startsWith("E2E") || p.projectName?.includes("E2E Test"),
  );
  console.log(`   Found ${e2eProjects.length} E2E projects`);

  for (const project of e2eProjects) {
    console.log(`   Deleting: ${project.projectName}`);
    await api.deleteProject(project._id);
  }

  // Delete categories with E2E prefix
  console.log("\n📝 Finding E2E categories...");
  const categories = await api.getCategories(user.companyID);
  const e2eCategories = categories.filter(
    (c) =>
      c.categoryName?.startsWith("E2E") || c.categoryName?.includes("E2E Test"),
  );
  console.log(`   Found ${e2eCategories.length} E2E categories`);

  for (const category of e2eCategories) {
    console.log(`   Deleting: ${category.categoryName}`);
    await api.deleteCategory(category._id);
  }

  console.log("\n✅ Cleanup complete!");
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const cleanAll = args.includes("--all");

  console.log("\n🧹 E2E Test Data Cleanup\n");
  console.log(`Backend URL: ${config.backendUrl}`);
  console.log(`Mode: ${cleanAll ? "Clean ALL E2E data" : "Clean by IDs"}\n`);

  const api = new CleanupApiClient(config.backendUrl);

  try {
    // Login
    console.log("📝 Logging in as test admin...");
    await api.login(config.adminEmail, config.adminPassword);

    if (cleanAll) {
      await cleanupAll(api);
    } else {
      await cleanupByIds(api);
    }

    console.log("\n✅ Cleanup successful!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  }
}

main();
