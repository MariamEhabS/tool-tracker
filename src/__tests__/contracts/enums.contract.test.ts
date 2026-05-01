/**
 * Contract Test: Enum Alignment
 *
 * Validates that frontend enum values and union types stay in sync with
 * the backend enum definitions declared in backend-contracts.ts.
 *
 * When the backend adds or removes an enum member, update backend-contracts.ts
 * first, then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend enum definitions.
 */

import { describe, it, expect } from "vitest";

// Backend contract enums (source of truth)
import {
  BackendQRCodeTypeEnum,
  BackendGroupingTypeEnum,
  BackendProcoreToolEnum,
  BackendActivityActionEnum,
  BackendActivityCategoryEnum,
} from "./backend-contracts";

// Frontend types and values
import { type CreateQRCodeDto } from "@api/endpoints/qr-codes";
import {
  type ProcoreToolType,
  PROCORE_TOOL_OPTIONS,
} from "@api/endpoints/categories";
import {
  ActivityActionEnum as FrontendActivityActionEnum,
  ActivityCategoryEnum as FrontendActivityCategoryEnum,
} from "@api/endpoints/activity-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all string values from a TypeScript enum object. */
function enumValues<T extends Record<string, string>>(e: T): string[] {
  return Object.values(e);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Enum Alignment", () => {
  // =========================================================================
  // 1. QRCodeTypeEnum
  // =========================================================================
  describe("QRCodeTypeEnum", () => {
    // The complete set of backend values
    const backendValues = enumValues(BackendQRCodeTypeEnum);

    it("backend enum should contain the expected members", () => {
      expect(backendValues).toEqual(
        expect.arrayContaining([
          "file",
          "folder",
          "url",
          "static",
          "procore-tool",
          "procore-location",
          "procore-drawing-code",
        ]),
      );
      expect(backendValues).toHaveLength(7);
    });

    it("every backend QRCodeType value should be assignable to CreateQRCodeDto.type", () => {
      // Type-level assertion: each backend value satisfies the frontend union.
      // If the frontend union is missing a value this will cause a compile error.
      const _typeCheck: CreateQRCodeDto["type"][] = [
        BackendQRCodeTypeEnum.FILE,
        BackendQRCodeTypeEnum.FOLDER,
        BackendQRCodeTypeEnum.URL,
        BackendQRCodeTypeEnum.STATIC,
        BackendQRCodeTypeEnum.PROCORE_TOOL,
        BackendQRCodeTypeEnum.PROCORE_LOCATION,
        BackendQRCodeTypeEnum.PROCORE_DRAWING_CODE,
      ];

      // Runtime verification that the type-check array matches the full backend set
      expect(_typeCheck.sort()).toEqual([...backendValues].sort());
    });

    it("frontend CreateQRCodeDto.type union should cover all backend values", () => {
      // Exhaustive runtime check: build the expected frontend union values
      // and verify they match the backend enum 1-to-1.
      const frontendTypeValues: CreateQRCodeDto["type"][] = [
        "file",
        "folder",
        "url",
        "static",
        "procore-tool",
        "procore-location",
        "procore-drawing-code",
      ];

      for (const backendVal of backendValues) {
        expect(frontendTypeValues).toContain(backendVal);
      }

      // No extra frontend values that the backend does not know about
      for (const frontendVal of frontendTypeValues) {
        expect(backendValues).toContain(frontendVal);
      }
    });
  });

  // =========================================================================
  // 2. GroupingTypeEnum
  // =========================================================================
  describe("GroupingTypeEnum", () => {
    const backendValues = enumValues(BackendGroupingTypeEnum);

    it("backend enum should contain the expected members", () => {
      expect(backendValues).toEqual(
        expect.arrayContaining([
          "arrangement",
          "equipment",
          "group",
          "procore-drawing-codes",
        ]),
      );
      expect(backendValues).toHaveLength(4);
    });

    it("every backend GroupingType value should be assignable to CreateQRCodeDto.groupingType", () => {
      // Type-level: compile-time proof that the union accepts every backend value
      const _typeCheck: NonNullable<CreateQRCodeDto["groupingType"]>[] = [
        BackendGroupingTypeEnum.ARRANGEMENT,
        BackendGroupingTypeEnum.EQUIPMENT,
        BackendGroupingTypeEnum.GROUP,
        BackendGroupingTypeEnum.PROCORE_DRAWING_CODES,
      ];

      expect(_typeCheck.sort()).toEqual([...backendValues].sort());
    });

    it("frontend groupingType union should cover all backend values", () => {
      const frontendGroupingValues: NonNullable<
        CreateQRCodeDto["groupingType"]
      >[] = ["arrangement", "equipment", "group", "procore-drawing-codes"];

      for (const backendVal of backendValues) {
        expect(frontendGroupingValues).toContain(backendVal);
      }

      for (const frontendVal of frontendGroupingValues) {
        expect(backendValues).toContain(frontendVal);
      }
    });
  });

  // =========================================================================
  // 3. ProcoreToolEnum
  // =========================================================================
  describe("ProcoreToolEnum", () => {
    const backendValues = enumValues(BackendProcoreToolEnum);

    it("backend enum should contain all 17 members", () => {
      expect(backendValues).toHaveLength(17);
      expect(backendValues).toEqual(
        expect.arrayContaining([
          "coordination-issues",
          "directory",
          "documents",
          "drawings",
          "forms",
          "incidents",
          "inspections",
          "instructions",
          "location",
          "none",
          "observations",
          "photos",
          "punch-list",
          "rfis",
          "specifications",
          "submittals",
          "tasks",
        ]),
      );
    });

    it("every backend ProcoreTool value should be assignable to ProcoreToolType", () => {
      // Compile-time proof: each backend enum member satisfies the frontend union
      const _typeCheck: ProcoreToolType[] = [
        BackendProcoreToolEnum.COORDINATION_ISSUES,
        BackendProcoreToolEnum.DIRECTORY,
        BackendProcoreToolEnum.DOCUMENTS,
        BackendProcoreToolEnum.DRAWINGS,
        BackendProcoreToolEnum.FORMS,
        BackendProcoreToolEnum.INCIDENTS,
        BackendProcoreToolEnum.INSPECTIONS,
        BackendProcoreToolEnum.INSTRUCTIONS,
        BackendProcoreToolEnum.LOCATION,
        BackendProcoreToolEnum.NONE,
        BackendProcoreToolEnum.OBSERVATIONS,
        BackendProcoreToolEnum.PHOTOS,
        BackendProcoreToolEnum.PUNCH_LIST,
        BackendProcoreToolEnum.RFIS,
        BackendProcoreToolEnum.SPECIFICATIONS,
        BackendProcoreToolEnum.SUBMITTALS,
        BackendProcoreToolEnum.TASKS,
      ];

      expect(_typeCheck.sort()).toEqual([...backendValues].sort());
    });

    it("frontend ProcoreToolType union should cover all backend values", () => {
      const frontendValues: ProcoreToolType[] = [
        "coordination-issues",
        "directory",
        "documents",
        "drawings",
        "forms",
        "incidents",
        "inspections",
        "instructions",
        "location",
        "none",
        "observations",
        "photos",
        "punch-list",
        "rfis",
        "specifications",
        "submittals",
        "tasks",
      ];

      for (const backendVal of backendValues) {
        expect(frontendValues).toContain(backendVal);
      }

      for (const frontendVal of frontendValues) {
        expect(backendValues).toContain(frontendVal);
      }
    });

    it("PROCORE_TOOL_OPTIONS values should match backend enum (excluding non-selectable tools)", () => {
      // "location" and "none" are not user-selectable tools, so they are
      // intentionally excluded from the dropdown options array.
      const nonSelectableTools: string[] = ["location", "none"];

      const expectedSelectableTools = backendValues.filter(
        (v) => !nonSelectableTools.includes(v),
      );

      const optionValues = PROCORE_TOOL_OPTIONS.map((opt) => opt.value);

      expect(optionValues.sort()).toEqual(expectedSelectableTools.sort());
    });

    it("every PROCORE_TOOL_OPTIONS value should be a valid backend enum value", () => {
      for (const option of PROCORE_TOOL_OPTIONS) {
        expect(backendValues).toContain(option.value);
      }
    });

    it("PROCORE_TOOL_OPTIONS should have a human-readable label for each entry", () => {
      for (const option of PROCORE_TOOL_OPTIONS) {
        expect(option.label).toBeTruthy();
        expect(typeof option.label).toBe("string");
        expect(option.label.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 4. ActivityActionEnum
  // =========================================================================
  describe("ActivityActionEnum", () => {
    const backendValues = enumValues(BackendActivityActionEnum);
    const frontendValues = enumValues(
      FrontendActivityActionEnum as unknown as Record<string, string>,
    );

    it("backend enum should contain all expected members", () => {
      expect(backendValues).toEqual(
        expect.arrayContaining([
          "user_invited",
          "user_removed",
          "user_activated",
          "user_deactivated",
          "role_changed",
          "settings_updated",
          "logo_changed",
          "company_info_updated",
          "password_changed",
          "email_changed",
          "two_factor_enabled",
          "two_factor_disabled",
          "login_success",
          "login_failed",
          "logout",
          "procore_connected",
          "procore_disconnected",
          "procore_user_disconnected",
          "procore_owner_changed",
          "procore_sync_started",
          "procore_sync_completed",
          "stripe_subscription_created",
          "stripe_subscription_updated",
          "stripe_subscription_cancelled",
          "resource_updated",
          "resource_deleted",
          "backfill_executed",
        ]),
      );
    });

    it("every frontend ActivityActionEnum value should exist in the backend", () => {
      for (const frontendVal of frontendValues) {
        expect(backendValues).toContain(frontendVal);
      }
    });

    it("should document known missing actions in the frontend enum", () => {
      // These backend actions are NOT yet represented in the frontend enum.
      // This test tracks the gap so it is visible in test output.
      const knownMissingActions = [
        BackendActivityActionEnum.PROCORE_USER_DISCONNECTED,
        BackendActivityActionEnum.PROCORE_OWNER_CHANGED,
        BackendActivityActionEnum.RESOURCE_UPDATED,
        BackendActivityActionEnum.RESOURCE_DELETED,
        BackendActivityActionEnum.BACKFILL_EXECUTED,
      ];

      for (const missing of knownMissingActions) {
        expect(frontendValues).not.toContain(missing);
      }

      // Ensure these are the ONLY missing values (detect new gaps early)
      const allMissing = backendValues.filter(
        (v) => !frontendValues.includes(v),
      );
      expect(allMissing.sort()).toEqual(knownMissingActions.map(String).sort());
    });

    it("should have the correct values for known missing backend actions", () => {
      // Verify the string values of the known missing actions so that
      // when the frontend adds support, the values will be correct.
      expect(BackendActivityActionEnum.PROCORE_USER_DISCONNECTED).toBe(
        "procore_user_disconnected",
      );
      expect(BackendActivityActionEnum.PROCORE_OWNER_CHANGED).toBe(
        "procore_owner_changed",
      );
      expect(BackendActivityActionEnum.RESOURCE_UPDATED).toBe(
        "resource_updated",
      );
      expect(BackendActivityActionEnum.RESOURCE_DELETED).toBe(
        "resource_deleted",
      );
      expect(BackendActivityActionEnum.BACKFILL_EXECUTED).toBe(
        "backfill_executed",
      );
    });
  });

  // =========================================================================
  // 5. ActivityCategoryEnum
  // =========================================================================
  describe("ActivityCategoryEnum", () => {
    const backendValues = enumValues(BackendActivityCategoryEnum);
    const frontendValues = enumValues(
      FrontendActivityCategoryEnum as unknown as Record<string, string>,
    );

    it("backend enum should contain all expected members", () => {
      expect(backendValues).toEqual(
        expect.arrayContaining([
          "users",
          "settings",
          "security",
          "integrations",
          "admin",
          "groups",
          "qr_codes",
          "projects",
          "documents",
          "folders",
          "procore_items",
          "categories",
        ]),
      );
      expect(backendValues).toHaveLength(12);
    });

    it("every frontend ActivityCategoryEnum value should exist in the backend", () => {
      for (const frontendVal of frontendValues) {
        expect(backendValues).toContain(frontendVal);
      }
    });

    it("frontend should define the original four categories", () => {
      expect(frontendValues).toContain("users");
      expect(frontendValues).toContain("settings");
      expect(frontendValues).toContain("security");
      expect(frontendValues).toContain("integrations");
      expect(frontendValues).toHaveLength(4);
    });

    it("should document known missing categories in the frontend enum", () => {
      // These backend categories are NOT yet represented in the frontend enum.
      // This test tracks the gap so it is visible in test output.
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

      for (const missing of knownMissingCategories) {
        expect(frontendValues).not.toContain(missing);
      }

      // Ensure these are the ONLY missing values (detect new gaps early)
      const allMissing = backendValues.filter(
        (v) => !frontendValues.includes(v),
      );
      expect(allMissing.sort()).toEqual(
        knownMissingCategories.map(String).sort(),
      );
    });

    it("should have the correct values for known missing backend categories", () => {
      // Verify the string values of the known missing categories so that
      // when the frontend adds support, the values will be correct.
      expect(BackendActivityCategoryEnum.ADMIN).toBe("admin");
      expect(BackendActivityCategoryEnum.GROUPS).toBe("groups");
      expect(BackendActivityCategoryEnum.QR_CODES).toBe("qr_codes");
      expect(BackendActivityCategoryEnum.PROJECTS).toBe("projects");
      expect(BackendActivityCategoryEnum.DOCUMENTS).toBe("documents");
      expect(BackendActivityCategoryEnum.FOLDERS).toBe("folders");
      expect(BackendActivityCategoryEnum.PROCORE_ITEMS).toBe("procore_items");
      expect(BackendActivityCategoryEnum.CATEGORIES).toBe("categories");
    });
  });
});
