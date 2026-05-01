import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import { axiosInstance } from "@/api";
import { logApiError } from "@/utils/rollbar";
import { fetchSignedUrl } from "@/api/endpoints/qr-codes";
import type { PrintItemGroup } from "@components/modal/taliho/PrintItemsModal";
import type { GroupRow, GroupedQrCodeEntry, ProjectDataType } from "../types";

interface UseProjectPrintParams {
  companyId: string;
  projectId: string;
  projectData: { data?: unknown } | undefined;
  /** Whether the group print modal is open */
  showPrintItemsGroupModal: boolean;
  /** Whether bulk actions mode is active for groups */
  bulkActionsGroup: boolean;
  /** Filtered group rows visible in the table */
  filteredGroups: GroupRow[];
  /** Currently selected group IDs */
  selectedGroup: Set<string>;
  /** The single group target row (row-level print) */
  groupTargetRow: GroupRow | undefined;
}

/**
 * Hook that manages the async fetching of QR codes for group-level printing,
 * and builds the flat or grouped print item payloads consumed by PrintItemsModal.
 */
export function useProjectPrint({
  companyId,
  projectId,
  projectData,
  showPrintItemsGroupModal,
  bulkActionsGroup,
  filteredGroups,
  selectedGroup,
  groupTargetRow,
}: UseProjectPrintParams) {
  const [groupedQrCodes, setGroupedQrCodes] = useState<GroupedQrCodeEntry[]>(
    [],
  );
  const [isFetchingQrCodes, setIsFetchingQrCodes] = useState(false);

  // Stable callback for refetching signed URLs (prevents infinite loop in PrintItemsModal)
  const handleRefetchUrl = useCallback(async (qrCodeId: string) => {
    return await fetchSignedUrl(qrCodeId);
  }, []);

  // Fetch QR codes when print modal opens - preserves group context for grouped printing
  useEffect(() => {
    if (!showPrintItemsGroupModal) {
      setGroupedQrCodes([]);
      setIsFetchingQrCodes(false);
      return;
    }

    const groupsToPrint = bulkActionsGroup
      ? filteredGroups.filter((g) => selectedGroup.has(g.id))
      : groupTargetRow
        ? [groupTargetRow]
        : [];

    if (groupsToPrint.length === 0) {
      setGroupedQrCodes([]);
      setIsFetchingQrCodes(false);
      return;
    }

    // Fetch QR codes for all selected groups, preserving group context
    const fetchQRCodes = async () => {
      setIsFetchingQrCodes(true);
      try {
        const groupedData: GroupedQrCodeEntry[] = [];

        for (const group of groupsToPrint) {
          // Get group type
          const groupType = group.groupType?.toLowerCase();
          const groupingType =
            groupType === "arrangement" || groupType === "equipment"
              ? groupType
              : undefined;

          // Fetch QR codes for this group
          const params: Record<string, unknown> = {
            groupingId: group.id,
            per_page: 1000,
            companyId,
          };
          if (groupingType) params.groupingType = groupingType;
          if (projectId) params.projectId = projectId;

          const response = await axiosInstance.get("/qr-code", { params });
          const qrCodes = response.data?.data ?? [];

          // Build address line from project data
          const project = projectData?.data as ProjectDataType | undefined;
          const addressParts = [
            project?.projectAddress,
            project?.projectCity,
            project?.projectState,
            project?.projectZIP,
          ].filter(Boolean);
          const addressLine =
            addressParts.length > 0 ? addressParts.join(", ") : undefined;

          groupedData.push({
            groupId: group.id,
            groupName: group.name,
            projectId: projectId,
            projectName: project?.projectName ?? "Unknown Project",
            clientName: project?.clientName,
            addressLine,
            items: qrCodes.map(
              (qr: {
                _id: string;
                qrcodeName?: string;
                qrImageUrl?: string;
                qrimage?: string;
              }) => ({
                id: String(qr._id),
                name: String(qr.qrcodeName || "QR Code"),
                qrImageUrl: qr.qrImageUrl,
                qrimage: qr.qrimage,
              }),
            ),
          });
        }

        setGroupedQrCodes(groupedData);
      } catch (error) {
        logApiError(error, "project-qr-print-fetch-failed", { projectId });
        if (import.meta.env.DEV) {
          console.error("Failed to fetch QR codes for printing:", error);
        }
        toast.error("Failed to load QR codes for printing");
        setGroupedQrCodes([]);
      } finally {
        setIsFetchingQrCodes(false);
      }
    };

    fetchQRCodes();
  }, [
    showPrintItemsGroupModal,
    bulkActionsGroup,
    filteredGroups,
    selectedGroup,
    groupTargetRow,
    companyId,
    projectId,
    projectData,
  ]);

  // Build print item groups for grouped printing (multiple groups with separate pages)
  const printItemGroups = useMemo((): PrintItemGroup[] | undefined => {
    // Only use grouped mode when bulk printing multiple groups
    if (!bulkActionsGroup || groupedQrCodes.length <= 1) {
      return undefined;
    }

    return groupedQrCodes.map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      projectName: group.projectName,
      clientName: group.clientName,
      addressLine: group.addressLine,
      items: group.items.map((qr) => ({
        name: qr.name,
        imgSrc: qr.qrImageUrl ? String(qr.qrImageUrl) : "",
        fallbackSrc: qr.qrimage
          ? `data:image/svg+xml;base64,${btoa(String(qr.qrimage))}`
          : undefined,
        qrCodeId: qr.id,
      })),
    }));
  }, [bulkActionsGroup, groupedQrCodes]);

  // Build flat items payload for single-group printing (backward compatibility)
  const printItems = useMemo(() => {
    // Flatten all grouped QR codes into a single array
    return groupedQrCodes.flatMap((group) =>
      group.items.map((qr) => ({
        name: qr.name,
        imgSrc: qr.qrImageUrl ? String(qr.qrImageUrl) : "",
        fallbackSrc: qr.qrimage
          ? `data:image/svg+xml;base64,${btoa(String(qr.qrimage))}`
          : undefined,
        qrCodeId: qr.id,
      })),
    );
  }, [groupedQrCodes]);

  // Total count for display
  const totalQrCodeCount = useMemo(() => {
    return groupedQrCodes.reduce((sum, g) => sum + g.items.length, 0);
  }, [groupedQrCodes]);

  return {
    groupedQrCodes,
    isFetchingQrCodes,
    handleRefetchUrl,
    printItemGroups,
    printItems,
    totalQrCodeCount,
  };
}
