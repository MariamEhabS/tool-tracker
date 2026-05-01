/**
 * Tests for GHL CRM API endpoints
 * Tests migration, diagnostics, backfill counts, and user creation functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/rollbar", () => ({
  rollbar: {
    error: vi.fn(),
    warning: vi.fn(),
    critical: vi.fn(),
  },
  ErrorCategories: {
    QR_CODE: "qr-code",
    JOB: "job",
    API: "api",
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  migrateAllToGhl,
  migrateProductionSampleToGhl,
  getDevGhlSampleSelection,
  migrateDevSampleToGhl,
  getGhlFieldsDiagnostics,
  getRawGhlOpportunityFieldsDiagnostics,
  updateGhlCountsDiagnostics,
  backfillGhlCounts,
  submitToGhl,
} from "./ghl";
import { rollbar } from "@/utils/rollbar";
import { logger } from "@/utils/logger";

describe("GHL API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== migrateAllToGhl ====================

  describe("migrateAllToGhl", () => {
    it("should send POST request to /ghl/migrate-all", async () => {
      const mockResponse = {
        success: true,
        message: "Migration completed",
        data: {
          businessesMigrated: 10,
          contactsMigrated: 25,
          errorsCount: 0,
          errors: [],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await migrateAllToGhl();

      expect(mockPost).toHaveBeenCalledWith("/ghl/migrate-all");
      expect(result).toEqual(mockResponse);
    });

    it("should return response with opportunitiesUpserted field", async () => {
      const mockResponse = {
        success: true,
        message: "OK",
        data: {
          businessesMigrated: 5,
          contactsMigrated: 10,
          opportunitiesUpserted: 3,
          errorsCount: 0,
          errors: [],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await migrateAllToGhl();

      expect(result.data.opportunitiesUpserted).toBe(3);
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      await expect(migrateAllToGhl()).rejects.toThrow("Server Error");

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-migrate-all-failed",
      });
    });

    it("should re-throw the original error", async () => {
      const error = { response: { status: 500 } };
      mockPost.mockRejectedValue(error);

      await expect(migrateAllToGhl()).rejects.toEqual(error);
    });

    it("should wrap non-Error values before passing to rollbar", async () => {
      mockPost.mockRejectedValue("string error");

      await expect(migrateAllToGhl()).rejects.toBe("string error");

      expect(rollbar.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ action: "ghl-migrate-all-failed" }),
      );
    });
  });

  // ==================== migrateProductionSampleToGhl ====================

  describe("migrateProductionSampleToGhl", () => {
    it("should send POST request to /ghl/migrate-sample", async () => {
      const mockResponse = {
        success: true,
        message: "Sample migration completed",
        data: {
          businessesMigrated: 3,
          contactsMigrated: 8,
          errorsCount: 0,
          errors: [],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await migrateProductionSampleToGhl();

      expect(mockPost).toHaveBeenCalledWith("/ghl/migrate-sample");
      expect(result).toEqual(mockResponse);
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Forbidden");
      mockPost.mockRejectedValue(error);

      await expect(migrateProductionSampleToGhl()).rejects.toThrow("Forbidden");

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-migrate-sample-failed",
      });
    });
  });

  // ==================== getDevGhlSampleSelection ====================

  describe("getDevGhlSampleSelection", () => {
    it("should send GET request to /ghl/dev/sample-selection", async () => {
      const mockResponse = {
        success: true,
        message: "Sample selection retrieved",
        data: {
          enabled: true,
          description: "3 companies selected",
          selectedCompanies: [
            {
              companyId: "c-1",
              companyName: "Company 1",
              usersCount: 5,
              score: 80,
              hasGhlBusinessId: false,
            },
          ],
        },
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getDevGhlSampleSelection();

      expect(mockGet).toHaveBeenCalledWith("/ghl/dev/sample-selection");
      expect(result).toEqual(mockResponse);
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Not Found");
      mockGet.mockRejectedValue(error);

      await expect(getDevGhlSampleSelection()).rejects.toThrow("Not Found");

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-dev-sample-selection-failed",
      });
    });
  });

  // ==================== migrateDevSampleToGhl ====================

  describe("migrateDevSampleToGhl", () => {
    it("should send POST request to /ghl/dev/migrate-sample", async () => {
      const mockResponse = {
        success: true,
        message: "Dev sample migration completed",
        data: {
          businessesMigrated: 3,
          contactsMigrated: 7,
          errorsCount: 1,
          errors: ["Failed to migrate user@example.com"],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await migrateDevSampleToGhl();

      expect(mockPost).toHaveBeenCalledWith("/ghl/dev/migrate-sample");
      expect(result).toEqual(mockResponse);
    });

    it("should handle error objects in errors array", async () => {
      const mockResponse = {
        success: true,
        message: "OK",
        data: {
          businessesMigrated: 2,
          contactsMigrated: 5,
          errorsCount: 1,
          errors: [{ message: "Duplicate contact", entity: "user@test.com" }],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await migrateDevSampleToGhl();

      expect(result.data.errors[0]).toEqual({
        message: "Duplicate contact",
        entity: "user@test.com",
      });
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      await expect(migrateDevSampleToGhl()).rejects.toThrow("Server Error");

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-dev-migrate-sample-failed",
      });
    });
  });

  // ==================== getGhlFieldsDiagnostics ====================

  describe("getGhlFieldsDiagnostics", () => {
    it("should send GET request to /ghl/diagnostics/fields", async () => {
      const mockResponse = {
        success: true,
        message: "Diagnostics retrieved",
        data: {
          module: "Businesses",
          apiVersionUsed: "2021-07-28",
          expectedApiNames: ["name", "taliho_id"],
          expectedFields: [
            {
              apiName: "name",
              exists: true,
              dataType: "text",
            },
          ],
          qrRelatedFields: [
            {
              apiName: "qr_codes_created",
              fieldLabel: "QR Codes Created",
              dataType: "integer",
            },
          ],
        },
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getGhlFieldsDiagnostics();

      expect(mockGet).toHaveBeenCalledWith("/ghl/diagnostics/fields");
      expect(result).toEqual(mockResponse);
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Diagnostics failed");
      mockGet.mockRejectedValue(error);

      await expect(getGhlFieldsDiagnostics()).rejects.toThrow(
        "Diagnostics failed",
      );

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-fields-diagnostics-failed",
      });
    });
  });

  describe("getRawGhlOpportunityFieldsDiagnostics", () => {
    it("should send GET request to /ghl/diagnostics/opportunity-fields-raw", async () => {
      const mockResponse = {
        success: true,
        message: "GHL raw opportunity field diagnostics",
        data: {
          locationId: "loc-1",
          fetchedAt: "2026-03-31T00:00:00.000Z",
          expectedFieldKeys: ["opportunity.account_status"],
          sources: [
            {
              source: "opportunity_object_key",
              supported: true,
              count: 1,
            },
          ],
          resolvedFields: [
            {
              key: "opportunity.account_status",
              resolvedId: "uuid-1",
              usesFallbackId: false,
            },
          ],
          opportunityObjectFields: [],
          legacyRelevantFields: [],
        },
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getRawGhlOpportunityFieldsDiagnostics();

      expect(mockGet).toHaveBeenCalledWith(
        "/ghl/diagnostics/opportunity-fields-raw",
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ==================== updateGhlCountsDiagnostics ====================

  describe("updateGhlCountsDiagnostics", () => {
    it("should send POST request with companyId in URL", async () => {
      const mockResponse = {
        success: true,
        message: "Counts updated",
        data: {
          enabled: true,
          companyId: "company-456",
          ghlBusinessId: "ghl-biz-123",
          ghlBusinessIdSource: "stored" as const,
          counts: {
            projectsCount: 5,
            qrGroupsCount: 3,
            usersCount: 10,
            qrCodesCount: 100,
            qrScansCount: 500,
          },
          sentFields: { qr_codes_created: 100 },
          ghlResponseFirstItem: null,
          ok: true,
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await updateGhlCountsDiagnostics("company-456");

      expect(mockPost).toHaveBeenCalledWith(
        "/ghl/diagnostics/update-counts/company-456",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should trim companyId whitespace", async () => {
      mockPost.mockResolvedValue({
        data: {
          success: true,
          message: "OK",
          data: {
            enabled: true,
            companyId: "company-456",
            ghlBusinessId: null,
            ghlBusinessIdSource: "none",
            counts: null,
            sentFields: null,
            ghlResponseFirstItem: null,
            ok: false,
          },
        },
      });

      await updateGhlCountsDiagnostics("  company-456  ");

      expect(mockPost).toHaveBeenCalledWith(
        "/ghl/diagnostics/update-counts/company-456",
      );
    });

    it("should throw for empty companyId", async () => {
      await expect(updateGhlCountsDiagnostics("")).rejects.toThrow(
        "Invalid companyId",
      );

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("should throw for whitespace-only companyId", async () => {
      await expect(updateGhlCountsDiagnostics("   ")).rejects.toThrow(
        "Invalid companyId",
      );

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("should log to rollbar with metadata on API error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      await expect(updateGhlCountsDiagnostics("company-456")).rejects.toThrow(
        "Server Error",
      );

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-update-counts-diagnostics-failed",
        metadata: { companyId: "company-456" },
      });
    });

    it("should not log to rollbar for client-side validation error", async () => {
      await expect(updateGhlCountsDiagnostics("")).rejects.toThrow();

      expect(rollbar.error).not.toHaveBeenCalled();
    });
  });

  // ==================== backfillGhlCounts ====================

  describe("backfillGhlCounts", () => {
    it("should send POST request with confirm payload", async () => {
      const mockResponse = {
        success: true,
        message: "Backfill completed",
        data: {
          success: true,
          processed: 50,
          updated: 45,
          skipped: 5,
          errors: [],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = { confirm: true as const };

      const result = await backfillGhlCounts(payload);

      expect(mockPost).toHaveBeenCalledWith("/ghl/backfill-counts", payload);
      expect(result).toEqual(mockResponse);
    });

    it("should pass companyIds when provided", async () => {
      mockPost.mockResolvedValue({
        data: {
          success: true,
          message: "OK",
          data: {
            success: true,
            processed: 2,
            updated: 2,
            skipped: 0,
            errors: [],
          },
        },
      });

      const payload = {
        companyIds: ["c-1", "c-2"],
        confirm: true as const,
      };

      await backfillGhlCounts(payload);

      expect(mockPost).toHaveBeenCalledWith("/ghl/backfill-counts", payload);
    });

    it("should pass limit when provided", async () => {
      mockPost.mockResolvedValue({
        data: {
          success: true,
          message: "OK",
          data: {
            success: true,
            processed: 10,
            updated: 10,
            skipped: 0,
            errors: [],
          },
        },
      });

      const payload = { limit: 10, confirm: true as const };

      await backfillGhlCounts(payload);

      expect(mockPost).toHaveBeenCalledWith("/ghl/backfill-counts", payload);
    });

    it("should pass createMissing when provided", async () => {
      mockPost.mockResolvedValue({
        data: {
          success: true,
          message: "OK",
          data: {
            success: true,
            processed: 5,
            updated: 5,
            skipped: 0,
            errors: [],
          },
        },
      });

      const payload = { createMissing: true, confirm: true as const };

      await backfillGhlCounts(payload);

      expect(mockPost).toHaveBeenCalledWith("/ghl/backfill-counts", payload);
    });

    it("should log to rollbar with metadata on error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      const payload = {
        companyIds: ["c-1", "c-2", "c-3"],
        limit: 5,
        confirm: true as const,
      };

      await expect(backfillGhlCounts(payload)).rejects.toThrow("Server Error");

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-backfill-counts-failed",
        metadata: { limit: 5, companyIdsCount: 3 },
      });
    });

    it("should handle undefined companyIds in metadata", async () => {
      const error = new Error("Error");
      mockPost.mockRejectedValue(error);

      await expect(backfillGhlCounts({ confirm: true })).rejects.toThrow(
        "Error",
      );

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-backfill-counts-failed",
        metadata: { limit: undefined, companyIdsCount: undefined },
      });
    });

    it("should return errors in response data", async () => {
      const mockResponse = {
        success: true,
        message: "Completed with errors",
        data: {
          success: true,
          processed: 3,
          updated: 2,
          skipped: 0,
          errors: [{ companyId: "c-3", message: "GHL API rate limit" }],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await backfillGhlCounts({ confirm: true });

      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0].message).toBe("GHL API rate limit");
    });
  });

  // ==================== submitToGhl ====================

  describe("submitToGhl", () => {
    it("should send POST request with user data", async () => {
      mockPost.mockResolvedValue({
        status: 200,
        data: { success: true, message: "User created in GHL" },
      });

      const userData = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      };

      const result = await submitToGhl(userData);

      expect(mockPost).toHaveBeenCalledWith("/ghl/create-user", {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });
      expect(result).toEqual({
        success: true,
        message: "User created in GHL",
      });
    });

    it("should return undefined when status is not 200", async () => {
      mockPost.mockResolvedValue({
        status: 201,
        data: { success: true },
      });

      const result = await submitToGhl({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });

      expect(result).toBeUndefined();
    });

    it("should not throw on error (swallows the error)", async () => {
      mockPost.mockRejectedValue(new Error("Server Error"));

      const result = await submitToGhl({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });

      expect(result).toBeUndefined();
    });

    it("should log to logger on error", async () => {
      const error = new Error("Network Error");
      mockPost.mockRejectedValue(error);

      await submitToGhl({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });

      expect(logger.error).toHaveBeenCalledWith(
        "GHL submission failed:",
        error,
      );
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("API Error");
      mockPost.mockRejectedValue(error);

      await submitToGhl({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });

      expect(rollbar.error).toHaveBeenCalledWith(error, {
        feature: "api",
        action: "ghl-create-user-failed",
      });
    });

    it("should wrap non-Error values before passing to rollbar", async () => {
      mockPost.mockRejectedValue("string error");

      await submitToGhl({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });

      expect(rollbar.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ action: "ghl-create-user-failed" }),
      );
    });
  });
});
