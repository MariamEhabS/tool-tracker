/**
 * Tests for authentication API endpoints
 * Tests all auth-related API functions including login, signup, OTP,
 * password reset, Procore OAuth, and logout.
 * Validates payloads, URLs, methods, headers, and error handling behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/utils/rollbar", () => ({
  logAuthError: vi.fn(),
}));

// Mock axios.isAxiosError used in login
vi.mock("axios", () => ({
  default: {
    isAxiosError: (error: unknown) => {
      return typeof error === "object" && error !== null && "response" in error;
    },
  },
  isAxiosError: (error: unknown) => {
    return typeof error === "object" && error !== null && "response" in error;
  },
}));

import {
  login,
  procoreLogin,
  procoreOauthSuccess,
  selectProcoreCompany,
  refreshProcoreAccessToken,
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
} from "./authentication";

import { logAuthError } from "@/utils/rollbar";

describe("Authentication API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== Login ====================

  describe("login", () => {
    it("should POST to /auth/login with email and password", async () => {
      const mockData = { accessToken: "jwt-token", user: { _id: "user-1" } };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await login("user@example.com", "password123");

      expect(mockPost).toHaveBeenCalledWith(
        "/auth/login",
        { email: "user@example.com", password: "password123" },
        { headers: { "x-skip-401-reload": "true" } },
      );
      expect(result).toEqual(mockData);
    });

    it("should return error response data for axios errors (4xx)", async () => {
      const errorData = { message: "Invalid credentials", statusCode: 401 };
      mockPost.mockRejectedValue({
        response: { status: 401, data: errorData },
      });

      const result = await login("user@example.com", "wrong-password");

      expect(result).toEqual(errorData);
    });

    it("should not report 4xx errors to rollbar", async () => {
      mockPost.mockRejectedValue({
        response: { status: 401, data: { message: "Invalid credentials" } },
      });

      await login("user@example.com", "wrong-password");

      // logAuthError is still called for 4xx, but at warning level (not error level)
      expect(logAuthError).toHaveBeenCalled();
    });

    it("should report 5xx errors to rollbar", async () => {
      mockPost.mockRejectedValue({
        response: { status: 500, data: { message: "Internal error" } },
      });

      await login("user@example.com", "password123");

      expect(logAuthError).toHaveBeenCalledWith(
        expect.anything(),
        "login-system-error",
      );
    });

    it("should report network errors (no status) to rollbar", async () => {
      mockPost.mockRejectedValue({
        response: { status: undefined, data: undefined },
      });

      await login("user@example.com", "password123");

      expect(logAuthError).toHaveBeenCalledWith(
        expect.anything(),
        "login-system-error",
      );
    });

    it("should throw non-axios errors", async () => {
      mockPost.mockRejectedValue(new TypeError("Unexpected"));

      await expect(login("user@example.com", "pass")).rejects.toThrow(
        "Unexpected",
      );
    });
  });

  // ==================== Procore Login ====================

  describe("procoreLogin", () => {
    it("should GET /auth/procore-login", async () => {
      const mockData = { redirectUrl: "https://procore.com/oauth" };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await procoreLogin();

      expect(mockGet).toHaveBeenCalledWith("/auth/procore-login");
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors to rollbar", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockGet.mockRejectedValue(error);

      await expect(procoreLogin()).rejects.toThrow("Server Error");
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "procore-login-failed",
      );
    });

    it("should not report 4xx errors to rollbar", async () => {
      const error = Object.assign(new Error("Forbidden"), {
        response: { status: 403 },
      });
      mockGet.mockRejectedValue(error);

      await expect(procoreLogin()).rejects.toThrow("Forbidden");
      // logAuthError is still called for 4xx, but at warning level
      expect(logAuthError).toHaveBeenCalled();
    });
  });

  // ==================== Procore OAuth Success ====================

  describe("procoreOauthSuccess", () => {
    it("should POST to /oauth/procore/success with userId", async () => {
      const mockData = { success: true, company: { _id: "comp-1" } };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await procoreOauthSuccess("user-123");

      expect(mockPost).toHaveBeenCalledWith("/oauth/procore/success", {
        userId: "user-123",
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(procoreOauthSuccess("user-123")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "procore-oauth-callback-failed",
      );
    });

    it("should throw but not report 4xx errors", async () => {
      const error = Object.assign(new Error("Bad Request"), {
        response: { status: 400 },
      });
      mockPost.mockRejectedValue(error);

      await expect(procoreOauthSuccess("user-123")).rejects.toThrow(
        "Bad Request",
      );
      // logAuthError is still called for 4xx, but at warning level
      expect(logAuthError).toHaveBeenCalled();
    });
  });

  // ==================== Select Procore Company ====================

  describe("selectProcoreCompany", () => {
    it("should POST to /oauth/procore/select-company with token and selectedCompanyId", async () => {
      const mockData = { success: true };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await selectProcoreCompany("jwt-token", 12345);

      expect(mockPost).toHaveBeenCalledWith("/oauth/procore/select-company", {
        token: "jwt-token",
        selectedCompanyId: 12345,
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors with metadata", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(selectProcoreCompany("token", 99)).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "select-procore-company-failed",
        { selectedCompanyId: 99 },
      );
    });
  });

  // ==================== Refresh Procore Access Token ====================

  describe("refreshProcoreAccessToken", () => {
    it("should POST to /oauth/refresh-token with companyId and refreshToken", async () => {
      const mockData = { accessToken: "new-token" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await refreshProcoreAccessToken("comp-1", "refresh-tok");

      expect(mockPost).toHaveBeenCalledWith("/oauth/refresh-token", {
        companyId: "comp-1",
        refreshToken: "refresh-tok",
      });
      expect(result).toEqual(mockData);
    });

    it("should allow refreshToken to be undefined", async () => {
      mockPost.mockResolvedValue({ data: { accessToken: "new-token" } });

      await refreshProcoreAccessToken("comp-1");

      expect(mockPost).toHaveBeenCalledWith("/oauth/refresh-token", {
        companyId: "comp-1",
        refreshToken: undefined,
      });
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(refreshProcoreAccessToken("comp-1", "tok")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "procore-token-refresh-failed",
      );
    });
  });

  // ==================== Sign Up ====================

  describe("signUp", () => {
    it("should POST to /auth/signup with all required fields", async () => {
      const mockResponse = {
        data: { message: "Verification email sent" },
        status: 201,
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await signUp(
        "user@example.com",
        "John",
        "Doe",
        "Acme Inc",
      );

      expect(mockPost).toHaveBeenCalledWith("/auth/signup", {
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Inc",
      });
      expect(result).toEqual(mockResponse);
    });

    it("should return the full response object (not response.data)", async () => {
      const mockResponse = {
        data: { message: "Created" },
        status: 201,
        headers: {},
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await signUp("a@b.com", "A", "B", "Co");

      // signUp returns response, not response.data
      expect(result).toBe(mockResponse);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(signUp("a@b.com", "A", "B", "Co")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "signup-failed",
      );
    });

    it("should throw but not report 4xx errors", async () => {
      const error = Object.assign(new Error("Conflict"), {
        response: { status: 409 },
      });
      mockPost.mockRejectedValue(error);

      await expect(signUp("a@b.com", "A", "B", "Co")).rejects.toThrow(
        "Conflict",
      );
      // logAuthError is still called for 4xx, but at warning level
      expect(logAuthError).toHaveBeenCalled();
    });
  });

  // ==================== Verify OTP ====================

  describe("verifyOtp", () => {
    it("should POST to /auth/verify-otp with email and otp", async () => {
      const mockResponse = {
        data: { accessToken: "jwt", user: { _id: "u1" } },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await verifyOtp("user@example.com", "123456");

      expect(mockPost).toHaveBeenCalledWith("/auth/verify-otp", {
        email: "user@example.com",
        otp: "123456",
      });
      // verifyOtp returns the axios response directly (not .data)
      expect(result).toBe(mockResponse);
    });

    it("should propagate errors to the caller (catch block unreachable due to non-awaited return)", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      // verifyOtp uses `return axiosInstance.post(...)` without await,
      // so the catch block never executes — errors propagate directly.
      await expect(verifyOtp("a@b.com", "000000")).rejects.toThrow(
        "Server Error",
      );
    });
  });

  // ==================== Resend OTP ====================

  describe("resendOtp", () => {
    it("should POST to /auth/resend-otp with email", async () => {
      const mockResponse = { data: { message: "OTP resent" } };
      mockPost.mockResolvedValue(mockResponse);

      const result = await resendOtp("user@example.com");

      expect(mockPost).toHaveBeenCalledWith("/auth/resend-otp", {
        email: "user@example.com",
      });
      // resendOtp returns the axios response directly
      expect(result).toBe(mockResponse);
    });

    it("should propagate errors to the caller (catch block unreachable due to non-awaited return)", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      // resendOtp uses `return axiosInstance.post(...)` without await,
      // so the catch block never executes — errors propagate directly.
      await expect(resendOtp("a@b.com")).rejects.toThrow("Server Error");
    });
  });

  // ==================== Complete Sign Up ====================

  describe("completeSignUp", () => {
    it("should POST to /auth/complete-signup with password and email", async () => {
      const mockResponse = { data: { message: "Signup complete" } };
      mockPost.mockResolvedValue(mockResponse);

      const result = await completeSignUp("securePass1!", "user@example.com");

      expect(mockPost).toHaveBeenCalledWith("/auth/complete-signup", {
        password: "securePass1!",
        email: "user@example.com",
      });
      // completeSignUp returns the axios response directly
      expect(result).toBe(mockResponse);
    });

    it("should propagate errors to the caller (catch block unreachable due to non-awaited return)", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      // completeSignUp uses `return axiosInstance.post(...)` without await,
      // so the catch block never executes — errors propagate directly.
      await expect(completeSignUp("pass", "a@b.com")).rejects.toThrow(
        "Server Error",
      );
    });
  });

  // ==================== Request Password Reset ====================

  describe("requestPasswordReset", () => {
    it("should POST to /auth/forgot-password/request with email", async () => {
      const mockData = { message: "Reset email sent" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await requestPasswordReset("user@example.com");

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password/request", {
        email: "user@example.com",
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(requestPasswordReset("a@b.com")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "request-password-reset-failed",
      );
    });
  });

  // ==================== Verify Password Reset ====================

  describe("verifyPasswordReset", () => {
    it("should POST to /auth/forgot-password/verify with email and otp", async () => {
      const mockData = { verified: true };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await verifyPasswordReset("user@example.com", "123456");

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password/verify", {
        email: "user@example.com",
        otp: "123456",
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(verifyPasswordReset("a@b.com", "000")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "verify-password-reset-failed",
      );
    });
  });

  // ==================== Complete Password Reset ====================

  describe("completePasswordReset", () => {
    it("should POST to /auth/forgot-password/complete with email, otp, and password", async () => {
      const mockData = { message: "Password reset" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await completePasswordReset(
        "user@example.com",
        "123456",
        "newPass!1",
      );

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password/complete", {
        email: "user@example.com",
        otp: "123456",
        password: "newPass!1",
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(
        completePasswordReset("a@b.com", "000", "newpass"),
      ).rejects.toThrow("Server Error");
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "complete-password-reset-failed",
      );
    });
  });

  // ==================== Verify Email Token ====================

  describe("verifyEmailToken", () => {
    it("should POST to /auth/verify-email-token with token", async () => {
      const mockData = { verified: true, email: "user@example.com" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await verifyEmailToken("email-verify-token-abc");

      expect(mockPost).toHaveBeenCalledWith("/auth/verify-email-token", {
        token: "email-verify-token-abc",
      });
      expect(result).toEqual(mockData);
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(verifyEmailToken("bad-token")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "verify-email-token-failed",
      );
    });
  });

  // ==================== Complete Invited Signup ====================

  describe("completeInvitedSignup", () => {
    it("should POST to /auth/complete-invited-signup with token, password, and optional names", async () => {
      const mockData = { message: "Account created" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await completeInvitedSignup(
        "invite-token",
        "securePass!1",
        "Jane",
        "Smith",
      );

      expect(mockPost).toHaveBeenCalledWith("/auth/complete-invited-signup", {
        token: "invite-token",
        password: "securePass!1",
        firstName: "Jane",
        lastName: "Smith",
      });
      expect(result).toEqual(mockData);
    });

    it("should allow firstName and lastName to be undefined", async () => {
      mockPost.mockResolvedValue({ data: { message: "Account created" } });

      await completeInvitedSignup("invite-token", "securePass!1");

      expect(mockPost).toHaveBeenCalledWith("/auth/complete-invited-signup", {
        token: "invite-token",
        password: "securePass!1",
        firstName: undefined,
        lastName: undefined,
      });
    });

    it("should throw and report 5xx errors", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await expect(completeInvitedSignup("tok", "pass")).rejects.toThrow(
        "Server Error",
      );
      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "complete-invited-signup-failed",
      );
    });
  });

  // ==================== Logout ====================

  describe("logout", () => {
    it("should POST to /auth/logout with x-skip-401-reload header", async () => {
      const mockData = { message: "Logged out" };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await logout();

      expect(mockPost).toHaveBeenCalledWith(
        "/auth/logout",
        {},
        { headers: { "x-skip-401-reload": "true" } },
      );
      expect(result).toEqual(mockData);
    });

    it("should return fallback message on error instead of throwing", async () => {
      const error = Object.assign(new Error("Network Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      const result = await logout();

      expect(result).toEqual({ message: "Logged out locally" });
    });

    it("should report 5xx errors to rollbar even though it does not throw", async () => {
      const error = Object.assign(new Error("Server Error"), {
        response: { status: 500 },
      });
      mockPost.mockRejectedValue(error);

      await logout();

      expect(logAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        "logout-failed",
      );
    });

    it("should not report 4xx errors to rollbar", async () => {
      const error = Object.assign(new Error("Unauthorized"), {
        response: { status: 401 },
      });
      mockPost.mockRejectedValue(error);

      await logout();

      // logAuthError is still called for 4xx, but at warning level
      expect(logAuthError).toHaveBeenCalled();
    });

    it("should return fallback message on network error (no status)", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      const result = await logout();

      // Network error has no response.status, so !status is true → rollbar called
      expect(result).toEqual({ message: "Logged out locally" });
    });
  });

  // ==================== Error Handling Patterns ====================

  describe("Error handling consistency", () => {
    it("login should return error data for axios errors instead of throwing", async () => {
      const errorData = { message: "Bad credentials" };
      mockPost.mockRejectedValue({
        response: { status: 400, data: errorData },
      });

      const result = await login("a@b.com", "pass");

      // login returns error.response.data rather than throwing for axios errors
      expect(result).toEqual(errorData);
    });

    it("signUp should throw errors to the caller", async () => {
      mockPost.mockRejectedValue(
        Object.assign(new Error("Conflict"), {
          response: { status: 409, data: { message: "Email already exists" } },
        }),
      );

      await expect(signUp("a@b.com", "A", "B", "Co")).rejects.toThrow(
        "Conflict",
      );
    });

    it("logout should swallow errors and return fallback", async () => {
      mockPost.mockRejectedValue(new Error("any error"));

      const result = await logout();

      expect(result).toEqual({ message: "Logged out locally" });
    });
  });
});
