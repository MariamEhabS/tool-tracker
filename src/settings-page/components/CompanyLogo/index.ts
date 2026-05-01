import { axiosInstance } from "@/api";

export { default as LogoUpload, validateLogoFile } from "./LogoUpload";
export { default as LogoCropper } from "./LogoCropper";
export { default as LogoPreview } from "./LogoPreview";

export type LogoType = "qr-code" | "print-branding";
export type AspectRatio = "1:1" | "2:1";

interface LogoResponse {
  url: string;
  logoType?: LogoType;
  aspectRatio?: AspectRatio;
}

interface AllLogosResponse {
  qrCodeLogo?: {
    logoUrl: string;
  };
  printBrandingLogo?: {
    logoUrl: string;
    aspectRatio?: AspectRatio;
  };
}

/**
 * Uploads a company logo.
 * @param companyId - The company ID
 * @param file - The logo file to upload
 * @param logoType - 'qr-code' for QR code center logo, 'print-branding' for print branding logo
 * @param aspectRatio - Required for print-branding: '1:1' or '2:1'
 * @returns The uploaded logo URL
 */
export const uploadLogo = async (
  companyId: string,
  file: File,
  logoType: LogoType = "qr-code",
  aspectRatio?: AspectRatio,
): Promise<LogoResponse> => {
  const formData = new FormData();
  formData.append("logo", file);

  const params = new URLSearchParams();
  if (aspectRatio) {
    params.append("aspectRatio", aspectRatio);
  }

  const queryString = params.toString();
  const url = `/company/${companyId}/logo/${logoType}${queryString ? `?${queryString}` : ""}`;

  console.log("[uploadLogo] Starting upload:", {
    url,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    logoType,
    aspectRatio,
  });

  // Response structure from API
  interface ApiLogoResponse {
    data?: {
      logoUrl?: string;
      url?: string;
      logoType?: LogoType;
      aspectRatio?: AspectRatio;
    };
    logoUrl?: string;
    url?: string;
    logoType?: LogoType;
    aspectRatio?: AspectRatio;
  }

  // Delete the Content-Type header so the browser can set it with the proper boundary
  // for multipart/form-data. The axios instance has a default Content-Type: application/json
  // which would interfere with FormData uploads.
  const response = await axiosInstance.post<ApiLogoResponse>(url, formData, {
    headers: {
      "Content-Type": undefined,
    },
  });

  console.log("[uploadLogo] Raw API response:", response.data);
  console.log("[uploadLogo] Response structure check:", {
    hasData: !!response.data,
    hasNestedData: !!response.data?.data,
    directLogoUrl: response.data?.logoUrl,
    nestedLogoUrl: response.data?.data?.logoUrl,
    directUrl: response.data?.url,
    nestedUrl: response.data?.data?.url,
  });

  // Handle multiple possible response structures:
  // 1. { data: { logoUrl: "..." } } - wrapped response
  // 2. { logoUrl: "..." } - direct response
  // 3. { data: { url: "..." } } - alternative wrapped
  // 4. { url: "..." } - alternative direct
  const responseData = response.data?.data || response.data;
  const extractedUrl = responseData?.logoUrl || responseData?.url;

  if (!extractedUrl || typeof extractedUrl !== "string") {
    console.error("[uploadLogo] Failed to extract URL from response:", {
      responseData,
      extractedUrl,
      fullResponse: response.data,
    });
    throw new Error("Invalid response: could not extract logo URL");
  }

  const result: LogoResponse = {
    url: extractedUrl,
    logoType: responseData?.logoType,
    aspectRatio: responseData?.aspectRatio,
  };

  console.log("[uploadLogo] Extracted result:", result);

  return result;
};

/**
 * Gets a company logo URL by type.
 * @param companyId - The company ID
 * @param logoType - 'qr-code' for QR code center logo, 'print-branding' for print branding logo
 * @returns The logo URL or null if no logo exists
 */
export const getLogo = async (
  companyId: string,
  logoType: LogoType = "qr-code",
): Promise<LogoResponse | null> => {
  // Response structure from API
  interface ApiGetLogoResponse {
    data?: {
      logoUrl?: string;
      url?: string;
      logoType?: LogoType;
      aspectRatio?: AspectRatio;
    };
    logoUrl?: string;
    url?: string;
    logoType?: LogoType;
    aspectRatio?: AspectRatio;
  }

  try {
    const response = await axiosInstance.get<ApiGetLogoResponse>(
      `/company/${companyId}/logo/${logoType}`,
    );
    // Handle multiple possible response structures
    const responseData = response.data?.data || response.data;
    const extractedUrl = responseData?.logoUrl || responseData?.url;

    if (!extractedUrl) {
      return null;
    }

    return {
      url: extractedUrl,
      logoType: responseData?.logoType,
      aspectRatio: responseData?.aspectRatio,
    };
  } catch (error) {
    // Return null if no logo exists (404)
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

/**
 * Gets all company logos (both QR code and print branding).
 * @param companyId - The company ID
 * @returns Both logos or null values if they don't exist
 */
export const getAllLogos = async (
  companyId: string,
): Promise<AllLogosResponse> => {
  const response = await axiosInstance.get<{ data: AllLogosResponse }>(
    `/company/${companyId}/logos`,
  );
  return response.data.data;
};

/**
 * Deletes a company logo by type.
 * @param companyId - The company ID
 * @param logoType - 'qr-code' for QR code center logo, 'print-branding' for print branding logo
 */
export const deleteLogo = async (
  companyId: string,
  logoType: LogoType = "qr-code",
): Promise<void> => {
  await axiosInstance.delete(`/company/${companyId}/logo/${logoType}`);
};
