/**
 * Contract Test: Auth API
 *
 * Validates that the frontend Auth API client (authentication.ts) sends
 * request bodies and hits URL paths that align with the backend specification
 * defined in backend-contracts.ts.
 *
 * When the backend changes an auth DTO or route, update backend-contracts.ts
 * first, then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend contract definitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  BackendRegisterRequestDto,
  BackendVerifyOtpDto,
  BackendResendOtpDto,
  BackendSetPasswordDto,
  BackendVerifyEmailTokenDto,
  BackendCompleteInvitedSignupDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPost = vi.fn().mockResolvedValue({ data: {} });
const mockGet = vi.fn().mockResolvedValue({ data: {} });
const mockPatch = vi.fn().mockResolvedValue({ data: {} });
const mockDelete = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Import frontend functions AFTER mocks are registered
import {
  login,
  signUp,
  verifyOtp,
  resendOtp,
  completeSignUp,
  requestPasswordReset,
  verifyPasswordReset,
  completePasswordReset,
  verifyEmailToken,
  completeInvitedSignup,
  logout,
  procoreLogin,
  procoreOauthSuccess,
  selectProcoreCompany,
  refreshProcoreAccessToken,
} from "@api/endpoints/authentication";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the keys of a TypeScript interface at runtime via a sample object. */
function keysOf<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: {} });
    mockGet.mockResolvedValue({ data: {} });
  });

  // =========================================================================
  // 1. login
  // =========================================================================
  it("login sends correct body", async () => {
    await login("test@test.com", "pass123");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/login");
    expect(body).toEqual({ email: "test@test.com", password: "pass123" });

    // Verify the fields match what BACKEND_ROUTES requires
    const requiredFields = BACKEND_ROUTES["auth.login"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 2. signUp
  // =========================================================================
  it("signUp sends body matching BackendRegisterRequestDto", async () => {
    await signUp("test@test.com", "John", "Doe", "Acme");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/signup");
    expect(body).toEqual({
      email: "test@test.com",
      firstName: "John",
      lastName: "Doe",
      company: "Acme",
    });

    // Every field the frontend sends should be a valid BackendRegisterRequestDto field
    const backendDtoKeys = keysOf<BackendRegisterRequestDto>({
      email: "",
      firstName: "",
      lastName: "",
      company: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields from route contract
    const requiredFields = BACKEND_ROUTES["auth.signup"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 3. verifyOtp
  // =========================================================================
  it("verifyOtp sends body matching BackendVerifyOtpDto", async () => {
    await verifyOtp("test@test.com", "123456");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/verify-otp");
    expect(body).toEqual({ email: "test@test.com", otp: "123456" });

    // Verify against BackendVerifyOtpDto
    // NOTE: Backend DTO class declares userId with validators, but the actual
    // auth.service.ts verifyOTP() method never uses it — user is resolved from
    // OTP storage via email. The contract reflects actual runtime behavior.
    const backendDtoKeys = keysOf<BackendVerifyOtpDto>({
      email: "",
      otp: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["auth.verify-otp"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 4. resendOtp
  // =========================================================================
  it("resendOtp sends body matching BackendResendOtpDto", async () => {
    await resendOtp("test@test.com");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/resend-otp");
    expect(body).toEqual({ email: "test@test.com" });

    // Verify against BackendResendOtpDto
    const backendDtoKeys = keysOf<BackendResendOtpDto>({ email: "" });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["auth.resend-otp"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 5. completeSignUp
  // =========================================================================
  it("completeSignUp sends body matching BackendSetPasswordDto", async () => {
    await completeSignUp("pass123", "test@test.com");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/complete-signup");
    expect(body).toEqual({ password: "pass123", email: "test@test.com" });

    // Verify against BackendSetPasswordDto
    const backendDtoKeys = keysOf<BackendSetPasswordDto>({
      email: "",
      password: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["auth.complete-signup"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 6. requestPasswordReset
  // =========================================================================
  it("requestPasswordReset sends correct body", async () => {
    await requestPasswordReset("test@test.com");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/forgot-password/request");
    expect(body).toEqual({ email: "test@test.com" });

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["auth.forgot-password-request"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 7. verifyPasswordReset
  // =========================================================================
  it("verifyPasswordReset sends correct body", async () => {
    await verifyPasswordReset("test@test.com", "654321");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/forgot-password/verify");
    expect(body).toEqual({ email: "test@test.com", otp: "654321" });

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["auth.forgot-password-verify"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 8. completePasswordReset
  // =========================================================================
  it("completePasswordReset sends correct body", async () => {
    await completePasswordReset("test@test.com", "654321", "newPass456");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/forgot-password/complete");
    expect(body).toEqual({
      email: "test@test.com",
      otp: "654321",
      password: "newPass456",
    });

    // Verify required fields
    const requiredFields =
      BACKEND_ROUTES["auth.forgot-password-complete"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 9. logout
  // =========================================================================
  it("logout calls correct endpoint", async () => {
    await logout();

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/logout");
  });

  // =========================================================================
  // 10. verifyEmailToken
  // =========================================================================
  it("verifyEmailToken sends body matching BackendVerifyEmailTokenDto", async () => {
    await verifyEmailToken("abc123token");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/verify-email-token");
    expect(body).toEqual({ token: "abc123token" });

    // Every field the frontend sends should be a valid BackendVerifyEmailTokenDto field
    const backendDtoKeys = keysOf<BackendVerifyEmailTokenDto>({
      token: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["auth.verify-email-token"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  // =========================================================================
  // 11. completeInvitedSignup
  // =========================================================================
  it("completeInvitedSignup sends body matching BackendCompleteInvitedSignupDto", async () => {
    await completeInvitedSignup("inviteToken123", "securePass", "Jane", "Doe");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/complete-invited-signup");
    expect(body).toEqual({
      token: "inviteToken123",
      password: "securePass",
      firstName: "Jane",
      lastName: "Doe",
    });

    // Every field the frontend sends should be a valid BackendCompleteInvitedSignupDto field
    const backendDtoKeys = keysOf<BackendCompleteInvitedSignupDto>({
      token: "",
      password: "",
      firstName: "",
      lastName: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Verify required fields from route contract
    const requiredFields =
      BACKEND_ROUTES["auth.complete-invited-signup"].requiredFields ?? [];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
  });

  it("completeInvitedSignup sends only required fields when optional fields omitted", async () => {
    await completeInvitedSignup("inviteToken456", "anotherPass");

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/auth/complete-invited-signup");

    // token and password are required and must be present
    expect(body).toHaveProperty("token", "inviteToken456");
    expect(body).toHaveProperty("password", "anotherPass");

    // All sent keys must be valid BackendCompleteInvitedSignupDto fields
    const backendDtoKeys = keysOf<BackendCompleteInvitedSignupDto>({
      token: "",
      password: "",
      firstName: "",
      lastName: "",
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }
  });

  // =========================================================================
  // 12. procoreLogin
  // =========================================================================
  it("procoreLogin calls correct endpoint", async () => {
    await procoreLogin();

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/auth/procore-login");
  });

  // =========================================================================
  // 13. procoreOauthSuccess
  // =========================================================================
  it("procoreOauthSuccess sends correct body", async () => {
    await procoreOauthSuccess("user-123");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/oauth/procore/success");
    expect(body).toEqual({ userId: "user-123" });
  });

  // =========================================================================
  // 14. selectProcoreCompany
  // =========================================================================
  it("selectProcoreCompany sends correct body", async () => {
    await selectProcoreCompany("jwt-token", 12345);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/oauth/procore/select-company");
    expect(body).toEqual({ token: "jwt-token", selectedCompanyId: 12345 });
  });

  // =========================================================================
  // 15. refreshProcoreAccessToken
  // =========================================================================
  it("refreshProcoreAccessToken sends correct body", async () => {
    await refreshProcoreAccessToken("comp-1", "refresh-tok");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/oauth/refresh-token");
    expect(body).toEqual({ companyId: "comp-1", refreshToken: "refresh-tok" });
  });

  it("refreshProcoreAccessToken allows undefined refreshToken", async () => {
    await refreshProcoreAccessToken("comp-1");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [, body] = mockPost.mock.calls[0];
    expect(body).toEqual({ companyId: "comp-1", refreshToken: undefined });
  });

  // =========================================================================
  // 16. Route paths match backend
  // =========================================================================
  describe("Route paths and HTTP methods match backend", () => {
    it("login URL and method match BACKEND_ROUTES", async () => {
      await login("a@b.com", "x");
      const route = BACKEND_ROUTES["auth.login"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("signup URL and method match BACKEND_ROUTES", async () => {
      await signUp("a@b.com", "F", "L", "C");
      const route = BACKEND_ROUTES["auth.signup"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("verify-otp URL and method match BACKEND_ROUTES", async () => {
      await verifyOtp("a@b.com", "000000");
      const route = BACKEND_ROUTES["auth.verify-otp"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("resend-otp URL and method match BACKEND_ROUTES", async () => {
      await resendOtp("a@b.com");
      const route = BACKEND_ROUTES["auth.resend-otp"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("complete-signup URL and method match BACKEND_ROUTES", async () => {
      await completeSignUp("pw", "a@b.com");
      const route = BACKEND_ROUTES["auth.complete-signup"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("forgot-password/request URL and method match BACKEND_ROUTES", async () => {
      await requestPasswordReset("a@b.com");
      const route = BACKEND_ROUTES["auth.forgot-password-request"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("forgot-password/verify URL and method match BACKEND_ROUTES", async () => {
      await verifyPasswordReset("a@b.com", "000000");
      const route = BACKEND_ROUTES["auth.forgot-password-verify"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("forgot-password/complete URL and method match BACKEND_ROUTES", async () => {
      await completePasswordReset("a@b.com", "000000", "pw");
      const route = BACKEND_ROUTES["auth.forgot-password-complete"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("logout URL and method match BACKEND_ROUTES", async () => {
      await logout();
      const route = BACKEND_ROUTES["auth.logout"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("verify-email-token URL and method match BACKEND_ROUTES", async () => {
      await verifyEmailToken("token");
      const route = BACKEND_ROUTES["auth.verify-email-token"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("complete-invited-signup URL and method match BACKEND_ROUTES", async () => {
      await completeInvitedSignup("token", "pw");
      const route = BACKEND_ROUTES["auth.complete-invited-signup"];
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe(route.path);
      expect(route.method).toBe("POST");
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});
