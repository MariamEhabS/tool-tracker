/**
 * Contract Test: Response Shapes
 *
 * Validates that the frontend response type definitions match the backend's
 * standard response shapes declared in backend-contracts.ts.
 *
 * These tests use runtime shape checking on mock objects and compile-time
 * `satisfies` assertions to catch structural mismatches between frontend
 * response types and backend response DTOs.
 *
 * When the backend changes a response shape, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend response definitions.
 */

import { describe, it, expect } from "vitest";

// Backend contract response types (source of truth)
import {
  type BackendPaginatedResponseDto,
  type BackendSingleResponseDto,
  type BackendMultipleResponseDto,
} from "./backend-contracts";

// Frontend response types
import { type PaginatedGroupsResponse } from "@api/endpoints/groups";
import { type ProjectsResponse } from "@api/endpoints/projects";
import { type PaginatedActivityLogResponse } from "@api/endpoints/activity-log";
import {
  type SingleQRCodeResponseDto,
  type MultipleQRCodeResponseDto,
} from "@api/endpoints/qr-codes";
import { type Category } from "@api/endpoints/categories";
import { type Company } from "../../types";
import { type UserRecord } from "@api/endpoints/user";
import {
  type SingleProcoreItemResponseDto,
  type MultipleProcoreItemResponseDto,
} from "@api/endpoints/procore-item";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The field names every paginated backend response must include. */
const PAGINATED_RESPONSE_FIELDS = [
  "success_message",
  "total_pages",
  "current_page",
  "total_items",
  "has_next",
  "has_prev",
  "data",
] as const;

/**
 * Build a mock paginated response with the correct shape.
 * Useful for runtime field-presence checks.
 */
