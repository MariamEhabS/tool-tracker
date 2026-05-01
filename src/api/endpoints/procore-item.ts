import { axiosInstance } from "../index";

export const createProcoreItem = async (payload: {
  companyId: string;
  projectId: string;
  qrcodeId: string;
  procoreToolName: string;
  procoreItemID: string;
}) => {
  const { data } = await axiosInstance.post(`/procore-item`, payload, {
    headers: { "x-skip-401-reload": "true" },
  });
  return data;
};

export type BulkProcoreItemEntry = {
  qrcodeId: string;
  procoreToolName: string;
  procoreItemID: string;
};

export type CreateManyProcoreItemsPayload = {
  companyId: string;
  projectId: string;
  items: BulkProcoreItemEntry[];
};

export const createProcoreItemsBulk = async (
  payload: CreateManyProcoreItemsPayload,
) => {
  const { data } = await axiosInstance.post(`/procore-item/bulk`, payload);
  return data;
};

export type ToggleVisibilitySingleProcoreItemDto = {
  companyId: string;
  projectId: string;
  procoreItemID: string;
  qrcodeId: string;
  hidden?: boolean;
  procoreToolName?: string;
};

export type SingleProcoreItemResponseDto = {
  success_message: string;
  data: Record<string, unknown>;
};

export const toggleVisibilitySingleProcoreItem = async (
  formData: ToggleVisibilitySingleProcoreItemDto,
): Promise<SingleProcoreItemResponseDto> => {
  const response = await axiosInstance.patch(
    `/procore-item/toggle-visibility/single`,
    formData,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

export type DeleteSingleProcoreItemDto = {
  companyId: string;
  projectId: string;
  procoreItemID: string;
  qrcodeId: string;
};

/**
 * Permanently remove a single procore item from a QR code
 * (unlike toggle-visibility which just hides it)
 */
export const deleteSingleProcoreItem = async (
  formData: DeleteSingleProcoreItemDto,
): Promise<SingleProcoreItemResponseDto> => {
  const response = await axiosInstance.delete(`/procore-item/delete/single`, {
    data: formData,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

// --- Bulk delete types and function ---

/**
 * Frontend DTO for bulk procore item deletion.
 * `procoreItemIdsDB` is required by the frontend for safety, even though
 * the backend accepts filter-only deletes. This prevents accidental
 * wide-scope deletions from the UI.
 *
 * @see backend DTO: modules/procore-item/dto/delete-procore-items-dto.ts
 */
export type DeleteManyProcoreItemsDto = {
  companyId: string;
  /** IMPORTANT: Field name must be `procoreItemIdsDB` — matches backend DTO exactly */
  procoreItemIdsDB: string[];
  qrcodeId?: string;
  groupingId?: string;
  groupingType?:
    | "group"
    | "arrangement"
    | "equipment"
    | "procore-drawing-codes";
  projectId?: string;
  dryRun?: boolean;
};

export type MultipleProcoreItemResponseDto = {
  success_message: string;
  total_items: number;
  data: Record<string, unknown>[];
};

/**
 * Delete multiple procore items in bulk.
 * Uses DELETE /procore-item/bulk endpoint.
 *
 * NOTE: This function is not currently called by any frontend component.
 * It is retained for future use when bulk delete by MongoDB _id is needed.
 * The backend also supports filter-only deletes (by qrcodeId, groupingId+groupingType,
 * or projectId alone) but the frontend intentionally requires explicit IDs for safety.
 *
 * IMPORTANT: The IDs field is `procoreItemIdsDB` (MongoDB _id values),
 * NOT `procoreItemIds` or `procoreItemID`. This matches the backend
 * DeleteManyProcoreItemsDto exactly.
 *
 * @see backend DTO: modules/procore-item/dto/delete-procore-items-dto.ts
 */
export const deleteManyProcoreItems = async (
  formData: DeleteManyProcoreItemsDto,
): Promise<MultipleProcoreItemResponseDto> => {
  if (!formData.procoreItemIdsDB || formData.procoreItemIdsDB.length === 0) {
    return {
      success_message: "No procore items to delete",
      total_items: 0,
      data: [],
    };
  }

  const BATCH_SIZE = 500;

  if (formData.procoreItemIdsDB.length <= BATCH_SIZE) {
    const response = await axiosInstance.delete("/procore-item/bulk", {
      data: formData,
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  }

  // Batch into chunks of 500 and call sequentially
  const allIds = formData.procoreItemIdsDB;
  const aggregated: MultipleProcoreItemResponseDto = {
    success_message: "",
    total_items: 0,
    data: [],
  };

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);
    const response = await axiosInstance.delete("/procore-item/bulk", {
      data: { ...formData, procoreItemIdsDB: batch },
      headers: { "Content-Type": "application/json" },
    });
    const result: MultipleProcoreItemResponseDto = response.data;
    aggregated.total_items += result.total_items;
    aggregated.data = aggregated.data.concat(result.data);
    aggregated.success_message = result.success_message;
  }

  return aggregated;
};

// --- Bulk toggle-visibility types and function ---

export type ToggleVisibilityBulkProcoreItemDto = {
  companyId: string;
  projectId: string;
  procoreItemIDs: string[];
  qrcodeId: string;
  hidden: boolean;
};

/**
 * Toggle visibility for multiple procore items in bulk.
 * Uses PATCH /procore-item/toggle-visibility/bulk endpoint.
 *
 * IMPORTANT: `procoreItemIDs` are Procore-format ID strings (e.g., "123456"),
 * NOT MongoDB _id values.
 */
export const toggleVisibilityBulkProcoreItems = async (
  formData: ToggleVisibilityBulkProcoreItemDto,
): Promise<MultipleProcoreItemResponseDto> => {
  const response = await axiosInstance.patch(
    "/procore-item/toggle-visibility/bulk",
    formData,
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return response.data;
};
