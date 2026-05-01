/**
 * @fileoverview Hook for fetching, filtering, and paginating the company
 * activity log. Maps backend activity entries to a frontend-friendly format
 * with human-readable descriptions.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getActivityLog,
  activityLogKeys,
  ActivityLogEntry,
  ActivityActionEnum,
  ActivityCategoryEnum,
  GetActivityLogParams,
} from "@/api/endpoints/activity-log";

// Re-export enums for components
export { ActivityActionEnum, ActivityCategoryEnum };

// Mapped activity interface for component consumption
export interface Activity {
  id: string;
  action: ActivityActionEnum;
  category: ActivityCategoryEnum;
  userId: string;
  userName: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityLogFilters {
  category: string; // 'all' | ActivityCategoryEnum value
  action: string; // 'all' | ActivityActionEnum value
  userId: string; // 'all' | specific user ID
  dateRange: string; // '7' | '30' | '90' | 'all'
  page: number;
  perPage: number;
}

export interface ActivityLogResponse {
  activities: Activity[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Generate a human-readable description from activity action and details
 */
function generateDescription(
  action: ActivityActionEnum,
  details: Record<string, unknown>,
): string {
  switch (action) {
    case ActivityActionEnum.USER_INVITED:
      return `invited ${details.targetUserName || details.targetEmail || "a user"} to the company`;
    case ActivityActionEnum.USER_REMOVED:
      return `removed ${details.targetUserName || "a user"} from the company`;
    case ActivityActionEnum.USER_ACTIVATED:
      return `activated ${details.targetUserName || "a user"}`;
    case ActivityActionEnum.USER_DEACTIVATED:
      return `deactivated ${details.targetUserName || "a user"}`;
    case ActivityActionEnum.ROLE_CHANGED:
      return `changed ${details.targetUserName || "a user"}'s role from ${details.oldRole || "unknown"} to ${details.newRole || "unknown"}`;
    case ActivityActionEnum.SETTINGS_UPDATED:
      return `updated ${details.settingName || "company settings"}`;
    case ActivityActionEnum.LOGO_CHANGED:
      return "updated the company logo";
    case ActivityActionEnum.COMPANY_INFO_UPDATED:
      return `updated company ${details.field || "information"}`;
    case ActivityActionEnum.PASSWORD_CHANGED:
      return "changed their password";
    case ActivityActionEnum.EMAIL_CHANGED:
      return `changed email from ${details.oldEmail || "unknown"} to ${details.newEmail || "unknown"}`;
    case ActivityActionEnum.TWO_FACTOR_ENABLED:
      return "enabled two-factor authentication";
    case ActivityActionEnum.TWO_FACTOR_DISABLED:
      return "disabled two-factor authentication";
    case ActivityActionEnum.LOGIN_SUCCESS:
      return "logged in";
    case ActivityActionEnum.LOGIN_FAILED:
      return "failed login attempt";
    case ActivityActionEnum.LOGOUT:
      return "logged out";
    case ActivityActionEnum.PROCORE_CONNECTED:
      return "connected Procore integration";
    case ActivityActionEnum.PROCORE_DISCONNECTED:
      return "disconnected Procore integration";
    case ActivityActionEnum.PROCORE_SYNC_STARTED:
      return "started Procore sync";
    case ActivityActionEnum.PROCORE_SYNC_COMPLETED:
      return `completed Procore sync${details.itemCount ? ` (${details.itemCount} items)` : ""}`;
    case ActivityActionEnum.STRIPE_SUBSCRIPTION_CREATED:
      return `created subscription for ${details.planName || "a plan"}`;
    case ActivityActionEnum.STRIPE_SUBSCRIPTION_UPDATED:
      return `updated subscription to ${details.planName || "a plan"}`;
    case ActivityActionEnum.STRIPE_SUBSCRIPTION_CANCELLED:
      return "cancelled subscription";
    default:
      return String(details.description || action);
  }
}

/**
 * Map backend activity log entry to frontend Activity interface
 */
function mapActivityLogEntry(entry: ActivityLogEntry): Activity {
  return {
    id: entry._id,
    action: entry.action,
    category: entry.category,
    userId: entry.userId,
    userName: entry.userName,
    description: generateDescription(entry.action, entry.details),
    details: entry.details,
    timestamp: entry.createdAt,
  };
}

/**
 * Calculate date range for API query
 */
function getDateRangeParams(
  dateRange: string,
): Pick<GetActivityLogParams, "startDate" | "endDate"> {
  if (dateRange === "all") {
    return {};
  }

  const days = parseInt(dateRange, 10);
  if (isNaN(days)) {
    return {};
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

/**
 * Fetches and manages the company activity log with support for filtering
 * by category, action, user, and date range, as well as pagination.
 *
 * Internally maps raw backend {@link ActivityLogEntry} records to
 * frontend {@link Activity} objects with human-readable descriptions
 * generated from the action type and details.
 *
 * The query is automatically disabled when `companyId` is empty and uses
 * a 30-second stale time to balance freshness with performance.
 *
 * @param companyId - The company ID to fetch the activity log for
 * @returns The TanStack Query result spread with:
 *   - `data` - An {@link ActivityLogResponse} with mapped activities and pagination info
 *   - `filters` - The current {@link ActivityLogFilters} state
 *   - `setFilters` - Setter to update filter/pagination values
 */
export function useActivityLog(companyId: string) {
  const [filters, setFilters] = useState<ActivityLogFilters>({
    category: "all",
    action: "all",
    userId: "all",
    dateRange: "30",
    page: 1,
    perPage: 20,
  });

  // Build API params from filters
  const apiParams = useMemo((): GetActivityLogParams => {
    const params: GetActivityLogParams = {
      page: filters.page,
      limit: filters.perPage,
      ...getDateRangeParams(filters.dateRange),
    };

    if (filters.category !== "all") {
      params.category = filters.category as ActivityCategoryEnum;
    }

    if (filters.action !== "all") {
      params.action = filters.action as ActivityActionEnum;
    }

    if (filters.userId !== "all") {
      params.userId = filters.userId;
    }

    return params;
  }, [filters]);

  const query = useQuery({
    queryKey: activityLogKeys.list(companyId, apiParams),
    queryFn: () => getActivityLog(companyId, apiParams),
    enabled: Boolean(companyId),
    staleTime: 30000, // 30 seconds
    select: (data): ActivityLogResponse => ({
      activities: data.data.map(mapActivityLogEntry),
      total: data.total_items,
      page: data.current_page,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrev: data.has_prev,
    }),
  });

  return { ...query, filters, setFilters };
}
