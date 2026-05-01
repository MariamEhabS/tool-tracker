/**
 * Contract Test: Users API
 *
 * Validates that the frontend User API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a User DTO, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Backend contract types (source of truth)
import {
  type BackendAddUserDto,
  type BackendPatchUserDto,
  type BackendDeleteManyUsersDto,
  type BackendRequestEmailChangeDto,
  type BackendVerifyEmailChangeDto,
  type BackendListUsersParams,
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
  addUser,
  patchUserDetails,
  deleteUser,
  deleteManyUsers,
  requestEmailChangeOtp,
  verifyEmailChangeOtp,
  listCompanyUsers,
} from "@api/endpoints/user";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_COMPANY_ID = "665af1b2c3d4e5f6a7b8c9d1";
const FAKE_USER_ID = "665af1b2c3d4e5f6a7b8c9d2";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. addUser sends body matching BackendAddUserDto
  // =========================================================================
  it("addUser sends body matching BackendAddUserDto via POST /user/add-user", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      email: "newuser@example.com",
      firstName: "Jane",
      lastName: "Doe",
      permission: "pm" as const,
      inviterUserId: FAKE_USER_ID,
    };

    await addUser(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/user/add-user");

    // Verify required fields from BackendAddUserDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("email", "newuser@example.com");

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("firstName", "Jane");
    expect(body).toHaveProperty("lastName", "Doe");
    expect(body).toHaveProperty("permission", "pm");
    expect(body).toHaveProperty("inviterUserId", FAKE_USER_ID);

    // Type-level assertion: the payload satisfies BackendAddUserDto
    const _typeCheck: BackendAddUserDto = {
      companyId: body.companyId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      permission: body.permission,
      inviterUserId: body.inviterUserId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.email).toBe("newuser@example.com");
  });

  // =========================================================================
  // 2. patchUser sends body matching BackendPatchUserDto
  // =========================================================================
  it("patchUser sends body matching BackendPatchUserDto via PATCH /user/:id", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      firstName: "Updated",
      lastName: "Name",
      phoneNumber: "555-1234",
      permission: "user" as const,
    };

    await patchUserDetails(FAKE_USER_ID, payload);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/user/${FAKE_USER_ID}`);

    // Verify required field from BackendPatchUserDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("firstName", "Updated");
    expect(body).toHaveProperty("lastName", "Name");
    expect(body).toHaveProperty("phoneNumber", "555-1234");
    expect(body).toHaveProperty("permission", "user");

    // Type-level assertion: the payload satisfies BackendPatchUserDto
    const _typeCheck: BackendPatchUserDto = {
      companyId: body.companyId,
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber,
      permission: body.permission,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 3. deleteSingleUser sends BasicRequestDto
  // =========================================================================
  it("deleteSingleUser sends BasicRequestDto via DELETE /user/:id", async () => {
    await deleteUser(FAKE_USER_ID, { companyId: FAKE_COMPANY_ID });

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/user/${FAKE_USER_ID}`);

    // Verify the data payload includes the required companyId
    const payload = config?.data;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);

    // Type-level assertion: the payload shape satisfies BackendBasicRequestDto
    const _typeCheck: BackendBasicRequestDto = {
      companyId: payload.companyId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 4. deleteManyUsers sends matching BackendDeleteManyUsersDto
  // =========================================================================
  it("deleteManyUsers sends matching BackendDeleteManyUsersDto via DELETE /user/bulk", async () => {
    const userIds = [FAKE_USER_ID, "665af1b2c3d4e5f6a7b8c9d4"];

    await deleteManyUsers(FAKE_COMPANY_ID, userIds);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/user/bulk");

    // Verify the payload shape
    const payload = config?.data;
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(payload).toHaveProperty("userIds", userIds);

    // Type-level assertion: the payload satisfies BackendDeleteManyUsersDto
    const _typeCheck: BackendDeleteManyUsersDto = {
      companyId: payload.companyId,
      userIds: payload.userIds,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.userIds).toEqual(userIds);
  });

  // =========================================================================
  // 5. requestEmailChangeOTP sends matching BackendRequestEmailChangeDto
  // =========================================================================
  it("requestEmailChangeOTP sends matching BackendRequestEmailChangeDto via POST /user/:id/email-change-otp", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      newEmail: "newemail@example.com",
      currentPassword: "MyP@ssw0rd!",
    };

    await requestEmailChangeOtp(FAKE_USER_ID, payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/user/${FAKE_USER_ID}/email-change-otp`);

    // Verify all required fields from BackendRequestEmailChangeDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("newEmail", "newemail@example.com");
    expect(body).toHaveProperty("currentPassword", "MyP@ssw0rd!");

    // Type-level assertion
    const _typeCheck: BackendRequestEmailChangeDto = {
      companyId: body.companyId,
      newEmail: body.newEmail,
      currentPassword: body.currentPassword,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.newEmail).toBe("newemail@example.com");
    expect(_typeCheck.currentPassword).toBe("MyP@ssw0rd!");
  });

  // =========================================================================
  // 6. verifyEmailChangeOTP sends matching BackendVerifyEmailChangeDto
  // =========================================================================
  it("verifyEmailChangeOTP sends matching BackendVerifyEmailChangeDto via POST /user/:id/email-change-verify", async () => {
    const payload = {
      companyId: FAKE_COMPANY_ID,
      newEmail: "newemail@example.com",
      otp: "123456",
    };

    await verifyEmailChangeOtp(FAKE_USER_ID, payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/user/${FAKE_USER_ID}/email-change-verify`);

    // Verify all required fields from BackendVerifyEmailChangeDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("newEmail", "newemail@example.com");
    expect(body).toHaveProperty("otp", "123456");

    // Type-level assertion
    const _typeCheck: BackendVerifyEmailChangeDto = {
      companyId: body.companyId,
      newEmail: body.newEmail,
      otp: body.otp,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.newEmail).toBe("newemail@example.com");
    expect(_typeCheck.otp).toBe("123456");
  });

  // =========================================================================
  // 7. listCompanyUsers sends query params matching BackendListUsersParams
  // =========================================================================
  it("listCompanyUsers sends query params matching BackendListUsersParams via GET /user/", async () => {
    const params = {
      companyId: FAKE_COMPANY_ID,
      current_page: 2,
      per_page: 25,
      search: "john",
    };

    await listCompanyUsers(params);

    expect(axiosInstance.get).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.get as Mock).mock.calls[0];

    // Frontend calls /user/ (trailing slash), backend route is /user
    expect(url).toBe("/user/");

    // Verify query params are forwarded
    const queryParams = config?.params;
    expect(queryParams).toBeDefined();
    expect(queryParams).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(queryParams).toHaveProperty("current_page", 2);
    expect(queryParams).toHaveProperty("per_page", 25);
    expect(queryParams).toHaveProperty("search", "john");

    // Type-level assertion: the params satisfy BackendListUsersParams
    const _typeCheck: BackendListUsersParams = {
      companyId: queryParams.companyId,
      current_page: queryParams.current_page,
      per_page: queryParams.per_page,
      search: queryParams.search,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 8. Route paths match backend
  // =========================================================================
  describe("Route paths match backend", () => {
    it("add user URL matches backend route", async () => {
      await addUser({ companyId: FAKE_COMPANY_ID, email: "a@b.com" });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/user/add-user");
      expect(BACKEND_ROUTES["user.add"].path).toBe("/user/add-user");
      expect(BACKEND_ROUTES["user.add"].method).toBe("POST");
    });

    it("patch user URL matches backend route pattern", async () => {
      await patchUserDetails(FAKE_USER_ID, { companyId: FAKE_COMPANY_ID });
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toMatch(/^\/user\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["user.patch"].path).toBe("/user/:userId");
      expect(BACKEND_ROUTES["user.patch"].method).toBe("PATCH");
    });

    it("single user delete URL matches backend route pattern", async () => {
      await deleteUser(FAKE_USER_ID, { companyId: FAKE_COMPANY_ID });
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toMatch(/^\/user\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["user.delete"].path).toBe("/user/:userId");
      expect(BACKEND_ROUTES["user.delete"].method).toBe("DELETE");
    });

    it("bulk user delete URL matches backend route", async () => {
      await deleteManyUsers(FAKE_COMPANY_ID, [FAKE_USER_ID]);
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toBe("/user/bulk");
      expect(BACKEND_ROUTES["user.delete-bulk"].path).toBe("/user/bulk");
      expect(BACKEND_ROUTES["user.delete-bulk"].method).toBe("DELETE");
    });

    it("email change OTP URL matches backend route pattern", async () => {
      await requestEmailChangeOtp(FAKE_USER_ID, {
        companyId: FAKE_COMPANY_ID,
        newEmail: "a@b.com",
        currentPassword: "pass",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(/^\/user\/[a-f0-9]{24}\/email-change-otp$/);
      expect(BACKEND_ROUTES["user.email-change-otp"].path).toBe(
        "/user/:userId/email-change-otp",
      );
      expect(BACKEND_ROUTES["user.email-change-otp"].method).toBe("POST");
    });

    it("email change verify URL matches backend route pattern", async () => {
      await verifyEmailChangeOtp(FAKE_USER_ID, {
        companyId: FAKE_COMPANY_ID,
        newEmail: "a@b.com",
        otp: "123456",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(/^\/user\/[a-f0-9]{24}\/email-change-verify$/);
      expect(BACKEND_ROUTES["user.email-change-verify"].path).toBe(
        "/user/:userId/email-change-verify",
      );
      expect(BACKEND_ROUTES["user.email-change-verify"].method).toBe("POST");
    });

    it("backend required fields for user.add include companyId and email", () => {
      const route = BACKEND_ROUTES["user.add"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "email"]),
      );
    });

    it("backend required fields for user.patch include companyId", () => {
      const route = BACKEND_ROUTES["user.patch"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId"]),
      );
    });

    it("backend required fields for user.email-change-otp include companyId, newEmail, currentPassword", () => {
      const route = BACKEND_ROUTES["user.email-change-otp"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "newEmail", "currentPassword"]),
      );
    });

    it("backend required fields for user.email-change-verify include companyId, newEmail, otp", () => {
      const route = BACKEND_ROUTES["user.email-change-verify"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId", "newEmail", "otp"]),
      );
    });

    it("list users URL matches backend route", async () => {
      await listCompanyUsers({ companyId: FAKE_COMPANY_ID });
      const [url] = (axiosInstance.get as Mock).mock.calls[0];
      // Frontend calls /user/ (trailing slash), backend route is /user
      expect(url).toBe("/user/");
      expect(BACKEND_ROUTES["user.list"].path).toBe("/user");
      expect(BACKEND_ROUTES["user.list"].method).toBe("GET");
    });

    it("backend required fields for user.list include companyId", () => {
      const route = BACKEND_ROUTES["user.list"];
      expect(route.requiredFields).toEqual(
        expect.arrayContaining(["companyId"]),
      );
    });
  });
});
