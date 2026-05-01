/**
 * Contract Test: QR Codes API
 *
 * Validates that the frontend QR code API client (src/api/endpoints/qr-codes.ts)
 * sends requests whose shapes align with the backend API specification defined in
 * backend-contracts.ts. If the backend changes a DTO or route, updating
 * backend-contracts.ts and re-running these tests will surface every frontend
 * call site that needs adjustment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  BackendCreateQRCodeDto,
  BackendQRCodeListDto,
  BackendPatchQRCodeDto,
  BackendBasicRequestDto,
  BackendDeleteManyQRCodesDto,
  BackendBulkAssignQRCodesDto,
  BackendBulkAssignQRCodesToProjectDto,
  BackendBulkSetPasswordDto,
  BackendDownloadQRCodesDto,
  BackendCreateBulkAsyncDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

import {
  type CreateQRCodeDto,
  type QRCodeListParams,
  type CreateBulkAsyncDto,
} from "@api/endpoints/qr-codes";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    defaults: { baseURL: "http://test" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// Import the functions AFTER mocks are defined so they resolve to the mocked modules.
import {
  createQRCode,
  useListQRCodes,
  useSingleQRCode,
  useQRImageSignedUrl,
  fetchSignedUrl,
  updateQRCodeDetails,
  deleteSingleQRCode,
  deleteManyQRCodes,
  bulkAssignQRCodesToGroup,
  bulkAssignQRCodesToProject,
  bulkSetQRCodePassword,
  downloadQRCodes,
  createBulkQRJob,
  getJobStatus,
  cancelJob,
} from "@api/endpoints/qr-codes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all own keys of a runtime object as a string array. */
const keysOf = (obj: Record<string, unknown>): string[] => Object.keys(obj);

/**
 * Build a reference key-set for a backend DTO by instantiating every field
 * with a dummy value so we can call Object.keys() on it at runtime.
 * TypeScript interfaces are erased, so we maintain "shadow" objects here
 * that list every field accepted by the backend DTO.
 */
const BACKEND_CREATE_QR_CODE_KEYS: (keyof BackendCreateQRCodeDto)[] = [
  "companyId",
  "projectId",
  "name",
  "type",
  "groupingId",
  "groupingType",
  "url",
  "description",
  "procoreTool",
  "procoreLinkedItemId",
];

const BACKEND_QR_CODE_LIST_KEYS: (keyof BackendQRCodeListDto)[] = [
  "companyId",
  "projectId",
  "groupingId",
  "groupingType",
  "groupingTypes",
  "quickCode",
  "filter_ids",
  "current_page",
  "per_page",
  "search",
  "sortBy",
  "sortDir",
  "sort_by",
  "sort_dir",
  "types",
  "type",
  "arrangementType",
  "projectStatus",
];

const BACKEND_PATCH_QR_CODE_KEYS: (keyof BackendPatchQRCodeDto)[] = [
  "companyId",
  "projectId",
  "qrcodeName",
  "groupingId",
  "groupingType",
  "description",
  "procoreFetch",
  "passwordActivated",
  "password",
  "timezone",
  "weekdayPassword",
  "weekdayPasswordTimeStart",
  "weekdayPasswordTimeEnd",
  "weekendPassword",
  "weekendPasswordTimeStart",
  "weekendPasswordTimeEnd",
];

const BACKEND_DELETE_MANY_KEYS: (keyof BackendDeleteManyQRCodesDto)[] = [
  "companyId",
  "qrcodeIds",
  "groupingId",
  "groupingType",
  "projectId",
];

const BACKEND_BULK_ASSIGN_KEYS: (keyof BackendBulkAssignQRCodesDto)[] = [
  "qrCodeIds",
  "groupingId",
  "groupingType",
  "companyId",
  "projectId",
];

const BACKEND_BULK_ASSIGN_PROJECT_KEYS: (keyof BackendBulkAssignQRCodesToProjectDto)[] =
  ["qrCodeIds", "projectId", "companyId"];

