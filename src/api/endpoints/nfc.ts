import { axiosInstance } from "../index";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { rollbar, ErrorCategories } from "@/utils/rollbar";

// Types

export interface NfcResolveResponse {
  type: "customer" | "marketing" | "unassigned";
  qrcodeId?: string;
  redirectUrl?: string;
  nfcId?: string;
}

export interface NfcTag {
  _id: string;
  url: string;
  assigned: boolean;
  purpose?: string;
  tagType?: string;
  websiteOverrideRedirect?: string;
  qrcodeRedirect?: string;
  company?: string;
  project?: string;
  batchId?: string;
  batchName?: string;
  createdAt: string;
}

export interface NfcListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  purpose?: string;
  tagType?: string;
  batchId?: string;
  batchName?: string;
  assigned?: boolean;
}

export interface NfcListResponse {
  tags: NfcTag[];
  total: number;
  page: number;
  limit: number;
}

type NfcListResponseData =
  | {
      tags?: NfcTag[];
      total?: number;
      page?: number;
      limit?: number;
      current_page?: number;
      per_page?: number;
      items?: NfcTag[];
    }
  | undefined;

export interface NfcStats {
  total: number;
  byPurpose: Record<string, number>;
  byTagType: Record<string, number>;
  assigned: number;
  unassigned: number;
}

export interface CreateNfcBatchParams {
  count: number;
  tagType: string;
  purpose: "customer" | "marketing";
  company?: string;
  websiteOverrideRedirect?: string;
  batchName?: string;
}

export interface CreateNfcBatchResponse {
  batchId: string;
  batchName: string;
  count: number;
  tags: { _id: string; url: string }[];
}

export interface NfcBatchNamesResponse {
  batchNames: string[];
}

export interface NfcMetadataBackfillTotals {
  parsedRows: number;
  validRows: number;
  matched: number;
  wouldUpdate: number;
  updated: number;
  skippedExisting: number;
  notFound: number;
  invalid: number;
  duplicates: number;
}

export interface NfcMetadataBackfillFileSummary {
  fileName: string;
  inferredTagType: string | null;
  derivedBatchName: string;
  totals: NfcMetadataBackfillTotals;
  unmatchedObjectIds: string[];
  errors: string[];
}

export interface NfcMetadataBackfillResponse {
  runId: string;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  totals: NfcMetadataBackfillTotals;
  files: NfcMetadataBackfillFileSummary[];
  unmatchedObjectIds: string[];
  errors: string[];
}

export interface UpdateNfcParams {
  purpose?: string;
  tagType?: string;
  websiteOverrideRedirect?: string;
  qrcodeRedirect?: string;
  company?: string;
  project?: string;
}

export interface BulkAssignNfcParams {
  nfcIds: string[];
  purpose: string;
  qrcodeRedirect?: string;
  websiteOverrideRedirect?: string;
  company?: string;
  project?: string;
}

// Query Keys

export const NfcKeys = {
  all: ["Nfc"] as const,
  list: (params: Record<string, string | number | boolean | undefined>) =>
    ["Nfc", "list", ...Object.values(params)] as const,
  single: (id: string) => ["Nfc", "single", id] as const,
  stats: () => ["Nfc", "stats"] as const,
  batchNames: () => ["Nfc", "batchNames"] as const,
  resolve: (id: string) => ["Nfc", "resolve", id] as const,
};

function normalizeSingleEnumFilter(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

function normalizeSingleValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toNfcListRequestParams(
  params?: NfcListParams,
): Record<string, string | number | boolean | undefined> | undefined {
  if (!params) return undefined;

  const { page, limit, purpose, tagType, batchName, ...rest } = params;

  return {
    ...rest,
    current_page: page,
    per_page: limit,
    purpose: normalizeSingleEnumFilter(purpose),
    tagType: normalizeSingleEnumFilter(tagType),
    batchName: normalizeSingleValue(batchName),
  };
}

function normalizeNfcListResponse(data: NfcListResponseData): NfcListResponse {
  const tags = Array.isArray(data?.tags)
    ? data.tags
    : Array.isArray(data?.items)
      ? data.items
      : [];

  const total = typeof data?.total === "number" ? data.total : tags.length;
  const page =
    typeof data?.page === "number"
      ? data.page
      : typeof data?.current_page === "number"
        ? data.current_page
        : 1;
  const limit =
    typeof data?.limit === "number"
      ? data.limit
      : typeof data?.per_page === "number"
        ? data.per_page
        : 20;

  return {
    tags,
    total,
    page,
    limit,
  };
}

// Public API Functions

/**
 * Resolve an NFC tag (public, no auth required).
 * Uses the standard axios instance which includes the API key header
 * required by AppGuard, but does not require a Bearer token.
 */
export const resolveNfc = async (
  nfcId: string,
): Promise<NfcResolveResponse> => {
  try {
    const res = await axiosInstance.get(`/nfc/resolve/${nfcId}`);
    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "nfc-resolve-failed",
      metadata: { nfcId },
    });
    throw error;
  }
};

// Admin API Functions

/**
 * List NFC tags (paginated, filterable)
 */
