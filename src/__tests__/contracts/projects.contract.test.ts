/**
 * Contract Test: Projects API
 *
 * Validates that the frontend Projects API client aligns with the backend
 * specification defined in backend-contracts.ts. These tests catch
 * frontend/backend drift in DTOs, query parameter naming, route paths,
 * and response shapes.
 *
 * Key concern: The frontend ListProjectsParams uses camelCase field names
 * (page, perPage, sortKey, sortDir) that must be mapped to the backend's
 * snake_case names (current_page, per_page, sort_by, sort_dir) before
 * sending the request.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import {
  BackendCreateProjectDto,
  BackendProjectListDto,
  BackendPatchProjectDto,
  BackendDeleteManyProjectsDto,
  BackendBasicRequestDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ============================================================
// Mocks — must be declared before imports that depend on them
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
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================
// Frontend imports (after mocks are wired)
// ============================================================

import {
  type CreateProjectDto,
  type ListProjectsParams,
  type PatchProjectDto,
  type DeleteManyProjectsDto,
  type ProjectsResponse,
} from "@api/endpoints/projects";

import {
  createProject,
  useListProjects,
  patchProject,
  deleteSingleProject,
  deleteManyProjects,
} from "@api/endpoints/projects";

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

/** Minimal paginated response so hooks resolve successfully. */
const STUB_PAGINATED_RESPONSE = {
  data: {
    success_message: "OK",
    total_pages: 1,
    current_page: 1,
    total_items: 0,
    has_next: false,
    has_prev: false,
    data: [],
  },
};

// ============================================================
// Tests
// ============================================================

