import { useState, useEffect, useCallback } from "react";
import { axiosInstance } from "@/api";
import { fetchSignedUrl } from "@/api/endpoints/qr-codes";
import { logQRError } from "@/utils/rollbar";
import toast from "react-hot-toast";

export type PrintItem = {
  name: string;
  imgSrc: string;
  fallbackSrc?: string;
  qrCodeId: string;
};

/**
 * Manages fetching all QR codes for printing in the group detail page.
 *
 * When `showPrintModal` is true, fetches all QR codes for the group
 * (up to 1000) and maps them into `PrintItem[]` for the PrintItemsModal.
 */
export function useGroupPrint({
  showPrintModal,
  groupType,
  projectId,
  groupId,
  companyId,
  sortBy,
  sortDir,
  fallbackPrintItems,
}: {
  showPrintModal: boolean;
  groupType?: string;
  projectId?: string;
  groupId: string;
  companyId: string;
  sortBy: string;
  sortDir: string;
  fallbackPrintItems: Array<{
    name: string;
    imgSrc: string;
    fallbackSrc?: string;
    qrCodeId?: string;
  }>;
}) {
  const [allPrintItems, setAllPrintItems] = useState<PrintItem[]>([]);
  const [isFetchingPrintItems, setIsFetchingPrintItems] = useState(false);

  // Fetch all QR codes when main print modal opens
  useEffect(() => {
    if (!showPrintModal) {
      setAllPrintItems([]);
      return;
    }

    const fetchAllForPrint = async () => {
      const typeLower = String(groupType || "").toLowerCase();
      const groupingType =
        typeLower === "arrangement" || typeLower === "equipment"
          ? typeLower
          : undefined;
      const params: Record<string, unknown> = {
        projectId: projectId,
        groupingId: groupId,
        per_page: 1000, // Fetch all for printing
        companyId: String(companyId || ""),
        sortBy: sortBy,
        sortDir: sortDir,
      };
      if (groupingType) params.groupingType = groupingType;

      setIsFetchingPrintItems(true);
      try {
        const response = await axiosInstance.get("/qr-code", { params });
        const qrCodes = response.data?.data ?? [];
        const items = qrCodes.map(
          (qr: {
            _id: string;
            qrcodeName?: string;
            qrImageUrl?: string;
            qrimage?: string;
          }) => ({
            name: String(qr.qrcodeName || "QR Code"),
            imgSrc: qr.qrImageUrl
              ? String(qr.qrImageUrl)
              : qr.qrimage
                ? `data:image/svg+xml;base64,${btoa(String(qr.qrimage))}`
                : "",
            fallbackSrc: qr.qrimage
              ? `data:image/svg+xml;base64,${btoa(String(qr.qrimage))}`
              : undefined,
            qrCodeId: String(qr._id),
          }),
        );
        setAllPrintItems(items);
      } catch (error) {
        logQRError(error, "fetch-all-qr-codes-for-print", undefined, {
          groupId,
          projectId,
        });
        toast.error("Failed to load all QR codes for printing");
        // Fall back to current page items (filter out any with undefined qrCodeId)
        setAllPrintItems(
          fallbackPrintItems
            .filter((item) => item.qrCodeId)
            .map((item) => ({ ...item, qrCodeId: item.qrCodeId! })),
        );
      } finally {
        setIsFetchingPrintItems(false);
      }
    };

    fetchAllForPrint();
  }, [
    showPrintModal,
    groupType,
    projectId,
    groupId,
    companyId,
    sortBy,
    sortDir,
    fallbackPrintItems,
  ]);

  // Stable callback for refetching signed URLs (prevents infinite loop in PrintItemsModal)
  const handleRefetchUrl = useCallback(async (qrCodeId: string) => {
    return await fetchSignedUrl(qrCodeId);
  }, []);

  return { allPrintItems, isFetchingPrintItems, handleRefetchUrl };
}