function buildMockPaginatedResponse<T>(data: T[]): {
  success_message: string;
  total_pages: number;
  current_page: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  data: T[];
} {
  return {
    success_message: "Success",
    total_pages: 5,
    current_page: 1,
    total_items: 50,
    has_next: true,
    has_prev: false,
    data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Response Shapes", () => {
  // =========================================================================
  // 1. Paginated responses include all backend pagination fields
  // =========================================================================
  describe("Paginated responses include all backend pagination fields", () => {
    it("PaginatedGroupsResponse has every required pagination field", () => {
      const mock = buildMockPaginatedResponse([
        { _id: "g1", groupName: "Group 1" },
      ]);

      // Runtime: verify every expected field exists
      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      // Compile-time: the mock satisfies the frontend type
      const _frontendCheck: PaginatedGroupsResponse = {
        ...mock,
        data: [{ _id: "g1", groupName: "Group 1" }],
      };
      expect(_frontendCheck).toBeDefined();
    });

    it("ProjectsResponse has every required pagination field", () => {
      const mock = buildMockPaginatedResponse([
        {
          _id: "p1",
          projectName: "Project 1",
          projectCity: "NYC",
          projectState: "NY",
          projectZIP: "10001",
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      // Compile-time: the mock satisfies the frontend type
      const _frontendCheck: ProjectsResponse = {
        ...mock,
        data: mock.data as ProjectsResponse["data"],
      };
      expect(_frontendCheck).toBeDefined();
    });

    it("PaginatedActivityLogResponse has every required pagination field", () => {
      const mock = buildMockPaginatedResponse([
        {
          _id: "a1",
          companyId: "c1",
          userId: "u1",
          userName: "Test User",
          action: "login_success",
          category: "security",
          details: {},
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      // Compile-time: the mock satisfies the frontend type
      const _frontendCheck: PaginatedActivityLogResponse = {
        ...mock,
        data: mock.data as PaginatedActivityLogResponse["data"],
      };
      expect(_frontendCheck).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Paginated response field types are correct
  // =========================================================================
  describe("Paginated response field types are correct", () => {
    it("success_message is string", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.success_message).toBe("string");
    });

    it("total_pages is number", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.total_pages).toBe("number");
    });

    it("current_page is number", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.current_page).toBe("number");
    });

    it("total_items is number", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.total_items).toBe("number");
    });

    it("has_next is boolean", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.has_next).toBe("boolean");
    });

    it("has_prev is boolean", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(typeof mock.has_prev).toBe("boolean");
    });

    it("data is array", () => {
      const mock = buildMockPaginatedResponse([]);
      expect(Array.isArray(mock.data)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Type compatibility check
  // =========================================================================
  describe("Type compatibility check", () => {
    it("PaginatedGroupsResponse structurally satisfies BackendPaginatedResponseDto", () => {
      // Create an object that satisfies both the frontend and backend types.
      // If either type changes incompatibly, this will produce a compile error.
      const response = {
        success_message: "Groups loaded",
        total_pages: 3,
        current_page: 1,
        total_items: 25,
        has_next: true,
        has_prev: false,
        data: [{ _id: "g1", groupName: "Group A" }],
      } satisfies PaginatedGroupsResponse;

      // The same object must also satisfy the backend generic shape
      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        groupName?: string;
      }> = response;

      expect(_backendCheck.success_message).toBe("Groups loaded");
      expect(_backendCheck.total_pages).toBe(3);
      expect(_backendCheck.current_page).toBe(1);
      expect(_backendCheck.total_items).toBe(25);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(false);
      expect(_backendCheck.data).toHaveLength(1);
    });

    it("ProjectsResponse structurally satisfies BackendPaginatedResponseDto", () => {
      const response = {
        success_message: "Projects loaded",
        total_pages: 2,
        current_page: 1,
        total_items: 15,
        has_next: true,
        has_prev: false,
        data: [
          {
            _id: "p1",
            projectName: "Test Project",
            projectCity: "Boston",
            projectState: "MA",
            projectZIP: "02101",
          },
        ],
      } satisfies ProjectsResponse;

      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        projectName?: string;
      }> = response;

      expect(_backendCheck.success_message).toBe("Projects loaded");
      expect(_backendCheck.total_pages).toBe(2);
      expect(_backendCheck.data).toHaveLength(1);
    });

    it("PaginatedActivityLogResponse structurally satisfies BackendPaginatedResponseDto", () => {
      const response = {
        success_message: "Activity log loaded",
        total_pages: 10,
        current_page: 2,
        total_items: 200,
        has_next: true,
        has_prev: true,
        data: [
          {
            _id: "al1",
            companyId: "c1",
            userId: "u1",
            userName: "Admin User",
            action: "login_success" as const,
            category: "security" as const,
            details: {},
            createdAt: "2026-01-15T12:00:00Z",
          },
        ],
      } satisfies PaginatedActivityLogResponse;

      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        companyId: string;
      }> = response;

      expect(_backendCheck.success_message).toBe("Activity log loaded");
      expect(_backendCheck.total_pages).toBe(10);
      expect(_backendCheck.current_page).toBe(2);
      expect(_backendCheck.total_items).toBe(200);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(true);
      expect(_backendCheck.data).toHaveLength(1);
    });

    it("BackendSingleResponseDto shape has success_message and data fields", () => {
      const response: BackendSingleResponseDto<{ _id: string }> = {
        success_message: "Item found",
        data: { _id: "item1" },
      };

      expect(response).toHaveProperty("success_message");
      expect(response).toHaveProperty("data");
      expect(typeof response.success_message).toBe("string");
      // data can be T or null
      expect(response.data).not.toBeNull();
    });

    it("BackendSingleResponseDto allows null data", () => {
      const response: BackendSingleResponseDto<{ _id: string }> = {
        success_message: "Not found",
        data: null,
      };

      expect(response.success_message).toBe("Not found");
      expect(response.data).toBeNull();
    });

    it("BackendMultipleResponseDto shape has success_message, total_items, and data fields", () => {
      const response: BackendMultipleResponseDto<{ _id: string }> = {
        success_message: "Items loaded",
        total_items: 3,
        data: [{ _id: "a" }, { _id: "b" }, { _id: "c" }],
      };

      expect(response).toHaveProperty("success_message");
      expect(response).toHaveProperty("total_items");
      expect(response).toHaveProperty("data");
      expect(typeof response.success_message).toBe("string");
      expect(typeof response.total_items).toBe("number");
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(3);
    });

    it("all three frontend paginated types share the same field set", () => {
      // This test ensures that all frontend paginated responses use
      // the same set of pagination fields, preventing one type from
      // accidentally diverging from the others.
      type KeysOf<T> = keyof T;

      type GroupKeys = KeysOf<PaginatedGroupsResponse>;
      type ProjectKeys = KeysOf<ProjectsResponse>;
      type ActivityLogKeys = KeysOf<PaginatedActivityLogResponse>;

      // Build sample objects and verify they all have the same keys
      const groupSample: Record<string, unknown> = buildMockPaginatedResponse(
        [],
      );
      const projectSample: Record<string, unknown> = buildMockPaginatedResponse(
        [],
      );
      const activitySample: Record<string, unknown> =
        buildMockPaginatedResponse([]);

      const groupKeySet = Object.keys(groupSample).sort();
      const projectKeySet = Object.keys(projectSample).sort();
      const activityKeySet = Object.keys(activitySample).sort();

      expect(groupKeySet).toEqual(projectKeySet);
      expect(projectKeySet).toEqual(activityKeySet);

      // Compile-time: ensure each type's keys are a superset of the
      // standard pagination fields. This will fail to compile if any
      // of the types removes a required field.
      const _groupFieldCheck: Record<GroupKeys, unknown> = {
        success_message: "",
        total_pages: 0,
        current_page: 0,
        total_items: 0,
        has_next: false,
        has_prev: false,
        data: [],
      };
      const _projectFieldCheck: Record<ProjectKeys, unknown> = {
        success_message: "",
        total_pages: 0,
        current_page: 0,
        total_items: 0,
        has_next: false,
        has_prev: false,
        data: [],
      };
      const _activityFieldCheck: Record<ActivityLogKeys, unknown> = {
        success_message: "",
        total_pages: 0,
        current_page: 0,
        total_items: 0,
        has_next: false,
        has_prev: false,
        data: [],
      };

      expect(_groupFieldCheck).toBeDefined();
      expect(_projectFieldCheck).toBeDefined();
      expect(_activityFieldCheck).toBeDefined();
    });
  });

  // =========================================================================
  // 4. QR Codes response shapes
  // =========================================================================
  describe("QR Codes response shapes", () => {
    it("SingleQRCodeResponseDto structurally satisfies BackendSingleResponseDto", () => {
      const response = {
        success_message: "QR code loaded",
        data: {
          _id: "qr1",
          groupingType: "arrangement",
        },
      } satisfies SingleQRCodeResponseDto;

      const _backendCheck: BackendSingleResponseDto<{ _id: string }> = response;

      expect(_backendCheck).toHaveProperty("success_message");
      expect(_backendCheck).toHaveProperty("data");
      expect(typeof _backendCheck.success_message).toBe("string");
      expect(_backendCheck.data).not.toBeNull();
    });

    it("MultipleQRCodeResponseDto structurally satisfies BackendMultipleResponseDto", () => {
      const response: MultipleQRCodeResponseDto = {
        success_message: "QR codes loaded",
        total_items: 10,
        data: [
          {
            _id: "qr1",
            groupingType: "arrangement",
          } as MultipleQRCodeResponseDto["data"][number],
        ],
      };

      const _backendCheck: BackendMultipleResponseDto<{ _id: string }> =
        response;

      expect(_backendCheck).toHaveProperty("success_message");
      expect(_backendCheck).toHaveProperty("total_items");
      expect(_backendCheck).toHaveProperty("data");
      expect(typeof _backendCheck.success_message).toBe("string");
      expect(typeof _backendCheck.total_items).toBe("number");
      expect(Array.isArray(_backendCheck.data)).toBe(true);
    });

    it("QR Codes list endpoint returns a paginated response shape", () => {
      // The backend /qr-code GET endpoint returns a paginated response,
      // but the frontend useListQRCodes hook returns untyped data.
      // Verify the expected shape matches backend pagination fields.
      const mock = buildMockPaginatedResponse([
        { _id: "qr1", name: "QR Code 1", type: "file" },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      // Compile-time: the mock satisfies the backend paginated shape
      const _backendCheck: BackendPaginatedResponseDto<{ _id: string }> = mock;
      expect(_backendCheck.data).toHaveLength(1);
    });
  });

  // =========================================================================
  // 5. Categories list response shape
  // =========================================================================
  describe("Categories list response shape", () => {
    it("Categories list response structurally satisfies BackendMultipleResponseDto", () => {
      // The backend /categories endpoint returns { success_message, total_items, data: Category[] }
      // which matches BackendMultipleResponseDto<Category>
      const response: BackendMultipleResponseDto<Category> = {
        success_message: "Categories loaded",
        total_items: 3,
        data: [
          {
            _id: "cat1",
            categoryName: "Safety",
            categoryClass: "Inspection",
            company: "c1",
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            _id: "cat2",
            categoryName: "Electrical",
            categoryClass: "Trade",
            company: "c1",
            procoreTool: "inspections",
            createdAt: "2026-01-02T00:00:00Z",
          },
          {
            _id: "cat3",
            categoryName: "Plumbing",
            categoryClass: "Trade",
            company: "c1",
            createdAt: "2026-01-03T00:00:00Z",
          },
        ],
      };

      expect(response).toHaveProperty("success_message");
      expect(response).toHaveProperty("total_items");
      expect(response).toHaveProperty("data");
      expect(typeof response.success_message).toBe("string");
      expect(typeof response.total_items).toBe("number");
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(3);
    });

    it("Category items have required fields", () => {
      const category: Category = {
        _id: "cat1",
        categoryName: "Safety",
        categoryClass: "Inspection",
        company: "c1",
        createdAt: "2026-01-01T00:00:00Z",
      };

      expect(category).toHaveProperty("_id");
      expect(category).toHaveProperty("categoryName");
      expect(category).toHaveProperty("categoryClass");
      expect(category).toHaveProperty("company");
      expect(category).toHaveProperty("createdAt");
    });
  });

  // =========================================================================
  // 6. Company single response shape
  // =========================================================================
  describe("Company single response structurally satisfies BackendSingleResponseDto", () => {
    it("Company response has success_message and data fields", () => {
      const response: BackendSingleResponseDto<Company> = {
        success_message: "Company loaded",
        data: {
          _id: "c1",
          companyName: "Test Company",
          companyAddress: "123 Main St",
          companyCity: "Boston",
          companyState: "MA",
          companyZIP: "02101",
          companyWebsite: "https://example.com",
          companyIndustry: "Construction",
          companyLogo: "",
          companyLogoAWSId: "",
          companyLogoAWSKey: "",
          freeTrialActive: false,
          paidAccount: true,
          subscriptionCanceled: false,
          stripeCustomerID: "cus_123",
          stripeSubscriptionID: "sub_123",
          stripeProductID: "prod_123",
          procoreAccess: {},
          procoreCompanyID: 0,
          deactivated: false,
          companyData: {},
          editProcoreItemsAllowed: true,
        },
      };

      expect(response).toHaveProperty("success_message");
      expect(response).toHaveProperty("data");
      expect(typeof response.success_message).toBe("string");
      expect(response.data).not.toBeNull();
      expect(response.data!._id).toBe("c1");
      expect(response.data!.companyName).toBe("Test Company");
    });

    it("Company response allows null data", () => {
      const response: BackendSingleResponseDto<Company> = {
        success_message: "Not found",
        data: null,
      };

      expect(response.success_message).toBe("Not found");
      expect(response.data).toBeNull();
    });
  });

  // =========================================================================
  // 7. Users paginated response shape
  // =========================================================================
  describe("Users paginated response shape", () => {
    it("Users list endpoint returns a paginated response shape", () => {
      const mock = buildMockPaginatedResponse<UserRecord>([
        {
          _id: "u1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          permission: "admin",
          isVerified: true,
        },
        {
          _id: "u2",
          email: "bob@example.com",
          firstName: "Bob",
          lastName: "Jones",
          permission: "user",
          isVerified: true,
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      const _backendCheck: BackendPaginatedResponseDto<UserRecord> = mock;
      expect(_backendCheck.data).toHaveLength(2);
      expect(_backendCheck.total_pages).toBe(5);
      expect(_backendCheck.current_page).toBe(1);
      expect(_backendCheck.total_items).toBe(50);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(false);
    });

    it("User items in paginated response have required identity fields", () => {
      const user: UserRecord = {
        _id: "u1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        permission: "user",
      };

      expect(user).toHaveProperty("_id");
      expect(user).toHaveProperty("email");
    });
  });

  // =========================================================================
  // 8. Documents paginated response shape
  // =========================================================================
  describe("Documents paginated response shape", () => {
    it("Documents list endpoint returns a paginated response shape", () => {
      const mock = buildMockPaginatedResponse([
        {
          _id: "doc1",
          documentName: "Floor Plan.pdf",
          documentPurpose: "file-qrcode",
          companyId: "c1",
        },
        {
          _id: "doc2",
          documentName: "Safety Manual.pdf",
          documentPurpose: "folder-qrcode",
          companyId: "c1",
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        documentName: string;
      }> = mock;
      expect(_backendCheck.data).toHaveLength(2);
      expect(_backendCheck.total_pages).toBe(5);
      expect(_backendCheck.current_page).toBe(1);
      expect(_backendCheck.total_items).toBe(50);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(false);
    });

    it("Document items have required fields", () => {
      const doc = {
        _id: "doc1",
        documentName: "Test Document.pdf",
        documentPurpose: "file-qrcode",
        companyId: "c1",
      };

      expect(doc).toHaveProperty("_id");
      expect(doc).toHaveProperty("documentName");
      expect(doc).toHaveProperty("documentPurpose");
      expect(doc).toHaveProperty("companyId");
    });
  });

  // =========================================================================
  // 9. Folders paginated response shape
  // =========================================================================
  describe("Folders paginated response shape", () => {
    it("Folders list endpoint returns a paginated response shape", () => {
      const mock = buildMockPaginatedResponse([
        {
          _id: "f1",
          folderName: "Blueprints",
          companyId: "c1",
          qrcodeId: "qr1",
        },
        {
          _id: "f2",
          folderName: "Permits",
          companyId: "c1",
          qrcodeId: "qr1",
          parentFolderId: "f1",
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        folderName: string;
      }> = mock;
      expect(_backendCheck.data).toHaveLength(2);
      expect(_backendCheck.total_pages).toBe(5);
      expect(_backendCheck.current_page).toBe(1);
      expect(_backendCheck.total_items).toBe(50);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(false);
    });

    it("Folder items have required fields", () => {
      const folder = {
        _id: "f1",
        folderName: "Blueprints",
        companyId: "c1",
        qrcodeId: "qr1",
      };

      expect(folder).toHaveProperty("_id");
      expect(folder).toHaveProperty("folderName");
      expect(folder).toHaveProperty("companyId");
      expect(folder).toHaveProperty("qrcodeId");
    });
  });

  // =========================================================================
  // 10. Procore Items response shapes
  // =========================================================================
  describe("Procore Items response shapes", () => {
    it("SingleProcoreItemResponseDto structurally satisfies BackendSingleResponseDto", () => {
      const response: SingleProcoreItemResponseDto = {
        success_message: "Procore item loaded",
        data: {
          _id: "pi1",
          procoreToolName: "inspections",
          procoreItemID: "12345",
          companyId: "c1",
          projectId: "p1",
          qrcodeId: "qr1",
        },
      };

      const _backendCheck: BackendSingleResponseDto<Record<string, unknown>> =
        response;

      expect(_backendCheck).toHaveProperty("success_message");
      expect(_backendCheck).toHaveProperty("data");
      expect(typeof _backendCheck.success_message).toBe("string");
      expect(_backendCheck.data).not.toBeNull();
    });

    it("MultipleProcoreItemResponseDto structurally satisfies BackendMultipleResponseDto", () => {
      const response: MultipleProcoreItemResponseDto = {
        success_message: "Procore items loaded",
        total_items: 5,
        data: [
          {
            _id: "pi1",
            procoreToolName: "inspections",
            procoreItemID: "12345",
          },
          {
            _id: "pi2",
            procoreToolName: "rfis",
            procoreItemID: "67890",
          },
        ],
      };

      const _backendCheck: BackendMultipleResponseDto<Record<string, unknown>> =
        response;

      expect(_backendCheck).toHaveProperty("success_message");
      expect(_backendCheck).toHaveProperty("total_items");
      expect(_backendCheck).toHaveProperty("data");
      expect(typeof _backendCheck.success_message).toBe("string");
      expect(typeof _backendCheck.total_items).toBe("number");
      expect(Array.isArray(_backendCheck.data)).toBe(true);
      expect(_backendCheck.data).toHaveLength(2);
    });

    it("Procore Items list endpoint returns a paginated response shape", () => {
      const mock = buildMockPaginatedResponse([
        {
          _id: "pi1",
          procoreToolName: "inspections",
          procoreItemID: "12345",
          companyId: "c1",
          projectId: "p1",
          qrcodeId: "qr1",
        },
      ]);

      for (const field of PAGINATED_RESPONSE_FIELDS) {
        expect(mock).toHaveProperty(field);
      }

      const _backendCheck: BackendPaginatedResponseDto<{
        _id: string;
        procoreToolName: string;
      }> = mock;
      expect(_backendCheck.data).toHaveLength(1);
      expect(_backendCheck.total_pages).toBe(5);
      expect(_backendCheck.current_page).toBe(1);
      expect(_backendCheck.total_items).toBe(50);
      expect(_backendCheck.has_next).toBe(true);
      expect(_backendCheck.has_prev).toBe(false);
    });
  });
});
