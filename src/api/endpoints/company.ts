/**
 * @fileoverview Company API endpoints, Procore integration, and TanStack Query hooks.
 *
 * Provides hooks for: fetching company details, company storage (deprecated),
 * Procore connection status, Procore integration status and details,
 * changing integration owner, storage statistics, and dashboard statistics.
 *
 * Provides API functions for: patching company settings, adding Stripe add-ons,
 * updating Procore settings, Procore logout, and generating Procore login URLs.
 *
 * Query keys: companyKeys.all, companyKeys.detail(id), companyKeys.dashboardStats(id),
 *             procoreKeys.status(id), procoreKeys.integrationStatus(id),
 *             companyProcoreKeys.integrationDetails(id), storageStatsKeys.stats(id)
 */
import { axiosInstance } from "../index";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Company } from "../../types";
import { logApiError, logProcoreError } from "@/utils/rollbar";

/** Query key factory for company queries. */
export const companyKeys = {
  /** Base key for all company queries. */
  all: ["company"] as const,
  /** Key for a single company by ID. */
  detail: (id: string) => [...companyKeys.all, id] as const,
  /** Key for dashboard statistics by company ID. */
  dashboardStats: (id: string) =>
    [...companyKeys.all, "dashboard-stats", id] as const,
};

/**
 * Fetches the company details by ID.
 *
 * GET /company/:id -- Returns the Company object.
 * Enabled when companyId is truthy.
 *
 * @param companyId - The company ID to fetch
 * @returns TanStack Query result with Company data
 */
export const useCompany = (companyId: string) => {
  return useQuery({
    queryKey: companyKeys.detail(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(`/company/${companyId}`);
        const data = res.data?.data ?? res.data;
        return data as Company;
      } catch (error) {
        logApiError(error, "company-query-failed", { companyId });
        throw error;
      }
    },
    enabled: Boolean(companyId),
  });
};

/**
 * Fetches company storage usage from S3 (deprecated).
 *
 * GET /s3/storage?prefix=:companyId -- Disabled by default (enabled: false).
 * Use useStorageStats instead for accurate, recalculated storage data.
 *
 * @deprecated Use useStorageStats for accurate storage statistics.
 * @param companyId - The company ID
 * @returns TanStack Query result (disabled by default)
 */
