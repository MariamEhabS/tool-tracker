/**
 * Contract Test: Procore Items API
 *
 * Validates that the frontend Procore Item API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a Procore Item DTO, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Backend contract types (source of truth)
import {
  type BackendCreateProcoreItemDto,
  type BackendCreateManyProcoreItemsDto,
  type BackendDeleteSingleProcoreItemDto,
  type BackendDeleteManyProcoreItemsDto,
  type BackendToggleVisibilitySingleProcoreItemDto,
  type BackendToggleVisibilityBulkProcoreItemDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks — must appear before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Frontend functions under test
import {
  createProcoreItem,
  createProcoreItemsBulk,
  toggleVisibilitySingleProcoreItem,
  deleteSingleProcoreItem,
  deleteManyProcoreItems,
  toggleVisibilityBulkProcoreItems,
} from "@api/endpoints/procore-item";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_COMPANY_ID = "665af1b2c3d4e5f6a7b8c9d0";
const FAKE_PROJECT_ID = "665af1b2c3d4e5f6a7b8c9d1";
const FAKE_QRCODE_ID = "665af1b2c3d4e5f6a7b8c9d2";
const FAKE_PROCORE_ITEM_ID = "12345";
const FAKE_PROCORE_ITEM_DB_ID = "665af1b2c3d4e5f6a7b8c9d3";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Procore Items API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. createProcoreItem sends body matching BackendCreateProcoreItemDto
  // =========================================================================
  it("createProcoreItem sends body matching BackendCreateProcoreItemDto via POST /procore-item", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      qrcodeId: FAKE_QRCODE_ID,
      procoreToolName: "inspections",
      procoreItemID: FAKE_PROCORE_ITEM_ID,
    };

    await createProcoreItem(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item");

    // Verify required fields from BackendCreateProcoreItemDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("procoreToolName", "inspections");
    expect(body).toHaveProperty("procoreItemID", FAKE_PROCORE_ITEM_ID);

    // Type-level assertion: the payload satisfies BackendCreateProcoreItemDto
    const _typeCheck: BackendCreateProcoreItemDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      qrcodeId: body.qrcodeId,
      procoreToolName: body.procoreToolName,
      procoreItemID: body.procoreItemID,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 2. createProcoreItemsBulk sends body matching BackendCreateManyProcoreItemsDto
  // =========================================================================
  it("createProcoreItemsBulk sends body matching BackendCreateManyProcoreItemsDto via POST /procore-item/bulk", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      items: [
        {
          qrcodeId: FAKE_QRCODE_ID,
          procoreToolName: "inspections",
          procoreItemID: "111",
        },
        {
          qrcodeId: FAKE_QRCODE_ID,
          procoreToolName: "forms",
          procoreItemID: "222",
        },
      ],
    };

    await createProcoreItemsBulk(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item/bulk");

    // Verify required fields from BackendCreateManyProcoreItemsDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("items");
    expect(body.items).toHaveLength(2);

    // Verify each bulk entry has the required fields
    for (const item of body.items) {
      expect(item).toHaveProperty("qrcodeId");
      expect(item).toHaveProperty("procoreToolName");
      expect(item).toHaveProperty("procoreItemID");
    }

    // Type-level assertion
    const _typeCheck: BackendCreateManyProcoreItemsDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      items: body.items,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 3. toggleVisibilitySingleProcoreItem sends body matching backend DTO
  // =========================================================================
  it("toggleVisibilitySingleProcoreItem sends body matching BackendToggleVisibilitySingleProcoreItemDto via PATCH /procore-item/toggle-visibility/single", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      procoreItemID: FAKE_PROCORE_ITEM_ID,
      qrcodeId: FAKE_QRCODE_ID,
      hidden: true,
      procoreToolName: "inspections",
    };

    await toggleVisibilitySingleProcoreItem(payload);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item/toggle-visibility/single");

    // Verify required fields from BackendToggleVisibilitySingleProcoreItemDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("procoreItemID", FAKE_PROCORE_ITEM_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("hidden", true);

    // Verify optional field is forwarded
    expect(body).toHaveProperty("procoreToolName", "inspections");

    // Type-level assertion
    const _typeCheck: BackendToggleVisibilitySingleProcoreItemDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      procoreItemID: body.procoreItemID,
      qrcodeId: body.qrcodeId,
      hidden: body.hidden,
      procoreToolName: body.procoreToolName,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 4. deleteSingleProcoreItem sends body matching BackendDeleteSingleProcoreItemDto
  // =========================================================================
  it("deleteSingleProcoreItem sends body matching BackendDeleteSingleProcoreItemDto via DELETE /procore-item/delete/single", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      procoreItemID: FAKE_PROCORE_ITEM_ID,
      qrcodeId: FAKE_QRCODE_ID,
    };

    await deleteSingleProcoreItem(payload);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item/delete/single");

    // Verify the data payload includes all required fields
    const body = config?.data;
    expect(body).toBeDefined();
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("procoreItemID", FAKE_PROCORE_ITEM_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);

    // Type-level assertion
    const _typeCheck: BackendDeleteSingleProcoreItemDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      procoreItemID: body.procoreItemID,
      qrcodeId: body.qrcodeId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 5. deleteManyProcoreItems sends body matching BackendDeleteManyProcoreItemsDto
  // =========================================================================
  it("deleteManyProcoreItems sends body matching BackendDeleteManyProcoreItemsDto via DELETE /procore-item/bulk", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      procoreItemIdsDB: [FAKE_PROCORE_ITEM_DB_ID, "665af1b2c3d4e5f6a7b8c9d4"],
      qrcodeId: FAKE_QRCODE_ID,
      projectId: FAKE_PROJECT_ID,
    };

    await deleteManyProcoreItems(payload);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item/bulk");

    // Verify the data payload
    const body = config?.data;
    expect(body).toBeDefined();
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("procoreItemIdsDB");
    expect(body.procoreItemIdsDB).toHaveLength(2);

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);

    // Type-level assertion
    const _typeCheck: BackendDeleteManyProcoreItemsDto = {
      companyId: body.companyId,
      procoreItemIdsDB: body.procoreItemIdsDB,
      qrcodeId: body.qrcodeId,
      projectId: body.projectId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 6. toggleVisibilityBulkProcoreItems sends body matching backend DTO
  // =========================================================================
  it("toggleVisibilityBulkProcoreItems sends body matching BackendToggleVisibilityBulkProcoreItemDto via PATCH /procore-item/toggle-visibility/bulk", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      procoreItemIDs: ["111", "222", "333"],
      qrcodeId: FAKE_QRCODE_ID,
      hidden: false,
    };

    await toggleVisibilityBulkProcoreItems(payload);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/procore-item/toggle-visibility/bulk");

    // Verify required fields from BackendToggleVisibilityBulkProcoreItemDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("procoreItemIDs");
    expect(body.procoreItemIDs).toHaveLength(3);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("hidden", false);

    // Type-level assertion
    const _typeCheck: BackendToggleVisibilityBulkProcoreItemDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      procoreItemIDs: body.procoreItemIDs,
      qrcodeId: body.qrcodeId,
      hidden: body.hidden,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 7. Route paths match backend specification
  // =========================================================================
  describe("Route paths match backend specification", () => {
    it("createProcoreItem URL matches backend route", async () => {
      await createProcoreItem({
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
        qrcodeId: FAKE_QRCODE_ID,
        procoreToolName: "inspections",
        procoreItemID: FAKE_PROCORE_ITEM_ID,
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/procore-item");
      expect(BACKEND_ROUTES["procore-item.create"].path).toBe("/procore-item");
      expect(BACKEND_ROUTES["procore-item.create"].method).toBe("POST");
    });

    it("createProcoreItemsBulk URL matches backend route", async () => {
      await createProcoreItemsBulk({
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
        items: [
          {
            qrcodeId: FAKE_QRCODE_ID,
            procoreToolName: "inspections",
            procoreItemID: "111",
          },
        ],
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/procore-item/bulk");
      expect(BACKEND_ROUTES["procore-item.create-bulk"].path).toBe(
        "/procore-item/bulk",
      );
      expect(BACKEND_ROUTES["procore-item.create-bulk"].method).toBe("POST");
    });

    it("toggleVisibilitySingleProcoreItem URL matches backend route", async () => {
      await toggleVisibilitySingleProcoreItem({
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
        procoreItemID: FAKE_PROCORE_ITEM_ID,
        qrcodeId: FAKE_QRCODE_ID,
        hidden: true,
      });
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toBe("/procore-item/toggle-visibility/single");
      expect(BACKEND_ROUTES["procore-item.toggle-visibility-single"].path).toBe(
        "/procore-item/toggle-visibility/single",
      );
      expect(
        BACKEND_ROUTES["procore-item.toggle-visibility-single"].method,
      ).toBe("PATCH");
    });

    it("deleteSingleProcoreItem URL matches backend route", async () => {
      await deleteSingleProcoreItem({
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
        procoreItemID: FAKE_PROCORE_ITEM_ID,
        qrcodeId: FAKE_QRCODE_ID,
      });
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toBe("/procore-item/delete/single");
      expect(BACKEND_ROUTES["procore-item.delete-single"].path).toBe(
        "/procore-item/delete/single",
      );
      expect(BACKEND_ROUTES["procore-item.delete-single"].method).toBe(
        "DELETE",
      );
    });

    it("deleteManyProcoreItems URL matches backend route", async () => {
      await deleteManyProcoreItems({
        companyId: FAKE_COMPANY_ID,
        procoreItemIdsDB: [FAKE_PROCORE_ITEM_DB_ID],
      });
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toBe("/procore-item/bulk");
      expect(BACKEND_ROUTES["procore-item.delete-bulk"].path).toBe(
        "/procore-item/bulk",
      );
      expect(BACKEND_ROUTES["procore-item.delete-bulk"].method).toBe("DELETE");
    });

    it("toggleVisibilityBulkProcoreItems URL matches backend route", async () => {
      await toggleVisibilityBulkProcoreItems({
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
        procoreItemIDs: ["111"],
        qrcodeId: FAKE_QRCODE_ID,
        hidden: true,
      });
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toBe("/procore-item/toggle-visibility/bulk");
      expect(BACKEND_ROUTES["procore-item.toggle-visibility-bulk"].path).toBe(
        "/procore-item/toggle-visibility/bulk",
      );
      expect(BACKEND_ROUTES["procore-item.toggle-visibility-bulk"].method).toBe(
        "PATCH",
      );
    });

    it("backend required fields for procore-item.create include companyId, projectId, qrcodeId, procoreToolName, procoreItemID", () => {
      const route = BACKEND_ROUTES["procore-item.create"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining([
          "companyId",
          "projectId",
          "qrcodeId",
          "procoreToolName",
          "procoreItemID",
        ]),
      );
    });

    it("backend required fields for procore-item.create-bulk include companyId, projectId, items", () => {
      const route = BACKEND_ROUTES["procore-item.create-bulk"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "projectId", "items"]),
      );
    });

    it("backend required fields for procore-item.delete-single include companyId, projectId, procoreItemID, qrcodeId", () => {
      const route = BACKEND_ROUTES["procore-item.delete-single"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining([
          "companyId",
          "projectId",
          "procoreItemID",
          "qrcodeId",
        ]),
      );
    });

    it("backend required fields for procore-item.toggle-visibility-single include companyId, projectId, procoreItemID, qrcodeId, hidden", () => {
      const route = BACKEND_ROUTES["procore-item.toggle-visibility-single"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining([
          "companyId",
          "projectId",
          "procoreItemID",
          "qrcodeId",
          "hidden",
        ]),
      );
    });

    it("backend required fields for procore-item.toggle-visibility-bulk include companyId, projectId, procoreItemIDs, qrcodeId, hidden", () => {
      const route = BACKEND_ROUTES["procore-item.toggle-visibility-bulk"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining([
          "companyId",
          "projectId",
          "procoreItemIDs",
          "qrcodeId",
          "hidden",
        ]),
      );
    });
  });
});
