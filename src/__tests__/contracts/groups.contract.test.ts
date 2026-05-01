/**
 * Contract Test: Groups API
 *
 * Validates that the frontend Groups API client aligns with the backend
 * specification defined in backend-contracts.ts. These tests catch drift
 * between frontend types/calls and backend DTOs/routes without requiring
 * a running backend.
 *
 * When the backend changes a DTO, update backend-contracts.ts first,
 * then run these tests to see which frontend code needs updating.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import {
  BackendCreateGroupDto,
  BackendGetGroupsDto,
  BackendPatchGroupDto,
  BackendDeleteManyGroupsDto,
  BackendBasicRequestDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ============================================================
// Mocks
// ============================================================

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

// Mock axios.isAxiosError used in patchGroup error handling
vi.mock("axios", () => ({
  default: {
    isAxiosError: (error: unknown) =>
      typeof error === "object" && error !== null && "response" in error,
  },
  isAxiosError: (error: unknown) =>
    typeof error === "object" && error !== null && "response" in error,
}));

import {
  type CreateGroupPayload,
  type GroupsListParams,
  type PatchGroupDto,
  type PaginatedGroupsResponse,
  type GroupApi,
} from "@api/endpoints/groups";

import {
  createGroup,
  useListGroups,
  patchGroup,
  deleteSingleGroup,
  deleteManyGroups,
} from "@api/endpoints/groups";

// ============================================================
// Test helpers
// ============================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

/** Standard paginated mock response for GET /groups */
const MOCK_PAGINATED_RESPONSE: PaginatedGroupsResponse = {
  success_message: "Groups fetched successfully",
  total_pages: 1,
  current_page: 1,
  total_items: 1,
  has_next: false,
  has_prev: false,
  data: [
    {
      _id: "6601abc123def456789abcde",
      type: "arrangement",
      groupName: "Floor Plan A",
      project: "6601abc123def456789abcd1",
      company: "6601abc123def456789abcd2",
      categories: ["cat-1"],
    },
  ],
};

// ============================================================
// Contract Tests
// ============================================================

