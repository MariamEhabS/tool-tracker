/**
 * @fileoverview Hook for fetching company storage usage history over a
 * configurable time window. Transforms the backend response into a
 * simplified time-series format suitable for charting.
 */

import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api";

export interface StorageHistoryPoint {
  date: string; // YYYY-MM-DD
  totalUsed: number; // bytes
  documentUsed: number; // bytes
  qrUsed: number; // bytes
}

// Backend response types
interface BackendStorageHistoryItem {
  date: string;
  totalUsed: number;
  breakdown: {
    documents: number;
    images: number;
    videos: number;
    other: number;
  };
  fileCount: number;
  qrCodeStorageUsed: number;
  isInterpolated?: boolean;
}

interface BackendStorageHistoryResponse {
  success_message: string;
  data: {
    companyId: string;
    currentUsage: {
      totalUsed: number;
      documentStorageUsed: number;
      qrCodeStorageUsed: number;
      documentStorageCapacity: number;
      qrCodeStorageCapacity: number;
    };
    history: BackendStorageHistoryItem[];
  };
}

// Query key factory for storage history
export const storageHistoryKeys = {
  all: ["storage-history"] as const,
  history: (companyId: string, days: number) =>
    [...storageHistoryKeys.all, companyId, days] as const,
};

/**
 * Transforms backend storage history response to frontend StorageHistoryPoint format
 */
function transformStorageHistory(
  history: BackendStorageHistoryItem[],
): StorageHistoryPoint[] {
  return history.map((item) => ({
    date: item.date,
    totalUsed: item.totalUsed + item.qrCodeStorageUsed,
    documentUsed: item.totalUsed,
    qrUsed: item.qrCodeStorageUsed,
  }));
}

/**
 * Fetches the company's storage usage history for the specified number of
 * days. Transforms the backend response into an array of
 * {@link StorageHistoryPoint} objects with combined total, document, and
 * QR code storage values suitable for chart rendering.
 *
 * Uses a 5-minute stale time and disables refetch-on-window-focus since
 * storage data does not change rapidly.
 *
 * @param companyId - The company ID to fetch storage history for
 * @param days - Number of days of history to retrieve (defaults to 30)
 * @returns A TanStack Query result containing an array of {@link StorageHistoryPoint}
 */
export function useStorageHistory(companyId: string, days = 30) {
  return useQuery({
    queryKey: storageHistoryKeys.history(companyId, days),
    queryFn: async (): Promise<StorageHistoryPoint[]> => {
      const { data } = await axiosInstance.get<BackendStorageHistoryResponse>(
        `/company/${companyId}/storage-history`,
        { params: { days } },
      );
      return transformStorageHistory(data.data.history);
    },
    enabled: Boolean(companyId),
    staleTime: 5 * 60 * 1000, // 5 minutes - data doesn't change rapidly
    refetchOnWindowFocus: false,
  });
}
