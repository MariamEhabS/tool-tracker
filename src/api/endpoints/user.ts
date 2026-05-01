/**
 * @fileoverview User API endpoints and TanStack Query hooks.
 *
 * Provides hooks for: fetching user Procore connection status and disconnecting
 * a user from Procore.
 *
 * Provides API functions for: listing company users (paginated), patching user
 * details, deleting users (single and bulk), adding/inviting users, switching
 * admin roles, resending invites, changing passwords, managing notification
 * preferences, email change (OTP request/verify), and password change via OTP.
 *
 * Query keys: userProcoreKeys.status(userId, companyId)
 */
import { axiosInstance } from "../index";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logApiError, logProcoreError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

/** Payload for updating user details. */
export type PatchUserDto = {
  companyId: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  permission?: "admin" | "pm" | "user";
};

/**
 * PATCH /user/:id -- Updates a user's profile details.
 *
 * Returns the updated user object directly (unwrapped from the envelope).
 *
 * @param userId - The user ID to update
 * @param payload - Update payload including companyId and optional profile fields
 * @returns The updated user object
 */
export const patchUserDetails = async (
  userId: string,
  payload: PatchUserDto,
) => {
  try {
    const res = await axiosInstance.patch(`/user/${userId}`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    const data = res.data?.data ?? res.data;
    return data;
  } catch (error) {
    logApiError(error, "patch-user-failed", { userId });
    throw error;
  }
};

/** Parameters for paginated user list queries. */
export type ListUsersParams = {
  companyId: string;
  current_page?: number;
  per_page?: number;
  search?: string;
};

/** Shape of a user record returned by the list endpoint. */
export type UserRecord = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  permission?: "admin" | "pm" | "user";
  isVerified?: boolean;
};

/**
 * GET /user/ -- Fetches a paginated list of users for a company.
 *
 * @param params - Query parameters including companyId, pagination, and search
 * @returns Object with users array, total count, currentPage, and totalPages
 */
export const listCompanyUsers = async (params: ListUsersParams) => {
  try {
    const res = await axiosInstance.get("/user/", { params });
    const data = res.data;
    return {
      users: (data?.data ?? []) as UserRecord[],
      total: data?.total_items ?? 0,
      currentPage: data?.current_page ?? 1,
      totalPages: data?.total_pages ?? 1,
    };
  } catch (error) {
    logApiError(error, "list-company-users-failed", {
      companyId: params.companyId,
    });
    throw error;
  }
};

/**
 * DELETE /user/:id -- Deletes a single user.
 *
 * @param userId - The user ID to delete
 * @param payload - Object containing companyId for authorization
 * @returns Response data confirming deletion
 */
export const deleteUser = async (
  userId: string,
  payload: { companyId: string },
) => {
  try {
    const res = await axiosInstance.delete(`/user/${userId}`, {
      headers: { "Content-Type": "application/json" },
      data: payload,
    });
    return res.data;
  } catch (error) {
    logApiError(error, "delete-user-failed", {
      userId,
      companyId: payload.companyId,
    });
    throw error;
  }
};

/**
 * DELETE /user/bulk -- Deletes multiple users in a single request.
 *
 * Validates that the count does not exceed MAX_BULK_DELETE_COUNT.
 *
 * @param companyId - The company ID
 * @param userIds - Array of user IDs to delete
 * @returns Response data confirming bulk deletion
 */
export const deleteManyUsers = async (companyId: string, userIds: string[]) => {
  if (userIds.length > MAX_BULK_DELETE_COUNT) {
    throw new Error(
      `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${userIds.length}.`,
    );
  }
  try {
    const res = await axiosInstance.delete("/user/bulk", {
      headers: { "Content-Type": "application/json" },
      data: { companyId, userIds },
    });
    return res.data;
  } catch (error) {
    logApiError(error, "delete-many-users-failed", {
      companyId,
      userCount: userIds.length,
    });
    throw error;
  }
};

/**
 * POST /user/add-user -- Invites a new user to the company.
 *
 * Sends an invitation email to the specified address.
 *
 * @param payload - User invitation details including companyId, email, permission, and optional name
 * @returns Response data with invitation confirmation
 */