export const useCompanyStorage = (companyId: string) => {
  return useQuery({
    queryKey: companyKeys.detail(`${companyId}-storage-deprecated`),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/s3/storage?prefix=${companyId}`,
      );
      return data;
    },
    enabled: false,
  });
};

/**
 * PATCH /company/:id -- Updates company settings.
 *
 * @param companyId - The company ID to update
 * @param payload - Partial Company object with fields to update
 * @returns The updated Company object
 */
export const patchCompany = async (
  companyId: string,
  payload: Partial<Company>,
): Promise<Company> => {
  try {
    const res = await axiosInstance.patch(`/company/${companyId}`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    const data = res.data?.data ?? res.data;
    return data as Company;
  } catch (error) {
    logApiError(error, "patch-company-failed", { companyId });
    throw error;
  }
};

/**
 * POST /company/:id/addons -- Activates a Stripe add-on for the company.
 *
 * @param companyId - The company ID
 * @param sessionId - The Stripe checkout session ID
 * @returns The updated Company object
 */
export const addStripeAddon = async (
  companyId: string,
  sessionId: string,
): Promise<Company> => {
  try {
    const res = await axiosInstance.post(
      `/company/${companyId}/addons`,
      { sessionId },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    const data = res.data?.data ?? res.data;
    return data as Company;
  } catch (error) {
    logApiError(
      error,
      "add-stripe-addon-failed",
      { companyId },
      { logClientErrors: true },
    );
    throw error;
  }
};

/** Basic Procore connection status for a company. */
export interface ProcoreStatus {
  isConnected: boolean;
  procoreEmail?: string;
  editProcoreItemsAllowed: boolean;
}

/** Sync health status levels for the Procore integration. */
export type ProcoreSyncHealthStatus = "healthy" | "degraded" | "error";

/** Extended Procore integration status with sync health and aggregate counts. */
export interface ExtendedProcoreStatus {
  connected: boolean;
  companyName?: string;
  lastSyncTime?: string;
  projectsCount: number;
  documentsCount: number;
  inspectionsCount: number;
  syncHealthStatus: ProcoreSyncHealthStatus;
  procoreEmail?: string;
  editProcoreItemsAllowed: boolean;
}

/** Query key factory for Procore status queries at the company level. */
export const procoreKeys = {
  /** Key for basic Procore connection status. */
  status: (companyId: string) => ["procore", "status", companyId] as const,
  /** Key for extended Procore integration status. */
  integrationStatus: (companyId: string) =>
    ["procore", "integrationStatus", companyId] as const,
};

/**
 * Fetches the basic Procore connection status for a company.
 *
 * GET /company/:id/procore-status -- Returns connection flag and email.
 * Enabled when companyId is truthy.
 *
 * @param companyId - The company ID
 * @returns TanStack Query result with ProcoreStatus
 */
export const useProcoreStatus = (companyId: string) => {
  return useQuery({
    queryKey: procoreKeys.status(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(
          `/company/${companyId}/procore-status`,
        );
        return res.data as ProcoreStatus;
      } catch (error) {
        logProcoreError(error, "procore-status-query-failed", { companyId });
        throw error;
      }
    },
    enabled: Boolean(companyId),
  });
};

/**
 * Fetches extended Procore integration status with sync health and entity counts.
 *
 * GET /procore/status?companyId=... -- Returns connection, sync health, and counts.
 * Enabled when companyId is truthy.
 *
 * @param companyId - The company ID
 * @returns TanStack Query result with ExtendedProcoreStatus
 */
export const useProcoreIntegrationStatus = (companyId: string) => {
  return useQuery({
    queryKey: procoreKeys.integrationStatus(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(`/procore/status`, {
          params: { companyId },
        });
        return res.data as ExtendedProcoreStatus;
      } catch (error) {
        logProcoreError(error, "procore-integration-status-query-failed", {
          companyId,
        });
        throw error;
      }
    },
    enabled: Boolean(companyId),
  });
};

/**
 * PATCH /company/:id/procore-settings -- Updates Procore-specific company settings.
 *
 * @param companyId - The company ID
 * @param editProcoreItemsAllowed - Whether users can edit Procore-sourced items
 * @returns The updated Company object
 */
export const updateProcoreSettings = async (
  companyId: string,
  editProcoreItemsAllowed: boolean,
): Promise<Company> => {
  try {
    const res = await axiosInstance.patch(
      `/company/${companyId}/procore-settings`,
      { editProcoreItemsAllowed },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    const data = res.data?.data ?? res.data;
    return data as Company;
  } catch (error) {
    logProcoreError(error, "update-procore-settings-failed", { companyId });
    throw error;
  }
};

/**
 * POST /oauth/procore/logout -- Disconnects the company from Procore.
 *
 * @param companyId - The company ID to disconnect
 * @returns Object with success flag
 */
export const procoreLogout = async (
  companyId: string,
): Promise<{ success: boolean }> => {
  try {
    const res = await axiosInstance.post(
      `/oauth/procore/logout`,
      { companyId },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return res.data;
  } catch (error) {
    logProcoreError(error, "procore-logout-failed", { companyId });
    throw error;
  }
};

/**
 * Builds the Procore OAuth login URL (client-side only, no API call).
 *
 * Constructs the URL from VITE_BACKEND_URL with companyId, userId, and
 * the current window origin as query parameters.
 *
 * @param companyId - Optional company ID
 * @param userId - Optional user ID
 * @returns Full Procore OAuth login URL string
 */
export const getProcoreLoginUrl = (
  companyId?: string,
  userId?: string,
): string => {
  const baseUrl = import.meta.env.VITE_BACKEND_URL;
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  if (userId) params.set("userId", userId);
  if (typeof window !== "undefined" && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  const qs = params.toString();
  return `${baseUrl}/oauth/procore/login${qs ? `?${qs}` : ""}`;
};

/** A user connected to Procore within the company. */
export interface ConnectedProcoreUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  connectedAt?: string;
  isIntegrationOwner: boolean;
}

/** Procore access/entitlement status for the company (trial, paid, expired). */
export interface ProcoreAccessStatus {
  allowed: boolean;
  reason:
    | "free_trial"
    | "paid_subscription"
    | "trial_expired"
    | "upgrade_required";
  trialDaysRemaining?: number;
}

/** Comprehensive Procore integration details including connected users and access status. */
export interface ProcoreIntegrationDetails {
  connected: boolean;
  integrationOwner?: {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  connectedUsers: ConnectedProcoreUser[];
  lastSyncTime?: string;
  syncHealth: "healthy" | "degraded" | "error";
  accessStatus: ProcoreAccessStatus;
}

/** Result of changing the Procore integration owner. */
export interface ChangeIntegrationOwnerResult {
  success: boolean;
  previousOwnerId?: string;
  newOwnerId: string;
  message: string;
}

/** Query key factory for company-level Procore integration detail queries. */
export const companyProcoreKeys = {
  /** Key for Procore integration details (connected users, access status). */
  integrationDetails: (companyId: string) =>
    ["company", "procore-integration", companyId] as const,
};

/**
 * Fetches comprehensive Procore integration details for a company.
 *
 * GET /company/:id/procore-integration-details -- Returns connected users,
 * integration owner, sync health, and access status.
 * Enabled when companyId is truthy. Always refetches on mount to avoid
 * stale "not connected" state after OAuth flows.
 * Stale time: 30 seconds.
 *
 * @param companyId - The company ID
 * @returns TanStack Query result with ProcoreIntegrationDetails
 */
export const useProcoreIntegrationDetails = (companyId: string) => {
  return useQuery({
    queryKey: companyProcoreKeys.integrationDetails(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(
          `/company/${companyId}/procore-integration-details`,
        );
        return res.data as ProcoreIntegrationDetails;
      } catch (error) {
        logProcoreError(error, "procore-integration-details-query-failed", {
          companyId,
        });
        throw error;
      }
    },
    enabled: Boolean(companyId),
    refetchOnMount: "always",
    staleTime: 30 * 1000, // 30s — prevents stale "not connected" state after OAuth or app updates
  });
};

/**
 * Mutation hook to change the Procore integration owner for a company.
 *
 * PUT /company/:id/procore-integration-owner -- Transfers ownership.
 * On success, invalidates integration details, basic status, and
 * integration status caches.
 *
 * @returns TanStack Mutation with mutationFn accepting { companyId, newOwnerUserId, requestingUserId }
 */
export const useChangeIntegrationOwner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      newOwnerUserId,
      requestingUserId,
    }: {
      companyId: string;
      newOwnerUserId: string;
      requestingUserId: string;
    }) => {
      const res = await axiosInstance.put(
        `/company/${companyId}/procore-integration-owner`,
        { newOwnerUserId, requestingUserId },
      );
      return res.data as ChangeIntegrationOwnerResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: companyProcoreKeys.integrationDetails(variables.companyId),
      });
      // Also invalidate basic procore status
      queryClient.invalidateQueries({
        queryKey: procoreKeys.status(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: procoreKeys.integrationStatus(variables.companyId),
      });
    },
  });
};

// ============================================================
// Storage Statistics (Recalculated on view)
// ============================================================

/**
 * Storage statistics response from the backend.
 * These values are recalculated from actual documents and QR codes
 * when the storage section is viewed.
 */
export interface StorageStats {
  /** Document storage used in bytes (recalculated from documents) */
  documentStorageUsed: number;
  /** QR code storage used in bytes (QR count * 250KB) */
  qrCodeStorageUsed: number;
  /** Total number of documents */
  documentsCount: number;
  /** Total number of QR codes */
  qrCodesCount: number;
  /** Document storage capacity in bytes */
  documentStorageCapacity: number;
  /** QR code storage capacity in bytes (0 for free trial shared pool) */
  qrCodeStorageCapacity: number;
  /** Number of documents without size field (links, legacy uploads) */
  documentsWithoutSize: number;
}

/** Query key factory for storage statistics queries. */
export const storageStatsKeys = {
  /** Base key for all storage stats queries. */
  all: ["storage-stats"] as const,
  /** Key for storage stats by company ID. */
  stats: (companyId: string) => [...storageStatsKeys.all, companyId] as const,
};

/**
 * Hook to fetch fresh storage statistics by recalculating from actual documents.
 * This endpoint handles legacy data and updates the Company document with fresh values.
 *
 * Call this when the Storage & Usage section is viewed.
 */
export const useStorageStats = (companyId: string, enabled = true) => {
  return useQuery({
    queryKey: storageStatsKeys.stats(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(
          `/company/${companyId}/storage-stats`,
        );
        return res.data.data as StorageStats;
      } catch (error) {
        logApiError(error, "storage-stats-query-failed", { companyId });
        throw error;
      }
    },
    enabled: Boolean(companyId) && enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
};

// ============================================================
// Dashboard Statistics
// ============================================================

/**
 * Dashboard statistics response from the backend.
 * Provides accurate aggregate counts for dashboard display.
 */
export interface DashboardStats {
  qrCodesCount: number;
  qrScansCount: number;
  documentsCount: number;
  projectsCount: number;
  groupsCount: number;
  arrangementsCount: number;
  equipmentCount: number;
}

/**
 * Hook to fetch dashboard statistics for a company.
 * Uses server-side aggregation for accurate counts instead of client-side calculations.
 */
export const useDashboardStats = (companyId: string) => {
  return useQuery({
    queryKey: companyKeys.dashboardStats(companyId),
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(
          `/company/${companyId}/dashboard-stats`,
        );
        return res.data.data as DashboardStats;
      } catch (error) {
        logApiError(error, "dashboard-stats-query-failed", { companyId });
        throw error;
      }
    },
    enabled: Boolean(companyId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};