export const getNfcList = async (
  params?: NfcListParams,
): Promise<NfcListResponse> => {
  try {
    const res = await axiosInstance.get("/admin/nfc", {
      params: toNfcListRequestParams(params),
    });
    return normalizeNfcListResponse(res.data?.data ?? res.data);
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-list-failed",
      metadata: { params },
    });
    throw error;
  }
};

/**
 * Get NFC dashboard statistics
 */
export const getNfcStats = async (): Promise<NfcStats> => {
  try {
    const res = await axiosInstance.get("/admin/nfc/stats");
    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-stats-failed",
    });
    throw error;
  }
};

/**
 * Get a single NFC tag by ID
 */
export const getNfcTag = async (nfcId: string): Promise<NfcTag> => {
  try {
    const res = await axiosInstance.get(`/admin/nfc/${nfcId}`);
    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-get-failed",
      metadata: { nfcId },
    });
    throw error;
  }
};

/**
 * Create a batch of NFC tags
 */
export const createNfcBatch = async (
  data: CreateNfcBatchParams,
): Promise<CreateNfcBatchResponse> => {
  try {
    const res = await axiosInstance.post("/admin/nfc/batch", data);
    const payload = res.data?.data ?? res.data;
    return payload?.data ?? payload;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-create-batch-failed",
      metadata: { data },
    });
    throw error;
  }
};

/**
 * Download a batch CSV file
 */
export const downloadNfcBatchCsv = async (batchId: string): Promise<Blob> => {
  try {
    const res = await axiosInstance.get(`/admin/nfc/batch/${batchId}/csv`, {
      responseType: "blob",
    });
    return res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-download-csv-failed",
      metadata: { batchId },
    });
    throw error;
  }
};

/**
 * Get distinct NFC batch names for filter dropdown.
 */
export const getNfcBatchNames = async (): Promise<NfcBatchNamesResponse> => {
  try {
    const res = await axiosInstance.get("/admin/nfc/batch-names");
    const payload = res.data?.data ?? res.data;
    const raw = payload?.batchNames ?? payload;
    return {
      batchNames: Array.isArray(raw) ? raw : [],
    };
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-batch-names-failed",
    });
    throw error;
  }
};

/**
 * Preview/apply NFC metadata backfill from uploaded CSV files.
 */
export const backfillNfcMetadata = async (
  files: File[],
  dryRun: boolean,
): Promise<NfcMetadataBackfillResponse> => {
  try {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const res = await axiosInstance.post(
      `/admin/nfc/metadata-backfill?dryRun=${dryRun ? "true" : "false"}`,
      formData,
      {
        // Keep boundary generation with the browser FormData encoder.
        headers: { "Content-Type": undefined },
      },
    );

    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-metadata-backfill-failed",
      metadata: { dryRun, fileCount: files.length },
    });
    throw error;
  }
};

/**
 * Update a single NFC tag
 */
export const updateNfc = async (
  nfcId: string,
  data: UpdateNfcParams,
): Promise<NfcTag> => {
  try {
    const res = await axiosInstance.patch(`/admin/nfc/${nfcId}`, data);
    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-update-failed",
      metadata: { nfcId, data },
    });
    throw error;
  }
};

/**
 * Delete a single NFC tag
 */
export const deleteNfc = async (nfcId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`/admin/nfc/${nfcId}`);
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-delete-failed",
      metadata: { nfcId },
    });
    throw error;
  }
};

/**
 * Bulk assign NFC tags
 */
export const bulkAssignNfc = async (
  data: BulkAssignNfcParams,
): Promise<{ modifiedCount: number }> => {
  try {
    const res = await axiosInstance.patch("/admin/nfc/bulk-assign", data);
    return res.data?.data ?? res.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "admin-nfc-bulk-assign-failed",
      metadata: { nfcIds: data.nfcIds, purpose: data.purpose },
    });
    throw error;
  }
};

// React Query Hooks

/**
 * Hook to resolve an NFC tag (public)
 */
export const useResolveNfc = (nfcId: string | undefined) => {
  return useQuery({
    queryKey: NfcKeys.resolve(nfcId || ""),
    queryFn: () => resolveNfc(nfcId!),
    enabled: Boolean(nfcId),
  });
};

/**
 * Hook to list NFC tags (admin)
 */
export const useNfcList = (params?: NfcListParams) => {
  return useQuery({
    queryKey: NfcKeys.list(params ?? {}),
    queryFn: () => getNfcList(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to get NFC dashboard statistics (admin)
 */
export const useNfcStats = () => {
  return useQuery({
    queryKey: NfcKeys.stats(),
    queryFn: () => getNfcStats(),
  });
};

/**
 * Hook to get distinct NFC batch names (admin).
 */
export const useNfcBatchNames = () => {
  return useQuery({
    queryKey: NfcKeys.batchNames(),
    queryFn: () => getNfcBatchNames(),
  });
};

/**
 * Hook to get a single NFC tag (admin)
 */
export const useNfcTag = (nfcId: string | undefined) => {
  return useQuery({
    queryKey: NfcKeys.single(nfcId || ""),
    queryFn: () => getNfcTag(nfcId!),
    enabled: Boolean(nfcId),
  });
};
