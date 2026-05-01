/**
 * Contract Test: Procore API
 *
 * Validates that the frontend Procore API client (src/api/endpoints/procore.ts)
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
  BackendProcoreLocationsParams,
  BackendProcorePermissionsParams,
  BackendProcoreToolsParams,
  BackendProcoreInspectionTemplatesParams,
  BackendProcoreDrawingsParams,
  BackendProcoreProjectSearchParams,
  BackendProcoreSyncDto,
  BackendProcoreSyncParams,
  BackendProcoreCreateBulkInspectionsDto,
  BackendProcoreCreateBulkInspectionsParams,
  BackendCreateProcoreItemDto,
  BackendCreateManyProcoreItemsDto,
  BackendToggleVisibilitySingleProcoreItemDto,
  BackendDeleteSingleProcoreItemDto,
  BackendDeleteManyProcoreItemsDto,
  BackendToggleVisibilityBulkProcoreItemDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

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
  useProcoreLocations,
  useProcorePermissions,
  useProcoreTools,
  useProcoreInspectionTemplates,
  useProcoreDrawings,
  useProcoreDrawingsPaged,
  useProcoreProjectsSearch,
  postProcoreSync,
  postProcoreCreateBulkInspections,
} from "@api/endpoints/procore";

import {
  createProcoreItem,
  createProcoreItemsBulk,
  type CreateManyProcoreItemsPayload,
  toggleVisibilitySingleProcoreItem,
  type ToggleVisibilitySingleProcoreItemDto as FEToggleVisibilitySingleDto,
  deleteSingleProcoreItem,
  type DeleteSingleProcoreItemDto as FEDeleteSingleDto,
  deleteManyProcoreItems,
  type DeleteManyProcoreItemsDto as FEDeleteManyDto,
  toggleVisibilityBulkProcoreItems,
  type ToggleVisibilityBulkProcoreItemDto as FEToggleVisibilityBulkDto,
} from "@api/endpoints/procore-item";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all own keys of a runtime object as a string array. */
const keysOf = (obj: Record<string, unknown>): string[] => Object.keys(obj);

/**
 * Shadow key arrays — TypeScript interfaces are erased at runtime, so we
 * maintain arrays that list every field accepted by each backend DTO.
 */
const BACKEND_PROCORE_LOCATIONS_KEYS: (keyof BackendProcoreLocationsParams)[] =
  ["companyId", "projectId"];

const BACKEND_PROCORE_PERMISSIONS_KEYS: (keyof BackendProcorePermissionsParams)[] =
  ["companyId", "projectId"];

const BACKEND_PROCORE_TOOLS_KEYS: (keyof BackendProcoreToolsParams)[] = [
  "companyId",
  "projectId",
];

const BACKEND_PROCORE_INSPECTION_TEMPLATES_KEYS: (keyof BackendProcoreInspectionTemplatesParams)[] =
  ["companyId", "projectId"];

const BACKEND_PROCORE_DRAWINGS_KEYS: (keyof BackendProcoreDrawingsParams)[] = [
  "qrCodeId",
  "companyId",
  "projectId",
  "desktop",
  "fetchPage",
  "paginated",
  "perPage",
  "cursor",
];

const BACKEND_PROCORE_PROJECT_SEARCH_KEYS: (keyof BackendProcoreProjectSearchParams)[] =
  ["companyId", "search"];

const BACKEND_PROCORE_SYNC_BODY_KEYS: (keyof BackendProcoreSyncDto)[] = [
  "groupingId",
  "groupingType",
];

const BACKEND_PROCORE_SYNC_PARAMS_KEYS: (keyof BackendProcoreSyncParams)[] = [
  "companyId",
  "projectId",
];

const BACKEND_PROCORE_BULK_INSPECTIONS_BODY_KEYS: (keyof BackendProcoreCreateBulkInspectionsDto)[] =
  ["groupingId", "inspectionTemplateId", "groupingType", "qrCodeIds"];