export const addUser = async (payload: {
  companyId: string;
  email: string;
  permission?: "admin" | "pm" | "user";
  firstName?: string;
  lastName?: string;
  inviterUserId?: string;
}) => {
  try {
    const res = await axiosInstance.post(`/user/add-user`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (error) {
    logApiError(error, "add-user-failed", { companyId: payload.companyId });
    throw error;
  }
};

/**
 * PATCH /user/switch-admin/:currentUserId/:newAdminUserId -- Transfers admin role.
 *
 * Demotes the current admin and promotes the target user.
 *
 * @param currentUserId - The current admin's user ID
 * @param newAdminUserId - The user ID to promote to admin
 * @param payload - Object containing companyId for authorization
 * @returns The updated user data
 */
export const switchAdminRole = async (
  currentUserId: string,
  newAdminUserId: string,
  payload: { companyId: string },
) => {
  try {
    const res = await axiosInstance.patch(
      `/user/switch-admin/${currentUserId}/${newAdminUserId}`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    const data = res.data?.data ?? res.data;
    return data;
  } catch (error) {
    logApiError(error, "switch-admin-failed", {
      currentUserId,
      newAdminUserId,
      companyId: payload.companyId,
    });
    throw error;
  }
};

/**
 * POST /user/resend-invite/:userId/:inviterUserId -- Resends a user invitation email.
 *
 * @param userId - The invited user's ID
 * @param inviterUserId - The inviting user's ID
 * @param payload - Object containing companyId for authorization
 * @returns Response data confirming the invitation was resent
 */
export const resendUserInvite = async (
  userId: string,
  inviterUserId: string,
  payload: { companyId: string },
) => {
  try {
    const res = await axiosInstance.post(
      `/user/resend-invite/${userId}/${inviterUserId}`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return res.data;
  } catch (error) {
    logApiError(error, "resend-invite-failed", { userId });
    throw error;
  }
};

/**
 * PATCH /user/:id/password -- Changes the user's password.
 *
 * Requires the current password for verification.
 *
 * @param userId - The user ID
 * @param payload - Object with currentPassword and newPassword
 * @returns Response data confirming the password was changed
 */
export const changePassword = async (
  userId: string,
  payload: {
    currentPassword: string;
    newPassword: string;
  },
) => {
  try {
    const res = await axiosInstance.patch(`/user/${userId}/password`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (error) {
    logApiError(error, "change-password-failed", { userId });
    throw error;
  }
};

/** Frequency options for notification delivery. */
export type NotificationFrequency = "immediate" | "daily" | "weekly";

/** Email notification toggle settings. */
export type EmailNotificationPreferences = {
  projectUpdates: boolean;
  inspectionReminders: boolean;
  documentUploads: boolean;
  teamActivity: boolean;
  weeklyDigest: boolean;
};

/** Push notification toggle settings. */
export type PushNotificationPreferences = {
  projectUpdates: boolean;
  inspectionReminders: boolean;
  documentUploads: boolean;
  teamActivity: boolean;
};

/** Full notification preferences for a user (email, push, frequency, quiet hours). */
export type NotificationPreferences = {
  email: EmailNotificationPreferences;
  push: PushNotificationPreferences;
  frequency: NotificationFrequency;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

/** Partial update payload for notification preferences (requires companyId). */
export type PatchNotificationPreferencesDto = Partial<{
  email: Partial<EmailNotificationPreferences>;
  push: Partial<PushNotificationPreferences>;
  frequency: NotificationFrequency;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}> & {
  companyId: string;
};

/**
 * GET /user/:id/notification-preferences -- Fetches user notification preferences.
 *
 * @param userId - The user ID
 * @param companyId - The company ID for scoping
 * @returns The user's NotificationPreferences object
 */
export const getNotificationPreferences = async (
  userId: string,
  companyId: string,
): Promise<NotificationPreferences> => {
  try {
    const res = await axiosInstance.get(
      `/user/${userId}/notification-preferences`,
      { params: { companyId } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "get-notification-preferences-failed", {
      userId,
      companyId,
    });
    throw error;
  }
};

/**
 * PATCH /user/:id/notification-preferences -- Updates user notification preferences.
 *
 * @param userId - The user ID
 * @param payload - Partial notification preferences update (must include companyId)
 * @returns The updated NotificationPreferences object
 */
export const updateNotificationPreferences = async (
  userId: string,
  payload: PatchNotificationPreferencesDto,
): Promise<NotificationPreferences> => {
  try {
    const res = await axiosInstance.patch(
      `/user/${userId}/notification-preferences`,
      payload,
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "update-notification-preferences-failed", { userId });
    throw error;
  }
};

/** Payload for requesting an email change OTP. */
export type RequestEmailChangeOtpPayload = {
  companyId: string;
  newEmail: string;
  currentPassword: string;
};

/** Response from requesting an email change OTP. */
export type RequestEmailChangeOtpResponse = {
  success: boolean;
  expiresIn: number;
};

/** Payload for verifying an email change OTP. */
export type VerifyEmailChangeOtpPayload = {
  companyId: string;
  newEmail: string;
  otp: string;
};

/** Response from verifying an email change OTP; may include new tokens and user data. */
export type VerifyEmailChangeOtpResponse = {
  success: boolean;
  message?: string;
  accessToken?: string;
  user?: {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyId?: string;
    permission?: "admin" | "pm" | "user";
    isVerified?: boolean;
  };
  /** Indicates user should restart the flow (e.g., max attempts exceeded, OTP expired) */
  restartFlow?: boolean;
};

/**
 * POST /user/:id/email-change-otp -- Requests an OTP for changing the user's email.
 *
 * Requires the current password for verification.
 *
 * @param userId - The user ID
 * @param payload - Includes companyId, newEmail, and currentPassword
 * @returns Response with success flag and OTP expiration time
 */
export const requestEmailChangeOtp = async (
  userId: string,
  payload: RequestEmailChangeOtpPayload,
): Promise<RequestEmailChangeOtpResponse> => {
  try {
    const res = await axiosInstance.post(
      `/user/${userId}/email-change-otp`,
      payload,
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "request-email-otp-failed", { userId });
    throw error;
  }
};

/**
 * POST /user/:id/email-change-verify -- Verifies the OTP and completes the email change.
 *
 * On success, returns updated tokens and user data with the new email.
 * May include restartFlow flag if max attempts exceeded or OTP expired.
 *
 * @param userId - The user ID
 * @param payload - Includes companyId, newEmail, and OTP code
 * @returns Response with success flag, optional new tokens, and user data
 */
export const verifyEmailChangeOtp = async (
  userId: string,
  payload: VerifyEmailChangeOtpPayload,
): Promise<VerifyEmailChangeOtpResponse> => {
  try {
    const res = await axiosInstance.post(
      `/user/${userId}/email-change-verify`,
      payload,
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "verify-email-otp-failed", { userId });
    throw error;
  }
};

/** Response from requesting a password change OTP. */
export type RequestPasswordChangeOtpResponse = {
  success: boolean;
  message?: string;
};

/** Payload for completing a password change via OTP. */
export type CompletePasswordChangeOtpPayload = {
  email: string;
  otp: string;
  password: string;
};

/** Response from completing a password change via OTP. */
export type CompletePasswordChangeOtpResponse = {
  success: boolean;
  message?: string;
  /** Indicates user should restart the flow (e.g., max attempts exceeded, OTP expired) */
  restartFlow?: boolean;
};

/** Payload for verifying a password change OTP. */
export type VerifyPasswordChangeOtpPayload = {
  email: string;
  otp: string;
};

/** Response from verifying a password change OTP. */
export type VerifyPasswordChangeOtpResponse = {
  success: boolean;
  message?: string;
  /** Indicates user should restart the flow (e.g., max attempts exceeded, OTP expired) */
  restartFlow?: boolean;
};

/**
 * POST /auth/forgot-password/request -- Requests an OTP for password change.
 *
 * Reuses the forgot-password/request endpoint for in-app password changes.
 *
 * @param email - The user's email address
 * @returns Response with success flag
 */
export const requestPasswordChangeOtp = async (
  email: string,
): Promise<RequestPasswordChangeOtpResponse> => {
  try {
    const res = await axiosInstance.post(
      `/auth/forgot-password/request`,
      { email },
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "request-password-otp-failed");
    throw error;
  }
};

/**
 * POST /auth/forgot-password/verify -- Verifies the password change OTP.
 *
 * Reuses the forgot-password/verify endpoint for in-app password changes.
 *
 * @param payload - Contains email and OTP code
 * @returns Response with success flag and optional restartFlow indicator
 */
export const verifyPasswordChangeOtp = async (
  payload: VerifyPasswordChangeOtpPayload,
): Promise<VerifyPasswordChangeOtpResponse> => {
  try {
    const res = await axiosInstance.post(
      `/auth/forgot-password/verify`,
      payload,
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "verify-password-otp-failed");
    throw error;
  }
};

/**
 * POST /auth/forgot-password/complete -- Completes the password change via OTP.
 *
 * Reuses the forgot-password/complete endpoint for in-app password changes.
 *
 * @param payload - Contains email, OTP code, and new password
 * @returns Response with success flag and optional restartFlow indicator
 */
export const completePasswordChangeOtp = async (
  payload: CompletePasswordChangeOtpPayload,
): Promise<CompletePasswordChangeOtpResponse> => {
  try {
    const res = await axiosInstance.post(
      `/auth/forgot-password/complete`,
      payload,
      { headers: { "Content-Type": "application/json" } },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "complete-password-change-failed");
    throw error;
  }
};

/** Procore connection status for a specific user. */
export interface UserProcoreStatus {
  connected: boolean;
  procoreUserId?: number;
  procoreEmail?: string;
  connectedAt?: string;
  isIntegrationOwner: boolean;
}

/** Result of disconnecting a user from Procore. */
export interface UserProcoreDisconnectResult {
  success: boolean;
  wasIntegrationOwner: boolean;
  companyDisconnected: boolean;
  message: string;
}

/** Query key factory for user-level Procore status queries. */
export const userProcoreKeys = {
  /** Key for a user's Procore connection status within a company. */
  status: (userId: string, companyId: string) =>
    ["user", "procore-status", userId, companyId] as const,
};

/**
 * Fetches the Procore connection status for a specific user.
 *
 * GET /user/:id/procore-status?companyId=... -- Returns connection flag,
 * Procore user ID, email, and integration owner status.
 * Enabled when both userId and companyId are truthy.
 *
 * @param userId - The user ID
 * @param companyId - The company ID
 * @returns TanStack Query result with UserProcoreStatus
 */
export const useUserProcoreStatus = (userId: string, companyId: string) => {
  return useQuery({
    queryKey: userProcoreKeys.status(userId, companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(`/user/${userId}/procore-status`, {
          params: { companyId },
        });
        return res.data as UserProcoreStatus;
      } catch (error) {
        logProcoreError(error, "user-procore-status-query-failed", {
          userId,
          companyId,
        });
        throw error;
      }
    },
    enabled: Boolean(userId && companyId),
  });
};

/**
 * Mutation hook to disconnect a user from Procore.
 *
 * POST /user/:id/procore-disconnect -- Disconnects the user's Procore account.
 * On success, invalidates the user's Procore status, company integration details,
 * and company Procore status caches.
 *
 * @returns TanStack Mutation with mutationFn accepting { userId, companyId }
 */
export const useDisconnectUserProcore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      companyId,
    }: {
      userId: string;
      companyId: string;
    }) => {
      try {
        const res = await axiosInstance.post(
          `/user/${userId}/procore-disconnect`,
          { companyId },
        );
        return res.data as UserProcoreDisconnectResult;
      } catch (error) {
        logProcoreError(error, "disconnect-user-procore-failed", {
          userId,
          companyId,
        });
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: userProcoreKeys.status(variables.userId, variables.companyId),
      });
      // Also invalidate company integration details
      queryClient.invalidateQueries({
        queryKey: ["company", "procore-integration", variables.companyId],
      });
      // Invalidate company procore status
      queryClient.invalidateQueries({
        queryKey: ["procore", "status", variables.companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["procore", "integrationStatus", variables.companyId],
      });
    },
  });
};
