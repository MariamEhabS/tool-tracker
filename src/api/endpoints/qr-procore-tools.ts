import { axiosInstance } from "../index";
import { useQuery } from "@tanstack/react-query";

export const QrProcoreToolsKeys = {
  all: ["QrProcoreTools"] as const,
  detail: (qrCodeId: string) => [...QrProcoreToolsKeys.all, qrCodeId] as const,
};

export interface QrProcoreToolsResponse {
  procoreTools: Array<{
    tool: string;
    count: number | null;
    linkedIds: string[];
  }>;
  qrType: string;
  procoreCategory: string | null;
}

export const useQrProcoreTools = (qrCodeId: string | undefined) => {
  return useQuery({
    queryKey: QrProcoreToolsKeys.detail(qrCodeId || ""),
    queryFn: async (): Promise<QrProcoreToolsResponse> => {
      const { data } = await axiosInstance.get<QrProcoreToolsResponse>(
        `/qr-code/${qrCodeId}/procore-tools`,
      );
      return data;
    },
    enabled: Boolean(qrCodeId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