const BACKEND_PROCORE_BULK_INSPECTIONS_PARAMS_KEYS: (keyof BackendProcoreCreateBulkInspectionsParams)[] =
  ["companyId", "projectId"];

const BACKEND_CREATE_PROCORE_ITEM_KEYS: (keyof BackendCreateProcoreItemDto)[] =
  [
    "companyId",
    "projectId",
    "groupingType",
    "groupingId",
    "qrcodeId",
    "procoreToolName",
    "procoreItemID",
    "hidden",
  ];

const BACKEND_CREATE_MANY_PROCORE_ITEMS_KEYS: (keyof BackendCreateManyProcoreItemsDto)[] =
  ["companyId", "projectId", "items"];

const BACKEND_TOGGLE_VISIBILITY_SINGLE_KEYS: (keyof BackendToggleVisibilitySingleProcoreItemDto)[] =
  [
    "companyId",
    "projectId",
    "procoreItemID",
    "qrcodeId",
    "hidden",
    "procoreToolName",
  ];

const BACKEND_DELETE_SINGLE_PROCORE_ITEM_KEYS: (keyof BackendDeleteSingleProcoreItemDto)[] =
  ["companyId", "projectId", "procoreItemID", "qrcodeId"];

const BACKEND_DELETE_MANY_PROCORE_ITEMS_KEYS: (keyof BackendDeleteManyProcoreItemsDto)[] =
  [
    "companyId",
    "procoreItemIdsDB",
    "qrcodeId",
    "groupingId",
    "groupingType",
    "projectId",
    "dryRun",
  ];

const BACKEND_TOGGLE_VISIBILITY_BULK_KEYS: (keyof BackendToggleVisibilityBulkProcoreItemDto)[] =
  ["companyId", "projectId", "procoreItemIDs", "qrcodeId", "hidden"];

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

