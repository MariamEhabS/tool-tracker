import { axiosInstance } from "../index";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { logApiError } from "@/utils/rollbar";

// Types
export interface AdminCompany {
  _id: string;
  companyName: string;
  usersCount: number;
  projectsCount: number;
  qrCodesCount: number;
  documentsCount: number;
  paidAccount: boolean;
  freeTrialActive: boolean;
  freeTrialRefreshDate?: string;
  planTier?: string;
  subscriptionCanceled?: boolean;
  procoreIntegration: boolean;
  emailDomains: string[];
  createdAt: string;
  deactivated?: boolean;
  oldestAdminEmail?: string;
  oldestAdminFirstName?: string;
  oldestAdminLastName?: string;
  matchedUserName?: string;
}

export interface AdminImpersonationCandidate {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permission: string;
  companyId: string;
  companyName: string;
  isVerified: boolean;
  lastLoggedIn?: string;
}

export interface AdminUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  permission: string;
  lastLoggedIn?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AdminCompanyDetail {
  _id: string;
  companyName: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZIP?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyIndustry?: string;
  usersCount: number;
  projectsCount: number;
  qrCodesCount: number;
  documentsCount: number;
  paidAccount: boolean;
  freeTrialActive: boolean;
  freeTrialRefreshDate?: string;
  planTier?: string;
  subscriptionCanceled?: boolean;
  procoreIntegration: boolean;
  procoreCompanyID?: number;
  emailDomains: string[];
  pendingDomainReview?: string[]; // Domains pending admin approval
  stripeCustomerID?: string;
  stripeSubscriptionID?: string;
  stripePriceID?: string;
  stripeSubscriptionStatus?: string;
  createdAt: string;
  updatedAt?: string;
  deactivated?: boolean;
  // Storage
  documentStorageUsed?: number;
  documentStorageCapacity?: number;
  qrCodeStorageUsed?: number;
  qrCodeStorageCapacity?: number;
  stripeAddons?: Array<Record<string, unknown>>;
  // Billing
  subscribedAt?: string;
  cancelledAt?: string;
  // Extended counts
  qrGroupsCount?: number;
  qrScansCount?: number;
  // Procore details
  procoreLastSyncTime?: string;
  procoreLastSyncError?: string;
  procoreSyncErrorCount?: number;
}

export interface ListCompaniesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  plan?: string;
  procore?: string;
}

export interface ListCompaniesResponse {
  companies: AdminCompany[];
  total: number;
  page: number;
  limit: number;
}

export interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalProjects: number;
  totalQrCodes: number;
  totalDocuments: number;
  totalQrGroups: number;
  totalQrScans: number;
  totalDocumentStorageUsed: number;
  totalDocumentStorageCapacity: number;
  totalQrCodeStorageUsed: number;
  totalQrCodeStorageCapacity: number;
  planBreakdown: {
    freeTrial: number;
    trialRefreshed: number;
    standard: number;
    professional: number;
    business: number;
    earlyAdopter: number;
    expired: number;
    cancelled: number;
  };
  procoreConnected: number;
  procoreNotConnected: number;
  deactivatedCompanies: number;
}

export interface OnlinePresencePingParams {
  sessionId: string;
  routePath: string;
  isMobileRoute: boolean;
}

export interface TransferUserParams {
  targetCompanyId: string;
  makeAdmin?: boolean;
  force?: boolean;
}

export interface UpdateUserParams {
  firstName?: string;
  lastName?: string;
  permission?: string;
}

export interface InviteUserParams {
  email: string;
  firstName?: string;
  lastName?: string;
  permission: string;
}

export interface RefreshTrialParams {
  durationDays?: number;
}

export interface NotifyAdminsParams {
  subject: string;
  body: string;
  template?: "procore_disconnection" | "trial_expiring" | "custom";
}

export interface UpdateCompanyStatusParams {
  deactivated: boolean;
}

export interface NotifyAdminsResponse {
  sentCount: number;
}

// Query Keys
export const adminCustomersKeys = {
  all: ["admin-customers"] as const,
  companies: (params?: ListCompaniesParams) =>
    [...adminCustomersKeys.all, "companies", params] as const,
  companyDetail: (id: string) =>
    [...adminCustomersKeys.all, "company", id] as const,
  companyUsers: (id: string) =>
    [...adminCustomersKeys.all, "company", id, "users"] as const,
  impersonationCandidates: (search?: string, limit?: number) =>
    [
      ...adminCustomersKeys.all,
      "impersonation-candidates",
      search,
      limit,
    ] as const,
  stats: () => [...adminCustomersKeys.all, "stats"] as const,
};

// API Functions

/**
 * List all companies with stats
 */