const BACKEND_BULK_SET_PASSWORD_KEYS: (keyof BackendBulkSetPasswordDto)[] = [
  "qrCodeIds",
  "companyId",
  "passwordActivated",
  "password",
  "timezone",
  "weekdayPassword",
  "weekdayPasswordTimeStart",
  "weekdayPasswordTimeEnd",
  "weekendPassword",
  "weekendPasswordTimeStart",
  "weekendPasswordTimeEnd",
];

const BACKEND_DOWNLOAD_KEYS: (keyof BackendDownloadQRCodesDto)[] = [
  "qrCodeIds",
];

const BACKEND_CREATE_BULK_ASYNC_KEYS: (keyof BackendCreateBulkAsyncDto)[] = [
  "equipmentId",
  "projectId",
  "numberOfCodes",
  "companyId",
  "createdBy",
  "groupName",
  "startNumber",
  "excludeNumbers",
];

const BACKEND_BASIC_REQUEST_KEYS: (keyof BackendBasicRequestDto)[] = [
  "companyId",
  "projectId",
];

/** Assert every key in `actual` is present in the allowed backend key list. */
function expectKeysSubsetOf(
  actual: string[],
  allowed: string[],
  label: string,
): void {
  const disallowed = actual.filter((k) => !allowed.includes(k));
  expect(
    disallowed,
    `Frontend sends field(s) not in ${label}: [${disallowed.join(", ")}]`,
  ).toEqual([]);
}