describe("Contract: Procore API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. useProcoreLocations --------------------------------------------------

  it("useProcoreLocations passes query params matching BackendProcoreLocationsParams", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useProcoreLocations(
          "64f1a2b3c4d5e6f7a8b9c0d1",
          "64f1a2b3c4d5e6f7a8b9c0d2",
          "procore-company-1",
          "procore-project-1",
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/locations");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_LOCATIONS_KEYS as string[],
      "BackendProcoreLocationsParams",
    );
  });

  // 2. useProcorePermissions ------------------------------------------------

  it("useProcorePermissions passes query params matching BackendProcorePermissionsParams", async () => {
    mockGet.mockResolvedValue({ data: {} });

    const { result } = renderHook(
      () =>
        useProcorePermissions(
          "64f1a2b3c4d5e6f7a8b9c0d1",
          "64f1a2b3c4d5e6f7a8b9c0d2",
          "procore-company-1",
          "procore-project-1",
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/permissions");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_PERMISSIONS_KEYS as string[],
      "BackendProcorePermissionsParams",
    );
  });

  // 3. useProcoreTools ------------------------------------------------------

  it("useProcoreTools passes query params matching BackendProcoreToolsParams", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useProcoreTools("64f1a2b3c4d5e6f7a8b9c0d1", "64f1a2b3c4d5e6f7a8b9c0d2"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/tools");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_TOOLS_KEYS as string[],
      "BackendProcoreToolsParams",
    );
  });

  // 4. useProcoreInspectionTemplates ----------------------------------------

  it("useProcoreInspectionTemplates passes query params matching BackendProcoreInspectionTemplatesParams", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useProcoreInspectionTemplates(
          "64f1a2b3c4d5e6f7a8b9c0d1",
          "64f1a2b3c4d5e6f7a8b9c0d2",
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/inspection-templates");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_INSPECTION_TEMPLATES_KEYS as string[],
      "BackendProcoreInspectionTemplatesParams",
    );
  });

  // 5. useProcoreDrawings ---------------------------------------------------

  it("useProcoreDrawings passes query params matching BackendProcoreDrawingsParams", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useProcoreDrawings(
          "64f1a2b3c4d5e6f7a8b9c0d3",
          "64f1a2b3c4d5e6f7a8b9c0d1",
          "64f1a2b3c4d5e6f7a8b9c0d2",
          "procore-company-1",
          "procore-project-1",
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/drawings");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_DRAWINGS_KEYS as string[],
      "BackendProcoreDrawingsParams",
    );
  });

  // 6. useProcoreDrawingsPaged ----------------------------------------------

  it("useProcoreDrawingsPaged passes query params matching BackendProcoreDrawingsParams", async () => {
    mockGet.mockResolvedValue({
      data: { data: [], nextCursor: undefined, hasNext: false },
    });

    const { result } = renderHook(
      () =>
        useProcoreDrawingsPaged(
          "64f1a2b3c4d5e6f7a8b9c0d1",
          "64f1a2b3c4d5e6f7a8b9c0d2",
          "procore-company-1",
          "procore-project-1",
          25,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/drawings");

    // Paginated variant sends additional params (paginated, perPage, cursor)
    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_DRAWINGS_KEYS as string[],
      "BackendProcoreDrawingsParams",
    );

    // Verify paginated-specific params are present
    expect(config.params).toHaveProperty("paginated", true);
    expect(config.params).toHaveProperty("perPage", 25);
    expect(config.params).toHaveProperty("cursor");
  });

  // 7. useProcoreProjectsSearch ---------------------------------------------

  it("useProcoreProjectsSearch passes query params matching BackendProcoreProjectSearchParams", async () => {
    mockGet.mockResolvedValue({
      data: { companies: [], projects: [] },
    });

    const { result } = renderHook(
      () =>
        useProcoreProjectsSearch("64f1a2b3c4d5e6f7a8b9c0d1", "building", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/projects/search");

    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_PROJECT_SEARCH_KEYS as string[],
      "BackendProcoreProjectSearchParams",
    );
  });

  // 8. postProcoreSync ------------------------------------------------------

  it("postProcoreSync sends body matching BackendProcoreSyncDto and params matching BackendProcoreSyncParams", async () => {
    mockPost.mockResolvedValueOnce({
      data: { success_message: "ok", created: 5 },
    });

    await postProcoreSync({
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      groupingId: "64f1a2b3c4d5e6f7a8b9c0d3",
      groupingType: "arrangement",
    });

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/sync");

    // Validate body keys
    expect(body).toHaveProperty("groupingId");
    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_PROCORE_SYNC_BODY_KEYS as string[],
      "BackendProcoreSyncDto",
    );

    // Validate query params
    expect(config.params).toHaveProperty("companyId");
    expect(config.params).toHaveProperty("projectId");
    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_SYNC_PARAMS_KEYS as string[],
      "BackendProcoreSyncParams",
    );
  });

  // 9. postProcoreCreateBulkInspections -------------------------------------

  it("postProcoreCreateBulkInspections sends body matching BackendProcoreCreateBulkInspectionsDto", async () => {
    mockPost.mockResolvedValueOnce({
      data: { success_message: "ok", created: 3, total_qrcodes: 10 },
    });

    await postProcoreCreateBulkInspections({
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      groupingId: "64f1a2b3c4d5e6f7a8b9c0d3",
      inspectionTemplateId: "template-abc",
      groupingType: "equipment",
      qrCodeIds: ["qr1", "qr2"],
    });

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { params: Record<string, unknown> },
    ];
    expect(url).toBe("/procore/inspections/bulk");

    // Validate body keys
    expect(body).toHaveProperty("groupingId");
    expect(body).toHaveProperty("inspectionTemplateId");
    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_PROCORE_BULK_INSPECTIONS_BODY_KEYS as string[],
      "BackendProcoreCreateBulkInspectionsDto",
    );

    // Validate query params
    expect(config.params).toHaveProperty("companyId");
    expect(config.params).toHaveProperty("projectId");
    expectKeysSubsetOf(
      keysOf(config.params),
      BACKEND_PROCORE_BULK_INSPECTIONS_PARAMS_KEYS as string[],
      "BackendProcoreCreateBulkInspectionsParams",
    );
  });

  // 10. Route paths and HTTP methods ----------------------------------------

  describe("Route paths and HTTP methods match backend specification", () => {
    it("useProcoreLocations GETs from the correct path", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(
        () => useProcoreLocations("c1", "p1", "pc1", "pp1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.locations"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcorePermissions GETs from the correct path", async () => {
      mockGet.mockResolvedValue({ data: {} });

      const { result } = renderHook(
        () => useProcorePermissions("c1", "p1", "pc1", "pp1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.permissions"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcoreTools GETs from the correct path", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useProcoreTools("c1", "p1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.tools"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcoreInspectionTemplates GETs from the correct path", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(
        () => useProcoreInspectionTemplates("c1", "p1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.inspection-templates"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcoreDrawings GETs from the correct path", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(
        () => useProcoreDrawings("qr1", "c1", "p1", "pc1", "pp1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.drawings"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcoreDrawingsPaged GETs from the correct path", async () => {
      mockGet.mockResolvedValue({
        data: { data: [], nextCursor: undefined, hasNext: false },
      });

      const { result } = renderHook(
        () => useProcoreDrawingsPaged("c1", "p1", "pc1", "pp1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.drawings"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("useProcoreProjectsSearch GETs from the correct path", async () => {
      mockGet.mockResolvedValue({
        data: { companies: [], projects: [] },
      });

      const { result } = renderHook(
        () => useProcoreProjectsSearch("c1", "test"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const route = BACKEND_ROUTES["procore.projects-search"];
      const [url] = mockGet.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("GET");
      expect(mockGet).toHaveBeenCalled();
    });

    it("postProcoreSync POSTs to the correct path", async () => {
      mockPost.mockResolvedValueOnce({
        data: { success_message: "ok" },
      });

      await postProcoreSync({
        companyId: "c1",
        projectId: "p1",
        groupingId: "g1",
      });

      const route = BACKEND_ROUTES["procore.sync"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("postProcoreCreateBulkInspections POSTs to the correct path", async () => {
      mockPost.mockResolvedValueOnce({
        data: { success_message: "ok", created: 0, total_qrcodes: 0 },
      });

      await postProcoreCreateBulkInspections({
        companyId: "c1",
        projectId: "p1",
        groupingId: "g1",
        inspectionTemplateId: "t1",
      });

      const route = BACKEND_ROUTES["procore.inspections-bulk"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Contract Tests — Procore Items API
// ---------------------------------------------------------------------------

describe("Contract: Procore Items API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({
      data: { success_message: "Created", data: { _id: "new-item-id" } },
    });
    mockPatch.mockResolvedValue({
      data: { success_message: "Updated", data: {} },
    });
    mockDelete.mockResolvedValue({
      data: { success_message: "Deleted", total_items: 1, data: [] },
    });
  });

  // 1. createProcoreItem ----------------------------------------------------

  it("createProcoreItem sends body matching BackendCreateProcoreItemDto", async () => {
    const payload = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
      procoreToolName: "inspections",
      procoreItemID: "12345",
    };

    await createProcoreItem(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/procore-item");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_CREATE_PROCORE_ITEM_KEYS as string[],
      "BackendCreateProcoreItemDto",
    );

    expect(body).toHaveProperty("companyId", payload.companyId);
    expect(body).toHaveProperty("projectId", payload.projectId);
    expect(body).toHaveProperty("qrcodeId", payload.qrcodeId);
    expect(body).toHaveProperty("procoreToolName", payload.procoreToolName);
    expect(body).toHaveProperty("procoreItemID", payload.procoreItemID);
  });

  // 2. createProcoreItemsBulk -----------------------------------------------

  it("createProcoreItemsBulk sends body matching BackendCreateManyProcoreItemsDto", async () => {
    const payload: CreateManyProcoreItemsPayload = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      items: [
        {
          qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
          procoreToolName: "inspections",
          procoreItemID: "12345",
        },
        {
          qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d4",
          procoreToolName: "rfis",
          procoreItemID: "67890",
        },
      ],
    };

    await createProcoreItemsBulk(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/procore-item/bulk");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_CREATE_MANY_PROCORE_ITEMS_KEYS as string[],
      "BackendCreateManyProcoreItemsDto",
    );

    expect(body).toHaveProperty("companyId", payload.companyId);
    expect(body).toHaveProperty("projectId", payload.projectId);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect((body.items as unknown[]).length).toBe(2);

    // Each item entry must have the expected fields
    for (const item of body.items as Record<string, unknown>[]) {
      expect(item).toHaveProperty("qrcodeId");
      expect(item).toHaveProperty("procoreToolName");
      expect(item).toHaveProperty("procoreItemID");
    }
  });

  // 3. toggleVisibilitySingleProcoreItem ------------------------------------

  it("toggleVisibilitySingleProcoreItem sends body matching BackendToggleVisibilitySingleProcoreItemDto", async () => {
    const formData: FEToggleVisibilitySingleDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      procoreItemID: "12345",
      qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
      hidden: true,
      procoreToolName: "inspections",
    };

    await toggleVisibilitySingleProcoreItem(formData);

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/procore-item/toggle-visibility/single");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_TOGGLE_VISIBILITY_SINGLE_KEYS as string[],
      "BackendToggleVisibilitySingleProcoreItemDto",
    );

    expect(body).toHaveProperty("companyId", formData.companyId);
    expect(body).toHaveProperty("projectId", formData.projectId);
    expect(body).toHaveProperty("procoreItemID", formData.procoreItemID);
    expect(body).toHaveProperty("qrcodeId", formData.qrcodeId);
    expect(body).toHaveProperty("hidden", true);
  });

  // 4. deleteSingleProcoreItem ----------------------------------------------

  it("deleteSingleProcoreItem sends body matching BackendDeleteSingleProcoreItemDto", async () => {
    const formData: FEDeleteSingleDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      procoreItemID: "12345",
      qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
    };

    await deleteSingleProcoreItem(formData);

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(url).toBe("/procore-item/delete/single");

    const body = config.data;
    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_DELETE_SINGLE_PROCORE_ITEM_KEYS as string[],
      "BackendDeleteSingleProcoreItemDto",
    );

    expect(body).toHaveProperty("companyId", formData.companyId);
    expect(body).toHaveProperty("projectId", formData.projectId);
    expect(body).toHaveProperty("procoreItemID", formData.procoreItemID);
    expect(body).toHaveProperty("qrcodeId", formData.qrcodeId);
  });

  // 5. deleteManyProcoreItems -----------------------------------------------

  it("deleteManyProcoreItems sends body matching BackendDeleteManyProcoreItemsDto", async () => {
    mockDelete.mockResolvedValue({
      data: { success_message: "Deleted", total_items: 2, data: [] },
    });

    const formData: FEDeleteManyDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      procoreItemIdsDB: [
        "64f1a2b3c4d5e6f7a8b9c0d5",
        "64f1a2b3c4d5e6f7a8b9c0d6",
      ],
      qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
    };

    await deleteManyProcoreItems(formData);

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(url).toBe("/procore-item/bulk");

    const body = config.data;
    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_DELETE_MANY_PROCORE_ITEMS_KEYS as string[],
      "BackendDeleteManyProcoreItemsDto",
    );

    expect(body).toHaveProperty("companyId", formData.companyId);
    expect(body).toHaveProperty("procoreItemIdsDB", formData.procoreItemIdsDB);
  });

  // 6. deleteManyProcoreItems — empty IDs early return ----------------------

  it("deleteManyProcoreItems returns early when procoreItemIdsDB is empty", async () => {
    const formData: FEDeleteManyDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      procoreItemIdsDB: [],
    };

    const result = await deleteManyProcoreItems(formData);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.total_items).toBe(0);
  });

  // 7. toggleVisibilityBulkProcoreItems -------------------------------------

  it("toggleVisibilityBulkProcoreItems sends body matching BackendToggleVisibilityBulkProcoreItemDto", async () => {
    mockPatch.mockResolvedValue({
      data: { success_message: "Updated", total_items: 3, data: [] },
    });

    const formData: FEToggleVisibilityBulkDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectId: "64f1a2b3c4d5e6f7a8b9c0d2",
      procoreItemIDs: ["111", "222", "333"],
      qrcodeId: "64f1a2b3c4d5e6f7a8b9c0d3",
      hidden: false,
    };

    await toggleVisibilityBulkProcoreItems(formData);

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("/procore-item/toggle-visibility/bulk");

    expectKeysSubsetOf(
      keysOf(body),
      BACKEND_TOGGLE_VISIBILITY_BULK_KEYS as string[],
      "BackendToggleVisibilityBulkProcoreItemDto",
    );

    expect(body).toHaveProperty("companyId", formData.companyId);
    expect(body).toHaveProperty("projectId", formData.projectId);
    expect(body).toHaveProperty("procoreItemIDs", formData.procoreItemIDs);
    expect(body).toHaveProperty("qrcodeId", formData.qrcodeId);
    expect(body).toHaveProperty("hidden", false);
  });

  // 8. Route paths and HTTP methods -----------------------------------------

  describe("Route paths and HTTP methods match backend specification", () => {
    it("createProcoreItem POSTs to the correct path", async () => {
      await createProcoreItem({
        companyId: "c1",
        projectId: "p1",
        qrcodeId: "qr1",
        procoreToolName: "inspections",
        procoreItemID: "123",
      });

      const route = BACKEND_ROUTES["procore-item.create"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("createProcoreItemsBulk POSTs to the correct path", async () => {
      await createProcoreItemsBulk({
        companyId: "c1",
        projectId: "p1",
        items: [
          { qrcodeId: "qr1", procoreToolName: "rfis", procoreItemID: "123" },
        ],
      });

      const route = BACKEND_ROUTES["procore-item.create-bulk"];
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("toggleVisibilitySingleProcoreItem PATCHes to the correct path", async () => {
      await toggleVisibilitySingleProcoreItem({
        companyId: "c1",
        projectId: "p1",
        procoreItemID: "123",
        qrcodeId: "qr1",
        hidden: true,
      });

      const route = BACKEND_ROUTES["procore-item.toggle-visibility-single"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("deleteSingleProcoreItem DELETEs to the correct path", async () => {
      await deleteSingleProcoreItem({
        companyId: "c1",
        projectId: "p1",
        procoreItemID: "123",
        qrcodeId: "qr1",
      });

      const route = BACKEND_ROUTES["procore-item.delete-single"];
      const [url] = mockDelete.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("DELETE");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("deleteManyProcoreItems DELETEs to the correct path", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyProcoreItems({
        companyId: "c1",
        procoreItemIdsDB: ["id1"],
      });

      const route = BACKEND_ROUTES["procore-item.delete-bulk"];
      const [url] = mockDelete.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("DELETE");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("toggleVisibilityBulkProcoreItems PATCHes to the correct path", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", total_items: 1, data: [] },
      });

      await toggleVisibilityBulkProcoreItems({
        companyId: "c1",
        projectId: "p1",
        procoreItemIDs: ["123"],
        qrcodeId: "qr1",
        hidden: true,
      });

      const route = BACKEND_ROUTES["procore-item.toggle-visibility-bulk"];
      const [url] = mockPatch.mock.calls[0] as [string];
      expect(url).toBe(route.path);
      expect(route.method).toBe("PATCH");
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    it("all Procore Items routes are defined in BACKEND_ROUTES", () => {
      const requiredRoutes = [
        "procore-item.create",
        "procore-item.create-bulk",
        "procore-item.patch",
        "procore-item.delete-single",
        "procore-item.delete-bulk",
        "procore-item.toggle-visibility-single",
        "procore-item.toggle-visibility-bulk",
      ];

      for (const routeKey of requiredRoutes) {
        expect(BACKEND_ROUTES).toHaveProperty(routeKey);
        expect(BACKEND_ROUTES[routeKey]).toHaveProperty("method");
        expect(BACKEND_ROUTES[routeKey]).toHaveProperty("path");
      }
    });
  });
});
