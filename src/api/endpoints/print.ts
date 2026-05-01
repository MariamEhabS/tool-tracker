import { axiosInstance } from "../index";
import { logger } from "@/utils/logger";
import { logApiError } from "@/utils/rollbar";

export async function postPrintLetter(params: {
  groupId: string;
  perPage: number;
  headerProjectName?: boolean;
  headerGroupName?: boolean;
  footerMode?: "logo" | "address";
  qrCodeIds?: string[];
}): Promise<Blob> {
  const {
    groupId,
    perPage,
    headerProjectName,
    headerGroupName,
    footerMode,
    qrCodeIds,
  } = params;
  try {
    const { data } = await axiosInstance.post(
      `/print/group/${groupId}/letter`,
      {
        perPage,
        headerProjectName,
        headerGroupName,
        footerMode,
        qrCodeIds,
      },
      { responseType: "blob" },
    );
    return data as Blob;
  } catch (error) {
    logApiError(error, "print-letter-generation-failed", {
      groupId,
      perPage,
      qrCodeCount: qrCodeIds?.length,
    });
    throw error;
  }
}

export async function postPrintAvery(params: {
  groupId: string;
  qrCodeIds?: string[];
}): Promise<Blob> {
  const { groupId, qrCodeIds } = params;
  try {
    const { data } = await axiosInstance.post(
      `/print/group/${groupId}/labels/avery`,
      { qrCodeIds },
      { responseType: "blob" },
    );
    return data as Blob;
  } catch (error) {
    logApiError(error, "print-avery-generation-failed", {
      groupId,
      qrCodeCount: qrCodeIds?.length,
    });
    throw error;
  }
}

export async function postPrintZebra(params: {
  groupId: string;
  qrCodeIds?: string[];
}): Promise<Blob> {
  const { groupId, qrCodeIds } = params;
  try {
    const { data } = await axiosInstance.post(
      `/print/group/${groupId}/labels/zebra`,
      { qrCodeIds },
      { responseType: "blob" },
    );
    return data as Blob;
  } catch (error) {
    logApiError(error, "print-zebra-generation-failed", {
      groupId,
      qrCodeCount: qrCodeIds?.length,
    });
    throw error;
  }
}

export function openBlobPdf(blob: Blob, filename: string = "print.pdf") {
  try {
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      // fallback: force a download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    logApiError(e, "open-blob-pdf-failed");
    logger.error("Failed to open PDF blob", e);
  }
}
