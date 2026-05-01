/**
 * @deprecated This endpoint module was deprecated on 2026-01-19.
 * Reason: Consolidated into the Groups module.
 * Note: Backend modules remain active for legacy data model references only.
 * Do not use in new frontend code.
 */

import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "..";
import {
  Equipment,
  PatchEquipmentDto,
  SingleEquipmentResponseDto,
} from "../../types";
import axios from "axios";
import { logger } from "@/utils/logger";

export interface CreateEquipmentPayload {
  companyId: string;
  projectId: string;
  equipmentName: string;
  equipmentID: string;
  equipmentSpecification?: string;
  description?: string;
}

export interface EquipmentListParams {
  companyId?: string;
  projectId?: string;
  groupingId?: string;
  groupingType?: string;
  filter_ids?: string[];
  current_page?: number;
  per_page?: number;
  search?: string;
  // Server-side filters/extensions
  projectStatus?: string[];
}

interface DeleteManyEquipmentsDto {
  companyId: string;
  equpmentIds?: string[];
  groupingId?: string;
  groupingType?: string;
  projectId?: string;
}

interface MultipleEquipmentsResponseDto {
  success_message: string;
  total_items: number;
  data: Equipment[];
}
export const EquipmentKeys = {
  all: ["Equipment"] as const,
  list: (filters: Record<string, unknown>) =>
    [...EquipmentKeys.all, "list", filters] as const,
  detail: (id: string) => [...EquipmentKeys.all, "detail", id] as const,
  qrs: (id: string) => [...EquipmentKeys.all, "qrs", id] as const,
};

export const useListEquipment = (params: EquipmentListParams) => {
  return useQuery({
    queryKey: EquipmentKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await axiosInstance.get("/equipment", {
        params,
      });
      return data;
    },
    enabled: !!params.companyId || !!params.projectId,
    // keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
};

export const useSingleEquipment = (groupingId: string) => {
  return useQuery({
    queryKey: EquipmentKeys.detail(groupingId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/equipment/${groupingId}`);
      return data;
    },
    // enabled: !!params.companyId || !!params.projectId,
    // keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
};

export const getSingleEquipment = async (groupingId: string) => {
  const { data } = await axiosInstance.get(`/equipment/${groupingId}`);
  return data;
};

export const useSingleEquipmentQrs = (groupingId: string) => {
  return useQuery({
    queryKey: EquipmentKeys.qrs(groupingId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/aggregation/equipment-qr/${groupingId}`,
      );
      return data;
    },
    // enabled: !!params.companyId || !!params.projectId,
    // keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
};

export const deleteSingleEquipment = async (
  companyId: string,
  equipmentId: string,
): Promise<SingleEquipmentResponseDto> => {
  try {
    const formData = {
      companyId,
    };

    const response = await axiosInstance.delete(`/equipment/${equipmentId}`, {
      data: formData,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    logger.error(`Error deleting equipment with ID ${equipmentId}:`, error);
    throw error;
  }
};

export const deleteManyEquipments = async (
  companyId: string,
  equpmentIds: Set<string> | string[],
  groupingId?: string,
  groupingType?: string,
  projectId?: string,
): Promise<MultipleEquipmentsResponseDto> => {
  try {
    const qrcodeIdsArray = Array.from(equpmentIds);

    const formData: DeleteManyEquipmentsDto = {
      companyId,
      equpmentIds: qrcodeIdsArray,
    };

    if (groupingId) formData.groupingId = groupingId;
    if (groupingType) formData.groupingType = groupingType;
    if (projectId) formData.projectId = projectId;

    const response = await axiosInstance.delete("/equipment/bulk", {
      data: formData,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    logger.error("Error deleting equipment:", error);
    throw error;
  }
};

export const patchEquipment = async (
  equipmentId: string,
  formData: PatchEquipmentDto,
): Promise<SingleEquipmentResponseDto> => {
  try {
    const response = await axiosInstance.patch<SingleEquipmentResponseDto>(
      `/equipment/${equipmentId}`,
      formData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(
          error.response.data.message ||
            `Failed to update equipment: ${error.response.statusText}`,
        );
      }
      throw new Error("Network error while updating equipment");
    }
    throw new Error("Unexpected error while updating equipment");
  }
};

export const createEquipment = async (
  form: CreateEquipmentPayload,
): Promise<SingleEquipmentResponseDto> => {
  const { data } = await axiosInstance.post(`/equipment`, form, {
    headers: { "Content-Type": "application/json" },
  });
  return data;
};
