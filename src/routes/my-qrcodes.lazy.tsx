import {
  createLazyFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import DataTable, { type Column } from "../components/table/DataTable";
import ListPageLayout from "../components/layout/ListPageLayout";
import FilterComboBox from "../components/combobox/detail/FilterComboBox";
import RowTypeIcon from "../components/ui/Icon";
import Badge from "../components/ui/Badge";
import {
  col,
  primaryCell,
  statusBadgeCell,
  dateCell,
  numberCell,
} from "../lib/columns";
import { computeTypeBadge, computeArrangementTypeVariant } from "../lib/badges";
import {
  deleteSingleQRCode,
  createBulkQRDeleteJob,
  updateQRCodeDetails,
  useListQRCodes,
  useSingleQRCode,
  bulkAssignQRCodesToGroup,
  bulkAssignQRCodesToProject,
  bulkSetQRCodePassword,
  QrKeys,
  fetchSignedUrl,
  fetchSignedUrlsBatch,
} from "../api/endpoints/qr-codes";
import { addJob } from "@/utils/localStorage-jobs";
import { queryClient } from "@/api";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { QRCode } from "../types";
import Button from "../components/ui/Button";
import ItemComboBox, {
  ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import EditModal, {
  type EditField,
} from "../components/modal/taliho/EditModal";
import DeleteModal from "../components/modal/taliho/DeleteModal";
import {
  useListProjects,
  useSingleProject,
  projectKeys,
} from "../api/endpoints/projects";
import { useCompany } from "../api/endpoints/company";
import { getStoredUser } from "@/utils/getStoredUser";
import toast from "react-hot-toast";
import PrintItemsModal from "../components/modal/taliho/PrintItemsModal";
import AssignToModal from "../components/modal/taliho/AssignToModal";
import CreateProjectModal from "../components/modal/taliho/CreateProjectModal";
import SetPasswordModal from "../components/modal/taliho/SetPasswordModal";
import { useDebounce } from "../utils/helpers/tableHelpers";
import BulkActionsBar from "@/components/table/BulkActionsBar";
import EmptyState from "@/components/ui/EmptyState";
import { createGroup, groupsKeys } from "../api/endpoints/groups";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { logQRError, logApiError } from "@/utils/rollbar";
import { canDelete, canModify } from "@/utils/permissions";
import type { QrCodesListResponse, Row } from "@/components/my-qrcodes/types";
import {
  useProjectStatusById,
  useBucketById,
  useProjectIdByName,
  useProjectArchivedMap,
  useApiRows,
  useFilteredRows,
} from "@/components/my-qrcodes/row-transforms";
import { useQRCodeGroupResolution } from "@/components/my-qrcodes/hooks/useQRCodeGroupResolution";
import { projectStatusBadgeVariant } from "@/utils/badge-helpers";

export const Route = createLazyFileRoute("/my-qrcodes")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = getStoredUser();
  const companyId = user?.companyId ?? "";
  const userCanDelete = canDelete(user);
  const userCanModify = canModify(user);
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/my-qrcodes" }) as
    | {
        q?: string;
        types?: string;
        groups?: string;
        projects?: string;
        sortKey?: string;
        sortDir?: "asc" | "desc";
        page?: string | number;
        perPage?: string | number;
      }
    | undefined;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [query, setQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [projectFilters, setProjectFilters] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  // Server-side sort state
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const initFromSearchRef = useRef<boolean>(false);

  // Initialize state from query params once (on first mount)
  useEffect(() => {
    if (initFromSearchRef.current) return;
    initFromSearchRef.current = true;
    const s = searchParams || {};
    if (typeof s.q === "string") setQuery(s.q);
    if (typeof s.types === "string" && s.types.length > 0)
      setTypeFilters(s.types.split(",").filter(Boolean));
    if (typeof s.groups === "string" && s.groups.length > 0)
      setGroupFilters(s.groups.split(",").filter(Boolean));
    if (typeof s.projects === "string" && s.projects.length > 0)
      setProjectFilters(s.projects.split(",").filter(Boolean));
    if (typeof s.sortKey === "string" && s.sortKey) setSortKey(s.sortKey);
    if (s.sortDir === "asc" || s.sortDir === "desc") setSortDir(s.sortDir);
    if (s.page && !Number.isNaN(Number(s.page))) setCurrentPage(Number(s.page));
    if (s.perPage && !Number.isNaN(Number(s.perPage)))
      setItemsPerPage(Number(s.perPage));
  }, [searchParams]);

  // Persist state to query params on changes
  useEffect(() => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (typeFilters.length) next.types = typeFilters.join(",");
    if (groupFilters.length) next.groups = groupFilters.join(",");
    if (projectFilters.length) next.projects = projectFilters.join(",");
    if (sortKey) next.sortKey = sortKey;
    if (sortDir) next.sortDir = sortDir;
    if (currentPage && currentPage !== 1) next.page = String(currentPage);
    if (itemsPerPage && itemsPerPage !== 10)
      next.perPage = String(itemsPerPage);
    navigate({ to: "/my-qrcodes", search: next, replace: true });
  }, [
    query,
    typeFilters,
    groupFilters,
    projectFilters,
    sortKey,
    sortDir,
    currentPage,
    itemsPerPage,
    navigate,
  ]);

  // Map UI filter values to backend type values and send to backend
  // "procore-drawings" UI value maps to "procore-drawing-codes" type
  const serverGroupingTypes = useMemo(() => {
    if (groupFilters.length === 0) return undefined;
    return groupFilters.map((v) =>
      v === "procore-drawings" ? "procore-drawing-codes" : v,
    );
  }, [groupFilters]);

  // Legacy single groupingType for backwards compatibility
  // Only used when exactly one type is selected
  const serverGroupingType = useMemo(() => {
    // If multiple filters selected, use groupingTypes array instead
    if (groupFilters.length !== 1) return undefined;
    const filter = groupFilters[0];
    // Map procore-drawings to procore-drawing-codes
    if (filter === "procore-drawings") return "procore-drawing-codes";
    return filter as "equipment" | "arrangement" | "none";
  }, [groupFilters]);

  // Row removal animation (UI-V3 style): rows in this set will fade then be removed after refetch
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Row name overrides (used by apiRows mapping)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {},
  );
  // Server query term (frozen during local search)
  const [serverQuery, setServerQuery] = useState<string | undefined>(
    debouncedQuery || undefined,
  );
  // Track the query when local mode was determined to prevent local filtering after edits (e.g., backspace)
  const localModeQueryRef = useRef<string | undefined>(undefined);

  // Compute project status filter: include archived when searching without explicit filter
  const computedProjectStatus = useMemo(() => {
    // If user explicitly selected project status filters, use those
    if (projectFilters.length) {
      return projectFilters;
    }
    // If searching without explicit filters, include all statuses to find QR codes from archived projects
    if (debouncedQuery && debouncedQuery.trim()) {
      return ["active", "completed", "on-hold", "archived", "unassigned"];
    }
    // No search, no filters: exclude archived but include unassigned
    return ["active", "completed", "on-hold", "unassigned"];
  }, [projectFilters, debouncedQuery]);

  const qrCodesQuery = useListQRCodes({
    companyId: companyId,
    per_page: itemsPerPage,
    current_page: currentPage,
    search: serverQuery,
    groupingType: serverGroupingType,
    groupingTypes: serverGroupingTypes,
    projectStatus: computedProjectStatus,
    types: typeFilters.length ? typeFilters : undefined,
    sortBy: sortKey === "group" ? "group" : sortKey,
    sortDir: sortDir,
  });
  const { data: QrCodesData, isLoading, refetch } = qrCodesQuery;
  const qrLoadingState = useTableLoadingState(qrCodesQuery);

  const useLocalSearch = useMemo(() => {
    const meta = QrCodesData as QrCodesListResponse | undefined;
    const total = Number(meta?.total_items ?? 0);
    const hasNext = Boolean(meta?.has_next);
    const hasPrev = Boolean(meta?.has_prev);
    return (
      currentPage === 1 &&
      !hasPrev &&
      !hasNext &&
      total > 0 &&
      total <= itemsPerPage
    );
  }, [QrCodesData, currentPage, itemsPerPage]);

  useEffect(() => {
    setServerQuery(debouncedQuery || undefined);
  }, [debouncedQuery]);

  useEffect(() => {
    if (useLocalSearch) {
      localModeQueryRef.current = debouncedQuery || undefined;
    } else {
      localModeQueryRef.current = undefined;
    }
  }, [useLocalSearch, debouncedQuery]);

  // Fetch projects (paginated) to determine archived status for coloring
  const { data: allProjectsResponse } = useListProjects({
    companyId: companyId,
    page: 1,
    perPage: 200, // Reasonable limit for filter/status lookups
    sortKey: "projectName",
    sortDir: "asc",
  });
  const allProjectsRes = { data: allProjectsResponse?.data ?? [] };
  const companyRes = useCompany(companyId);
  const projectArchivedMap = useProjectArchivedMap(allProjectsRes.data ?? []);
  const projectStatusById = useProjectStatusById(allProjectsRes.data ?? []);
  const bucketById = useBucketById(
    QrCodesData as QrCodesListResponse | undefined,
  );
  const projectIdByName = useProjectIdByName(allProjectsRes.data ?? []);

  // Resolve group names, types, and IDs from QR code data
  const {
    arrangementNameById,
    arrangementTypeById,
    equipmentNameById,
    groupNameById,
    groupsData,
  } = useQRCodeGroupResolution(
    companyId,
    QrCodesData as QrCodesListResponse | undefined,
  );

  const apiRows: Row[] = useApiRows({
    qrCodesData: QrCodesData as QrCodesListResponse | undefined,
    arrangementNameById,
    arrangementTypeById,
    equipmentNameById,
    groupNameById,
    nameOverrides,
  });

  // Client-side filtering on the currently loaded page (hybrid search)
  const rows = useFilteredRows({
    apiRows,
    projectFilters,
    useLocalSearch,
    localModeQuery: localModeQueryRef.current,
    debouncedQuery,
    sortKey,
    qrCodesData: QrCodesData as QrCodesListResponse | undefined,
    projectStatusById,
    projectArchivedMap,
    projectIdByName,
    bucketById,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  // Fetch full QR code details for the edit modal (includes description)
  const { data: editQrCodeData } = useSingleQRCode(editRow?.id ?? "");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showGroupDeleteModal, setShowGroupDeleteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTargetId, setPrintTargetId] = useState<string | null>(null);
  const [showMoveToGroupModal, setShowMoveToGroupModal] = useState(false);
  const [isMovingToGroup, setIsMovingToGroup] = useState(false);
  const [showMoveToProjectModal, setShowMoveToProjectModal] = useState(false);
  const [isMovingToProject, setIsMovingToProject] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  // Single row action targets for move operations
  const [moveToGroupTargetId, setMoveToGroupTargetId] = useState<string | null>(
    null,
  );
  const [moveToProjectTargetId, setMoveToProjectTargetId] = useState<
    string | null
  >(null);

  // Look up existing password data for single QR code targets
  const passwordTargetData = useMemo(() => {
    if (!passwordTargetId) return undefined;
    const list = (QrCodesData as QrCodesListResponse | undefined)?.data as
      | QRCode[]
      | undefined;
    return list?.find((q) => q._id === passwordTargetId);
  }, [passwordTargetId, QrCodesData]);

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  // Signed URLs for print modal images
  const [signedUrls, setSignedUrls] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [isFetchingSignedUrls, setIsFetchingSignedUrls] = useState(false);

  // Check if all selected QR codes are unassigned (no group)
  const allSelectedAreUnassigned = useMemo(() => {
    if (selectedIds.size === 0) return false;
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    return selectedRows.every((r) => r.groupType === "none" && !r.group);
  }, [selectedIds, rows]);

  // Get count of selected QR codes that are already assigned to a group
  const assignedSelectedCount = useMemo(() => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    return selectedRows.filter((r) => r.groupType !== "none" || r.group).length;
  }, [selectedIds, rows]);

  // Check if all selected QR codes are from the same project and get that project ID
  const selectedProjectInfo = useMemo(() => {
    if (selectedIds.size === 0)
      return { sameProject: false, projectId: undefined };
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    const projectIds = new Set(
      selectedRows.map((r) => r.projectId).filter(Boolean),
    );
    if (projectIds.size === 1) {
      return { sameProject: true, projectId: Array.from(projectIds)[0] };
    }
    return { sameProject: false, projectId: undefined };
  }, [selectedIds, rows]);

  // Get project ID for single row move to group action
  const singleRowMoveToGroupProjectId = useMemo(() => {
    if (!moveToGroupTargetId) return undefined;
    const row = rows.find((r) => r.id === moveToGroupTargetId);
    return row?.projectId;
  }, [moveToGroupTargetId, rows]);

  // Map groups data for the AssignToModal options - filtered by selected project or single row project
  const groupOptions = useMemo(() => {
    const groups = groupsData?.data ?? [];
    // For single row action, use that row's project; for bulk, use selected project
    const projectIdFilter =
      singleRowMoveToGroupProjectId || selectedProjectInfo.projectId;
    const filtered = projectIdFilter
      ? groups.filter((g) => g.project === projectIdFilter)
      : groups;
    return filtered.map((g) => ({
      id: g._id,
      name:
        g.groupName || g.arrangementName || g.equipmentName || "Unnamed Group",
    }));
  }, [
    groupsData,
    selectedProjectInfo.projectId,
    singleRowMoveToGroupProjectId,
  ]);

  // Check if all selected QR codes have no project assigned
  const allSelectedHaveNoProject = useMemo(() => {
    if (selectedIds.size === 0) return false;
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    return selectedRows.every((r) => !r.projectId);
  }, [selectedIds, rows]);

  // Check if any selected QR codes have no project assigned
  const anySelectedHasNoProject = useMemo(() => {
    if (selectedIds.size === 0) return false;
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    return selectedRows.some((r) => !r.projectId);
  }, [selectedIds, rows]);

  // Get count of selected QR codes that already have a project
  const projectAssignedSelectedCount = useMemo(() => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id));
    return selectedRows.filter((r) => r.projectId).length;
  }, [selectedIds, rows]);

  // Map projects data for the AssignToModal options (active projects only)
  const projectOptions = useMemo(() => {
    const projects = allProjectsRes.data ?? [];
    return projects
      .filter((p) => !p.archived)
      .map((p) => ({
        id: p._id,
        name: p.name || p.projectName || "Unnamed Project",
      }));
  }, [allProjectsRes.data]);

  // Build print items from selected QR codes using signed URLs
  const printItems = useMemo(() => {
    const idsToPrint = printTargetId
      ? [printTargetId]
      : Array.from(selectedIds);
    if (idsToPrint.length === 0) return [];

    const qrCodes = (QrCodesData?.data ?? []) as Array<{
      _id: string;
      qrcodeName?: string;
      qrImageUrl?: string;
      qrimage?: string;
    }>;

    return idsToPrint
      .map((id) => {
        const qr = qrCodes.find((q) => q._id === id);
        if (!qr) return null;

        // Build SVG data URL fallback if available
        const svgFallback = qr.qrimage
          ? `data:image/svg+xml;base64,${btoa(String(qr.qrimage))}`
          : undefined;

        // Priority: 1. Signed URL, 2. Base64 SVG, 3. Empty string
        let imgSrc = "";
        const signedUrl = signedUrls.get(id);
        if (signedUrl) {
          imgSrc = signedUrl;
        } else if (svgFallback) {
          imgSrc = svgFallback;
        }

        return {
          name: qr.qrcodeName || "QR Code",
          imgSrc,
          // Provide SVG as fallback when using signed URL as primary
          fallbackSrc: signedUrl && svgFallback ? svgFallback : undefined,
          // Pass QR code ID for refetch capability on image load failure
          qrCodeId: id,
        };
      })
      .filter(
        (
          item,
        ): item is {
          name: string;
          imgSrc: string;
          fallbackSrc: string | undefined;
          qrCodeId: string;
        } => item !== null,
      );
  }, [printTargetId, selectedIds, QrCodesData?.data, signedUrls]);

  // Compute print header info from selected QR codes' project/group data
  const printHeaderInfo = useMemo(() => {
    const idsToPrint = printTargetId
      ? [printTargetId]
      : Array.from(selectedIds);
    if (idsToPrint.length === 0)
      return {
        projectLine: undefined,
        clientName: undefined,
        addressLine: undefined,
        groupLine: undefined,
      };

    const selectedRows = rows.filter((r) => idsToPrint.includes(r.id));

    // Check if all selected QR codes share the same project
    const projectIds = [
      ...new Set(selectedRows.map((r) => r.projectId).filter(Boolean)),
    ];
    let projectLine: string | undefined;
    let clientName: string | undefined;
    let addressLine: string | undefined;

    if (projectIds.length === 1) {
      const projects = allProjectsRes.data ?? [];
      const project = projects.find((p) => p._id === projectIds[0]);
      if (project) {
        projectLine = project.projectName || project.name || "";
        clientName = project.clientName || "";
        const parts = [
          project.projectAddress,
          project.projectCity,
          project.projectState
            ? `${project.projectState} ${project.projectZIP || ""}`.trim()
            : project.projectZIP,
        ].filter(Boolean);
        addressLine = parts.length > 0 ? parts.join(", ") : undefined;
      }
    }

    // Check if all selected QR codes share the same group
    const groupIds = [
      ...new Set(selectedRows.map((r) => r.groupId).filter(Boolean)),
    ];
    const groupLine =
      groupIds.length === 1
        ? selectedRows.find((r) => r.groupId === groupIds[0])?.group
        : undefined;

    return { projectLine, clientName, addressLine, groupLine };
  }, [printTargetId, selectedIds, rows, allProjectsRes.data]);

  // Computed disabled state and tooltip for "Move to Group" button
  const moveToGroupDisabled = useMemo(() => {
    if (selectedIds.size === 0) return true;
    if (isMovingToGroup) return true;
    if (!allSelectedAreUnassigned) return true;
    if (anySelectedHasNoProject) return true;
    if (!selectedProjectInfo.sameProject) return true;
    return false;
  }, [
    selectedIds.size,
    isMovingToGroup,
    allSelectedAreUnassigned,
    anySelectedHasNoProject,
    selectedProjectInfo.sameProject,
  ]);

  const moveToGroupDisabledReason = useMemo(() => {
    if (selectedIds.size === 0) return "";
    if (!allSelectedAreUnassigned)
      return "Some selected QR codes are already in a group.";
    if (anySelectedHasNoProject)
      return "QR codes must be assigned to a project before they can be moved to a group.";
    if (!selectedProjectInfo.sameProject)
      return "All selected QR codes must belong to the same project to move to a group.";
    return "";
  }, [
    selectedIds.size,
    allSelectedAreUnassigned,
    anySelectedHasNoProject,
    selectedProjectInfo.sameProject,
  ]);

  // Computed disabled state and tooltip for "Move to Project" button
  const moveToProjectDisabled = useMemo(() => {
    if (selectedIds.size === 0) return true;
    if (isMovingToProject) return true;
    if (!allSelectedHaveNoProject) return true;
    return false;
  }, [selectedIds.size, isMovingToProject, allSelectedHaveNoProject]);

  const moveToProjectDisabledReason = useMemo(() => {
    if (selectedIds.size === 0) return "";
    if (!allSelectedHaveNoProject)
      return "Some selected QR codes already have a project.";
    return "";
  }, [selectedIds.size, allSelectedHaveNoProject]);

  // Helper function to open print modal with signed URLs
  const handleOpenPrintModal = useCallback(
    async (targetId: string | null) => {
      setPrintTargetId(targetId);

      // Determine which QR codes need signed URLs
      const idsToPrint = targetId ? [targetId] : Array.from(selectedIds);
      if (idsToPrint.length === 0) {
        setShowPrintModal(true);
        return;
      }

      // Get QR code data to check which ones have S3 images
      const qrCodes = (QrCodesData?.data ?? []) as Array<{
        _id: string;
        qrImageUrl?: string;
        qrimage?: string;
      }>;

      // Filter to only fetch signed URLs for QR codes with S3 images
      const idsNeedingSignedUrls = idsToPrint.filter((id) => {
        const qr = qrCodes.find((q) => q._id === id);
        return qr?.qrImageUrl && !signedUrls.has(id);
      });

      if (idsNeedingSignedUrls.length === 0) {
        // All images are either base64 or already have signed URLs
        setShowPrintModal(true);
        return;
      }

      // Fetch signed URLs
      setIsFetchingSignedUrls(true);
      try {
        const urls = await fetchSignedUrlsBatch(idsNeedingSignedUrls);
        setSignedUrls((prev) => {
          const next = new Map(prev);
          urls.forEach((url, id) => {
            if (url) next.set(id, url);
          });
          return next;
        });
      } catch (e) {
        logApiError(e, "print-url-fetch-failed", {
          companyId: companyId,
          qrcodeCount: idsNeedingSignedUrls.length,
        });
        if (import.meta.env.DEV) {
          console.error("Failed to fetch signed URLs for print", e);
        }
        // Continue anyway - the modal will show errors for failed images
      } finally {
        setIsFetchingSignedUrls(false);
        setShowPrintModal(true);
      }
    },
    [selectedIds, QrCodesData?.data, signedUrls, companyId],
  );

  const deleteSingleQRCallback = async (
    companyId: string,
    qrcodeId: string,
  ) => {
    try {
      await deleteSingleQRCode(companyId, qrcodeId);
    } catch (error: unknown) {
      logQRError(error, "qr-delete-failed", qrcodeId, { companyId });
      if (import.meta.env.DEV) {
        console.error(`Error deleting equipment with ID ${qrcodeId}:`, error);
      }
      throw error;
    }
  };

  async function handleMoveToGroup(groupId: string) {
    // Determine if this is a single row action or bulk action
    const isSingleRow = moveToGroupTargetId !== null;
    const ids = isSingleRow ? [moveToGroupTargetId] : Array.from(selectedIds);

    if (ids.length === 0) return;

    // For bulk actions, validate all selected are unassigned
    if (!isSingleRow && !allSelectedAreUnassigned) {
      toast.error(
        `${assignedSelectedCount} of the selected QR codes are already assigned to a group. Only unassigned QR codes can be moved using the My QR Codes page.`,
      );
      return;
    }

    // Get project ID - for single row, use that row's project; for bulk, use selected project
    const projectId = isSingleRow
      ? singleRowMoveToGroupProjectId
      : selectedProjectInfo.projectId;

    // Validate project requirement
    if (!projectId) {
      toast.error("QR codes must belong to a project to be moved to a group.");
      return;
    }

    // For bulk actions, validate all selected QR codes are from the same project
    if (!isSingleRow && !selectedProjectInfo.sameProject) {
      toast.error(
        "Selected QR codes must belong to the same project to be moved to a group.",
      );
      return;
    }

    try {
      setIsMovingToGroup(true);

      const result = await bulkAssignQRCodesToGroup(
        ids,
        groupId,
        "group",
        companyId,
        projectId,
      );

      if (result.success) {
        toast.success(
          `Moved ${ids.length} QR code${ids.length === 1 ? "" : "s"} to group`,
        );
        setSelectedIds(new Set());
        setShowMoveToGroupModal(false);
        setMoveToGroupTargetId(null);
        setGroupMode(false);
        void refetch?.();
        void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
      } else {
        toast.error(result.message || "Failed to move QR codes to group");
      }
    } catch (e: unknown) {
      logQRError(e, "qr-move-to-group-failed", undefined, {
        companyId: companyId,
        qrcodeCount: ids.length,
        groupId,
      });
      if (import.meta.env.DEV) {
        console.error("Failed to move QR codes to group", e);
      }
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to move QR codes to group",
      );
    } finally {
      setIsMovingToGroup(false);
    }
  }

  async function handleMoveToProject(projectId: string) {
    // Determine if this is a single row action or bulk action
    const isSingleRow = moveToProjectTargetId !== null;
    const ids = isSingleRow ? [moveToProjectTargetId] : Array.from(selectedIds);

    if (ids.length === 0) return;

    // For bulk actions, validate all selected have no project
    if (!isSingleRow && !allSelectedHaveNoProject) {
      toast.error(
        `${projectAssignedSelectedCount} of the selected QR codes are already assigned to a project. Only unassigned QR codes can be moved.`,
      );
      return;
    }

    try {
      setIsMovingToProject(true);

      const result = await bulkAssignQRCodesToProject(
        ids,
        projectId,
        companyId,
      );

      if (result.success) {
        toast.success(
          `Moved ${ids.length} QR code${ids.length === 1 ? "" : "s"} to project`,
        );
        setSelectedIds(new Set());
        setShowMoveToProjectModal(false);
        setMoveToProjectTargetId(null);
        setGroupMode(false);
        void refetch?.();
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      } else {
        toast.error(result.message || "Failed to move QR codes to project");
      }
    } catch (e: unknown) {
      logQRError(e, "qr-move-to-project-failed", undefined, {
        companyId: companyId,
        qrcodeCount: ids.length,
        projectId,
      });
      if (import.meta.env.DEV) {
        console.error("Failed to move QR codes to project", e);
      }
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to move QR codes to project",
      );
    } finally {
      setIsMovingToProject(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      // Immediate fade-out for all rows to avoid jarring gaps
      setRemovingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });

      const { jobId } = await createBulkQRDeleteJob(companyId, ids);
      addJob({
        jobId,
        status: "pending",
        progress: 0,
        total: ids.length,
        type: "bulk-qr-delete",
      });

      setSelectedIds(new Set());
      setGroupMode(false);
      toast.success("Deletion started");

      // Clear removing animation after brief delay
      window.setTimeout(() => {
        setRemovingIds(new Set());
      }, 300);
    } catch (e: unknown) {
      // Clear removing animation on error
      setRemovingIds(new Set());
      logQRError(e, "qr-bulk-delete-failed", undefined, {
        companyId: companyId,
        qrcodeCount: selectedIds.size,
      });
      if (import.meta.env.DEV) {
        console.error("Failed to delete selected QR codes", e);
      }
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete selected QR codes",
      );
    }
  }

  function ProjectBadgeCell({
    projectId,
    fallbackName,
    rowId,
    onAssign,
  }: {
    projectId?: string;
    fallbackName?: string;
    rowId?: string;
    onAssign?: (rowId: string) => void;
  }) {
    const { data: projectRes } = useSingleProject(companyId, projectId ?? "");
    if (!projectId) {
      // If onAssign is provided and we have a rowId, make the badge clickable
      if (onAssign && rowId) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(rowId);
            }}
            className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
          >
            <Badge
              variant={"gray" as Parameters<typeof Badge>[0]["variant"]}
              shape="md"
            >
              {fallbackName || "[UNASSIGNED]"}
            </Badge>
          </button>
        );
      }
      return (
        <Badge
          variant={"gray" as Parameters<typeof Badge>[0]["variant"]}
          shape="md"
        >
          {fallbackName || "[UNASSIGNED]"}
        </Badge>
      );
    }
    const status = projectId
      ? (projectStatusById.get(projectId) ?? "active")
      : "none";
    const variant = projectStatusBadgeVariant(status) as Parameters<
      typeof Badge
    >[0]["variant"];
    const label =
      (projectRes as unknown as { data?: { projectName?: string } })?.data
        ?.projectName ||
      fallbackName ||
      "[UNASSIGNED]";
    return (
      <a
        href={`/project/${projectId}`}
        className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <Badge variant={variant} shape="md">
          {label}
        </Badge>
      </a>
    );
  }

  const columns: Column<Row>[] = useMemo(
    () => [
      col({
        key: "name",
        header: "NAME",
        sortable: true,
        getSortValue: (row) => row.name,
        ...primaryCell((row) => (
          <div className="flex items-center">
            <div className="mr-3">
              <RowTypeIcon
                type={
                  (row.type as unknown as
                    | "file"
                    | "folder"
                    | "url"
                    | "static"
                    | "procore"
                    | "procore-tool"
                    | "procore-location"
                    | "procore-drawing-code") ?? "file"
                }
              />
            </div>
            <span className="font-medium text-indigo-700">{row.name}</span>
          </div>
        )),
      }),
      col({
        key: "type",
        header: "QR TYPE",
        sortable: true,
        getSortValue: (row) => row.type,
        ...statusBadgeCell((row) => {
          const t = computeTypeBadge(String(row.type));
          const v = (t?.variant ?? "gray") as Parameters<
            typeof Badge
          >[0]["variant"];
          return { label: t?.label ?? String(row.type), variant: v };
        }),
      }),
      col({
        key: "group",
        header: "GROUP",
        sortable: true,
        columnType: "group",
        render: (row) => {
          let variant: Parameters<typeof Badge>[0]["variant"] = "gray";
          if (row.groupType === "equipment") variant = "red";
          else if (row.groupType === "arrangement")
            variant =
              computeArrangementTypeVariant(row.groupArrangementType) ?? "blue";
          const badge = (
            <Badge variant={variant} shape="md">
              {row.group || "[UNASSIGNED]"}
            </Badge>
          );
          if (row.groupId) {
            return (
              <a
                href={`/group/${row.groupId}`}
                className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {badge}
              </a>
            );
          }
          // If no group but has project, make badge clickable to assign to group
          if (row.projectId && !row.group) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveToGroupTargetId(row.id);
                  setShowMoveToGroupModal(true);
                }}
                className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
              >
                {badge}
              </button>
            );
          }
          return badge;
        },
      }),
      col({
        key: "project",
        header: "PROJECT",
        sortable: true,
        columnType: "project",
        getSortValue: (row) => row.project,
        render: (row) => {
          const list =
            (QrCodesData as QrCodesListResponse | undefined)?.data ?? [];
          const q = list.find((x) => x._id === row.id);
          const projectId = q?.project as string | undefined;
          return (
            <ProjectBadgeCell
              projectId={projectId}
              fallbackName={row.project}
              rowId={row.id}
              onAssign={(rowId) => {
                setMoveToProjectTargetId(rowId);
                setShowMoveToProjectModal(true);
              }}
            />
          );
        },
      }),
      col({
        key: "createdAt",
        header: "DATE CREATED",
        sortable: true,
        ...dateCell((row) => row.createdAt),
      }),
      col({
        key: "scans",
        header: "SCANS",
        sortable: true,
        ...numberCell((row) => row.scans),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [QrCodesData?.data, projectArchivedMap],
  );

  const renderActions = useCallback(
    (row: Row) => {
      // Determine if row can be moved to project (no project assigned)
      const canMoveToProject = !row.projectId;
      // Determine if row can be moved to group (has project, no group)
      const canMoveToGroup =
        row.projectId && row.groupType === "none" && !row.group;

      const options: ItemComboBoxOption[] = [
        {
          label: "Edit",
          value: "edit",
          iconClass: "bx bx-pencil",
          onSelect: () => {
            setEditRow(row);
            setShowEditModal(true);
          },
        },
        {
          label: "Print",
          value: "print",
          iconClass: "bx bx-printer",
          onSelect: () => {
            void handleOpenPrintModal(row.id);
          },
        },
        // Move to Project - only show if QR code has no project
        ...(userCanModify && canMoveToProject
          ? [
              {
                label: "Move to Project",
                value: "move-to-project",
                iconClass: "bx bx-folder",
                onSelect: () => {
                  setMoveToProjectTargetId(row.id);
                  setShowMoveToProjectModal(true);
                },
              },
            ]
          : []),
        // Move to Group - only show if QR code has project but no group
        ...(userCanModify && canMoveToGroup
          ? [
              {
                label: "Move to Group",
                value: "move-to-group",
                iconClass: "bx bx-folder-plus",
                onSelect: () => {
                  setMoveToGroupTargetId(row.id);
                  setShowMoveToGroupModal(true);
                },
              },
            ]
          : []),
        // Only show set password option for admin/PM users
        ...(userCanModify
          ? [
              {
                label: "Set Password",
                value: "set-password",
                iconClass: "bx bx-lock-alt",
                onSelect: () => {
                  setPasswordTargetId(row.id);
                  setShowSetPasswordModal(true);
                },
              },
            ]
          : []),
        // Only show delete option for admin users
        ...(userCanDelete
          ? [
              {
                label: "Delete",
                value: "delete",
                iconClass: "bx bx-trash",
                onSelect: () => {
                  setDeleteTargetId(row.id);
                  setShowDeleteModal(true);
                },
              },
            ]
          : []),
      ];

      return (
        <div
          className="relative inline-block text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <ItemComboBox
            options={options}
            sourceId={`my-qrcodes-actions-${row.id}`}
          />
        </div>
      );
    },
    [handleOpenPrintModal, userCanDelete, userCanModify],
  );

  const toggleRow = useCallback((row: Row) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }, []);

  const sortStateObj = useMemo(
    () => ({ key: sortKey, dir: sortDir }),
    [sortKey, sortDir],
  );

  const handleSortChange = useCallback((key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((p: number) => {
    setCurrentPage(p);
  }, []);

  const handleItemsPerPageChange = useCallback((v: number) => {
    setItemsPerPage(v);
    setCurrentPage(1);
  }, []);

  const getRowClassNameMemo = useCallback(
    (row: Row) =>
      removingIds.has(row.id)
        ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
        : "",
    [removingIds],
  );

  const handleRowClick = useCallback(
    (row: Row) => {
      navigate({
        to: "/qrcode/$qrcodeId",
        params: { qrcodeId: row.id },
      });
    },
    [navigate],
  );

  const hasSearchOrFilters = useMemo(() => {
    return (
      debouncedQuery.trim() !== "" ||
      typeFilters.length > 0 ||
      groupFilters.length > 0 ||
      projectFilters.length > 0
    );
  }, [debouncedQuery, typeFilters, groupFilters, projectFilters]);

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <ListPageLayout
        title="My QR Codes"
        titleIconClass="bx bx-qr-scan text-purple-600"
        subtitle="View, search, and manage all QR codes with their content, group assignments, and project details."
        onResetPage={() => setCurrentPage(1)}
        activeFilters={{
          search: debouncedQuery || "",
          groupingType: serverGroupingType || "",
          groupingTypes: serverGroupingTypes || [],
          types: typeFilters,
        }}
        headerActions={
          <>
            <Button
              variant="secondary"
              leftIconClass={
                groupMode
                  ? "bx bx-x text-gray-500"
                  : "bx bx-grid-alt text-gray-500"
              }
              onClick={() =>
                setGroupMode((prev) => {
                  if (prev) setSelectedIds(new Set());
                  return !prev;
                })
              }
            >
              {groupMode ? "Cancel" : "Bulk Actions"}
            </Button>
            {userCanModify && (
              <Link to={"/create-qr"}>
                <Button variant="primary">
                  {/* <i className="bx bx-qr" /> */}
                  Create QR Code
                </Button>
              </Link>
            )}
          </>
        }
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Search QR codes...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Type"
              options={[
                { label: "File", value: "file" },
                { label: "Taliho", value: "folder" },
                { label: "URL", value: "url" },
                { label: "Static", value: "static" },
                { label: "Procore Tool", value: "procore-tool" },
                { label: "Procore Location", value: "procore-location" },
                {
                  label: "Procore Drawing",
                  value: "procore-drawing-code",
                },
              ]}
              value={typeFilters}
              onChange={(next) => setTypeFilters(next as string[])}
            />
            <FilterComboBox
              multiple
              placeholder="Group"
              options={[
                { label: "Arrangement", value: "arrangement" },
                { label: "Equipment", value: "equipment" },
                { label: "Procore Drawings", value: "procore-drawings" },
                { label: "Unassigned", value: "none" },
              ]}
              value={groupFilters}
              onChange={(next) => setGroupFilters(next as string[])}
            />
            <FilterComboBox
              multiple
              placeholder="Project"
              options={[
                { label: "Active", value: "active" },
                { label: "Completed", value: "completed" },
                { label: "On Hold", value: "on-hold" },
                { label: "Archived", value: "archived" },
                { label: "Unassigned", value: "unassigned" },
              ]}
              value={projectFilters}
              onChange={(next) => setProjectFilters(next as string[])}
            />
            <Button
              type="button"
              variant="clear"
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5 "
              onClick={() => {
                setTypeFilters([]);
                setGroupFilters([]);
                setProjectFilters([]);
                setQuery("");
                setCurrentPage(1);
                setSelectedIds(new Set());
              }}
            >
              Clear Filters
            </Button>
          </>
        }
        bulkActionsBar={
          groupMode ? (
            <BulkActionsBar
              selectedCount={selectedIds.size}
              showSelectAll
              selectAllChecked={false}
              onClearSelection={() => setSelectedIds(new Set())}
              actions={
                <>
                  {userCanModify && (
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass={
                        isMovingToGroup
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-folder-plus"
                      }
                      onClick={() => setShowMoveToGroupModal(true)}
                      disabled={moveToGroupDisabled}
                      rightIcon={
                        moveToGroupDisabled && moveToGroupDisabledReason ? (
                          <InfoTooltip
                            content={moveToGroupDisabledReason}
                            position="top"
                          />
                        ) : undefined
                      }
                    >
                      {isMovingToGroup ? "Moving..." : `Move to Group`}
                    </Button>
                  )}
                  {userCanModify && (
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass={
                        isMovingToProject
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-folder"
                      }
                      onClick={() => setShowMoveToProjectModal(true)}
                      disabled={moveToProjectDisabled}
                      rightIcon={
                        moveToProjectDisabled && moveToProjectDisabledReason ? (
                          <InfoTooltip
                            content={moveToProjectDisabledReason}
                            position="top"
                          />
                        ) : undefined
                      }
                    >
                      {isMovingToProject ? "Moving..." : "Move to Project"}
                    </Button>
                  )}
                  {userCanModify && (
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass={
                        isSettingPassword
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-lock-alt"
                      }
                      onClick={() => setShowSetPasswordModal(true)}
                      disabled={selectedIds.size === 0 || isSettingPassword}
                    >
                      {isSettingPassword ? "Setting..." : "Set Password"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass={
                      isFetchingSignedUrls
                        ? "bx bx-loader-alt animate-spin"
                        : "bx bx-printer"
                    }
                    onClick={() => {
                      void handleOpenPrintModal(null);
                    }}
                    disabled={selectedIds.size === 0 || isFetchingSignedUrls}
                  >
                    {isFetchingSignedUrls ? "Loading..." : "Print"}
                  </Button>
                  {userCanDelete && (
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass="bx bx-trash"
                      onClick={() => setShowGroupDeleteModal(true)}
                    >
                      Delete
                    </Button>
                  )}
                </>
              }
              moreOptions={[
                // Only show move/set password options for admin/PM users
                ...(userCanModify
                  ? [
                      {
                        label: isMovingToGroup ? "Moving..." : "Move to Group",
                        value: "move-to-group",
                        iconClass: isMovingToGroup
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-folder-plus",
                        disabled: moveToGroupDisabled,
                        onSelect: () => {
                          if (!moveToGroupDisabled) {
                            setShowMoveToGroupModal(true);
                          }
                        },
                      },
                      {
                        label: isMovingToProject
                          ? "Moving..."
                          : "Move to Project",
                        value: "move-to-project",
                        iconClass: isMovingToProject
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-folder",
                        disabled: moveToProjectDisabled,
                        onSelect: () => {
                          if (!moveToProjectDisabled) {
                            setShowMoveToProjectModal(true);
                          }
                        },
                      },
                    ]
                  : []),
                {
                  label: isFetchingSignedUrls ? "Loading..." : "Print",
                  value: "print",
                  iconClass: isFetchingSignedUrls
                    ? "bx bx-loader-alt animate-spin"
                    : "bx bx-printer",
                  disabled: isFetchingSignedUrls,
                  onSelect: () => {
                    void handleOpenPrintModal(null);
                  },
                },
                // Only show set password option for admin/PM users
                ...(userCanModify
                  ? [
                      {
                        label: isSettingPassword
                          ? "Setting..."
                          : "Set Password",
                        value: "set-password",
                        iconClass: isSettingPassword
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-lock-alt",
                        disabled: isSettingPassword,
                        onSelect: () => {
                          setShowSetPasswordModal(true);
                        },
                      },
                    ]
                  : []),
                // Only show delete option for admin users
                ...(userCanDelete
                  ? [
                      {
                        label: "Delete",
                        value: "delete",
                        iconClass: "bx bx-trash",
                        onSelect: () => {
                          setShowGroupDeleteModal(true);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          ) : null
        }
        table={
          <>
            {rows.length === 0 && !isLoading ? (
              <EmptyState
                icon={<i className="bx bx-qr text-blue-500 text-2xl" />}
                title={
                  hasSearchOrFilters ? "No QR Codes found" : "No QR Codes yet"
                }
                description={
                  hasSearchOrFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Create your first QR code to start tracking your equipment and locations."
                }
                actionLabel={hasSearchOrFilters ? undefined : "Create QR Code"}
                actionTo={hasSearchOrFilters ? undefined : "/create-qr"}
                iconBgClass="bg-blue-50"
                compact
                className="h-full min-h-[400px]"
              />
            ) : (
              <DataTable<Row>
                columns={columns}
                rows={rows}
                getRowId={(r) => r.id}
                loadingState={qrLoadingState}
                renderActions={renderActions}
                getRowClassName={getRowClassNameMemo}
                onRowClick={handleRowClick}
                getRowUrl={(r) => `/qrcode/${r.id}`}
                serverSide={true}
                serverSideSort={true}
                sortState={sortStateObj}
                onSortChange={handleSortChange}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalItems={
                  useLocalSearch
                    ? (rows?.length ?? 0)
                    : Number(QrCodesData?.total_items ?? rows?.length ?? 0)
                }
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                searchText={query}
                showSelection={groupMode}
                isRowSelected={(row) => selectedIds.has(row.id)}
                onToggleRow={toggleRow}
              />
            )}
            <EditModal
              open={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setEditRow(null);
              }}
              title="Edit QR Code"
              subtitle={<span>Update your QR code details.</span>}
              fields={
                [
                  {
                    key: "name",
                    label: "Name",
                    type: "text",
                    required: true,
                    placeholder: "Enter QR code name",
                    initialValue: editRow?.name ?? "",
                  },
                  {
                    key: "description",
                    label: "Description",
                    type: "textarea",
                    placeholder: "(Optional)",
                    initialValue: editQrCodeData?.data?.description ?? "",
                  },
                ] as EditField[]
              }
              onConfirm={async (values) => {
                if (editRow) {
                  try {
                    const list =
                      (QrCodesData as QrCodesListResponse | undefined)?.data ??
                      [];
                    const projId =
                      list.find((q) => q._id === editRow.id)?.project ??
                      undefined;
                    await updateQRCodeDetails(editRow.id, {
                      qrcodeName: values.name,
                      description: values.description,
                      companyId: companyId,
                      projectId: projId,
                    });
                    setNameOverrides((prev) => ({
                      ...prev,
                      [editRow.id]: values.name,
                    }));
                    // Invalidate the single QR code cache to ensure fresh data on next modal open
                    void queryClient.invalidateQueries({
                      queryKey: QrKeys.single(editRow.id),
                    });
                    void refetch?.();
                    void queryClient.invalidateQueries({
                      queryKey: ["Aggregation", "project-qrcodes"],
                    });
                    toast.success("QR code updated successfully");
                  } catch (e: unknown) {
                    const err = e as {
                      response?: { data?: { message?: string } };
                      message?: string;
                    };
                    toast.error(
                      err?.response?.data?.message ||
                        err?.message ||
                        "Failed to update QR code",
                    );
                  }
                }
                setShowEditModal(false);
                setEditRow(null);
              }}
            />
            <DeleteModal
              open={showDeleteModal}
              onClose={() => {
                setShowDeleteModal(false);
                setDeleteTargetId(null);
              }}
              subjectLabel="QR code"
              selectedCount={deleteTargetId ? 1 : 0}
              bodyMessage="This action cannot be undone. Deleting this QR code will permanently remove all associated folders, documents, and Procore item links."
              isLoading={isDeleting}
              onConfirm={async () => {
                if (deleteTargetId) {
                  setIsDeleting(true);
                  try {
                    await deleteSingleQRCallback(companyId, deleteTargetId);
                    // Fade out after success
                    setRemovingIds((prev) => {
                      const next = new Set(prev);
                      next.add(deleteTargetId);
                      return next;
                    });
                    toast.success("QR code deleted");
                    setShowDeleteModal(false);
                    setDeleteTargetId(null);
                    // Wait for refetch to complete before clearing removingIds to prevent
                    // rows from reappearing due to keepPreviousData showing stale data
                    setTimeout(async () => {
                      await refetch?.();
                      // Also invalidate Groups query to update numberOfCodes
                      await queryClient.invalidateQueries({
                        queryKey: groupsKeys.all,
                      });
                      setRemovingIds(new Set());
                    }, 220);
                  } catch (e: unknown) {
                    const err = e as {
                      response?: { data?: { message?: string } };
                      message?: string;
                    };
                    toast.error(
                      err?.response?.data?.message ||
                        err?.message ||
                        "Failed to delete QR code",
                    );
                  } finally {
                    setIsDeleting(false);
                  }
                }
              }}
            />
            <DeleteModal
              open={showGroupDeleteModal}
              onClose={() => setShowGroupDeleteModal(false)}
              subjectLabel="QR code"
              selectedCount={selectedIds.size}
              bodyMessage="This action cannot be undone. Deleting these QR codes will permanently remove all associated folders, documents, and Procore item links."
              isLoading={isBulkDeleting}
              onConfirm={async () => {
                setIsBulkDeleting(true);
                try {
                  await handleDeleteSelected();
                  setShowGroupDeleteModal(false);
                } finally {
                  setIsBulkDeleting(false);
                }
              }}
            />
            <PrintItemsModal
              open={showPrintModal}
              onClose={() => {
                setShowPrintModal(false);
                setPrintTargetId(null);
              }}
              onConfirm={() => {
                setShowPrintModal(false);
                // Exit bulk mode when printing from bulk selection (not single item from row menu)
                if (printTargetId === null && selectedIds.size > 0) {
                  setSelectedIds(new Set());
                  setGroupMode(false);
                }
                setPrintTargetId(null);
              }}
              selectedCount={printTargetId ? 1 : selectedIds.size}
              title="Print QR Codes"
              subtitle={
                <span>
                  Configure print options for{" "}
                  {printTargetId ? 1 : selectedIds.size} selected QR code
                  {(printTargetId ? 1 : selectedIds.size) === 1 ? "" : "s"}.
                </span>
              }
              companyName={companyRes.data?.companyName ?? "Taliho"}
              companyWebsite={companyRes.data?.companyWebsite}
              brandLogoSrc={companyRes.data?.printBrandingLogo}
              projectLine={printHeaderInfo.projectLine}
              clientName={printHeaderInfo.clientName}
              addressLine={printHeaderInfo.addressLine}
              groupLine={printHeaderInfo.groupLine}
              items={printItems}
              onRefetchUrl={fetchSignedUrl}
              allowMultiple
              maxItemsPerPage={12}
            />
            <AssignToModal
              open={showMoveToGroupModal}
              onClose={() => {
                setShowMoveToGroupModal(false);
                setMoveToGroupTargetId(null);
              }}
              selectedCount={moveToGroupTargetId ? 1 : selectedIds.size}
              title="Move to Group"
              subtitle={
                <span>
                  Assign {moveToGroupTargetId ? 1 : selectedIds.size} selected
                  QR code
                  {(moveToGroupTargetId ? 1 : selectedIds.size) === 1
                    ? ""
                    : "s"}{" "}
                  to a group.
                </span>
              }
              selectedSubjectLabel="QR code"
              targetLabel="Group"
              options={groupOptions}
              allowNew={true}
              existingLabel="Select existing group"
              newLabel="Create new group"
              selectLabel="Group"
              newNameLabel="New group name"
              newNamePlaceholder="Enter group name"
              confirmLabel="Move to Group"
              loadingLabel="Moving…"
              isLoading={isMovingToGroup}
              onConfirm={async (result) => {
                if (result.mode === "existing" && result.existingId) {
                  await handleMoveToGroup(result.existingId);
                } else if (result.mode === "new" && result.newName) {
                  // Get project ID - for single row, use that row's project; for bulk, use selected project
                  const isSingleRow = moveToGroupTargetId !== null;
                  const projectId = isSingleRow
                    ? singleRowMoveToGroupProjectId
                    : selectedProjectInfo.projectId;

                  // Validate project requirement
                  if (!projectId) {
                    toast.error(
                      "QR codes must belong to a project to create a new group.",
                    );
                    return;
                  }

                  if (!isSingleRow && !selectedProjectInfo.sameProject) {
                    toast.error(
                      "Selected QR codes must belong to the same project to create a new group.",
                    );
                    return;
                  }

                  try {
                    setIsMovingToGroup(true);

                    // Create the new group
                    const createResponse = await createGroup({
                      companyId: companyId,
                      projectId: projectId,
                      groupName: result.newName,
                      type: "arrangement",
                    });

                    if (createResponse?.data?._id) {
                      // Assign QR codes to the newly created group
                      await handleMoveToGroup(createResponse.data._id);
                    } else {
                      toast.error("Failed to create group");
                    }
                  } catch (e: unknown) {
                    logApiError(e, "qr-group-creation-failed", {
                      companyId: companyId,
                      projectId: projectId,
                      qrcodeCount: isSingleRow ? 1 : selectedIds.size,
                    });
                    if (import.meta.env.DEV) {
                      console.error("Failed to create group", e);
                    }
                    const err = e as {
                      response?: { data?: { message?: string } };
                      message?: string;
                    };
                    toast.error(
                      err?.response?.data?.message ||
                        err?.message ||
                        "Failed to create group",
                    );
                    setIsMovingToGroup(false);
                  }
                }
              }}
            />
            <AssignToModal
              open={showMoveToProjectModal}
              onClose={() => {
                setShowMoveToProjectModal(false);
                setMoveToProjectTargetId(null);
              }}
              selectedCount={moveToProjectTargetId ? 1 : selectedIds.size}
              title="Move to Project"
              subtitle={
                <span>
                  Assign {moveToProjectTargetId ? 1 : selectedIds.size} selected
                  QR code
                  {(moveToProjectTargetId ? 1 : selectedIds.size) === 1
                    ? ""
                    : "s"}{" "}
                  to a project.
                </span>
              }
              selectedSubjectLabel="QR code"
              targetLabel="Project"
              options={projectOptions}
              allowNew={true}
              existingLabel="Select existing project"
              newLabel="Create new project"
              selectLabel="Project"
              newNameLabel="New project name"
              newNamePlaceholder="Enter project name"
              confirmLabel="Move to Project"
              loadingLabel="Moving…"
              isLoading={isMovingToProject}
              onConfirm={async (result) => {
                if (result.mode === "existing" && result.existingId) {
                  await handleMoveToProject(result.existingId);
                } else if (result.mode === "new") {
                  // Store the entered project name and open CreateProjectModal
                  setPendingProjectName(result.newName || "");
                  setShowMoveToProjectModal(false);
                  setShowCreateProjectModal(true);
                }
              }}
            />
            <CreateProjectModal
              open={showCreateProjectModal}
              onClose={() => {
                setShowCreateProjectModal(false);
                setPendingProjectName("");
                setMoveToProjectTargetId(null);
              }}
              companyId={companyId}
              subtitle={
                moveToProjectTargetId
                  ? "Create a new project to assign your QR code."
                  : "Create a new project to assign your selected QR codes."
              }
              initialProjectName={pendingProjectName}
              onSuccess={async (newProjectId) => {
                // After project creation, assign the QR codes to it
                setShowCreateProjectModal(false);
                setPendingProjectName("");
                await handleMoveToProject(newProjectId);
              }}
            />
            <SetPasswordModal
              open={showSetPasswordModal}
              selectedCount={passwordTargetId ? 1 : selectedIds.size}
              subjectLabel="QR code"
              initialPasswordActivated={passwordTargetData?.passwordActivated}
              initialPassword={passwordTargetData?.password}
              initialTimezone={passwordTargetData?.timezone}
              initialWeekdayPassword={passwordTargetData?.weekdayPassword}
              initialWeekdayPasswordTimeStart={
                passwordTargetData?.weekdayPasswordTimeStart
              }
              initialWeekdayPasswordTimeEnd={
                passwordTargetData?.weekdayPasswordTimeEnd
              }
              initialWeekendPassword={passwordTargetData?.weekendPassword}
              initialWeekendPasswordTimeStart={
                passwordTargetData?.weekendPasswordTimeStart
              }
              initialWeekendPasswordTimeEnd={
                passwordTargetData?.weekendPasswordTimeEnd
              }
              onClose={() => {
                setShowSetPasswordModal(false);
                setPasswordTargetId(null);
              }}
              onConfirmValues={async (values) => {
                const ids = passwordTargetId
                  ? [passwordTargetId]
                  : Array.from(selectedIds);
                if (ids.length === 0) return;

                setIsSettingPassword(true);
                try {
                  if (ids.length === 1) {
                    // Single QR code - use existing updateQRCodeDetails
                    const list =
                      (QrCodesData as QrCodesListResponse | undefined)?.data ??
                      [];
                    const projId =
                      list.find((q) => q._id === ids[0])?.project || undefined;
                    await updateQRCodeDetails(ids[0], {
                      companyId: companyId,
                      projectId: projId,
                      ...values,
                    });
                  } else {
                    // Bulk - use new bulk endpoint
                    const result = await bulkSetQRCodePassword(
                      ids,
                      companyId,
                      values,
                    );
                    if (!result.success) {
                      throw new Error(
                        result.message || "Failed to set password",
                      );
                    }
                  }
                  toast.success(
                    `Password ${values.passwordActivated ? "set" : "removed"} for ${ids.length} QR code${ids.length === 1 ? "" : "s"}`,
                  );
                  setShowSetPasswordModal(false);
                  setPasswordTargetId(null);
                  if (!passwordTargetId) {
                    setSelectedIds(new Set());
                    setGroupMode(false);
                  }
                  void refetch?.();
                } catch (e: unknown) {
                  logQRError(e, "qr-password-set-failed", undefined, {
                    companyId: companyId,
                    qrcodeCount: ids.length,
                  });
                  if (import.meta.env.DEV) {
                    console.error("Failed to set password for QR codes", e);
                  }
                  const err = e as {
                    response?: { data?: { message?: string } };
                    message?: string;
                  };
                  toast.error(
                    err?.response?.data?.message ||
                      err?.message ||
                      "Failed to set password",
                  );
                } finally {
                  setIsSettingPassword(false);
                }
              }}
            />
          </>
        }
      />
    </main>
  );
}
