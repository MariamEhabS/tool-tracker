/**
 * @deprecated This endpoint module was deprecated on 2026-01-19.
 * Reason: Consolidated into the Groups module.
 * Note: Backend modules remain active for legacy data model references only.
 * Do not use in new frontend code.
 */

import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "..";
import { Arrangement } from "../../types";
import { logger } from "@/utils/logger";

export interface ArrangementListParams {
  companyId?: string;
  projectId?: string;
  groupingId?: string;
  groupingType?: string;
  filter_ids?: string[];
  current_page?: number;
  per_page?: number;
  search?: string;
  // Server-side extensions
  sortBy?: string;
  sortDir?: "asc" | "desc";
  arrangementType?: string; // e.g., 'Procore Drawings Codes'
  projectStatus?: string[]; // e.g., ['active','completed']
}
export interface MultipleArrangementsDto {
  success_message: string;
  total_items: number;
  data: Arrangement[];
}

interface DeleteManyArrangementsDto {
  companyId: string;
  arrangementIds?: string[];
  groupingId?: string;
  groupingType?: string;
  projectId?: string;
}
export const ArrangementKeys = {
  all: ["Arrangements"] as const,
  list: (filters: Record<string, unknown>) =>
    [...ArrangementKeys.all, "list", filters] as const,
  detail: (id: string) => [...ArrangementKeys.all, "detail", id] as const,
  qrs: (id: string) => [...ArrangementKeys.all, "qrs", id] as const,
};

export const useListArrangements = (params: ArrangementListParams) => {
  return useQuery({
    queryKey: ArrangementKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await axiosInstance.get("/arrangement", {
        params,
      });
      return data;
    },
    enabled: !!params.companyId || !!params.projectId,
    // keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
};

export const useSingleArrangement = (groupingId: string) => {
  return useQuery({
    queryKey: ArrangementKeys.detail(groupingId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/arrangement/${groupingId}`);
      return data;
    },

    refetchOnWindowFocus: true,
  });
};

export const getSingleArrangement = async (groupingId: string) => {
  const { data } = await axiosInstance.get(`/arrangement/${groupingId}`);
  return data;
};

export const useSingleArrangementQrs = (groupingId: string) => {
  return useQuery({
    queryKey: ArrangementKeys.qrs(groupingId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/aggregation/arrangement-qr/${groupingId}`,
      );
      return data;
    },

    refetchOnWindowFocus: true,
  });
};

export const deleteSingleArrangement = async (
  companyId: string,
  arrangementId: string,
): Promise<MultipleArrangementsDto | undefined> => {
  try {
    const formData = {
      companyId,
    };

    const response = await axiosInstance.delete(
      `/arrangement/${arrangementId}`,
      {
        data: formData,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    logger.error(`Error deleting arrangement with ID ${arrangementId}:`, error);
    throw error;
  }
};

export const deleteManyArrangements = async (
  companyId: string,
  arrangementIds: Set<string> | string[],
  groupingId?: string,
  groupingType?: string,
  projectId?: string,
): Promise<MultipleArrangementsDto> => {
  try {
    const arrangementsArray = Array.from(arrangementIds);

    const formData: DeleteManyArrangementsDto = {
      companyId,
      arrangementIds: arrangementsArray,
    };

    if (groupingId) formData.groupingId = groupingId;
    if (groupingType) formData.groupingType = groupingType;
    if (projectId) formData.projectId = projectId;

    const response = await axiosInstance.delete("/arrangement/bulk", {
      data: formData,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    logger.error("Error deleting arrangements:", error);
    throw error;
  }
};

export const patchArrangement = async (
  arrangementId: string,
  data: {
    arrangementName: string;
    description?: string;
    projectId: string;
  },
) => {
  const response = await axiosInstance.patch(
    `/arrangement/${arrangementId}`,
    data,
  );
  return response.data;
};