/** React Query wrapper for renderHook. */
const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: QR Codes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. createQRCode -------------------------------------------------------

  it("createQRCode sends body matching BackendCreateQRCodeDto", async () => {
    mockPost.mockResolvedValueOnce({
      data: { success_message: "ok", data: {} },
    });

    const payload: CreateQRCodeDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      name: "Lobby QR",
      type: "file",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      groupingId: "64f1a2b3c4d5e6f7a8b9c0d3",
      groupingType: "arrangement",
      description: "Main lobby file code",
    };

    await createQRCode(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code");
    expect(body).toHaveProperty("companyId");
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("type");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_CREATE_QR_CODE_KEYS as string[],
      "BackendCreateQRCodeDto",
    );
  });

  // 2. useListQRCodes ------------------------------------------------------

  it("useListQRCodes passes query params matching BackendQRCodeListDto", async () => {
    mockGet.mockResolvedValue({
      data: { success_message: "ok", total_items: 0, data: [] },
    });

    const params: QRCodeListParams = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      current_page: 1,
      per_page: 25,
      search: "lobby",
      sortBy: "name",
      sortDir: "asc",
      types: ["file", "folder"],
      groupingTypes: ["arrangement"],
      projectStatus: ["active"],
    };

    const { result } = renderHook(() => useListQRCodes(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/qr-code");

    const sentParams = keysOf(config.params);
    expectKeysSubsetOf(
      sentParams,
      BACKEND_QR_CODE_LIST_KEYS as string[],
      "BackendQRCodeListDto",
    );
  });

  // 3. updateQRCodeDetails -------------------------------------------------

  it("updateQRCodeDetails sends body matching BackendPatchQRCodeDto", async () => {
    mockPatch.mockResolvedValueOnce({
      data: { success_message: "ok", data: {} },
    });

    await updateQRCodeDetails("64f1a2b3c4d5e6f7a8b9c0d4", {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      qrcodeName: "Updated Name",
      description: "Updated description",
      passwordActivated: true,
      password: "secure123",
      timezone: "America/New_York",
      weekdayPassword: true,
      weekdayPasswordTimeStart: "08:00",
      weekdayPasswordTimeEnd: "17:00",
    });

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/64f1a2b3c4d5e6f7a8b9c0d4");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_PATCH_QR_CODE_KEYS as string[],
      "BackendPatchQRCodeDto",
    );
  });

  // 4. deleteSingleQRCode -------------------------------------------------

  it("deleteSingleQRCode sends body matching BackendBasicRequestDto", async () => {
    mockDelete.mockResolvedValueOnce({
      data: { success_message: "ok", data: {} },
    });

    await deleteSingleQRCode(
      "64f1a2b3c4d5e6f7a8b9c0d1",
      "64f1a2b3c4d5e6f7a8b9c0d4",
    );

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(url).toBe("/qr-code/64f1a2b3c4d5e6f7a8b9c0d4");
    expect(config.data).toEqual({ companyId: "64f1a2b3c4d5e6f7a8b9c0d1" });

    expectKeysSubsetOf(
      keysOf(config.data),
      BACKEND_BASIC_REQUEST_KEYS as string[],
      "BackendBasicRequestDto",
    );
  });

  // 5. deleteManyQRCodes ---------------------------------------------------

  it("deleteManyQRCodes sends body matching BackendDeleteManyQRCodesDto", async () => {
    mockDelete.mockResolvedValueOnce({
      data: { success_message: "ok", total_items: 2, data: [] },
    });

    await deleteManyQRCodes(
      "64f1a2b3c4d5e6f7a8b9c0d1",
      ["64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d5"],
      "64f1a2b3c4d5e6f7a8b9c0d6", // groupingId
      "arrangement", // groupingType
      "64f1a2b3c4d5e6f7a8b9c0d2", // projectId
    );

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(url).toBe("/qr-code/bulk");

    const body = config.data;
    expect(body).toHaveProperty("companyId");
    expect(body).toHaveProperty("qrcodeIds");
    expect(Array.isArray(body.qrcodeIds)).toBe(true);

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_DELETE_MANY_KEYS as string[],
      "BackendDeleteManyQRCodesDto",
    );
  });

  // 6. bulkAssignQRCodesToGroup --------------------------------------------

  it("bulkAssignQRCodesToGroup sends body matching BackendBulkAssignQRCodesDto", async () => {
    mockPatch.mockResolvedValueOnce({
      data: { success: true, updated: 2 },
    });

    await bulkAssignQRCodesToGroup(
      ["64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d5"],
      "64f1a2b3c4d5e6f7a8b9c0d6", // groupId
      "equipment", // groupType
      "64f1a2b3c4d5e6f7a8b9c0d1", // companyId
      "64f1a2b3c4d5e6f7a8b9c0d2", // projectId
    );

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/bulk-assign");

    expect(body).toHaveProperty("qrCodeIds");
    expect(body).toHaveProperty("groupingId");
    expect(body).toHaveProperty("groupingType");
    expect(body).toHaveProperty("companyId");
    expect(body).toHaveProperty("projectId");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_BULK_ASSIGN_KEYS as string[],
      "BackendBulkAssignQRCodesDto",
    );
  });

  // 7. bulkAssignQRCodesToProject ------------------------------------------

  it("bulkAssignQRCodesToProject sends body matching BackendBulkAssignQRCodesToProjectDto", async () => {
    mockPatch.mockResolvedValueOnce({
      data: { success: true, updated: 3 },
    });

    await bulkAssignQRCodesToProject(
      ["64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d5"],
      "64f1a2b3c4d5e6f7a8b9c0d2", // projectId
      "64f1a2b3c4d5e6f7a8b9c0d1", // companyId
    );

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/bulk-assign-project");

    expect(body).toHaveProperty("qrCodeIds");
    expect(body).toHaveProperty("projectId");
    expect(body).toHaveProperty("companyId");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_BULK_ASSIGN_PROJECT_KEYS as string[],
      "BackendBulkAssignQRCodesToProjectDto",
    );
  });

  // 8. bulkSetQRCodePassword -----------------------------------------------

  it("bulkSetQRCodePassword sends body matching BackendBulkSetPasswordDto", async () => {
    mockPatch.mockResolvedValueOnce({
      data: { success: true, updated: 2 },
    });

    await bulkSetQRCodePassword(
      ["64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d5"],
      "64f1a2b3c4d5e6f7a8b9c0d1",
      {
        passwordActivated: true,
        password: "secure123",
        timezone: "America/Chicago",
        weekdayPassword: true,
        weekdayPasswordTimeStart: "09:00",
        weekdayPasswordTimeEnd: "18:00",
        weekendPassword: false,
      },
    );

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/bulk-password");

    expect(body).toHaveProperty("qrCodeIds");
    expect(body).toHaveProperty("companyId");
    expect(body).toHaveProperty("passwordActivated");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_BULK_SET_PASSWORD_KEYS as string[],
      "BackendBulkSetPasswordDto",
    );
  });

  // 9. downloadQRCodes -----------------------------------------------------

  it("downloadQRCodes sends body matching BackendDownloadQRCodesDto", async () => {
    mockPost.mockResolvedValueOnce({
      data: { success: true, downloadUrl: "https://s3.example.com/zip" },
    });

    await downloadQRCodes([
      "64f1a2b3c4d5e6f7a8b9c0d4",
      "64f1a2b3c4d5e6f7a8b9c0d5",
    ]);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/download");

    expect(body).toHaveProperty("qrCodeIds");
    expect(Array.isArray(body.qrCodeIds)).toBe(true);

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_DOWNLOAD_KEYS as string[],
      "BackendDownloadQRCodesDto",
    );
  });

  // 10. createBulkQRJob ----------------------------------------------------

  it("createBulkQRJob sends body matching BackendCreateBulkAsyncDto", async () => {
    mockPost.mockResolvedValueOnce({
      data: { jobId: "job-abc-123", message: "Job created" },
    });

    const payload: CreateBulkAsyncDto = {
      equipmentId: "64f1a2b3c4d5e6f7a8b9c0d7",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      numberOfCodes: 50,
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      groupName: "Floor 3 Equipment",
      startNumber: 1,
    };

    await createBulkQRJob(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/qr-code/bulk-async");

    expect(body).toHaveProperty("equipmentId");
    expect(body).toHaveProperty("projectId");
    expect(body).toHaveProperty("numberOfCodes");
    expect(body).toHaveProperty("companyId");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_CREATE_BULK_ASYNC_KEYS as string[],
      "BackendCreateBulkAsyncDto",
    );
  });

  // 11. useSingleQRCode -----------------------------------------------------

  it("useSingleQRCode GETs from /qr-code/:qrcodeId with companyId param", async () => {
    mockGet.mockResolvedValue({
      data: {
        success_message: "ok",
        data: { _id: "64f1a2b3c4d5e6f7a8b9c0d4" },
      },
    });

    const { result } = renderHook(
      () =>
        useSingleQRCode("64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/qr-code/64f1a2b3c4d5e6f7a8b9c0d4");
    expect(config.params).toEqual({ companyId: "64f1a2b3c4d5e6f7a8b9c0d1" });
  });

  // 12. fetchSignedUrl -------------------------------------------------------

  it("fetchSignedUrl GETs from /qr-code/image/:qrcodeId", async () => {
    mockGet.mockResolvedValueOnce({
      data: { signedUrl: "https://s3.example.com/signed", exists: true },
    });

    await fetchSignedUrl("64f1a2b3c4d5e6f7a8b9c0d4");

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0] as [string];
    expect(url).toBe("/qr-code/image/64f1a2b3c4d5e6f7a8b9c0d4");
  });

  // 13. useQRImageSignedUrl --------------------------------------------------

  it("useQRImageSignedUrl GETs from /qr-code/image/:qrcodeId", async () => {
    mockGet.mockResolvedValue({
      data: { signedUrl: "https://s3.example.com/signed", exists: true },
    });

    const { result } = renderHook(
      () => useQRImageSignedUrl("64f1a2b3c4d5e6f7a8b9c0d4"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0] as [string];
    expect(url).toBe("/qr-code/image/64f1a2b3c4d5e6f7a8b9c0d4");
  });

  // 14. getJobStatus ---------------------------------------------------------

  it("getJobStatus GETs from /qr-code/jobs/:jobId", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          jobId: "job-abc-123",
          status: "processing",
          progress: 5,
          total: 50,
        },
      },
    });

    await getJobStatus("job-abc-123");

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0] as [string];
    expect(url).toBe("/qr-code/jobs/job-abc-123");
  });

  // 15. cancelJob ------------------------------------------------------------

  it("cancelJob DELETEs at /qr-code/jobs/:jobId with companyId in body", async () => {
    mockDelete.mockResolvedValueOnce({ data: {} });

    await cancelJob("job-abc-123", "64f1a2b3c4d5e6f7a8b9c0d1");

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(url).toBe("/qr-code/jobs/job-abc-123");
    expect(config.data).toHaveProperty("companyId");

    expectKeysSubsetOf(
      keysOf(config.data),
      BACKEND_BASIC_REQUEST_KEYS as string[],
      "BackendBasicRequestDto",
    );
  });

  // 16. Route paths and HTTP methods ----------------------------------------

  describe("Route paths and HTTP methods match backend specification", () => {
    it("createQRCode POSTs to the correct path", async () => {
      mockPost.mockResolvedValueOnce({
        data: { success_message: "ok", data: {} },
      });

      await createQRCode({
        companyId: "c1",
        name: "Test",
        type: "file",
      });

      const route = BACKEND_ROUTES["qr-code.create"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("useListQRCodes GETs from the correct path", async () => {
      mockGet.mockResolvedValue({
        data: { success_message: "ok", total_items: 0, data: [] },
      });

      const { result } = renderHook(() => useListQRCodes({ companyId: "c1" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["qr-code.list"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("updateQRCodeDetails PATCHes to /qr-code/:qrcodeId", async () => {
      mockPatch.mockResolvedValueOnce({
        data: { success_message: "ok", data: {} },
      });

      await updateQRCodeDetails("abc123", { companyId: "c1" });

      const route = BACKEND_ROUTES["qr-code.patch"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe("/qr-code/abc123");
      // Verify the pattern matches the backend route template
      expect(route.path).toBe("/qr-code/:qrcodeId");
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("deleteSingleQRCode DELETEs at /qr-code/:qrcodeId", async () => {
      mockDelete.mockResolvedValueOnce({
        data: { success_message: "ok", data: {} },
      });

      await deleteSingleQRCode("c1", "qr1");

      const route = BACKEND_ROUTES["qr-code.delete"];
      const [url] = mockDelete.mock.calls[0] as [string];
      expect(url).toBe("/qr-code/qr1");
      expect(route.path).toBe("/qr-code/:qrcodeId");
      expect(route.method).toBe("DELETE");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("deleteManyQRCodes DELETEs at the bulk path", async () => {
      mockDelete.mockResolvedValueOnce({
        data: { success_message: "ok", total_items: 1, data: [] },
      });

      await deleteManyQRCodes("c1", ["qr1"]);

      const route = BACKEND_ROUTES["qr-code.delete-bulk"];
      const [url] = mockDelete.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("DELETE");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("bulkAssignQRCodesToGroup PATCHes to the bulk-assign path", async () => {
      mockPatch.mockResolvedValueOnce({
        data: { success: true, updated: 1 },
      });

      await bulkAssignQRCodesToGroup(["qr1"], "g1", "arrangement", "c1", "p1");

      const route = BACKEND_ROUTES["qr-code.bulk-assign"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("bulkAssignQRCodesToProject PATCHes to the bulk-assign-project path", async () => {
      mockPatch.mockResolvedValueOnce({
        data: { success: true, updated: 1 },
      });

      await bulkAssignQRCodesToProject(["qr1"], "p1", "c1");

      const route = BACKEND_ROUTES["qr-code.bulk-assign-project"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("bulkSetQRCodePassword PATCHes to the bulk-password path", async () => {
      mockPatch.mockResolvedValueOnce({
        data: { success: true, updated: 1 },
      });

      await bulkSetQRCodePassword(["qr1"], "c1", {
        passwordActivated: false,
      });

      const route = BACKEND_ROUTES["qr-code.bulk-password"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("downloadQRCodes POSTs to the download path", async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, downloadUrl: "https://example.com/zip" },
      });

      await downloadQRCodes(["qr1"]);

      const route = BACKEND_ROUTES["qr-code.download"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("createBulkQRJob POSTs to the bulk-async path", async () => {
      mockPost.mockResolvedValueOnce({
        data: { jobId: "j1", message: "ok" },
      });

      await createBulkQRJob({
        equipmentId: "e1",
        projectId: "p1",
        numberOfCodes: 10,
        companyId: "c1",
      });

      const route = BACKEND_ROUTES["qr-code.bulk-async"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("useSingleQRCode GETs from the correct path pattern", async () => {
      mockGet.mockResolvedValue({
        data: { success_message: "ok", data: { _id: "qr1" } },
      });

      const { result } = renderHook(() => useSingleQRCode("qr1", "c1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["qr-code.get"];
      const [url, config] = mockGet.mock.calls[0] as [
        string,
        { params: Record<string, unknown> },
      ];
      expect(url).toBe("/qr-code/qr1");
      expect(config.params).toEqual({ companyId: "c1" });
      expect(route.path).toBe("/qr-code/:qrcodeId");
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("fetchSignedUrl GETs from the correct image path pattern", async () => {
      mockGet.mockResolvedValueOnce({
        data: { signedUrl: "https://example.com/signed", exists: true },
      });

      await fetchSignedUrl("qr1");

      const route = BACKEND_ROUTES["qr-code.image"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe("/qr-code/image/qr1");
      expect(route.path).toBe("/qr-code/image/:qrcodeId");
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("getJobStatus GETs from the correct job path pattern", async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: { jobId: "j1", status: "pending", progress: 0, total: 0 },
        },
      });

      await getJobStatus("j1");

      const route = BACKEND_ROUTES["qr-code.job-status"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe("/qr-code/jobs/j1");
      expect(route.path).toBe("/qr-code/jobs/:jobId");
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("cancelJob DELETEs at the correct job path pattern", async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });

      await cancelJob("j1", "c1");

      const route = BACKEND_ROUTES["qr-code.job-cancel"];
      const [url] = mockDelete.mock.calls[0] as [string];
      expect(url).toBe("/qr-code/jobs/j1");
      expect(route.path).toBe("/qr-code/jobs/:jobId");
      expect(route.method).toBe("DELETE");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  // 17. Type compatibility -------------------------------------------------

  it("Type compatibility: frontend CreateQRCodeDto fields are valid backend fields", () => {
    // Build a sample object that satisfies the frontend CreateQRCodeDto
    const sampleFrontend: CreateQRCodeDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      name: "Test QR",
      type: "file",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      groupingId: "64f1a2b3c4d5e6f7a8b9c0d3",
      groupingType: "arrangement",
      url: "https://example.com",
      description: "A test QR code",
      procoreTool: "documents",
      procoreLinkedItemId: "64f1a2b3c4d5e6f7a8b9c0d8",
    };

    const frontendKeys = keysOf(sampleFrontend);

    expectKeysSubsetOf(
      frontendKeys,
      BACKEND_CREATE_QR_CODE_KEYS as string[],
      "BackendCreateQRCodeDto",
    );
  });

  it("Type compatibility: frontend QRCodeListParams fields are valid backend fields", () => {
    const sampleFrontend: QRCodeListParams = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      groupingId: "64f1a2b3c4d5e6f7a8b9c0d3",
      groupingType: "arrangement",
      groupingTypes: ["arrangement", "equipment"],
      filter_ids: ["id1", "id2"],
      current_page: 1,
      per_page: 25,
      search: "test",
      types: ["file"],
      sortBy: "name",
      sortDir: "asc",
      arrangementType: "Procore Drawings Codes",
      projectStatus: ["active", "completed"],
    };

    const frontendKeys = keysOf(sampleFrontend);

    expectKeysSubsetOf(
      frontendKeys,
      BACKEND_QR_CODE_LIST_KEYS as string[],
      "BackendQRCodeListDto",
    );
  });

  it("Type compatibility: frontend CreateBulkAsyncDto fields are valid backend fields", () => {
    const sampleFrontend: CreateBulkAsyncDto = {
      equipmentId: "64f1a2b3c4d5e6f7a8b9c0d7",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      numberOfCodes: 100,
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      createdBy: "64f1a2b3c4d5e6f7a8b9c0d9",
      groupName: "Equipment Group A",
      startNumber: 1,
      excludeNumbers: [5, 10],
    };

    const frontendKeys = keysOf(sampleFrontend);

    expectKeysSubsetOf(
      frontendKeys,
      BACKEND_CREATE_BULK_ASYNC_KEYS as string[],
      "BackendCreateBulkAsyncDto",
    );
  });
});
