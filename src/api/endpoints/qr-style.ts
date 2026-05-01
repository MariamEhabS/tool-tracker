import { axiosInstance } from "../index";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrKeys } from "./qr-codes";

// Types
export interface QRStylePreset {
  name: string;
  displayName: string;
  description: string;
  category: "basic" | "gradient" | "color" | "advanced";
}

export interface QRStyleConfig {
  useStyledQRCodes: boolean;
  qrStyleConfig?: {
    presetName?: string;
  };
}

export interface PreviewResponse {
  dataUri: string;
  svgString: string;
  text: string;
}

// Query keys
export const qrStyleKeys = {
  all: ["qrStyle"] as const,
  presets: () => [...qrStyleKeys.all, "presets"] as const,
  companyConfig: (companyId: string) =>
    [...qrStyleKeys.all, "config", companyId] as const,
  preview: (text: string, preset: string) =>
    [...qrStyleKeys.all, "preview", text, preset] as const,
};

// Get all available presets
export const useQRStylePresets = () => {
  return useQuery({
    queryKey: qrStyleKeys.presets(),
    queryFn: async () => {
      const res = await axiosInstance.get("/qr-code/admin/presets");
      const data = res.data?.data ?? res.data;
      return data as {
        presets: string[];
        presetsByCategory: Record<string, QRStylePreset[]>;
      };
    },
    staleTime: 10 * 60 * 1000, // Presets don't change often
  });
};

// Get company QR style config
export const useCompanyQRStyleConfig = (companyId: string) => {
  return useQuery({
    queryKey: qrStyleKeys.companyConfig(companyId),
    queryFn: async () => {
      const res = await axiosInstance.get(`/company/${companyId}/qr-style`);
      const data = res.data?.data ?? res.data;
      return data as QRStyleConfig;
    },
    enabled: Boolean(companyId),
  });
};

// Update company QR style config
export const useUpdateQRStyleConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      useStyledQRCodes,
      presetName,
      customStyle,
    }: {
      companyId: string;
      useStyledQRCodes: boolean;
      presetName?: string;
      customStyle?: Record<string, unknown>;
    }) => {
      const res = await axiosInstance.patch(`/company/${companyId}/qr-style`, {
        companyId,
        useStyledQRCodes,
        presetName,
        customStyle,
      });
      const data = res.data?.data ?? res.data;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate company config query
      queryClient.invalidateQueries({
        queryKey: qrStyleKeys.companyConfig(variables.companyId),
      });
      // Also invalidate company query to refresh the company data
      queryClient.invalidateQueries({
        queryKey: ["company", variables.companyId],
      });
    },
  });
};

// Preview QR style
export const previewQRStyle = async (
  text: string,
  presetNameOrStyle: string | Record<string, unknown>,
): Promise<PreviewResponse> => {
  const payload =
    typeof presetNameOrStyle === "string"
      ? { text, presetName: presetNameOrStyle }
      : { text, customStyle: presetNameOrStyle };

  const res = await axiosInstance.post("/qr-code/admin/preview", payload);
  const data = res.data?.data ?? res.data;
  return data as PreviewResponse;
};

// Batch regenerate QR codes
export interface BatchRegenerateResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

// Async batch regenerate result (for job-based processing)
export interface BatchRegenerateAsyncResult {
  jobId: string;
  message: string;
  total: number;
}

export const useBatchRegenerateQRCodes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      qrcodeIds,
      applyToAll,
      enableLogo,
    }: {
      companyId: string;
      qrcodeIds?: string[];
      applyToAll?: boolean;
      enableLogo?: boolean;
    }) => {
      const res = await axiosInstance.post("/qr-code/admin/batch-regenerate", {
        companyId,
        qrcodeIds,
        applyToAll,
        enableLogo,
      });
      const data = res.data?.data ?? res.data;
      return data as BatchRegenerateResult;
    },
    onSuccess: () => {
      // Invalidate all QR code queries
      queryClient.invalidateQueries({
        queryKey: QrKeys.all,
      });
    },
  });
};

// Get count of QR codes that would be regenerated
export const useGetRegenerateCount = (companyId: string, enabled = true) => {
  return useQuery({
    queryKey: ["qr-regenerate-count", companyId],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/qr-code/admin/regenerate-count/${companyId}`,
      );
      const data = res.data?.data ?? res.data;
      return data.count as number;
    },
    enabled: !!companyId && enabled,
    staleTime: 30000, // 30 seconds
  });
};

// Async batch regenerate QR codes (job-based processing)
export const useBatchRegenerateQRCodesAsync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      qrcodeIds,
      applyToAll,
      enableLogo,
    }: {
      companyId: string;
      qrcodeIds?: string[];
      applyToAll?: boolean;
      enableLogo?: boolean;
    }): Promise<BatchRegenerateAsyncResult> => {
      const res = await axiosInstance.post(
        "/qr-code/admin/batch-regenerate-async",
        { companyId, qrcodeIds, applyToAll, enableLogo },
      );
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      // Invalidate QR code queries after job starts (they'll refresh when job completes)
      queryClient.invalidateQueries({
        queryKey: QrKeys.all,
      });
    },
  });
};

// ===== QR Style Logo Functions =====
// These are SEPARATE from Company Logo functions.
// QR Style Logo: Embedded in QR codes (stored in qrStyleConfig.logo)
// Company Logo: App branding for prints, headers (stored in company.companyLogo)

export interface QRStyleLogoResponse {
  logoUrl: string;
  awsKey: string;
  awsId: string;
}

/**
 * Upload a logo specifically for QR code embedding.
 * Stores in qrStyleConfig.logo, NOT in company.companyLogo.
 */
export const uploadQRStyleLogo = async (
  companyId: string,
  file: File,
): Promise<QRStyleLogoResponse> => {
  const formData = new FormData();
  formData.append("logo", file);

  const response = await axiosInstance.post(
    `/company/${companyId}/qr-style/logo`,
    formData,
    {
      headers: {
        "Content-Type": undefined, // Let browser set multipart boundary
      },
    },
  );

  const data = response.data?.data ?? response.data;
  return data as QRStyleLogoResponse;
};

/**
 * Get the QR style logo URL (regenerates presigned URL if needed).
 */
export const getQRStyleLogo = async (
  companyId: string,
): Promise<{
  logoUrl: string | null;
  awsKey: string | null;
  awsId: string | null;
}> => {
  const response = await axiosInstance.get(
    `/company/${companyId}/qr-style/logo`,
  );
  const data = response.data?.data ?? response.data;
  return data;
};

/**
 * Delete the QR style logo.
 */
export const deleteQRStyleLogo = async (
  companyId: string,
): Promise<{ success: boolean }> => {
  const response = await axiosInstance.delete(
    `/company/${companyId}/qr-style/logo`,
  );
  const data = response.data?.data ?? response.data;
  return data;
};
