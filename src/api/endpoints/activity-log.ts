import { axiosInstance } from "../index";

/**
 * Activity Log API Types and Endpoints
 * Backend endpoint: GET /company/:companyId/activity-log
 */

// Backend enums - must match backend/src/modules/activity-log/enums/activity-log.enum.ts
export enum ActivityActionEnum {
  // User management
  USER_INVITED = "user_invited",
  USER_REMOVED = "user_removed",
  USER_ACTIVATED = "user_activated",
  USER_DEACTIVATED = "user_deactivated",
  ROLE_CHANGED = "role_changed",

  // Settings
  SETTINGS_UPDATED = "settings_updated",
  LOGO_CHANGED = "logo_changed",
  COMPANY_INFO_UPDATED = "company_info_updated",

  // Security
  PASSWORD_CHANGED = "password_changed",
  EMAIL_CHANGED = "email_changed",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",

  // Integrations
  PROCORE_CONNECTED = "procore_connected",
  PROCORE_DISCONNECTED = "procore_disconnected",
  PROCORE_SYNC_STARTED = "procore_sync_started",
  PROCORE_SYNC_COMPLETED = "procore_sync_completed",
  STRIPE_SUBSCRIPTION_CREATED = "stripe_subscription_created",
  STRIPE_SUBSCRIPTION_UPDATED = "stripe_subscription_updated",
  STRIPE_SUBSCRIPTION_CANCELLED = "stripe_subscription_cancelled",
}

export enum ActivityCategoryEnum {
  USERS = "users",
  SETTINGS = "settings",
  SECURITY = "security",
  INTEGRATIONS = "integrations",
}

// Activity log entry from backend
export interface ActivityLogEntry {
  _id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: ActivityActionEnum;
  category: ActivityCategoryEnum;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Query parameters for fetching activity log
export interface GetActivityLogParams {
  page?: number;
  limit?: number;
  category?: ActivityCategoryEnum;
  action?: ActivityActionEnum;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// Response from backend
export interface PaginatedActivityLogResponse {
  success_message: string;
  total_pages: number;
  current_page: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  data: ActivityLogEntry[];
}

// Query keys for react-query
export const activityLogKeys = {
  all: ["activity-log"] as const,
  list: (companyId: string, params: GetActivityLogParams) =>
    [...activityLogKeys.all, companyId, params] as const,
};

/**
 * Fetch activity log for a company with optional filters
 */
export async function getActivityLog(
  companyId: string,
  params: GetActivityLogParams = {},
): Promise<PaginatedActivityLogResponse> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.category) queryParams.append("category", params.category);
  if (params.action) queryParams.append("action", params.action);
  if (params.userId) queryParams.append("userId", params.userId);
  if (params.startDate) queryParams.append("startDate", params.startDate);
  if (params.endDate) queryParams.append("endDate", params.endDate);

  const queryString = queryParams.toString();
  const url = `/company/${companyId}/activity-log${queryString ? `?${queryString}` : ""}`;

  const response = await axiosInstance.get<PaginatedActivityLogResponse>(url);
  return response.data;
}
