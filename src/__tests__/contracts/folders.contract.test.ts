/**
 * Contract Test: Folders API
 *
 * Validates that the frontend Folder API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a Folder DTO, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Backend contract types (source of truth)
import {
  type BackendCreateFolderDto,
  type BackendPatchFolderDto,
  type BackendDeleteManyFoldersDto,
  type BackendBasicRequestDto,
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
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFoldersBulk,
} from "@api/endpoints/folder";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_MONGO_ID = "665af1b2c3d4e5f6a7b8c9d0";
const FAKE_COMPANY_ID = "665af1b2c3d4e5f6a7b8c9d1";
const FAKE_PROJECT_ID = "665af1b2c3d4e5f6a7b8c9d2";
const FAKE_QRCODE_ID = "665af1b2c3d4e5f6a7b8c9d3";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Folders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. createFolder sends body matching BackendCreateFolderDto
  // =========================================================================
  it("createFolder sends body matching BackendCreateFolderDto via POST /folder", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      qrcodeId: FAKE_QRCODE_ID,
      folderName: "Test Folder",
      parentFolderId: FAKE_MONGO_ID,
    };

    await createFolder(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/folder");

    // Verify all required fields from BackendCreateFolderDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("folderName", "Test Folder");

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("parentFolderId", FAKE_MONGO_ID);

    // Type-level assertion: the payload satisfies BackendCreateFolderDto
    const _typeCheck: BackendCreateFolderDto = {
      companyId: body.companyId,
      qrcodeId: body.qrcodeId,
      folderName: body.folderName,
      projectId: body.projectId,
      parentFolderId: body.parentFolderId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.qrcodeId).toBe(FAKE_QRCODE_ID);
    expect(_typeCheck.folderName).toBe("Test Folder");
  });

  // =========================================================================
  // 2. patchFolder sends body matching BackendPatchFolderDto
  // =========================================================================
  it("patchFolder sends body matching BackendPatchFolderDto via PATCH /folder/:id", async () => {
    const params = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      folderName: "Renamed Folder",
      qrcodeId: FAKE_QRCODE_ID,
    };

    await updateFolder(FAKE_MONGO_ID, params);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/folder/${FAKE_MONGO_ID}`);

    // Verify required fields from BackendPatchFolderDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("folderName", "Renamed Folder");
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);

    // Type-level assertion: the payload satisfies BackendPatchFolderDto
    const _typeCheck: BackendPatchFolderDto = {
      companyId: body.companyId,
      projectId: body.projectId,
      folderName: body.folderName,
      qrcodeId: body.qrcodeId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.projectId).toBe(FAKE_PROJECT_ID);
  });

  // =========================================================================
  // 3. deleteSingleFolder sends BasicRequestDto
  // =========================================================================
  it("deleteSingleFolder sends BasicRequestDto via DELETE /folder/:id", async () => {
    await deleteFolder(FAKE_MONGO_ID, FAKE_COMPANY_ID, FAKE_PROJECT_ID);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/folder/${FAKE_MONGO_ID}`);

    // Verify the data payload includes the required companyId
    const payload = config?.data;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);

    // Type-level assertion: the payload shape satisfies BackendBasicRequestDto
    const _typeCheck: BackendBasicRequestDto = {
      companyId: payload.companyId,
      projectId: payload.projectId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 4. deleteManyFolders sends matching BackendDeleteManyFoldersDto
  // =========================================================================
  it("deleteManyFolders sends matching BackendDeleteManyFoldersDto via DELETE /folder/bulk", async () => {
    const folderIds = [FAKE_MONGO_ID, "665af1b2c3d4e5f6a7b8c9d4"];

    await deleteFoldersBulk(folderIds, FAKE_COMPANY_ID);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/folder/bulk");

    // Verify the payload shape
    const payload = config?.data;
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(payload).toHaveProperty("folderIds", folderIds);

    // Type-level assertion: the payload satisfies BackendDeleteManyFoldersDto
    const _typeCheck: BackendDeleteManyFoldersDto = {
      companyId: payload.companyId,
      folderIds: payload.folderIds,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.folderIds).toEqual(folderIds);
  });

  // =========================================================================
  // 5. Route paths match backend
  // =========================================================================
  describe("Route paths match backend", () => {
    it("create folder URL matches backend route", async () => {
      await createFolder({
        companyId: FAKE_COMPANY_ID,
        qrcodeId: FAKE_QRCODE_ID,
        folderName: "Test",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/folder");
      expect(BACKEND_ROUTES["folder.create"].path).toBe("/folder");
      expect(BACKEND_ROUTES["folder.create"].method).toBe("POST");
    });

    it("patch folder URL matches backend route pattern", async () => {
      await updateFolder(FAKE_MONGO_ID, {
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
      });
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toMatch(/^\/folder\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["folder.patch"].path).toBe("/folder/:folderId");
      expect(BACKEND_ROUTES["folder.patch"].method).toBe("PATCH");
    });

    it("single folder delete URL matches backend route pattern", async () => {
      await deleteFolder(FAKE_MONGO_ID, FAKE_COMPANY_ID);
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toMatch(/^\/folder\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["folder.delete"].path).toBe("/folder/:folderId");
      expect(BACKEND_ROUTES["folder.delete"].method).toBe("DELETE");
    });

    it("bulk folder delete URL matches backend route", async () => {
      await deleteFoldersBulk([FAKE_MONGO_ID], FAKE_COMPANY_ID);
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toBe("/folder/bulk");
      expect(BACKEND_ROUTES["folder.delete-bulk"].path).toBe("/folder/bulk");
      expect(BACKEND_ROUTES["folder.delete-bulk"].method).toBe("DELETE");
    });

    it("backend required fields for folder.create include companyId, qrcodeId, folderName", () => {
      const route = BACKEND_ROUTES["folder.create"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "qrcodeId", "folderName"]),
      );
    });

    it("backend required fields for folder.patch include companyId, projectId", () => {
      const route = BACKEND_ROUTES["folder.patch"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "projectId"]),
      );
    });

    it("backend required fields for folder.delete include companyId", () => {
      const route = BACKEND_ROUTES["folder.delete"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId"]),
      );
    });
  });
});
