import { axiosInstance } from "../index";
import { useQuery } from "@tanstack/react-query";
import { QRCodeAggregate } from "../../types";

export const QrKeys = {
  all: ["Qrs"] as const,
  detail: (id: string) => [...QrKeys.all, id] as const,
  listItems: (id: string) => [...QrKeys.all, id] as const,
};

export const useQrCompanyProjectAggregation = (
  qrCodeId: string | undefined,
) => {
  return useQuery({
    queryKey: QrKeys.detail(qrCodeId || ""),
    queryFn: async () => {
      const { data } = await axiosInstance.get<QRCodeAggregate[]>(
        `/aggregation/qr-company-project/${qrCodeId}`,
      );
      return data[0];
    },
    enabled: Boolean(qrCodeId),
    refetchOnMount: "always",
  });
};
export const useAllQrCodeItems = (qrCodeId: string) => {
  return useQuery({
    queryKey: QrKeys.listItems(qrCodeId),
    queryFn: async () => {
      const { data } = await axiosInstance.get<QRCodeAggregate[]>(
        `/aggregation/qr-folder/${qrCodeId}`,
      );
      return data[0];
    },
    enabled: Boolean(qrCodeId),
    refetchOnMount: "always",
  });
};

export type ProjectQRCodesParams = {
  companyId?: string;
  projectId: string;
  current_page?: number;
  per_page?: number;
  search?: string;
  groupingType?: string;
  // Optional: array of grouping types for multi-select filtering (e.g., ['arrangement', 'none', 'procore-drawings'])
  groupingTypes?: string[];
  // Optional: further narrow arrangements by specific arrangementType (e.g., 'Procore Drawings Codes')
  arrangementType?: string;
  types?: string[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export const useProjectQRCodes = (params: ProjectQRCodesParams) => {
  return useQuery({
    queryKey: [
      "Aggregation",
      "project-qrcodes",
      params.companyId,
      params.projectId,
      params.current_page,
      params.per_page,
      params.search,
      params.groupingType,
      (params.groupingTypes ?? []).join(","),
      params.arrangementType,
      params.types,
      params.sortBy,
      params.sortDir,
    ],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/aggregation/project-qrcodes`, {
        params,
      });
      return data as {
        success_message: string;
        current_page: number;
        per_page: number;
        total_items: number;
        data: Array<{
          _id: string;
          qrcodeName?: string;
          type?: string;
          resolvedType?: string;
          groupingType?: string;
          arrangement?: string;
          equipment?: string;
          groupLabel?: string;
          groupType?: string;
          groupArrangementType?: string;
          project?: string;
          createdAt?: string;
          mobileScanCount?: number;
          qrImageUrl?: string;
          qrimage?: string;
        }>;
      };
    },
    enabled: Boolean(params.projectId),
    refetchOnWindowFocus: false,
  });
};