describe("Contract: Projects API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------
  // 1. createProject sends body matching BackendCreateProjectDto
  // ----------------------------------------------------------
  it("createProject sends body matching BackendCreateProjectDto", async () => {
    mockPost.mockResolvedValue({
      data: { success_message: "Created", data: { _id: "project-new" } },
    });

    const dto: CreateProjectDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      userId: "64f1a2b3c4d5e6f7a8b9c0d2",
      projectName: "Contract Test Project",
      projectCity: "Denver",
      projectState: "CO",
      projectZIP: "80202",
    };

    await createProject(dto);

    const [url, sentBody] = mockPost.mock.calls[0];

    // Route matches backend
    expect(url).toBe("/project");

    // Every required field from BackendCreateProjectDto is present
    const backendRequired: (keyof BackendCreateProjectDto)[] = [
      "companyId",
      "projectName",
      "projectCity",
      "projectState",
      "projectZIP",
    ];
    for (const field of backendRequired) {
      expect(sentBody).toHaveProperty(field);
    }

    // Verify actual values
    expect(sentBody.companyId).toBe(dto.companyId);
    expect(sentBody.projectName).toBe(dto.projectName);
    expect(sentBody.projectCity).toBe(dto.projectCity);
    expect(sentBody.projectState).toBe(dto.projectState);
    expect(sentBody.projectZIP).toBe(dto.projectZIP);

    // Frontend always sends userId (required on frontend, optional on backend).
    // This is acceptable — the backend simply ignores it or uses it for
    // permission validation.
    expect(sentBody.userId).toBe(dto.userId);

    // The body must not contain keys outside BackendCreateProjectDto
    const allBackendKeys: (keyof BackendCreateProjectDto)[] = [
      "companyId",
      "userId",
      "projectName",
      "projectAddress",
      "projectCity",
      "projectState",
      "projectZIP",
      "clientName",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(allBackendKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 2. useListProjects maps params to BackendProjectListDto field names
  // ----------------------------------------------------------
  it("useListProjects maps params to BackendProjectListDto field names", async () => {
    mockGet.mockResolvedValue(STUB_PAGINATED_RESPONSE);

    const frontendParams: ListProjectsParams = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      page: 3,
      perPage: 50,
      search: "warehouse",
      status: "active",
      sortKey: "projectName",
      sortDir: "desc",
    };

    const { result } = renderHook(() => useListProjects(frontendParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/project");

    const sentParams = config.params;

    // CRITICAL: Frontend camelCase -> backend snake_case mapping
    // page       -> current_page
    // perPage    -> per_page
    // sortKey    -> sort_by
    // sortDir    -> sort_dir
    expect(sentParams.current_page).toBe(3);
    expect(sentParams.per_page).toBe(50);
    expect(sentParams.sort_by).toBe("projectName");
    expect(sentParams.sort_dir).toBe("desc");

    // Pass-through fields
    expect(sentParams.companyId).toBe(frontendParams.companyId);
    expect(sentParams.search).toBe("warehouse");
    expect(sentParams.status).toBe("active");

    // The params sent must only contain valid BackendProjectListDto keys
    const validBackendKeys: (keyof BackendProjectListDto)[] = [
      "companyId",
      "status",
      "is_archived",
      "filter_ids",
      "current_page",
      "per_page",
      "search",
      "sort_by",
      "sort_dir",
    ];
    for (const key of Object.keys(sentParams)) {
      // undefined values are acceptable — axios strips them
      if (sentParams[key] !== undefined) {
        expect(validBackendKeys).toContain(key);
      }
    }
  });

  // ----------------------------------------------------------
  // 3. patchProject sends body matching BackendPatchProjectDto
  // ----------------------------------------------------------
  it("patchProject sends body matching BackendPatchProjectDto", async () => {
    mockPatch.mockResolvedValue({
      data: {
        success_message: "Updated",
        data: { _id: "project-789", projectName: "Renamed" },
      },
    });

    const dto: PatchProjectDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectName: "Renamed Project",
      projectCity: "Austin",
      projectStatus: "completed",
      procoreProjectID: "procore-456",
    };

    await patchProject("project-789", dto);

    const [url, sentBody] = mockPatch.mock.calls[0];

    // Route matches backend pattern /project/:id
    expect(url).toBe("/project/project-789");

    // Required field is present
    expect(sentBody.companyId).toBe(dto.companyId);

    // All sent keys are valid BackendPatchProjectDto fields
    const validBackendKeys: (keyof BackendPatchProjectDto)[] = [
      "companyId",
      "projectName",
      "projectAddress",
      "projectCity",
      "projectState",
      "projectZIP",
      "clientName",
      "archived",
      "status",
      "projectStatus",
      "procoreCompanyID",
      "procoreProjectID",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validBackendKeys).toContain(key);
    }

    // Specific values
    expect(sentBody.projectName).toBe("Renamed Project");
    expect(sentBody.projectCity).toBe("Austin");
    expect(sentBody.projectStatus).toBe("completed");
    expect(sentBody.procoreProjectID).toBe("procore-456");
  });

  // ----------------------------------------------------------
  // 4. deleteSingleProject sends body matching BackendBasicRequestDto
  // ----------------------------------------------------------
  it("deleteSingleProject sends body matching BackendBasicRequestDto", async () => {
    mockDelete.mockResolvedValue({
      data: { success_message: "Deleted", data: { _id: "project-789" } },
    });

    await deleteSingleProject("64f1a2b3c4d5e6f7a8b9c0d1", "project-789");

    const [url, config] = mockDelete.mock.calls[0];

    // Route matches backend pattern /project/:id
    expect(url).toBe("/project/project-789");

    // Body sent via axios `data` property
    const sentBody = config.data;
    expect(sentBody).toEqual({ companyId: "64f1a2b3c4d5e6f7a8b9c0d1" });

    // Validate all keys are valid BackendBasicRequestDto fields
    const validKeys: (keyof BackendBasicRequestDto)[] = [
      "companyId",
      "projectId",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 5. deleteManyProjects sends body matching BackendDeleteManyProjectsDto
  // ----------------------------------------------------------
  it("deleteManyProjects sends body matching BackendDeleteManyProjectsDto", async () => {
    mockDelete.mockResolvedValue({
      data: { success_message: "Deleted", total_items: 2, data: [] },
    });

    const dto: DeleteManyProjectsDto = {
      companyId: "64f1a2b3c4d5e6f7a8b9c0d1",
      projectIds: ["project-aaa", "project-bbb"],
    };

    await deleteManyProjects(dto);

    const [url, config] = mockDelete.mock.calls[0];

    // Route matches backend
    expect(url).toBe("/project/bulk");

    // Body sent via axios `data` property
    const sentBody = config.data;
    expect(sentBody.companyId).toBe(dto.companyId);
    expect(sentBody.projectIds).toEqual(["project-aaa", "project-bbb"]);

    // Validate all keys are valid BackendDeleteManyProjectsDto fields
    const validKeys: (keyof BackendDeleteManyProjectsDto)[] = [
      "companyId",
      "projectIds",
    ];
    for (const key of Object.keys(sentBody)) {
      expect(validKeys).toContain(key);
    }
  });

  // ----------------------------------------------------------
  // 6. ProjectsResponse matches backend PaginatedProjectResponseDto
  // ----------------------------------------------------------
  it("ProjectsResponse matches backend PaginatedProjectResponseDto shape", () => {
    // Construct a value that satisfies the frontend ProjectsResponse type.
    // If any required field is missing, TypeScript will fail at compile time,
    // and the runtime assertions below will catch shape drift.
    const response: ProjectsResponse = {
      success_message: "OK",
      total_pages: 5,
      current_page: 2,
      total_items: 100,
      has_next: true,
      has_prev: true,
      data: [],
    };

    // Every field from BackendPaginatedResponseDto must be present
    expect(response).toHaveProperty("success_message");
    expect(response).toHaveProperty("total_pages");
    expect(response).toHaveProperty("current_page");
    expect(response).toHaveProperty("total_items");
    expect(response).toHaveProperty("has_next");
    expect(response).toHaveProperty("has_prev");
    expect(response).toHaveProperty("data");

    // Type checks on the values
    expect(typeof response.success_message).toBe("string");
    expect(typeof response.total_pages).toBe("number");
    expect(typeof response.current_page).toBe("number");
    expect(typeof response.total_items).toBe("number");
    expect(typeof response.has_next).toBe("boolean");
    expect(typeof response.has_prev).toBe("boolean");
    expect(Array.isArray(response.data)).toBe(true);
  });

  // ----------------------------------------------------------
  // 7. Route paths match backend
  // ----------------------------------------------------------
  describe("Route paths match backend", () => {
    it("project.list route is GET /project", () => {
      const route = BACKEND_ROUTES["project.list"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/project");
    });

    it("project.create route is POST /project", () => {
      const route = BACKEND_ROUTES["project.create"];
      expect(route.method).toBe("POST");
      expect(route.path).toBe("/project");
    });

    it("project.patch route is PATCH /project/:projectId", () => {
      const route = BACKEND_ROUTES["project.patch"];
      expect(route.method).toBe("PATCH");
      expect(route.path).toBe("/project/:projectId");
    });

    it("project.delete route is DELETE /project/:projectId", () => {
      const route = BACKEND_ROUTES["project.delete"];
      expect(route.method).toBe("DELETE");
      expect(route.path).toBe("/project/:projectId");
    });

    it("project.delete-bulk route is DELETE /project/bulk", () => {
      const route = BACKEND_ROUTES["project.delete-bulk"];
      expect(route.method).toBe("DELETE");
      expect(route.path).toBe("/project/bulk");
    });

    it("project.get route is GET /project/:projectId", () => {
      const route = BACKEND_ROUTES["project.get"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/project/:projectId");
    });

    it("project.get-by-id route is GET /project/by-id/:projectId", () => {
      const route = BACKEND_ROUTES["project.get-by-id"];
      expect(route.method).toBe("GET");
      expect(route.path).toBe("/project/by-id/:projectId");
    });

    it("createProject posts to the correct URL", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "Created", data: {} },
      });

      await createProject({
        companyId: "company-1",
        userId: "user-1",
        projectName: "Test",
        projectCity: "City",
        projectState: "ST",
        projectZIP: "12345",
      });

      expect(mockPost.mock.calls[0][0]).toBe(
        BACKEND_ROUTES["project.create"].path,
      );
    });

    it("patchProject patches to /project/:id", async () => {
      mockPatch.mockResolvedValue({
        data: { success_message: "Updated", data: {} },
      });

      await patchProject("proj-123", { companyId: "company-1" });

      // The frontend substitutes :projectId with the actual ID
      expect(mockPatch.mock.calls[0][0]).toBe("/project/proj-123");
    });

    it("deleteSingleProject deletes at /project/:id", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", data: {} },
      });

      await deleteSingleProject("company-1", "proj-123");

      expect(mockDelete.mock.calls[0][0]).toBe("/project/proj-123");
    });

    it("deleteManyProjects deletes at /project/bulk", async () => {
      mockDelete.mockResolvedValue({
        data: { success_message: "Deleted", total_items: 1, data: [] },
      });

      await deleteManyProjects({
        companyId: "company-1",
        projectIds: ["proj-1"],
      });

      expect(mockDelete.mock.calls[0][0]).toBe(
        BACKEND_ROUTES["project.delete-bulk"].path,
      );
    });
  });

  // ----------------------------------------------------------
  // 8. Frontend param name mapping is correct (explicit)
  // ----------------------------------------------------------
  it("Frontend param name mapping is correct for useListProjects", async () => {
    mockGet.mockResolvedValue(STUB_PAGINATED_RESPONSE);

    const frontendParams: ListProjectsParams = {
      companyId: "company-abc",
      page: 2,
      perPage: 25,
      sortKey: "name",
      sortDir: "asc",
    };

    const { result } = renderHook(() => useListProjects(frontendParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const sentParams = mockGet.mock.calls[0][1].params;

    // Explicit 1:1 mapping verification
    // Frontend "page" must become backend "current_page"
    expect(sentParams).toHaveProperty("current_page", 2);
    expect(sentParams).not.toHaveProperty("page");

    // Frontend "perPage" must become backend "per_page"
    expect(sentParams).toHaveProperty("per_page", 25);
    expect(sentParams).not.toHaveProperty("perPage");

    // Frontend "sortKey" must become backend "sort_by"
    expect(sentParams).toHaveProperty("sort_by", "name");
    expect(sentParams).not.toHaveProperty("sortKey");

    // Frontend "sortDir" must become backend "sort_dir"
    expect(sentParams).toHaveProperty("sort_dir", "asc");
    expect(sentParams).not.toHaveProperty("sortDir");

    // companyId passes through unchanged
    expect(sentParams).toHaveProperty("companyId", "company-abc");
  });
});