export const getAdminCompanies = async (
  params?: ListCompaniesParams,
): Promise<ListCompaniesResponse> => {
  try {
    const res = await axiosInstance.get("/admin/customers/companies", {
      params,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-list-companies-failed", { params });
    throw error;
  }
};

/**
 * Track the current route as online presence
 */
export const trackOnlinePresence = async (
  params: OnlinePresencePingParams,
): Promise<void> => {
  await axiosInstance.post("/admin/customers/online/ping", params);
};

/**
 * Get platform-wide aggregate statistics
 */
export const getAdminPlatformStats = async (): Promise<PlatformStats> => {
  try {
    const res = await axiosInstance.get("/admin/customers/stats");
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-platform-stats-failed");
    throw error;
  }
};

/**
 * Get a single company with full details
 */
export const getAdminCompany = async (
  companyId: string,
): Promise<AdminCompanyDetail> => {
  try {
    const res = await axiosInstance.get(
      `/admin/customers/companies/${companyId}`,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-get-company-failed", { companyId });
    throw error;
  }
};

/**
 * List all users for a company
 */
export const getAdminCompanyUsers = async (
  companyId: string,
): Promise<AdminUser[]> => {
  try {
    const res = await axiosInstance.get(
      `/admin/customers/companies/${companyId}/users`,
    );
    const data = res.data?.data ?? res.data;
    return data.users ?? data;
  } catch (error) {
    logApiError(error, "admin-list-company-users-failed", { companyId });
    throw error;
  }
};

/**
 * Search customer user candidates for impersonation
 */
export const getImpersonationCandidates = async (
  search?: string,
  limit = 20,
): Promise<AdminImpersonationCandidate[]> => {
  try {
    const res = await axiosInstance.get(
      "/admin/customers/impersonation/candidates",
      {
        params: { search, limit },
      },
    );
    const data = res.data?.data ?? res.data;
    return data.candidates ?? [];
  } catch (error) {
    logApiError(error, "admin-impersonation-candidates-failed", {
      search,
      limit,
    });
    throw error;
  }
};

/**
 * Update company email domains
 */
export const updateEmailDomains = async (
  companyId: string,
  emailDomains: string[],
): Promise<AdminCompanyDetail> => {
  try {
    const res = await axiosInstance.patch(
      `/admin/customers/companies/${companyId}/email-domains`,
      { emailDomains },
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-update-email-domains-failed", {
      companyId,
      emailDomains,
    });
    throw error;
  }
};

/**
 * Transfer a user to another company
 */
export const transferUser = async (
  userId: string,
  params: TransferUserParams,
): Promise<AdminUser> => {
  try {
    const res = await axiosInstance.post(
      `/admin/customers/users/${userId}/transfer`,
      params,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-transfer-user-failed", { userId, params });
    throw error;
  }
};

/**
 * Update user details
 */
export const updateAdminUser = async (
  userId: string,
  params: UpdateUserParams,
): Promise<AdminUser> => {
  try {
    const res = await axiosInstance.patch(
      `/admin/customers/users/${userId}`,
      params,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-update-user-failed", { userId, params });
    throw error;
  }
};

/**
 * Delete a user
 */
export const deleteAdminUser = async (userId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`/admin/customers/users/${userId}`);
  } catch (error) {
    logApiError(error, "admin-delete-user-failed", { userId });
    throw error;
  }
};

/**
 * Invite a new user to a company
 */
export const inviteUser = async (
  companyId: string,
  params: InviteUserParams,
): Promise<AdminUser> => {
  try {
    const res = await axiosInstance.post(
      `/admin/customers/companies/${companyId}/invite`,
      params,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-invite-user-failed", { companyId, params });
    throw error;
  }
};

/**
 * Refresh a company's free trial
 */
export const refreshCompanyTrial = async (
  companyId: string,
  params?: RefreshTrialParams,
): Promise<AdminCompanyDetail> => {
  try {
    const res = await axiosInstance.patch(
      `/admin/customers/companies/${companyId}/refresh-trial`,
      params || {},
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-refresh-trial-failed", { companyId });
    throw error;
  }
};

/**
 * Send notification to company admins
 */
export const notifyCompanyAdmins = async (
  companyId: string,
  params: NotifyAdminsParams,
): Promise<NotifyAdminsResponse> => {
  try {
    const res = await axiosInstance.post(
      `/admin/customers/companies/${companyId}/notify-admins`,
      params,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-notify-admins-failed", { companyId });
    throw error;
  }
};

/**
 * Update company status (deactivate/reactivate)
 */
export const updateCompanyStatus = async (
  companyId: string,
  params: UpdateCompanyStatusParams,
): Promise<AdminCompanyDetail> => {
  try {
    const res = await axiosInstance.patch(
      `/admin/customers/companies/${companyId}/status`,
      params,
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    logApiError(error, "admin-update-company-status-failed", { companyId });
    throw error;
  }
};

/**
 * Delete a company
 */
export const deleteAdminCompany = async (companyId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`/admin/customers/companies/${companyId}`);
  } catch (error) {
    logApiError(error, "admin-delete-company-failed", { companyId });
    throw error;
  }
};

// React Query Hooks

/**
 * Hook to list all companies
 */
export const useAdminCompanies = (params?: ListCompaniesParams) => {
  return useQuery({
    queryKey: adminCustomersKeys.companies(params),
    queryFn: () => getAdminCompanies(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to get platform-wide aggregate statistics.
 * Only fetches when enabled (e.g. when the stats modal is open).
 */
export const useAdminPlatformStats = (enabled = true) => {
  return useQuery({
    queryKey: adminCustomersKeys.stats(),
    queryFn: getAdminPlatformStats,
    enabled,
    staleTime: 60_000,
  });
};

/**
 * Hook to get a single company
 */
export const useAdminCompany = (companyId: string) => {
  return useQuery({
    queryKey: adminCustomersKeys.companyDetail(companyId),
    queryFn: () => getAdminCompany(companyId),
    enabled: Boolean(companyId),
  });
};

/**
 * Hook to list users for a company
 */
export const useAdminCompanyUsers = (companyId: string) => {
  return useQuery({
    queryKey: adminCustomersKeys.companyUsers(companyId),
    queryFn: () => getAdminCompanyUsers(companyId),
    enabled: Boolean(companyId),
  });
};

/**
 * Hook to search impersonation candidates
 */
export const useAdminImpersonationCandidates = (
  search?: string,
  limit = 20,
  enabled = true,
) => {
  return useQuery({
    queryKey: adminCustomersKeys.impersonationCandidates(search, limit),
    queryFn: () => getImpersonationCandidates(search, limit),
    enabled,
    staleTime: 30_000,
  });
};

/**
 * Hook to update email domains
 */
export const useUpdateEmailDomains = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      emailDomains,
    }: {
      companyId: string;
      emailDomains: string[];
    }) => updateEmailDomains(companyId, emailDomains),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyDetail(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Approve pending email domains for a company
 */
export const approvePendingDomains = async (
  companyId: string,
  domains: string[],
): Promise<{ success_message: string; data: AdminCompanyDetail }> => {
  try {
    const response = await axiosInstance.post(
      `/admin/customers/companies/${companyId}/approve-domains`,
      { domains },
    );
    return response.data;
  } catch (error) {
    logApiError(error, "admin-approve-domains-failed", { companyId });
    throw error;
  }
};

/**
 * Hook to approve pending email domains
 */
export const useApprovePendingDomains = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      domains,
    }: {
      companyId: string;
      domains: string[];
    }) => approvePendingDomains(companyId, domains),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyDetail(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Hook to transfer a user
 */
export const useTransferUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      params,
    }: {
      userId: string;
      params: TransferUserParams;
      sourceCompanyId: string;
    }) => transferUser(userId, params),
    onSuccess: (_, variables) => {
      // Invalidate both source and target company queries
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyUsers(variables.sourceCompanyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyUsers(
          variables.params.targetCompanyId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Hook to update a user
 */
export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      params,
    }: {
      userId: string;
      params: UpdateUserParams;
      companyId: string;
    }) => updateAdminUser(userId, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyUsers(variables.companyId),
      });
    },
  });
};