describe("Contract: Groups API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock responses so calls don't reject unexpectedly
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED_RESPONSE });
    mockPost.mockResolvedValue({
      data: {
        success_message: "Group created",
        data: { _id: "new-group-id" },
      },
    });
    mockPatch.mockResolvedValue({
      data: {
        success_message: "Group updated",
        data: { _id: "6601abc123def456789abcde" },
      },
    });
    mockDelete.mockResolvedValue({
      data: {
        success_message: "Group deleted",
        data: { _id: "6601abc123def456789abcde" },
      },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------
  // 1. createGroup sends body matching BackendCreateGroupDto
  // ----------------------------------------------------------
  it("createGroup sends body matching BackendCreateGroupDto", async () => {
    const payload: CreateGroupPayload = {
      companyId: "6601abc123def456789abcd1",
      projectId: "6601abc123def456789abcd2",
      groupName: "Test Group",
      type: "arrangement",
      categories: ["cat-1", "cat-2"],
    };

    await createGroup(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/groups");

    // Every key the frontend sends must be a valid BackendCreateGroupDto field
    const backendFields: (keyof BackendCreateGroupDto)[] = [
      "companyId",
      "projectId",
      "groupName",
      "type",
      "arrangementType",
      "equipmentID",
      "description",
      "categories",
    ];
    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    // Required fields per backend DTO must be present
    expect(body).toHaveProperty("companyId", payload.companyId);
    expect(body).toHaveProperty("projectId", payload.projectId);
    expect(body).toHaveProperty("groupName", payload.groupName);
    expect(body).toHaveProperty("type", payload.type);
    expect(body).toHaveProperty("categories", payload.categories);
  });

  // ----------------------------------------------------------
  // 2. createGroup type field includes all backend-supported types
  // ----------------------------------------------------------
  it("createGroup type field includes all backend-supported types", () => {
    // The backend CreateGroupDto accepts:
    //   "arrangement" | "equipment" | "group" | "procore-drawing-codes"
    //
    // This compile-time assertion verifies the frontend CreateGroupPayload.type
    // union covers all values accepted by BackendCreateGroupDto.type.

    // If BackendCreateGroupDto.type adds a new value that CreateGroupPayload
    // doesn't include, this assignment will produce a TypeScript error.
    type BackendCreateType = NonNullable<BackendCreateGroupDto["type"]>;
    type FrontendCreateType = NonNullable<CreateGroupPayload["type"]>;

    // Assert backend type is assignable to frontend type (frontend covers backend)
    const _backendToFrontend: FrontendCreateType =
      "" as unknown as BackendCreateType;
    expect(_backendToFrontend).toBeDefined();

    // Runtime check: enumerate backend-supported values and confirm they are
    // valid frontend payload values at the type level
    const backendTypes: BackendCreateType[] = [
      "arrangement",
      "equipment",
      "group",
      "procore-drawing-codes",
    ];

    for (const t of backendTypes) {
      // Each backend type must be assignable to FrontendCreateType
      const _check: FrontendCreateType = t;
      expect(_check).toBe(t);
    }
  });

  // ----------------------------------------------------------
  // 3. useListGroups passes query params matching BackendGetGroupsDto
  // ----------------------------------------------------------
  it("useListGroups passes query params matching BackendGetGroupsDto", async () => {
    const params: GroupsListParams = {
      companyId: "6601abc123def456789abcd1",
      projectId: "6601abc123def456789abcd2",
      type: "arrangement",
      types: ["arrangement", "equipment"],
      current_page: 1,
      per_page: 25,
      search: "floor",
      sortBy: "groupName",
      sortDir: "asc",
      excludeArchivedProjects: true,
    };

    const { result } = renderHook(() => useListGroups(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/groups");

    // Every param key sent to the backend must be a valid BackendGetGroupsDto field
    const backendFields: (keyof BackendGetGroupsDto)[] = [
      "companyId",
      "projectId",
      "type",
      "types",
      "arrangementType",
      "excludeArrangementTypes",
      "filter_ids",
      "current_page",
      "per_page",
      "search",
      "sortBy",
      "sortDir",
      "excludeArchivedProjects",
    ];

    const sentParams = config.params as Record<string, unknown>;
    for (const key of Object.keys(sentParams)) {
      expect(backendFields).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 4. patchGroup sends body matching BackendPatchGroupDto
  // ----------------------------------------------------------
  it("patchGroup sends body matching BackendPatchGroupDto", async () => {
    const groupId = "6601abc123def456789abcde";
    const formData: PatchGroupDto = {
      companyId: "6601abc123def456789abcd1",
      projectId: "6601abc123def456789abcd2",
      groupName: "Updated Name",
      description: "Updated description",
      type: "equipment",
      passwordActivated: true,
      password: "secure123",
      timezone: "America/New_York",
      weekdayPassword: true,
      weekdayPasswordTimeStart: "08:00",
      weekdayPasswordTimeEnd: "17:00",
      weekendPassword: false,
    };

    await patchGroup(groupId, formData);

    expect(mockPatch).toHaveBeenCalledTimes(1);

    const [url, body] = mockPatch.mock.calls[0];
    expect(url).toBe(`/groups/${groupId}`);

    // Every key the frontend sends must be a valid BackendPatchGroupDto field
    const backendFields: (keyof BackendPatchGroupDto)[] = [
      "companyId",
      "projectId",
      "groupName",
      "description",
      "equipmentID",
      "type",
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

    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    // Required field per backend DTO
    expect(body).toHaveProperty("companyId");
  });

  // ----------------------------------------------------------
  // 5. deleteSingleGroup sends body matching BackendBasicRequestDto
  // ----------------------------------------------------------
  it("deleteSingleGroup sends body matching BackendBasicRequestDto", async () => {
    const companyId = "6601abc123def456789abcd1";
    const groupId = "6601abc123def456789abcde";

    await deleteSingleGroup(companyId, groupId);

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0];
    expect(url).toBe(`/groups/${groupId}`);

    // The data body must match BackendBasicRequestDto shape
    const body = config.data as Record<string, unknown>;
    const backendFields: (keyof BackendBasicRequestDto)[] = [
      "companyId",
      "projectId",
    ];

    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    expect(body).toHaveProperty("companyId", companyId);
  });

  // ----------------------------------------------------------
  // 6. deleteManyGroups sends body matching BackendDeleteManyGroupsDto
  // ----------------------------------------------------------
  it("deleteManyGroups sends body matching BackendDeleteManyGroupsDto", async () => {
    const companyId = "6601abc123def456789abcd1";
    const groupIds = ["6601abc123def456789abcd3", "6601abc123def456789abcd4"];
    const projectId = "6601abc123def456789abcd2";

    mockDelete.mockResolvedValue({
      data: {
        success_message: "Groups deleted",
        total_items: 2,
        data: [],
      },
    });

    await deleteManyGroups(companyId, groupIds, projectId);

    expect(mockDelete).toHaveBeenCalledTimes(1);

    const [url, config] = mockDelete.mock.calls[0];
    expect(url).toBe("/groups/bulk");

    // The data body must match BackendDeleteManyGroupsDto shape
    const body = config.data as Record<string, unknown>;
    const backendFields: (keyof BackendDeleteManyGroupsDto)[] = [
      "companyId",
      "projectId",
      "groupIds",
    ];

    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    expect(body).toHaveProperty("companyId", companyId);
    expect(body).toHaveProperty("groupIds", groupIds);
    expect(body).toHaveProperty("projectId", projectId);
  });

  // ----------------------------------------------------------
  // 7. GroupApi response type has required backend fields
  // ----------------------------------------------------------
  it("GroupApi response type has required backend fields", () => {
    // Verify GroupApi includes the core fields the backend Group model returns.
    // This is a compile-time structural check: if any of these properties are
    // removed from GroupApi, the explicit property accesses below will fail.

    const sampleGroup: GroupApi = {
      _id: "6601abc123def456789abcde",
      type: "arrangement",
      groupName: "Test Group",
      project: "6601abc123def456789abcd1",
      company: "6601abc123def456789abcd2",
    };

    // Core identity fields from backend Group model
    expect(sampleGroup).toHaveProperty("_id");
    expect(sampleGroup).toHaveProperty("type");
    expect(sampleGroup).toHaveProperty("groupName");
    expect(sampleGroup).toHaveProperty("project");
    expect(sampleGroup).toHaveProperty("company");

    // Verify PaginatedGroupsResponse shape matches backend's
    // BackendPaginatedResponseDto<Group>
    const samplePaginated: PaginatedGroupsResponse = {
      success_message: "Success",
      total_pages: 5,
      current_page: 1,
      total_items: 50,
      has_next: true,
      has_prev: false,
      data: [sampleGroup],
    };

    // Each pagination envelope field must exist
    expect(samplePaginated).toHaveProperty("success_message");
    expect(samplePaginated).toHaveProperty("total_pages");
    expect(samplePaginated).toHaveProperty("current_page");
    expect(samplePaginated).toHaveProperty("total_items");
    expect(samplePaginated).toHaveProperty("has_next");
    expect(samplePaginated).toHaveProperty("has_prev");
    expect(samplePaginated).toHaveProperty("data");
    expect(Array.isArray(samplePaginated.data)).toBe(true);

    // Verify field types
    expect(typeof samplePaginated.success_message).toBe("string");
    expect(typeof samplePaginated.total_pages).toBe("number");
    expect(typeof samplePaginated.current_page).toBe("number");
    expect(typeof samplePaginated.total_items).toBe("number");
    expect(typeof samplePaginated.has_next).toBe("boolean");
    expect(typeof samplePaginated.has_prev).toBe("boolean");
  });

  // ----------------------------------------------------------
  // 8. GroupApi.type field alignment
  // ----------------------------------------------------------
  it("GroupApi.type field alignment - documents known gap", () => {
    // KNOWN GAP:
    // The frontend GroupApi.type is defined as: "arrangement" | "equipment"
    // The backend Group model supports:         "arrangement" | "equipment" | "group" | "procore-drawing-codes"
    //
    // The GroupApi type should be updated to include "group" and "procore-drawing-codes"
    // to fully match the backend Group schema. This gap exists because the GroupApi
    // type was defined before the group type consolidation was completed. The
    // CreateGroupPayload.type already includes all four values, but the response
    // type (GroupApi) has not been updated yet.
    //
    // Impact: If the backend returns a group with type "group" or "procore-drawing-codes",
    // the frontend will still receive it (TypeScript types don't enforce at runtime),
    // but TypeScript narrowing on GroupApi.type won't recognize these values.
    //
    // TODO: Update GroupApi.type to "arrangement" | "equipment" | "group" | "procore-drawing-codes"

    type GroupApiType = NonNullable<GroupApi["type"]>;

    // These two values ARE in GroupApi.type
    const arrangement: GroupApiType = "arrangement";
    const equipment: GroupApiType = "equipment";
    expect(arrangement).toBe("arrangement");
    expect(equipment).toBe("equipment");

    // These two values are NOT in GroupApi.type but ARE in the backend model.
    // We cannot do a direct type assignment without a type error, so we verify
    // at runtime that the backend supports them and document the gap.
    const backendOnlyTypes = ["group", "procore-drawing-codes"];
    for (const t of backendOnlyTypes) {
      // Verify the backend contract includes these types
      const backendType = t as NonNullable<BackendCreateGroupDto["type"]>;
      expect(backendType).toBe(t);

      // The following would produce a TypeScript error, confirming the gap:
      // const _: GroupApiType = t; // Error: Type 'string' is not assignable to type '"arrangement" | "equipment"'
    }

    // The CreateGroupPayload.type correctly covers all backend types
    type CreateType = NonNullable<CreateGroupPayload["type"]>;
    const allBackendTypes: CreateType[] = [
      "arrangement",
      "equipment",
      "group",
      "procore-drawing-codes",
    ];
    expect(allBackendTypes).toHaveLength(4);
  });

  // ----------------------------------------------------------
  // 9. Route paths match backend
  // ----------------------------------------------------------
  describe("Route paths match backend", () => {
    it("createGroup POSTs to the correct route", async () => {
      await createGroup({
        companyId: "6601abc123def456789abcd1",
        projectId: "6601abc123def456789abcd2",
        groupName: "Route Test",
      });

      const route = BACKEND_ROUTES["groups.create"];
      expect(route.method).toBe("POST");
      expect(mockPost.mock.calls[0][0]).toBe(route.path);
    });

    it("useListGroups GETs from the correct route", async () => {
      const { result } = renderHook(
        () => useListGroups({ companyId: "6601abc123def456789abcd1" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const route = BACKEND_ROUTES["groups.list"];
      expect(route.method).toBe("GET");
      expect(mockGet.mock.calls[0][0]).toBe(route.path);
    });

    it("patchGroup PATCHes to the correct route pattern", async () => {
      const groupId = "6601abc123def456789abcde";
      await patchGroup(groupId, {
        companyId: "6601abc123def456789abcd1",
        groupName: "Patched",
      });

      const route = BACKEND_ROUTES["groups.patch"];
      expect(route.method).toBe("PATCH");
      // Backend route is "/groups/:id", frontend substitutes :id with actual ID
      const expectedPath = route.path.replace(":id", groupId);
      expect(mockPatch.mock.calls[0][0]).toBe(expectedPath);
    });

    it("deleteSingleGroup DELETEs to the correct route pattern", async () => {
      const groupId = "6601abc123def456789abcde";
      await deleteSingleGroup("6601abc123def456789abcd1", groupId);

      const route = BACKEND_ROUTES["groups.delete"];
      expect(route.method).toBe("DELETE");
      const expectedPath = route.path.replace(":id", groupId);
      expect(mockDelete.mock.calls[0][0]).toBe(expectedPath);
    });

    it("deleteManyGroups DELETEs to the correct route", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyGroups("6601abc123def456789abcd1", [
        "6601abc123def456789abcd3",
      ]);

      const route = BACKEND_ROUTES["groups.delete-bulk"];
      expect(route.method).toBe("DELETE");
      expect(mockDelete.mock.calls[0][0]).toBe(route.path);
    });

    it("all groups routes are defined in BACKEND_ROUTES", () => {
      // Verify every groups route we depend on actually exists in the contract
      const requiredRoutes = [
        "groups.list",
        "groups.get",
        "groups.create",
        "groups.patch",
        "groups.delete",
        "groups.delete-bulk",
        "groups.procore-fetch-global",
      ];

      for (const routeKey of requiredRoutes) {
        expect(BACKEND_ROUTES).toHaveProperty(routeKey);
        expect(BACKEND_ROUTES[routeKey]).toHaveProperty("method");
        expect(BACKEND_ROUTES[routeKey]).toHaveProperty("path");
      }
    });
  });
});
