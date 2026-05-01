/**
 * @fileoverview Authentication API endpoints for login, signup, OTP verification,
 * password reset, email verification, and logout.
 *
 * Provides API functions for: email/password login, Procore OAuth login flow,
 * user registration (signup, OTP verification, password creation), password
 * reset (request, verify, complete), email token verification, invited user
 * signup completion, and logout.
 *
 * This file does not define TanStack Query hooks or query keys -- authentication
 * calls are imperative and typically managed by auth context/state.
 */
import axios from "axios";
import { axiosInstance } from "..";
import { logger } from "@/utils/logger";
import { logAuthError } from "@/utils/rollbar";

/**
 * POST /auth/login -- Authenticates a user with email and password.
 *
 * Skips 401 reload logic (x-skip-401-reload header) since login naturally
 * returns 401 on bad credentials. Returns error response data on Axios errors
 * instead of throwing.
 *
 * @param email - User email
 * @param password - User password
 * @returns Login response data (tokens, user info) or error response data
 */
export const login = async (email: string, password: string) => {
  try {
    const response = await axiosInstance.post(
      "/auth/login",
      {
        email,
        password,
      },
      {
        // Login will naturally 401 on bad creds; don't trigger refresh/redirect logic.
        headers: { "x-skip-401-reload": "true" },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // logAuthError automatically skips 4xx and uses appropriate log level
      logAuthError(error, "login-system-error");
      return error.response?.data;
    }
    throw error;
  }
};

/**
 * GET /auth/procore-login -- Initiates Procore OAuth login flow.
 *
 * @returns Response data with Procore OAuth redirect URL
 */
export const procoreLogin = async () => {
  try {
    const response = await axiosInstance.get("/auth/procore-login");
    return response.data;
  } catch (error) {
    logAuthError(error, "procore-login-failed");
    logger.error("Error during Procore login:", error);
    throw error;
  }
};

/**
 * POST /oauth/procore/success -- Completes Procore OAuth callback processing.
 *
 * @param userId - The authenticated user's ID
 * @returns Response data confirming OAuth success
 */
export const procoreOauthSuccess = async (userId: string) => {
  try {
    const response = await axiosInstance.post("/oauth/procore/success", {
      userId,
    });
    return response.data;
  } catch (error) {
    logAuthError(error, "procore-oauth-callback-failed");
    logger.error("Error during Procore OAuth success:", error);
    throw error;
  }
};

/**
 * POST /oauth/procore/select-company -- Selects a Procore company during OAuth setup.
 *
 * @param token - OAuth token from the Procore callback
 * @param selectedCompanyId - The numeric Procore company ID chosen by the user
 * @returns Response data confirming company selection
 */
export const selectProcoreCompany = async (
  token: string,
  selectedCompanyId: number,
) => {
  try {
    const response = await axiosInstance.post("/oauth/procore/select-company", {
      token,
      selectedCompanyId,
    });
    return response.data;
  } catch (error) {
    logAuthError(error, "select-procore-company-failed", { selectedCompanyId });
    throw error;
  }
};

/**
 * POST /oauth/refresh-token -- Refreshes the Procore OAuth access token.
 *
 * @param companyId - The company ID
 * @param refreshToken - Optional Procore refresh token
 * @returns Response data with new access token
 */
export const refreshProcoreAccessToken = async (
  companyId: string,
  refreshToken?: string,
) => {
  try {
    const response = await axiosInstance.post("/oauth/refresh-token", {
      companyId,
      refreshToken,
    });
    return response.data;
  } catch (error) {
    logAuthError(error, "procore-token-refresh-failed");
    logger.error("Error refreshing Procore access token:", error);
    throw error;
  }
};

/**
 * POST /auth/signup -- Registers a new user account.
 *
 * Sends OTP to the provided email for verification.
 *
 * @param email - User email
 * @param firstName - User first name
 * @param lastName - User last name
 * @param company - Company name
 * @param nfcId - Optional NFC tag ID for NFC-initiated signups
 * @returns Axios response with signup confirmation data
 */
export const signUp = async (
  email: string,
  firstName: string,
  lastName: string,
  company: string,
  nfcId?: string,
) => {
  try {
    const response = await axiosInstance.post("/auth/signup", {
      email,
      firstName,
      lastName,
      company,
      ...(nfcId ? { nfcId } : {}),
    });

    return response;
  } catch (error) {
    logAuthError(error, "signup-failed");
    logger.error("Sign up error:", error);
    throw error;
  }
};

/**
 * POST /auth/verify-otp -- Verifies a one-time password sent during signup.
 *
 * @param email - User email that received the OTP
 * @param otp - The OTP code to verify
 * @returns Axios response confirming OTP validity
 */
export const verifyOtp = async (email: string, otp: string) => {
  try {
    return axiosInstance.post("/auth/verify-otp", {
      email,
      otp,
    });
  } catch (error) {
    logAuthError(error, "verify-otp-failed");
    logger.error("Error during OTP verification:", error);
    throw error;
  }
};

/**
 * POST /auth/resend-otp -- Resends the OTP verification code to the user's email.
 *
 * @param email - User email to resend the OTP to
 * @returns Axios response confirming OTP was resent
 */
export const resendOtp = async (email: string) => {
  try {
    return axiosInstance.post("/auth/resend-otp", {
      email,
    });
  } catch (error) {
    logAuthError(error, "resend-otp-failed");
    logger.error("Error during OTP resend:", error);
    throw error;
  }
};

/**
 * POST /auth/complete-signup -- Completes signup by setting the user's password.
 *
 * Called after OTP verification to finalize account creation.
 *
 * @param password - The password to set
 * @param email - The verified user email
 * @returns Axios response with account creation confirmation
 */
export const completeSignUp = async (password: string, email: string) => {
  try {
    return axiosInstance.post("/auth/complete-signup", {
      password,
      email,
    });
  } catch (error) {
    logAuthError(error, "complete-signup-failed");
    logger.error("Error during sign up completion:", error);
    throw error;
  }
};

/**
 * POST /auth/forgot-password/request -- Sends a password reset OTP to the user's email.
 *
 * @param email - The email address to send the reset code to
 * @returns Response data confirming the OTP was sent
 */
export const requestPasswordReset = async (email: string) => {
  try {
    const { data } = await axiosInstance.post("/auth/forgot-password/request", {
      email,
    });
    return data;
  } catch (error) {
    logAuthError(error, "request-password-reset-failed");
    logger.error("Error requesting password reset:", error);
    throw error;
  }
};

/**
 * POST /auth/forgot-password/verify -- Verifies the password reset OTP.
 *
 * @param email - The user's email
 * @param otp - The OTP code to verify
 * @returns Response data confirming OTP validity
 */
export const verifyPasswordReset = async (email: string, otp: string) => {
  try {
    const { data } = await axiosInstance.post("/auth/forgot-password/verify", {
      email,
      otp,
    });
    return data;
  } catch (error) {
    logAuthError(error, "verify-password-reset-failed");
    logger.error("Error verifying password reset code:", error);
    throw error;
  }
};

/**
 * POST /auth/forgot-password/complete -- Completes the password reset by setting a new password.
 *
 * @param email - The user's email
 * @param otp - The verified OTP code
 * @param password - The new password to set
 * @returns Response data confirming the password was reset
 */
export const completePasswordReset = async (
  email: string,
  otp: string,
  password: string,
) => {
  try {
    const { data } = await axiosInstance.post(
      "/auth/forgot-password/complete",
      { email, otp, password },
    );
    return data;
  } catch (error) {
    logAuthError(error, "complete-password-reset-failed");
    logger.error("Error completing password reset:", error);
    throw error;
  }
};

/**
 * POST /auth/verify-email-token -- Verifies an email verification token (e.g., from invite links).
 *
 * @param token - The email verification token
 * @returns Response data with token verification result
 */
export const verifyEmailToken = async (token: string) => {
  try {
    const { data } = await axiosInstance.post("/auth/verify-email-token", {
      token,
    });
    return data;
  } catch (error) {
    logAuthError(error, "verify-email-token-failed");
    logger.error("Error verifying email token:", error);
    throw error;
  }
};

/**
 * POST /auth/complete-invited-signup -- Completes signup for an invited user.
 *
 * Sets password and optional name fields for a user who was invited via email.
 *
 * @param token - The invitation token
 * @param password - The password to set
 * @param firstName - Optional first name
 * @param lastName - Optional last name
 * @returns Response data with user info and tokens
 */
export const completeInvitedSignup = async (
  token: string,
  password: string,
  firstName?: string,
  lastName?: string,
) => {
  try {
    const { data } = await axiosInstance.post("/auth/complete-invited-signup", {
      token,
      password,
      firstName,
      lastName,
    });
    return data;
  } catch (error) {
    logAuthError(error, "complete-invited-signup-failed");
    logger.error("Error completing invited signup:", error);
    throw error;
  }
};

/**
 * POST /auth/logout -- Logs out the current user session.
 *
 * Skips 401 reload logic. On error, returns a local logout message
 * instead of throwing, ensuring the client-side logout always succeeds.
 *
 * @returns Response data confirming logout, or a local fallback message
 */
export const logout = async () => {
  try {
    const { data } = await axiosInstance.post(
      "/auth/logout",
      {},
      {
        headers: { "x-skip-401-reload": "true" },
      },
    );
    return data;
  } catch (error) {
    logAuthError(error, "logout-failed");
    logger.error("Error during logout:", error);
    // Don't throw error, just log it - logout should work even if API fails
    return { message: "Logged out locally" };
  }
};
