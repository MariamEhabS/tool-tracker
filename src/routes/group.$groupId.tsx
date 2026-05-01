import {
  createFileRoute,
  Link,
  useNavigate,
  ErrorComponentProps,
} from "@tanstack/react-router";
import { logApiError, logQRError, logProcoreError } from "@/utils/rollbar";
import type { QRItem } from "@/components/group/types";
import { buildGroupQRItem } from "@/components/group/row-transforms";
import { useGroupJobPolling } from "@/components/group/hooks/useGroupJobPolling";
import { useGroupPrint } from "@/components/group/hooks/useGroupPrint";
import { projectStatusBadgeVariant } from "@/utils/badge-helpers";
import FilterComboBox from "@/components/combobox/detail/FilterComboBox";
import ItemComboBox, {
  ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import ListPageLayout from "@/components/layout/ListPageLayout";
import { InlineError } from "@/components/error";
import { parseHttpError } from "@/utils/httpErrors";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import BulkDeleteModal from "@/components/modal/taliho/BulkDeleteModal";
import DeleteModal from "@/components/modal/taliho/DeleteModal";
import DownloadModal from "@/components/modal/taliho/DownloadModal";
import EditModal from "@/components/modal/taliho/EditModal";
import PrintItemsModal from "@/components/modal/taliho/PrintItemsModal";
import SetPasswordModal from "@/components/modal/taliho/SetPasswordModal";
import {
  patchGroup,
  deleteGroupAsync,
  groupsKeys,
} from "@/api/endpoints/groups";
import { addJob } from "@/utils/localStorage-jobs";
import toast from "react-hot-toast";
import UploadModal from "@/components/modal/taliho/UploadModal";
import BulkActionsBar from "@/components/table/BulkActionsBar";
import DataGrid from "@/components/table/DataGrid";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { buildCreateQRHref } from "@/lib/urlState";
// import { Button } from "@headlessui/react";
import { useMemo, useState, useEffect } from "react";
import { useSingleGroup } from "@/api/endpoints/groups";
import { useSingleProject } from "@/api/endpoints/projects";
import { useCompany } from "@/api/endpoints/company";
import {
  useListQRCodes,
  useSingleQRCode,
  updateQRCodeDetails,
  deleteSingleQRCode,
  createBulkQRDeleteJob,
  bulkSetQRCodePassword,
  type QRCodeListParams,
} from "@/api/endpoints/qr-codes";
import { queryClient } from "@/api";
import procoreIcon from "@/assets/images/procore-icon.png";
import { getStoredUser } from "@/utils/getStoredUser";
import {
  postProcoreSync,
  postProcoreCreateBulkInspectionsAsync,
} from "@/api/endpoints/procore";
import ProcoreTemplateModal from "@/components/modal/taliho/ProcoreTemplateModal";
import { getActiveJobs } from "@/utils/localStorage-jobs";
import { canDelete, canModify } from "@/utils/permissions";

function GroupErrorComponent({ error, reset }: ErrorComponentProps) {
  const errorInfo = parseHttpError(error);

  // Log to Rollbar on mount (skip 404s - expected navigation errors)
  useEffect(() => {
    if (errorInfo.statusCode !== 404) {
      logApiError(error, "route-error-group", {
        pathname: window.location.pathname,
        statusCode: errorInfo.statusCode,
      });
    }
  }, [error, errorInfo.statusCode]);

  if (errorInfo.statusCode === 404) {
    return (
      <InlineError
        title="Group Not Found"
        message="The group you're looking for doesn't exist or has been deleted."
        icon="not-found"
        goBackTo="/groups"
        goBackLabel="Back to Groups"
      />
    );
  }

  if (errorInfo.statusCode === 403) {
    return (
      <InlineError
        title="Access Denied"
        message="You don't have permission to view this group."
        icon="access-denied"
        goBackTo="/groups"
        goBackLabel="Back to Groups"
      />
    );
  }

  // For server errors and other unhandled cases, show retry option
  return (
    <InlineError
      title={errorInfo.title}
      message={errorInfo.message}
      icon="server-error"
      onRetry={reset}
    />
  );
}

export const Route = createFileRoute("/group/$groupId")({
  component: RouteComponent,
  errorComponent: GroupErrorComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { groupId: groupId } = Route.useParams();

  const user = useMemo(() => getStoredUser(), []);
  const userCanDelete = canDelete(user); // Only admin can delete
  const userCanModify = canModify(user); // Admin and PM can modify

  const groupRes = useSingleGroup(groupId);
  const groupDoc = groupRes.data?.data as unknown as {
    _id?: string;
    type?: string;
    arrangementName?: string;
    arrangementType?: string;
    groupName?: string;
    groupingId?: string;
    equipmentName?: string;
    project?: string;
    passwordActivated?: boolean;
    password?: string;
    timezone?: string;
    weekdayPassword?: boolean;
    weekdayPasswordTimeStart?: string;
    weekdayPasswordTimeEnd?: string;
    weekendPassword?: boolean;
    weekendPasswordTimeStart?: string;
    weekendPasswordTimeEnd?: string;
  };

  const isArrangement = (groupDoc?.type || "").toLowerCase() === "arrangement";
  const isProcoreDrawings =
    (groupDoc?.type || "").toLowerCase() === "procore-drawing-codes";
  const groupName =
    groupDoc?.arrangementName ||
    groupDoc?.groupName ||
    groupDoc?.equipmentName ||
    "Group";
  const projectId = groupDoc?.project ? String(groupDoc.project) : undefined;

  const projectRes = useSingleProject(
    String(user.companyId || ""),
    String(projectId || ""),
  );
  const companyRes = useCompany(String(user.companyId || ""));
  type ProjectData = {
    projectName?: string;
    archived?: boolean;
    status?: string;
    projectStatus?: string;
    projectAddress?: string;
    projectCity?: string;
    projectState?: string;
    projectZIP?: string;
    clientName?: string;
    procoreCompanyID?: string | number;
    procoreProjectID?: string | number;
  };
  type ProjectResponse = { data?: ProjectData } & ProjectData;
  const project = projectRes.data as unknown as ProjectResponse | undefined;
  const projectData = project?.data || project;
  const projectName = projectData?.projectName || "";
  const projectStatus = useMemo(() => {
    const archived = Boolean(projectData?.archived);
    if (archived) return "archived" as const;
    const raw = String(projectData?.projectStatus || "").toLowerCase();
    if (!raw || raw === "active") return "active" as const;
    if (raw === "completed") return "completed" as const;
    if (raw === "on hold" || raw === "on-hold") return "on-hold" as const;
    return "others" as const;
  }, [projectData]);
  const isProjectArchived = projectStatus === "archived";
  const isProcoreConnected = useMemo(() => {
    const pid = String(projectData?.procoreProjectID || "");
    return Boolean(pid && pid.toLowerCase() !== "none");
  }, [projectData]);

  // const { id: groupId } = useParams({ from: '/group/$id' }) as { id: string };

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Array<QRItem["type"]>>([]);
  const [sortBy, setSortBy] = useState<
    | undefined
    | "name-asc"
    | "name-desc"
    | "date-desc"
    | "date-asc"
    | "scans-desc"
    | "scans-asc"
  >("name-asc");
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showQRPasswordModal, setShowQRPasswordModal] = useState(false);
  const [qrPasswordTargetId, setQrPasswordTargetId] = useState<string | null>(
    null,
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBulkDeleteQrsModal, setShowBulkDeleteQrsModal] = useState(false);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [bulkInspectionLoading, setBulkInspectionLoading] = useState(false);
  const [bulkInspectionFromSelection, setBulkInspectionFromSelection] =
    useState(false);

  // Loading states for modal submit buttons
  const [editingGroupLoading, setEditingGroupLoading] = useState(false);
  const [editingQrLoading, setEditingQrLoading] = useState(false);
  const [deletingQr, setDeletingQr] = useState(false);
  const [settingGroupPassword, setSettingGroupPassword] = useState(false);
  const [settingQrPassword, setSettingQrPassword] = useState(false);
  const [bulkDeletingQrs, setBulkDeletingQrs] = useState(false);

  const [bulkActions, setBulkActions] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Pagination state for DataGrid
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    try {
      if (typeof window === "undefined") return 12;
      const raw = window.localStorage.getItem(
        "itemsPerPage:group-detail-items-per-page",
      );
      if (!raw) return 12;
      const persisted = Number(raw);
      return [12, 24, 48].includes(persisted) ? persisted : 12;
    } catch {
      return 12;
    }
  });
  const [bodySkeletonVersion, setBodySkeletonVersion] = useState<number>(0);

  // Map sort UI values to API parameters
  // Note: Backend whitelist expects 'name' and 'scans' keys, not field names
  const serverSortParams = useMemo(() => {
    if (!sortBy) return { sortBy: "name", sortDir: "asc" as const };
    const mapping: Record<string, { sortBy: string; sortDir: "asc" | "desc" }> =
      {
        "name-asc": { sortBy: "name", sortDir: "asc" },
        "name-desc": { sortBy: "name", sortDir: "desc" },
        "date-desc": { sortBy: "createdAt", sortDir: "desc" },
        "date-asc": { sortBy: "createdAt", sortDir: "asc" },
        "scans-desc": { sortBy: "scans", sortDir: "desc" },
        "scans-asc": { sortBy: "scans", sortDir: "asc" },
      };
    return mapping[sortBy] || { sortBy: "name", sortDir: "asc" as const };
  }, [sortBy]);

  const qrListParams = useMemo(() => {
    // Fall back to groupingType stored in localStorage job when groupDoc hasn't loaded yet.
    // This prevents the race condition where groupDoc?.type is undefined on first navigation
    // to a newly created group, causing the backend query to skip group-based filtering.
    const storedGroupingType = !groupDoc?.type
      ? getActiveJobs().find((j) => j.groupId === groupId)?.groupingType
      : undefined;
    const typeLower = String(
      groupDoc?.type || storedGroupingType || "",
    ).toLowerCase();
    const groupingType =
      typeLower === "arrangement" || typeLower === "equipment"
        ? typeLower
        : undefined;
    const base: Record<string, unknown> = {
      projectId: projectId,
      groupingId: groupId,
      current_page: currentPage,
      per_page: itemsPerPage,
      sortBy: serverSortParams.sortBy,
      sortDir: serverSortParams.sortDir,
    };
    // Add search filter
    if (query.trim()) base.search = query.trim();
    // Add type filter - map display types to API types
    if (typeFilter.length > 0) {
      const typeMap: Record<string, string> = {
        File: "file",
        Taliho: "folder",
        URL: "url",
        "Procore Tool": "procore-tool",
        "Procore Location": "procore-location",
        "Procore Drawing": "procore-drawing-code",
      };
      base.types = typeFilter.map((t) => typeMap[t] || t.toLowerCase());
    }
    if (groupingType) base.groupingType = groupingType;
    if (user?.companyId) base.companyId = String(user.companyId);
    return base as QRCodeListParams;
  }, [
    user?.companyId,
    projectId,
    groupId,
    groupDoc?.type,
    currentPage,
    itemsPerPage,
    serverSortParams,
    query,
    typeFilter,
  ]);
  const qrListRes = useListQRCodes(qrListParams);
  const gridLoadingState = useTableLoadingState(qrListRes);

  // Fetch individual QR code data when password modal is opened for a specific QR code
  const qrPasswordData = useSingleQRCode(qrPasswordTargetId || "");

  const rawItems = useMemo<QRItem[]>(() => {
    type QRListResponse = { data?: Array<Record<string, unknown>> };
    const rows = ((qrListRes?.data as QRListResponse | undefined)?.data ??
      []) as Array<{
      _id: string;
      qrcodeName?: string;
      type?: string;
      resolvedType?: string;
      createdAt?: string | Date;
      mobileScanCount?: number;
      qrimage?: string;
      qrImageUrl?: string;
      passwordActivated?: boolean;
    }>;
    return rows.map((r) => buildGroupQRItem(r));
  }, [qrListRes.data]);

  const [items, setItems] = useState<QRItem[]>([]);
  useEffect(() => {
    setItems(rawItems);
  }, [rawItems]);

  // Server now handles filtering and sorting, so these are simplified
  // Items come pre-filtered and pre-sorted from the API
  const filtered = useMemo(() => items, [items]);
  const sorted = useMemo(() => filtered, [filtered]);

  const visibleSorted = useMemo(
    () => sorted.filter((i) => !hiddenIds.has(i.id)),
    [sorted, hiddenIds],
  );

  // Build print items for main print modal (all visible items on current page - used as fallback)
  const printItems = useMemo(() => {
    return visibleSorted.map((i) => {
      const item = i as {
        image?: string;
        qrCodeId?: string;
        id?: string;
        svgFallback?: string;
      };
      return {
        name: String(i.title ?? ""),
        imgSrc: item.image || "",
        fallbackSrc: item.svgFallback,
        qrCodeId: item.qrCodeId || item.id, // Include QR code ID for signed URL refresh
      };
    });
  }, [visibleSorted]);

  // Use extracted print hook for fetching all QR codes for printing
  const { allPrintItems, isFetchingPrintItems, handleRefetchUrl } =
    useGroupPrint({
      showPrintModal,
      groupType: groupDoc?.type,
      projectId,
      groupId,
      companyId: String(user?.companyId || ""),
      sortBy: serverSortParams.sortBy,
      sortDir: serverSortParams.sortDir,
      fallbackPrintItems: printItems,
    });

  // Use extracted job polling hook
  const { hasActiveCreationJob } = useGroupJobPolling(groupId, () =>
    qrListRes.refetch(),
  );

  // Build bulk print items (only selected items)
  const bulkPrintItems = useMemo(() => {
    return items
      .filter((i) => selectedIds.has(i.id))
      .map((i) => {
        const item = i as {
          image?: string;
          qrCodeId?: string;
          id?: string;
          svgFallback?: string;
        };
        return {
          name: String(i.title ?? ""),
          imgSrc: item.image || "",
          fallbackSrc: item.svgFallback,
          qrCodeId: item.qrCodeId || item.id, // Include QR code ID for signed URL refresh
        };
      });
  }, [items, selectedIds]);

  // Server-side pagination - use total_items from API response
  const totalItems = useMemo(() => {
    const response = qrListRes.data as { total_items?: number } | undefined;
    return Number(response?.total_items ?? visibleSorted.length);
  }, [qrListRes.data, visibleSorted.length]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage],
  );
  useEffect(() => {
    if (currentPage > pageCount && pageCount > 0) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  // Items are already paginated from server, just filter out hidden ones
  const pagedItems = useMemo(() => {
    return visibleSorted.filter((i) => !hiddenIds.has(i.id));
  }, [visibleSorted, hiddenIds]);

  useEffect(() => {
    clearSelection();
  }, [typeFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, typeFilter, sortBy]);
  useEffect(() => {
    setBodySkeletonVersion((v) => v + 1);
  }, [sortBy, currentPage, itemsPerPage]);

  const [showEditQrModal, setShowEditQrModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const editingItem = useMemo(
    () => items.find((i) => i.id === editingItemId),
    [items, editingItemId],
  );

  const typeOptions = useMemo(
    () => [
      { label: "File", value: "File" },
      { label: "Taliho", value: "Taliho" },
      { label: "URL", value: "URL" },
      { label: "Procore Tool", value: "Procore Tool" },
      { label: "Procore Location", value: "Procore Location" },
      { label: "Procore Drawing", value: "Procore Drawing" },
    ],
    [],
  );

  const sortOptions = useMemo(
    () => [
      { label: "Name (A-Z)", value: "name-asc" },
      { label: "Name (Z-A)", value: "name-desc" },
      { label: "Date Created (Newest)", value: "date-desc" },
      { label: "Date Created (Oldest)", value: "date-asc" },
      { label: "Scans (High-Low)", value: "scans-desc" },
      { label: "Scans (Low-High)", value: "scans-asc" },
    ],
    [],
  );

  const activeFiltersMemo = useMemo(
    () => ({ type: typeFilter, sort: sortBy ?? undefined }),
    [typeFilter, sortBy],
  );

  function clearSelection() {
    setSelectedIds(new Set());
  }
  function isRowSelected(id: string) {
    return selectedIds.has(id);
  }
  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groupErrorInfo = groupRes.error ? parseHttpError(groupRes.error) : null;

  // If there's no group document, classify errors carefully:
  // - 404/410 (or empty non-loading state): true not found
  // - other errors: transient/server/access issue, allow retry
  if (!groupDoc?._id) {
    const statusCode = groupErrorInfo?.statusCode;
    const isNotFoundStatus = statusCode === 404 || statusCode === 410;

    if (
      isNotFoundStatus ||
      (!groupRes.isLoading && !groupDoc?._id && !groupRes.error)
    ) {
      return (
        <InlineError
          title="Group Not Found"
          message="The group you're looking for doesn't exist or has been deleted."
          icon="not-found"
          goBackTo="/groups"
          goBackLabel="Back to Groups"
        />
      );
    }

    if (groupRes.error && groupErrorInfo) {
      return (
        <InlineError
          title={groupErrorInfo.title}
          message={groupErrorInfo.message}
          icon="server-error"
          onRetry={() => {
            void groupRes.refetch();
          }}
        />
      );
    }
  }

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      {/* Page-scoped modals */}
      <DeleteModal
        open={showDeleteGroupModal}
        subjectLabel="group"
        bodyMessage={`This will permanently delete this group along with all its QR codes, folders, documents, and Procore item links. This action cannot be undone.`}
        onClose={() => setShowDeleteGroupModal(false)}
        isLoading={deletingGroup}
        onConfirm={async () => {
          if (!user?.companyId) {
            toast.error("Session expired. Please log in again.");
            return;
          }
          setDeletingGroup(true);
          try {
            const { jobId } = await deleteGroupAsync(
              user.companyId,
              String(groupId),
            );
            addJob({
              jobId,
              status: "pending",
              progress: 0,
              total: 1,
              type: "bulk-group-delete",
            });
            toast.success("Deletion started");
            setShowDeleteGroupModal(false);
            navigate({ to: "/groups" });
          } catch (e) {
            logApiError(e, "delete-group", { groupId });
            toast.error("Failed to delete group.");
          } finally {
            setDeletingGroup(false);
          }
        }}
      />
      <EditModal
        open={showEditGroupModal}
        title={`Edit Group`}
        subtitle={<span>Update the details for this group.</span>}
        fields={[
          {
            key: "name",
            label: "Group Name",
            type: "text",
            required: true,
            initialValue: groupName,
          },
          {
            key: "type",
            label: "Group Type",
            type: "select",
            required: true,
            initialValue: isArrangement ? "arrangement" : "equipment",
            options: [
              { label: "Arrangement", value: "arrangement" },
              { label: "Equipment", value: "equipment" },
            ],
          },
        ]}
        onClose={() => setShowEditGroupModal(false)}
        isLoading={editingGroupLoading}
        onConfirm={async (values) => {
          setEditingGroupLoading(true);
          try {
            await patchGroup(String(groupId), {
              companyId: String(user.companyId || ""),
              projectId: String(projectId || ""),
              groupName: String(values?.name || "").trim(),
              type: values?.type as "arrangement" | "equipment",
            });
            toast.success("Group updated successfully.");
            await groupRes.refetch();
          } catch (e) {
            logApiError(e, "update-group", { groupId });
            toast.error("Failed to update group.");
          } finally {
            setEditingGroupLoading(false);
            setShowEditGroupModal(false);
          }
        }}
      />
      <EditModal
        open={showEditQrModal}
        title="Edit QR Code"
        subtitle={<span>Update the details for this QR Code.</span>}
        fields={[
          {
            key: "title",
            label: "QR Code Name",
            type: "text",
            required: true,
            initialValue: editingItem?.title ?? "",
          },
          {
            key: "type",
            label: "QR Type",
            type: "select",
            required: true,
            initialValue: editingItem?.type ?? "File",
            options: [
              { label: "File", value: "File" },
              { label: "Taliho", value: "Taliho" },
              { label: "URL", value: "URL" },
              { label: "Procore Tool", value: "Procore Tool" },
            ],
          },
        ]}
        onClose={() => {
          setShowEditQrModal(false);
          setEditingItemId(null);
        }}
        isLoading={editingQrLoading}
        onConfirm={async (values) => {
          const { title, type } = values;
          const id = editingItemId;
          setEditingQrLoading(true);
          try {
            if (id) {
              const list =
                (
                  qrListRes?.data as unknown as {
                    data?: Array<{ _id: string; project?: string }>;
                  }
                )?.data ?? [];
              const projId =
                list.find((q) => String(q._id) === String(id))?.project ??
                undefined;
              if (!user.companyId) {
                toast.error("Company information is missing.");
                return;
              }
              await updateQRCodeDetails(String(id), {
                qrcodeName: title,
                companyId: String(user.companyId),
                projectId: projId ? String(projId) : undefined,
              });
              const nextType = type as
                | "File"
                | "Taliho"
                | "URL"
                | "Procore Tool";
              setItems((prev) =>
                prev.map((i) =>
                  i.id === id ? { ...i, title, type: nextType } : i,
                ),
              );
              toast.success("QR code updated.");
              await qrListRes.refetch();
            }
          } catch (e) {
            logQRError(e, "update-qrcode", editingItemId ?? undefined, {
              groupId,
            });
            toast.error("Failed to update QR code.");
          } finally {
            setEditingQrLoading(false);
            setShowEditQrModal(false);
            setEditingItemId(null);
          }
        }}
      />
      <DownloadModal
        open={showDownloadModal}
        selectedCount={1}
        subjectLabel={actionTargetId ? "QR code" : "item"}
        onClose={() => {
          setShowDownloadModal(false);
          setActionTargetId(null);
        }}
        onConfirm={(settings) => {
          setShowDownloadModal(false);
          setActionTargetId(null);
          toast.success(
            `Preparing ${settings.format.toUpperCase()} download${settings.includeAnalytics ? " with analytics" : ""}`,
          );
        }}
      />
      <PrintItemsModal
        open={showPrintModal}
        selectedCount={allPrintItems.length || totalItems}
        title="Print All QR Codes"
        subtitle={
          <span>
            Print all {allPrintItems.length || totalItems} QR code
            {(allPrintItems.length || totalItems) === 1 ? "" : "s"} in this
            group.
          </span>
        }
        maxItemsPerPage={12}
        onClose={() => setShowPrintModal(false)}
        companyName={companyRes.data?.companyName ?? "Taliho"}
        companyWebsite={companyRes.data?.companyWebsite}
        brandLogoSrc={companyRes.data?.printBrandingLogo}
        projectLine={projectName ?? ""}
        clientName={projectData?.clientName || ""}
        addressLine={
          projectData
            ? [
                projectData.projectAddress,
                projectData.projectCity,
                projectData.projectState
                  ? `${projectData.projectState} ${projectData.projectZIP || ""}`.trim()
                  : projectData.projectZIP,
              ]
                .filter(Boolean)
                .join(", ") || ""
            : ""
        }
        groupLine={groupName}
        items={allPrintItems}
        isLoadingItems={isFetchingPrintItems}
        inlinePrint={true}
        onRefetchUrl={handleRefetchUrl}
        onConfirm={() => {
          // Browser print handles everything, just close modal
          setShowPrintModal(false);
        }}
      />
      <DeleteModal
        open={showDeleteModal}
        selectedCount={1}
        subjectLabel="QR code"
        bodyMessage="This action cannot be undone. Deleting this QR code will permanently remove all associated folders, documents, and Procore item links."
        isLoading={deletingQr}
        onClose={() => {
          setShowDeleteModal(false);
          setActionTargetId(null);
        }}
        onConfirm={async () => {
          const id = actionTargetId;
          if (!id) {
            setShowDeleteModal(false);
            return;
          }
          if (!user?.companyId) {
            toast.error("Session expired. Please log in again.");
            return;
          }
          setDeletingQr(true);
          try {
            await deleteSingleQRCode(user.companyId, String(id));
            setRemovingIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
            toast.success("QR code deleted.");
            window.setTimeout(async () => {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                if (id) next.add(id);
                return next;
              });
              setRemovingIds((prev) => {
                const next = new Set(prev);
                if (id) next.delete(id);
                return next;
              });
              setDeletingQr(false);
              setShowDeleteModal(false);
              setActionTargetId(null);
              try {
                await qrListRes.refetch();
                // Also invalidate Groups query to update numberOfCodes
                await queryClient.invalidateQueries({
                  queryKey: groupsKeys.all,
                });
              } catch {
                // Best-effort refetch; ignore errors to avoid blocking UI updates
              }
            }, 200);
          } catch (e) {
            logQRError(e, "delete-qrcode", id, { groupId });
            toast.error("Failed to delete QR code.");
            setDeletingQr(false);
          }
        }}
      />
      <SetPasswordModal
        open={showSetPasswordModal}
        selectedCount={
          bulkActions && selectedIds.size > 0 ? selectedIds.size : 0
        }
        subjectLabel={bulkActions && selectedIds.size > 0 ? "QR code" : "item"}
        title={
          bulkActions && selectedIds.size > 0
            ? "Set Password for Selected QR Codes"
            : groupDoc?.passwordActivated
              ? "Update Group Password"
              : "Set Group Password"
        }
        subtitle={
          <span>
            {bulkActions && selectedIds.size > 0
              ? `Set a password for ${selectedIds.size} selected QR code${selectedIds.size === 1 ? "" : "s"}.`
              : groupDoc?.passwordActivated
                ? "Update the password for this group and all its QR codes."
                : "Set a password for this group and all its QR codes."}
          </span>
        }
        // Pre-populate with existing password data if available (only for group-level password)
        initialPasswordActivated={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.passwordActivated
        }
        initialPassword={
          bulkActions && selectedIds.size > 0 ? undefined : groupDoc?.password
        }
        initialTimezone={
          bulkActions && selectedIds.size > 0 ? undefined : groupDoc?.timezone
        }
        initialWeekdayPassword={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekdayPassword
        }
        initialWeekdayPasswordTimeStart={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekdayPasswordTimeStart
        }
        initialWeekdayPasswordTimeEnd={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekdayPasswordTimeEnd
        }
        initialWeekendPassword={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekendPassword
        }
        initialWeekendPasswordTimeStart={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekendPasswordTimeStart
        }
        initialWeekendPasswordTimeEnd={
          bulkActions && selectedIds.size > 0
            ? undefined
            : groupDoc?.weekendPasswordTimeEnd
        }
        onClose={() => setShowSetPasswordModal(false)}
        isLoading={settingGroupPassword}
        onConfirmValues={async (vals) => {
          // Validate password when activating
          if (
            vals.passwordActivated &&
            (!vals.password || vals.password.trim() === "")
          ) {
            toast.error("Password cannot be empty");
            return;
          }

          const isSelectedOnly = bulkActions && selectedIds.size > 0;
          setSettingGroupPassword(true);

          try {
            if (!isSelectedOnly) {
              // Group-level: patchGroup handles QR code propagation on the backend
              await patchGroup(String(groupId), {
                companyId: String(user.companyId || ""),
                projectId: String(projectId || ""),
                passwordActivated: Boolean(vals.passwordActivated),
                password: vals.password,
                timezone: vals.timezone,
                weekdayPassword: Boolean(vals.weekdayPassword),
                weekdayPasswordTimeStart: vals.weekdayPasswordTimeStart,
                weekdayPasswordTimeEnd: vals.weekdayPasswordTimeEnd,
                weekendPassword: Boolean(vals.weekendPassword),
                weekendPasswordTimeStart: vals.weekendPasswordTimeStart,
                weekendPasswordTimeEnd: vals.weekendPasswordTimeEnd,
              });
              toast.success(
                `Group password ${groupDoc?.passwordActivated ? "updated" : "set"} successfully`,
              );
            } else {
              // Bulk selection: update only the selected QR codes
              const qrCodeIdsToUpdate = Array.from(selectedIds);
              if (qrCodeIdsToUpdate.length > 0) {
                const bulkResult = await bulkSetQRCodePassword(
                  qrCodeIdsToUpdate,
                  String(user.companyId || ""),
                  {
                    passwordActivated: Boolean(vals.passwordActivated),
                    password: vals.password,
                    timezone: vals.timezone,
                    weekdayPassword: Boolean(vals.weekdayPassword),
                    weekdayPasswordTimeStart: vals.weekdayPasswordTimeStart,
                    weekdayPasswordTimeEnd: vals.weekdayPasswordTimeEnd,
                    weekendPassword: Boolean(vals.weekendPassword),
                    weekendPasswordTimeStart: vals.weekendPasswordTimeStart,
                    weekendPasswordTimeEnd: vals.weekendPasswordTimeEnd,
                  },
                );
                if (bulkResult.success) {
                  toast.success(
                    `Password ${vals.passwordActivated ? "set" : "removed"} for ${bulkResult.updated ?? qrCodeIdsToUpdate.length} QR code${qrCodeIdsToUpdate.length === 1 ? "" : "s"}`,
                  );
                } else {
                  toast.error(
                    `Failed to update QR codes: ${bulkResult.message || "Unknown error"}`,
                  );
                }
              } else {
                toast.success("No QR codes selected to update");
              }
            }

            await groupRes.refetch();
            await qrListRes.refetch();
            setSettingGroupPassword(false);
            setShowSetPasswordModal(false);
            if (isSelectedOnly) {
              setSelectedIds(new Set());
              setBulkActions(false);
            }
          } catch (e) {
            logQRError(
              e,
              isSelectedOnly
                ? "bulk-set-qrcode-password"
                : "save-group-password",
              undefined,
              {
                groupId,
                isSelectedOnly,
                selectedCount: selectedIds.size,
              },
            );
            const errorMessage =
              e instanceof Error
                ? e.message
                : isSelectedOnly
                  ? "Failed to set password for selected QR codes. Please try again."
                  : "Failed to save group password settings. Please try again.";
            toast.error(errorMessage);
            setSettingGroupPassword(false);
          }
        }}
      />
      <SetPasswordModal
        open={showQRPasswordModal}
        selectedCount={1}
        subjectLabel="QR code"
        title={
          qrPasswordData?.data?.data?.passwordActivated
            ? "Update QR Code Password"
            : "Set QR Code Password"
        }
        subtitle={
          <span>
            {qrPasswordData?.data?.data?.passwordActivated
              ? "Update the password for this QR code."
              : "Set a password for this QR code."}
          </span>
        }
        initialPasswordActivated={qrPasswordData?.data?.data?.passwordActivated}
        initialPassword={qrPasswordData?.data?.data?.password}
        initialTimezone={qrPasswordData?.data?.data?.timezone}
        initialWeekdayPassword={qrPasswordData?.data?.data?.weekdayPassword}
        initialWeekdayPasswordTimeStart={
          qrPasswordData?.data?.data?.weekdayPasswordTimeStart
        }
        initialWeekdayPasswordTimeEnd={
          qrPasswordData?.data?.data?.weekdayPasswordTimeEnd
        }
        initialWeekendPassword={qrPasswordData?.data?.data?.weekendPassword}
        initialWeekendPasswordTimeStart={
          qrPasswordData?.data?.data?.weekendPasswordTimeStart
        }
        initialWeekendPasswordTimeEnd={
          qrPasswordData?.data?.data?.weekendPasswordTimeEnd
        }
        onClose={() => {
          setShowQRPasswordModal(false);
          setQrPasswordTargetId(null);
        }}
        isLoading={settingQrPassword}
        onConfirmValues={async (vals) => {
          if (!qrPasswordTargetId) {
            toast.error("No QR code selected");
            return;
          }

          // Validate password before sending
          if (
            vals.passwordActivated &&
            (!vals.password || vals.password.trim() === "")
          ) {
            toast.error(
              "Password cannot be empty when activating password protection",
            );
            return;
          }

          setSettingQrPassword(true);
          try {
            // Update the QR code password
            if (!user.companyId) {
              toast.error("Company information is missing.");
              return;
            }
            await updateQRCodeDetails(qrPasswordTargetId, {
              companyId: String(user.companyId),
              projectId: projectId ? String(projectId) : undefined,
              passwordActivated: Boolean(vals.passwordActivated),
              password: vals.password,
              timezone: vals.timezone,
              weekdayPassword: Boolean(vals.weekdayPassword),
              weekdayPasswordTimeStart: vals.weekdayPasswordTimeStart,
              weekdayPasswordTimeEnd: vals.weekdayPasswordTimeEnd,
              weekendPassword: Boolean(vals.weekendPassword),
              weekendPasswordTimeStart: vals.weekendPasswordTimeStart,
              weekendPasswordTimeEnd: vals.weekendPasswordTimeEnd,
            });

            toast.success(
              `QR code password ${qrPasswordData?.data?.data?.passwordActivated ? "updated" : "set"} successfully`,
            );

            // Refetch the QR code list to update the UI
            await qrListRes.refetch();
            setSettingQrPassword(false);
            setShowQRPasswordModal(false);
            setQrPasswordTargetId(null);
          } catch (e) {
            logQRError(
              e,
              "update-qrcode-password",
              qrPasswordTargetId ?? undefined,
              { groupId },
            );
            const errorMessage =
              e instanceof Error
                ? e.message
                : "Failed to update QR code password. Please try again.";
            toast.error(errorMessage);
            setSettingQrPassword(false);
          }
        }}
      />
      <UploadModal
        open={showUploadModal}
        subjectLabel="group"
        subtitle={`Upload documents to ${groupName ? "Group: " + groupName : "this group"} (${selectedIds.size} QR codes selected)`}
        onClose={() => setShowUploadModal(false)}
        onConfirm={() => {
          setShowUploadModal(false);
        }}
      />
      <BulkDeleteModal
        open={showBulkDeleteQrsModal}
        selectedCount={selectedIds.size}
        subjectLabel="QR code"
        bodyMessage="This action cannot be undone. Deleting these QR codes will permanently remove all associated folders, documents, and Procore item links."
        isLoading={bulkDeletingQrs}
        onClose={() => {
          setShowBulkDeleteQrsModal(false);
        }}
        onConfirm={async () => {
          const idsToRemove = Array.from(selectedIds);
          if (idsToRemove.length === 0) {
            setShowBulkDeleteQrsModal(false);
            return;
          }

          if (!user?.companyId) {
            toast.error("Session expired. Please log in again.");
            return;
          }

          setBulkDeletingQrs(true);

          // Show fade-out animation
          setRemovingIds((prev) => {
            const next = new Set(prev);
            idsToRemove.forEach((id) => next.add(id));
            return next;
          });

          try {
            // Create async delete job
            const { jobId } = await createBulkQRDeleteJob(
              user.companyId,
              idsToRemove,
              String(projectId || ""),
            );
            addJob({
              jobId,
              status: "pending",
              progress: 0,
              total: idsToRemove.length,
              type: "bulk-qr-delete",
            });

            toast.success("Deletion started");

            // Hide deleted items and cleanup
            window.setTimeout(() => {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.add(id));
                return next;
              });
              setRemovingIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.delete(id));
                return next;
              });
              clearSelection();
              setBulkDeletingQrs(false);
              setShowBulkDeleteQrsModal(false);
              setBulkActions(false);
            }, 200);
          } catch (error) {
            // Remove fade-out animation on error
            setRemovingIds((prev) => {
              const next = new Set(prev);
              idsToRemove.forEach((id) => next.delete(id));
              return next;
            });

            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to delete QR codes. Please try again.";
            toast.error(errorMessage);
            setBulkDeletingQrs(false);

            logQRError(error, "bulk-delete-qrcodes", undefined, {
              qrcodeCount: idsToRemove.length,
              groupId,
            });
          }
        }}
      />
      <PrintItemsModal
        open={showBulkPrintModal}
        selectedCount={selectedIds.size}
        title="Print Selected QR Codes"
        maxItemsPerPage={12}
        onClose={() => setShowBulkPrintModal(false)}
        companyName={companyRes.data?.companyName ?? "Taliho"}
        companyWebsite={companyRes.data?.companyWebsite}
        brandLogoSrc={companyRes.data?.printBrandingLogo}
        projectLine={projectName ?? ""}
        clientName={projectData?.clientName || ""}
        addressLine={
          projectData
            ? [
                projectData.projectAddress,
                projectData.projectCity,
                projectData.projectState
                  ? `${projectData.projectState} ${projectData.projectZIP || ""}`.trim()
                  : projectData.projectZIP,
              ]
                .filter(Boolean)
                .join(", ") || ""
            : ""
        }
        groupLine={groupName}
        items={bulkPrintItems}
        inlinePrint={true}
        onRefetchUrl={handleRefetchUrl}
        onConfirm={() => {
          // Browser print handles everything, just close modal
          setShowBulkPrintModal(false);
        }}
      />

      {/* Progress banners removed - replaced with grid overlay */}

      <ListPageLayout
        title={groupName}
        titleIcon={
          isProcoreDrawings ? (
            <img
              src={procoreIcon}
              alt="Procore Drawings"
              className="h-6 w-6 mr-2"
            />
          ) : undefined
        }
        titleIconClass={
          isProcoreDrawings
            ? undefined
            : isArrangement
              ? "bx bx-layer text-indigo-600"
              : "bx bx-wrench text-red-600"
        }
        subtitle={
          projectId ? (
            <span className="inline-flex items-center space-x-2">
              <span className="text-gray-600 tracking-wide uppercase text-xs font-semibold">
                Project:
              </span>
              <Link
                to="/project/$projectId"
                params={{ projectId: String(projectId) }}
              >
                <Badge
                  variant={projectStatusBadgeVariant(projectStatus)}
                  shape="md"
                  className="cursor-pointer transition-all duration-150 hover:scale-105 hover:brightness-95"
                >
                  {projectName}
                </Badge>
              </Link>
            </span>
          ) : null
        }
        headerActions={
          <>
            <div className="hidden xl:flex xl:space-x-2 xl:flex-shrink-0">
              {(() => {
                const options: ItemComboBoxOption[] = [
                  // Only show edit option for admin and PM users
                  ...(userCanModify
                    ? [
                        {
                          label: `Edit Group`,
                          value: "edit",
                          iconClass: "bx bx-pencil",
                          disabled: isProjectArchived,
                          onSelect: () => setShowEditGroupModal(true),
                        },
                      ]
                    : []),
                  // Only show delete option for admin users
                  ...(userCanDelete
                    ? [
                        {
                          label: `Delete Group`,
                          value: "delete",
                          iconClass: "bx bx-trash",
                          disabled: isProjectArchived,
                          onSelect: () => setShowDeleteGroupModal(true),
                        },
                      ]
                    : []),
                ];
                return (
                  <div
                    className={
                      hasActiveCreationJob
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                    title={
                      hasActiveCreationJob
                        ? "Actions disabled while creating QR codes"
                        : ""
                    }
                  >
                    <ItemComboBox
                      options={options}
                      buttonVariant="secondary"
                      buttonLabel="Settings"
                      buttonLeftIconClass="bx bx-cog text-gray-600"
                      buttonRightIconClass="bx bx-chevron-down text-gray-400"
                      align="right"
                      menuWidthClassName="w-48"
                    />
                  </div>
                );
              })()}
              {/* <Button type="button" variant="secondary" leftIconClass='bx bx-download' onClick={() => { setActionTargetId(null); setShowDownloadModal(true) }}>Download</Button> */}
              <Button
                type="button"
                variant="secondary"
                leftIconClass="bx bx-printer"
                onClick={() => setShowPrintModal(true)}
                disabled={hasActiveCreationJob}
                title={
                  hasActiveCreationJob
                    ? "Actions disabled while creating QR codes"
                    : ""
                }
              >
                Print
              </Button>
              {userCanModify && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIconClass="bx bx-lock-alt"
                  onClick={() => setShowSetPasswordModal(true)}
                  disabled={hasActiveCreationJob || isProjectArchived}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : hasActiveCreationJob
                        ? "Actions disabled while creating QR codes"
                        : groupDoc?.passwordActivated
                          ? "Update group password"
                          : "Set group password"
                  }
                >
                  {groupDoc?.passwordActivated
                    ? "Update Password"
                    : "Set Password"}
                </Button>
              )}
              {(() => {
                const options: ItemComboBoxOption[] = [
                  {
                    label: "Fetch from Procore",
                    value: "fetch",
                    iconClass: "bx bx-cloud-download",
                    onSelect: () =>
                      navigate({
                        to: "/procore/fetch",
                        search: {
                          selectedIds: undefined,
                          groupId: groupId,
                          returnTo: "/group/$groupId",
                          returnParams: { groupId: groupId },
                        },
                      }),
                  },
                  {
                    label: "Sync inspections",
                    value: "sync",
                    iconClass: "bx bx-sync",
                    onSelect: async () => {
                      if (!isProcoreConnected) {
                        toast.error("Project not connected to Procore.");
                        return;
                      }
                      try {
                        const res = await postProcoreSync({
                          companyId: String(user.companyId || ""),
                          projectId: String(projectId || ""),
                          groupingId: String(groupId),
                          groupingType: isArrangement
                            ? "arrangement"
                            : "equipment",
                        });
                        await qrListRes.refetch();
                        const created = Number(
                          (res as { created?: number })?.created ?? 0,
                        );
                        if (created > 0)
                          toast.success(`Linked ${created} inspections.`);
                        else toast.success("Sync completed (no new links).");
                      } catch (err) {
                        logProcoreError(err, "sync-inspections", {
                          groupId,
                          projectId,
                        });
                        const maybeMessage = (
                          err as { response?: { data?: { message?: string } } }
                        )?.response?.data?.message;
                        toast.error(
                          typeof maybeMessage === "string"
                            ? maybeMessage
                            : "Failed to sync Procore inspections. Please try again.",
                        );
                      }
                    },
                  },
                  {
                    label: "Create inspections…",
                    value: "create",
                    iconClass: "bx bx-plus",
                    onSelect: () => {
                      if (!isProcoreConnected) {
                        toast.error("Project not connected to Procore.");
                        return;
                      }
                      setBulkInspectionFromSelection(false);
                      setShowTemplateModal(true);
                    },
                  },
                ];
                return (
                  <div
                    className={
                      hasActiveCreationJob || isProjectArchived
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                    title={
                      isProjectArchived
                        ? "This project has been archived"
                        : hasActiveCreationJob
                          ? "Actions disabled while creating QR codes"
                          : ""
                    }
                  >
                    <ItemComboBox
                      options={options}
                      buttonVariant="secondary"
                      buttonContent={
                        <>
                          <img src={procoreIcon} className="h-4 w-4 mr-1.5" />
                          Procore Actions
                          <i className="bx bx-chevron-down text-gray-400 ml-1.5"></i>
                        </>
                      }
                      align="right"
                      menuWidthClassName="w-56"
                    />
                  </div>
                );
              })()}
              <Button
                type="button"
                variant="secondary"
                leftIconClass={`bx ${bulkActions ? "bx-x" : "bx-grid-alt"} text-gray-500`}
                disabled={hasActiveCreationJob}
                title={
                  hasActiveCreationJob
                    ? "Actions disabled while creating QR codes"
                    : ""
                }
                onClick={() => {
                  setBulkActions((a) => !a);
                  clearSelection();
                }}
              >
                {bulkActions ? "Cancel" : "Bulk Actions"}
              </Button>
              {userCanModify && (
                <Button
                  type="button"
                  variant="primary"
                  leftIconClass="bx bx-plus"
                  {...(hasActiveCreationJob || isProjectArchived
                    ? {
                        disabled: true,
                        onClick: () => {
                          if (isProjectArchived) {
                            toast.error("This project has been archived.");
                          } else {
                            toast.error(
                              "Actions disabled while creating QR codes. Please wait for creation to complete.",
                            );
                          }
                        },
                      }
                    : {
                        href: buildCreateQRHref({
                          projectId: projectId ?? null,
                          groupingId: groupId,
                        }),
                      })}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : hasActiveCreationJob
                        ? "Actions disabled while creating QR codes"
                        : ""
                  }
                >
                  Add QR Codes
                </Button>
              )}
            </div>
            <div className="xl:hidden flex space-x-2 flex-shrink-0">
              {(() => {
                const options: ItemComboBoxOption[] = [
                  // Only show edit option for admin and PM users
                  ...(userCanModify
                    ? [
                        {
                          label: `Edit Group`,
                          value: "edit",
                          iconClass: "bx bx-pencil",
                          onSelect: () => setShowEditGroupModal(true),
                          disabled: isProjectArchived,
                        },
                      ]
                    : []),
                  {
                    label: "Download",
                    value: "download",
                    iconClass: "bx bx-download",
                    onSelect: () => {
                      setActionTargetId(null);
                      setShowDownloadModal(true);
                    },
                  },
                  {
                    label: "Print",
                    value: "print",
                    iconClass: "bx bx-printer",
                    onSelect: () => setShowPrintModal(true),
                  },
                  // Only show set password option for admin and PM users
                  ...(userCanModify
                    ? [
                        {
                          label: groupDoc?.passwordActivated
                            ? "Update Password"
                            : "Set Password",
                          value: "password",
                          iconClass: "bx bx-lock-alt",
                          onSelect: () => setShowSetPasswordModal(true),
                          disabled: isProjectArchived,
                        },
                      ]
                    : []),
                  // Only show delete option for admin users
                  ...(userCanDelete
                    ? [
                        {
                          label: "Delete Group",
                          value: "delete",
                          iconClass: "bx bx-trash",
                          onSelect: () => setShowDeleteGroupModal(true),
                          disabled: isProjectArchived,
                        },
                      ]
                    : []),
                ];
                return (
                  <div
                    className={
                      hasActiveCreationJob
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                    title={
                      hasActiveCreationJob
                        ? "Actions disabled while creating QR codes"
                        : ""
                    }
                  >
                    <ItemComboBox
                      options={options}
                      buttonVariant="secondary"
                      buttonLabel="More"
                      buttonRightIconClass="bx bx-chevron-down -mr-1  text-gray-400"
                      align="right"
                      menuWidthClassName="w-48"
                    />
                  </div>
                );
              })()}
              <Button
                type="button"
                variant="secondary"
                leftIconClass={`bx ${bulkActions ? "bx-x" : "bx-grid-alt"} text-gray-500`}
                disabled={hasActiveCreationJob}
                title={
                  hasActiveCreationJob
                    ? "Actions disabled while creating QR codes"
                    : ""
                }
                onClick={() => {
                  setBulkActions((a) => !a);
                  clearSelection();
                }}
              >
                {bulkActions ? "Cancel" : "Bulk Actions"}
              </Button>
              {(() => {
                const procoreOptions: ItemComboBoxOption[] = [
                  {
                    label: "Fetch from Procore",
                    value: "fetch",
                    iconClass: "bx bx-cloud-download",
                    onSelect: () =>
                      navigate({
                        to: "/procore/fetch",
                        search: {
                          selectedIds: undefined,
                          groupId: groupId,
                          returnTo: "/group/$groupId",
                          returnParams: { groupId: groupId },
                        },
                      }),
                  },
                  {
                    label: "Sync inspections",
                    value: "sync",
                    iconClass: "bx bx-sync",
                    onSelect: async () => {
                      if (!isProcoreConnected) {
                        toast.error("Project not connected to Procore.");
                        return;
                      }
                      try {
                        const res = await postProcoreSync({
                          companyId: String(user.companyId || ""),
                          projectId: String(projectId || ""),
                          groupingId: String(groupId),
                          groupingType: isArrangement
                            ? "arrangement"
                            : "equipment",
                        });
                        await qrListRes.refetch();
                        const created = Number(
                          (res as { created?: number })?.created ?? 0,
                        );
                        if (created > 0)
                          toast.success(`Linked ${created} inspections.`);
                        else toast.success("Sync completed (no new links).");
                      } catch (err) {
                        logProcoreError(err, "sync-inspections-mobile", {
                          groupId,
                          projectId,
                        });
                        toast.error("Failed to sync Procore inspections.");
                      }
                    },
                  },
                  {
                    label: "Create inspections…",
                    value: "create",
                    iconClass: "bx bx-plus",
                    onSelect: () => {
                      if (!isProcoreConnected) {
                        toast.error("Project not connected to Procore.");
                        return;
                      }
                      setBulkInspectionFromSelection(false);
                      setShowTemplateModal(true);
                    },
                  },
                ];
                return (
                  <div
                    className={
                      hasActiveCreationJob || isProjectArchived
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                    title={
                      isProjectArchived
                        ? "This project has been archived"
                        : hasActiveCreationJob
                          ? "Actions disabled while creating QR codes"
                          : ""
                    }
                  >
                    <ItemComboBox
                      options={procoreOptions}
                      buttonVariant="secondary"
                      buttonContent={
                        <>
                          <img src={procoreIcon} className="h-4 w-4 mr-1.5" />
                          Procore
                          <i className="bx bx-chevron-down text-gray-400 ml-1.5"></i>
                        </>
                      }
                      align="right"
                      menuWidthClassName="w-56"
                    />
                  </div>
                );
              })()}
              {userCanModify && (
                <Button
                  type="button"
                  variant="primary"
                  leftIconClass="bx bx-plus"
                  {...(hasActiveCreationJob || isProjectArchived
                    ? {
                        disabled: true,
                        onClick: () => {
                          if (isProjectArchived) {
                            toast.error("This project has been archived.");
                          } else {
                            toast.error(
                              "Actions disabled while creating QR codes. Please wait for creation to complete.",
                            );
                          }
                        },
                      }
                    : {
                        href: buildCreateQRHref({
                          projectId: projectId ?? null,
                          groupingId: groupId,
                        }),
                      })}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : hasActiveCreationJob
                        ? "Actions disabled while creating QR codes"
                        : ""
                  }
                >
                  Add QR Codes
                </Button>
              )}
            </div>
          </>
        }
        search={{
          value: query,
          onChange: (v) => {
            setQuery(v);
            setCurrentPage(1);
            clearSelection();
          },
          placeholder: "Search QR codes in this group...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="QR Type"
              options={typeOptions.map((o) => ({
                label: o.label,
                value: o.value,
              }))}
              value={typeFilter as unknown as string[]}
              onChange={(next) => {
                setTypeFilter(next as unknown as QRItem["type"][]);
                setCurrentPage(1);
              }}
            />
            <FilterComboBox
              placeholder="Sort by"
              options={sortOptions.map((o) => ({
                label: o.label,
                value: o.value,
              }))}
              value={sortBy}
              onChange={(next) => {
                setSortBy((next as unknown as typeof sortBy) ?? undefined);
                setCurrentPage(1);
              }}
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setQuery("");
                setTypeFilter([]);
                setSortBy("name-asc");
                setCurrentPage(1);
                clearSelection();
              }}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5"
            >
              Clear Filters
            </Button>
          </>
        }
        activeFilters={activeFiltersMemo}
        bulkActionsBar={
          bulkActions ? (
            <BulkActionsBar
              selectedCount={selectedIds.size}
              onClearSelection={clearSelection}
              moreOptions={[
                {
                  label: "Upload",
                  value: "upload",
                  iconClass: "bx bx-upload",
                  onSelect: () => setShowUploadModal(true),
                  disabled: isProjectArchived,
                },
                // Only show set password option for admin and PM users
                ...(userCanModify
                  ? [
                      {
                        label: "Set Password",
                        value: "password",
                        iconClass: "bx bx-lock-alt",
                        onSelect: () => setShowSetPasswordModal(true),
                        disabled: isProjectArchived,
                      },
                    ]
                  : []),
                {
                  label: "Print",
                  value: "print",
                  iconClass: "bx bx-printer",
                  onSelect: () => {
                    if (selectedIds.size === 0) {
                      toast.error(
                        "Please select at least one QR code to print.",
                      );
                      return;
                    }
                    setShowBulkPrintModal(true);
                  },
                },
                {
                  label: "Fetch from Procore",
                  value: "fetch",
                  iconClass: "bx bx-cloud-download",
                  onSelect: () => {
                    const selected = Array.from(selectedIds);
                    navigate({
                      to: "/procore/fetch",
                      search: {
                        selectedIds: selected,
                        groupId: undefined,
                        returnTo: "/group/$groupId",
                        returnParams: { groupId: groupId },
                      },
                    });
                  },
                  disabled: isProjectArchived,
                },
                {
                  label: "Create inspections\u2026",
                  value: "create-inspections",
                  iconClass: "bx bx-plus",
                  onSelect: () => {
                    if (!isProcoreConnected) {
                      toast.error("Project not connected to Procore.");
                      return;
                    }
                    if (selectedIds.size === 0) {
                      toast.error("Please select at least one QR code.");
                      return;
                    }
                    setBulkInspectionFromSelection(true);
                    setShowTemplateModal(true);
                  },
                  disabled: isProjectArchived || !isProcoreConnected,
                },
                // Only show delete option for admin users
                ...(userCanDelete
                  ? [
                      {
                        label: "Delete",
                        value: "delete",
                        iconClass: "bx bxs-trash",
                        onSelect: () => setShowBulkDeleteQrsModal(true),
                        disabled: isProjectArchived,
                      },
                    ]
                  : []),
              ]}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-upload"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUploadModal(true);
                    }}
                    disabled={isProjectArchived}
                    title={
                      isProjectArchived
                        ? "This project has been archived"
                        : undefined
                    }
                  >
                    Upload
                  </Button>
                  {userCanModify && (
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass="bx bx-lock-alt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSetPasswordModal(true);
                      }}
                      disabled={isProjectArchived}
                      title={
                        isProjectArchived
                          ? "This project has been archived"
                          : undefined
                      }
                    >
                      Set Password
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-printer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedIds.size === 0) {
                        toast.error(
                          "Please select at least one QR code to print.",
                        );
                        return;
                      }
                      setShowBulkPrintModal(true);
                    }}
                  >
                    Print
                  </Button>
                  {(() => {
                    const options: ItemComboBoxOption[] = [
                      {
                        label: "Fetch from Procore",
                        value: "fetch",
                        iconClass: "bx bx-cloud-download",
                        onSelect: () => {
                          const selected = Array.from(selectedIds);
                          navigate({
                            to: "/procore/fetch",
                            search: {
                              selectedIds: selected,
                              groupId: undefined,
                              returnTo: "/group/$groupId",
                              returnParams: { groupId: groupId },
                            },
                          });
                        },
                        disabled: isProjectArchived,
                      },
                      {
                        label: "Create inspections\u2026",
                        value: "create-inspections",
                        iconClass: "bx bx-plus",
                        onSelect: () => {
                          if (!isProcoreConnected) {
                            toast.error("Project not connected to Procore.");
                            return;
                          }
                          if (selectedIds.size === 0) {
                            toast.error("Please select at least one QR code.");
                            return;
                          }
                          setBulkInspectionFromSelection(true);
                          setShowTemplateModal(true);
                        },
                        disabled: isProjectArchived || !isProcoreConnected,
                      },
                    ];
                    return (
                      <ItemComboBox
                        options={options}
                        menuZIndexClassName="z-50"
                        buttonVariant="secondary"
                        buttonContent={
                          <>
                            <img src={procoreIcon} className="h-4 w-4 mr-1.5" />
                            Procore
                            <i className="bx bx-chevron-down text-gray-400"></i>
                          </>
                        }
                        align="right"
                        menuWidthClassName="w-56"
                      />
                    );
                  })()}
                  {userCanDelete && (
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass="bx bxs-trash"
                      onClick={() => setShowBulkDeleteQrsModal(true)}
                      disabled={isProjectArchived}
                      title={
                        isProjectArchived
                          ? "This project has been archived"
                          : undefined
                      }
                    >
                      Delete
                    </Button>
                  )}
                </>
              }
            />
          ) : undefined
        }
        table={
          <>
            <div
              className={
                hasActiveCreationJob
                  ? "blur-sm pointer-events-none h-full"
                  : "h-full"
              }
            >
              <DataGrid
                key={groupId}
                items={pagedItems}
                loadingState={gridLoadingState}
                getItemId={(item) => (item as QRItem).id}
                getItemUrl={(item) => `/qrcode/${(item as QRItem).id}`}
                showSelection={bulkActions}
                isItemSelected={(item) => isRowSelected((item as QRItem).id)}
                onToggleItem={(item) => toggleRow((item as QRItem).id)}
                renderItem={() => null}
                onItemClick={(item) =>
                  navigate({
                    to: "/qrcode/$qrcodeId",
                    params: { qrcodeId: (item as QRItem).id },
                  })
                }
                mapItemToQrCard={(item) => ({
                  qrCodeId: (item as QRItem).id,
                  hasS3Image: Boolean((item as QRItem).hasS3),
                  qrImageSrc: (item as QRItem).image || "",
                  title: (item as QRItem).title,
                  type: (item as QRItem).type,
                  created: (item as QRItem).created,
                  scans: (item as QRItem).scans,
                  className: removingIds.has((item as QRItem).id)
                    ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
                    : "",
                  actions: (
                    <div className="flex justify-between items-center w-full">
                      <div>
                        {(item as QRItem).passwordActivated && (
                          <Button
                            type="button"
                            variant="iconGhost"
                            leftIconClass="bx bx-lock-alt text-yellow-500"
                            aria-label="Update password"
                            title={
                              isProjectArchived
                                ? "This project has been archived"
                                : "Update password"
                            }
                            disabled={isProjectArchived}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setQrPasswordTargetId((item as QRItem).id);
                              setShowQRPasswordModal(true);
                            }}
                          />
                        )}
                      </div>

                      <div>
                        <Button
                          type="button"
                          variant="iconGhost"
                          leftIconClass="bx bx-download"
                          aria-label="Download"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActionTargetId((item as QRItem).id);
                            setShowDownloadModal(true);
                          }}
                        />
                        <Button
                          type="button"
                          variant="iconGhost"
                          leftIconClass="bx bx-pencil"
                          aria-label="Edit"
                          disabled={isProjectArchived}
                          title={
                            isProjectArchived
                              ? "This project has been archived"
                              : undefined
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingItemId((item as QRItem).id);
                            setShowEditQrModal(true);
                          }}
                        />
                        {userCanDelete && (
                          <Button
                            type="button"
                            variant="iconDangerGhost"
                            leftIconClass="bx bx-trash"
                            aria-label="Delete"
                            disabled={isProjectArchived}
                            title={
                              isProjectArchived
                                ? "This project has been archived"
                                : undefined
                            }
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActionTargetId((item as QRItem).id);
                              setShowDeleteModal(true);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ),
                })}
                resultsStart={
                  (currentPage - 1) * itemsPerPage + (pagedItems.length ? 1 : 0)
                }
                resultsEnd={
                  (currentPage - 1) * itemsPerPage + pagedItems.length
                }
                resultsTotal={totalItems}
                currentPage={currentPage}
                pageCount={pageCount}
                onPageChange={(p) => setCurrentPage(p)}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(v) => {
                  setItemsPerPage(v);
                  setCurrentPage(1);
                }}
                itemsPerPageSelectId="group-detail-items-per-page"
                bodySkeletonSignal={bodySkeletonVersion}
              />
            </div>

            {/* Clean loading overlay when QR codes are being created */}
            {hasActiveCreationJob && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-8 py-6 max-w-md">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-yellow-500 rounded-full animate-spin" />
                    <div className="space-y-2">
                      <p className="text-base font-medium text-gray-900">
                        Creating QR codes...
                      </p>
                      <p className="text-sm text-gray-600">
                        Your QR codes will appear here once generation is
                        complete.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        }
      />
      <ProcoreTemplateModal
        open={showTemplateModal}
        companyId={String(user.companyId || "")}
        projectId={String(projectId || "")}
        onClose={() => setShowTemplateModal(false)}
        loading={bulkInspectionLoading}
        onConfirm={async (templateId) => {
          if (!groupDoc?._id || groupRes.error) {
            toast.error(
              "This group no longer exists. Please refresh the page.",
            );
            return;
          }

          setBulkInspectionLoading(true);
          try {
            const groupingId = groupId;
            if (!groupingId) {
              toast.error("Invalid group ID.");
              return;
            }

            const qrCodeIds = bulkInspectionFromSelection
              ? Array.from(selectedIds)
              : undefined;

            const res = await postProcoreCreateBulkInspectionsAsync({
              companyId: String(user.companyId || ""),
              projectId: String(projectId || ""),
              groupingId: groupingId,
              inspectionTemplateId: String(templateId),
              groupingType: isArrangement ? "arrangement" : "equipment",
              qrCodeIds,
            });

            const total = Number(res?.total ?? 0);
            if (!res?.jobId || total === 0) {
              toast(
                res?.message || "No QR codes were found for bulk inspections.",
              );
              return;
            }

            addJob({
              jobId: res.jobId,
              status: "pending",
              progress: 0,
              total,
              type: "bulk-procore-inspections-create",
              groupId: groupingId,
              groupName: groupName || "Procore Inspections",
            });

            toast.success(
              res.message || "Procore inspection creation started",
            );

            if (bulkInspectionFromSelection) {
              clearSelection();
            }
          } catch (err) {
            logProcoreError(err, "create-bulk-inspections", {
              groupId,
              projectId,
            });
            const maybeMessage = (
              err as { response?: { data?: { message?: string } } }
            )?.response?.data?.message;
            toast.error(
              typeof maybeMessage === "string"
                ? maybeMessage
                : "Failed to create Procore inspections. Please try again.",
            );
          } finally {
            setBulkInspectionLoading(false);
            setShowTemplateModal(false);
            setBulkInspectionFromSelection(false);
          }
        }}
      />
    </main>
  );
}