/**
 * Hook to delete a user
 */
export const useDeleteAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }: { userId: string; companyId: string }) =>
      deleteAdminUser(userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyUsers(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Hook to invite a user
 */
export const useInviteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      params,
    }: {
      companyId: string;
      params: InviteUserParams;
    }) => inviteUser(companyId, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyUsers(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Hook to refresh company trial
 */
export const useRefreshCompanyTrial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      params,
    }: {
      companyId: string;
      params?: RefreshTrialParams;
    }) => refreshCompanyTrial(companyId, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyDetail(variables.companyId),
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companies(),
      });
    },
  });
};

/**
 * Hook to notify company admins
 */
export const useNotifyCompanyAdmins = () => {
  return useMutation({
    mutationFn: ({
      companyId,
      params,
    }: {
      companyId: string;
      params: NotifyAdminsParams;
    }) => notifyCompanyAdmins(companyId, params),
  });
};

/**
 * Hook to update company status
 */
export const useUpdateCompanyStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      params,
    }: {
      companyId: string;
      params: UpdateCompanyStatusParams;
    }) => updateCompanyStatus(companyId, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminCustomersKeys.companyDetail(variables.companyId),
      });
      // Use partial key to match all companies queries regardless of pagination/filter params
      queryClient.invalidateQueries({
        queryKey: ["admin-customers", "companies"],
      });
    },
  });
};

/**
 * Hook to delete a company
 */
export const useDeleteAdminCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId }: { companyId: string }) =>
      deleteAdminCompany(companyId),
    onSuccess: () => {
      // Use partial key to match all companies queries regardless of pagination/filter params
      queryClient.invalidateQueries({
        queryKey: ["admin-customers", "companies"],
      });
    },
  });
};
