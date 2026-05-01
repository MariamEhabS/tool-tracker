import FilterComboBox from "@/components/combobox/detail/FilterComboBox";
import ItemComboBox, {
  ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import ListPageLayout from "@/components/layout/ListPageLayout";
import DeleteModal from "@/components/modal/taliho/DeleteModal";
import DownloadModal from "@/components/modal/taliho/DownloadModal";
import EditModal from "@/components/modal/taliho/EditModal";
import PrintItemsModal, {
  type PrintItemGroup,
} from "@/components/modal/taliho/PrintItemsModal";
import SetPasswordModal from "@/components/modal/taliho/SetPasswordModal";
import BulkActionsBar from "@/components/table/BulkActionsBar";
import DataTable from "@/components/table/DataTable";
import {
  getGroupsTable,
  GroupTableRow,
} from "@/components/table/taliho/GroupsTable";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { ActiveFilters } from "@/components/ui/SearchFiltersCard";
import { BadgeVariant } from "@/types/Badge.types";
import { formatDate } from "@/lib/format";
// import { Button } from '@headlessui/react';
import {
  createLazyFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { canCreateProjects, canDelete } from "@/utils/permissions";
import { useAllProjects } from "@/api/endpoints/projects";
import { useCompany } from "@/api/endpoints/company";
import {
  useListGroups,
  deleteGroupAsync,
  createBulkGroupDeleteJob,
  patchGroup,
  getSingleGroup,
  type GroupApi,
} from "@/api/endpoints/groups";
import { addJob } from "@/utils/localStorage-jobs";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import { axiosInstance } from "@/api";
import {
  fetchSignedUrl,
  bulkSetQRCodePassword,
} from "@/api/endpoints/qr-codes";
import toast from "react-hot-toast";
import { logApiError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createLazyFileRoute("/groups")({
  component: RouteComponent,
});

type Row = GroupTableRow;

function RouteComponent() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const canModify = canCreateProjects(user); // Admin or PM can create/edit
  const userCanDelete = canDelete(user); // Only admin can delete
  const searchParams = useSearch({ from: "/groups" }) as
    | {
        q?: string;
        page?: string | number;
        perPage?: string | number;
        sortKey?: string;
        sortDir?: "asc" | "desc";
        type?: string;
        projectStatus?: string;
      }
    | undefined;
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [, setTableVersion] = useState(0);
  const [filters, setFilters] = useState<ActiveFilters>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPrintItemsModal, setShowPrintItemsModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [targetGroupData, setTargetGroupData] = useState<GroupApi | null>(null);
  const [printGroupIds, setPrintGroupIds] = useState<string[] | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {},
  );
  const [bulkActions, setbulkActions] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Grouped QR codes for bulk print - preserves group context for separate pages
  const [groupedQrCodes, setGroupedQrCodes] = useState<
    Array<{
      groupId: string;
      groupName: string;
      projectId?: string;
      projectName: string;
      clientName?: string;
      addressLine?: string;
      items: Array<{
        id: string;
        name: string;
        qrImageUrl?: string;
        qrimage?: string;
      }>;
    }>
  >([]);
  const [isFetchingQrCodes, setIsFetchingQrCodes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const allProjectsRes = useAllProjects(user.companyId);
  const companyRes = useCompany(user.companyId);
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    const arr = allProjectsRes.data ?? [];
    for (const p of arr) m.set(p._id, p.projectName ?? "");
    return m;
  }, [allProjectsRes.data]);
  // Note: projectStatus is now computed directly from group data (projectArchived, projectStatusValue)
  // returned by the groups API, eliminating dependency on useAllProjects for status lookup

  // Determine if we should exclude archived projects at the backend level
  // Only exclude when: no search query AND no explicit project status filter selected
  const projectStatusFilters =
    (filters.projectStatus as string[] | undefined) ?? [];
  const shouldExcludeArchivedProjects =
    !query.trim() && projectStatusFilters.length === 0;

  // Determine type filters based on selected filter values
  // Now supports three types: arrangement, equipment, procore-drawing-codes
  const typeFilterValues = (filters.type as string[] | undefined) ?? [];
  // Map "procore-drawings" UI value to "procore-drawing-codes" type
  const mappedTypeValues = typeFilterValues.map((v) =>
    v === "procore-drawings" ? "procore-drawing-codes" : v,
  ) as Array<"arrangement" | "equipment" | "procore-drawing-codes">;
  // Only pass type if there's exactly one type selected
  const groupTypeParam =
    mappedTypeValues.length === 1 ? mappedTypeValues[0] : undefined;
  // Pass types array if multiple types are selected
  const groupTypesParam =
    mappedTypeValues.length > 1 ? mappedTypeValues : undefined;

  const groupsQuery = useListGroups({
    companyId: user.companyId,
    current_page: currentPage,
    per_page: itemsPerPage,
    search: query,
    // Pass single type or multiple types
    type: groupTypeParam,
    types: groupTypesParam,
    sortBy: sortKey,
    sortDir: sortDir,
    excludeArchivedProjects: shouldExcludeArchivedProjects,
  });
  const { data: groupsData, refetch: refetchGroups } = groupsQuery;
  const loadingState = useTableLoadingState(groupsQuery);

  // Initialize from URL once
  const initFromSearchRef = useRef(false);
  useEffect(() => {
    if (initFromSearchRef.current) return;
    initFromSearchRef.current = true;
    const s = searchParams || {};
    if (typeof s.q === "string") setQuery(s.q);
    if (s.page && !Number.isNaN(Number(s.page))) setCurrentPage(Number(s.page));
    if (s.perPage && !Number.isNaN(Number(s.perPage)))
      setItemsPerPage(Number(s.perPage));
    if (typeof s.sortKey === "string" && s.sortKey) setSortKey(s.sortKey);
    if (s.sortDir === "asc" || s.sortDir === "desc") setSortDir(s.sortDir);
    // type/projectStatus filters
    setFilters((prev) => {
      const next = { ...prev };
      if (typeof s.type === "string" && s.type.length > 0) {
        next.type = s.type.split(",").filter(Boolean);
      }
      if (typeof s.projectStatus === "string" && s.projectStatus.length > 0) {
        next.projectStatus = s.projectStatus.split(",").filter(Boolean);
      }
      return next;
    });
  }, [searchParams]);

  // Persist to URL on changes
  useEffect(() => {
    const params: Record<string, string> = {};
    if (query) params.q = query;
    if (currentPage && currentPage !== 1) params.page = String(currentPage);
    if (itemsPerPage && itemsPerPage !== 20)
      params.perPage = String(itemsPerPage);
    if (sortKey) params.sortKey = sortKey;
    if (sortDir) params.sortDir = sortDir;
    const typeFilters =
      (filters.type as string[] | undefined)?.filter(Boolean) ?? [];
    if (typeFilters.length) params.type = typeFilters.join(",");
    const projStatus =
      (filters.projectStatus as string[] | undefined)?.filter(Boolean) ?? [];
    if (projStatus.length) params.projectStatus = projStatus.join(",");
    navigate({ to: "/groups", search: params, replace: true });
  }, [query, currentPage, itemsPerPage, sortKey, sortDir, filters, navigate]);

  const rows = useMemo<Row[]>(() => {
    type GroupData = {
      _id: string;
      type?: string;
      project?: string;
      arrangementName?: string;
      groupName?: string;
      equipmentName?: string;
      equipmentID?: string;
      arrangementType?: string;
      numberOfCodes?: number;
      mobileScanCount?: number;
      createdAt?: string;
      // Project status fields returned directly from the groups API
      projectArchived?: boolean;
      projectStatusValue?: string;
    };
    const list = (groupsData?.data ?? []) as GroupData[];
    return list.map((g) => {
      const id = String(g._id);
      // procore-drawing-codes groups are displayed as "arrangement" type
      // since they're essentially a special kind of arrangement
      const normalizedType = (g.type || "").toLowerCase();
      const groupType = (
        normalizedType === "arrangement" ||
        normalizedType === "procore-drawing-codes"
          ? "arrangement"
          : "equipment"
      ) as Row["groupType"];
      const projectId = g.project ? String(g.project) : undefined;

      // Compute projectStatus directly from group data (returned by API)
      // This avoids dependency on useAllProjects which may miss legacy data
      let computedProjectStatus: Row["projectStatus"] = "none";
      if (projectId) {
        const archived = Boolean(g.projectArchived);
        const raw = (g.projectStatusValue ?? "")
          .toString()
          .toLowerCase()
          .trim();
        if (archived) computedProjectStatus = "archived";
        else if (!raw || raw === "active") computedProjectStatus = "active";
        else if (raw === "completed") computedProjectStatus = "completed";
        else if (raw === "on hold" || raw === "on-hold")
          computedProjectStatus = "on-hold";
        // For any other status value, default to "none"
      }

      // Determine arrangementType for Procore Drawings badge display
      // procore-drawing-codes is now a first-class type (not arrangement subtype)
      const arrangementType =
        (g.type || "").toLowerCase() === "procore-drawing-codes"
          ? "Procore Drawings"
          : g.type === "arrangement"
            ? "Taliho"
            : undefined;

      return {
        id,
        name:
          nameOverrides[id] ??
          (g.arrangementName || g.groupName || g.equipmentName || "Group"),
        groupType,
        arrangementType,
        project: projectId
          ? (projectNameById.get(projectId) ?? "[UNASSIGNED]")
          : "[UNASSIGNED]",
        projectId,
        projectStatus: computedProjectStatus,
        qrCodes: Number(g.numberOfCodes ?? 0),
        date: formatDate(String(g.createdAt ?? "")),
        scans: Number(g.mobileScanCount ?? 0),
        subtitle: undefined,
      } as Row;
    });
  }, [groupsData?.data, nameOverrides, projectNameById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const typeFilters = (filters.type as string[] | undefined) ?? [];
    const projectStatuses =
      (filters.projectStatus as string[] | undefined) ?? [];
    let next = rows;
    if (q) next = next.filter((r) => r.name.toLowerCase().includes(q));
    // Type filtering is now handled server-side via the type/types parameters
    // Client-side filtering only needed for legacy group types since
    // procore-drawing-codes groups display as "arrangement" groupType
    const regularTypeFilters = typeFilters.filter(
      (t) => t === "arrangement" || t === "equipment",
    );
    if (regularTypeFilters.length > 0)
      next = next.filter((r) => regularTypeFilters.includes(r.groupType));

    // Project status filtering when explicit filters are selected
    // Note: Default exclusion of archived projects is now handled server-side
    // via the excludeArchivedProjects parameter for accurate pagination
    if (projectStatuses.length > 0) {
      // When filters are selected, only show groups matching those statuses
      // Unassigned groups ("none") are hidden since they can't match any filter
      next = next.filter((r) =>
        projectStatuses.includes(String(r.projectStatus)),
      );
    }

    next = next.filter((r) => !hiddenIds.has(r.id));
    return next;
  }, [query, rows, filters, hiddenIds]);

  // Row-level print targeting helpers
  const isRowTarget = useMemo(
    () => Array.isArray(printGroupIds) && printGroupIds.length === 1,
    [printGroupIds],
  );
  const targetRow = useMemo(
    () =>
      isRowTarget
        ? rows.find((r) => r.id === (printGroupIds as string[])[0])
        : undefined,
    [isRowTarget, printGroupIds, rows],
  );
  const targetProject = useMemo(() => {
    if (!targetRow?.projectId) return undefined;
    const arr = allProjectsRes.data ?? [];
    return arr.find((p) => String(p._id) === String(targetRow.projectId));
  }, [targetRow, allProjectsRes.data]);

  // Fetch group data when set password modal opens for a single group
  useEffect(() => {
    if (!showSetPasswordModal || !actionTargetId) {
      setTargetGroupData(null);
      return;
    }

    const fetchGroupData = async () => {
      try {
        const response = await getSingleGroup(actionTargetId);
        setTargetGroupData(response.data);
      } catch (error) {
        logApiError(error, "group-data-fetch-failed", {
          companyId: user.companyId,
          groupId: actionTargetId,
        });
        if (import.meta.env.DEV) {
          console.error("Failed to fetch group data:", error);
        }
        // Don't show error toast - just proceed without initial values
        setTargetGroupData(null);
      }
    };

    fetchGroupData();
  }, [showSetPasswordModal, actionTargetId, user.companyId]);

  // Fetch QR codes when print modal opens - preserves group context for grouped printing
  useEffect(() => {
    if (!showPrintItemsModal) {
      setGroupedQrCodes([]);
      setIsFetchingQrCodes(false);
      return;
    }

    const groupsToPrint = bulkActions
      ? filtered.filter((g) => selected.has(g.id))
      : targetRow
        ? [targetRow]
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
        const groupedData: Array<{
          groupId: string;
          groupName: string;
          projectId?: string;
          projectName: string;
          clientName?: string;
          addressLine?: string;
          items: Array<{
            id: string;
            name: string;
            qrImageUrl?: string;
            qrimage?: string;
          }>;
        }> = [];

        for (const group of groupsToPrint) {
          // Get group type from the original groupsData
          const groupData = (groupsData?.data ?? []).find(
            (g: { _id: string }) => String(g._id) === group.id,
          );
          const groupType = groupData?.type
            ? String(groupData.type).toLowerCase()
            : undefined;
          const groupingType =
            groupType === "arrangement" || groupType === "equipment"
              ? groupType
              : undefined;

          // Fetch QR codes for this group
          const params: Record<string, unknown> = {
            groupingId: group.id,
            per_page: 1000,
            companyId: user.companyId,
          };
          if (groupingType) params.groupingType = groupingType;
          if (group.projectId) params.projectId = group.projectId;

          const response = await axiosInstance.get("/qr-code", { params });
          const qrCodes = response.data?.data ?? [];

          // Get project details for this group
          const projectData = (allProjectsRes.data ?? []).find(
            (p) => String(p._id) === String(group.projectId),
          );

          // Build address line from project data
          const addressParts = [
            projectData?.projectAddress,
            projectData?.projectCity,
            projectData?.projectState,
            projectData?.projectZIP,
          ].filter(Boolean);
          const addressLine =
            addressParts.length > 0 ? addressParts.join(", ") : undefined;

          groupedData.push({
            groupId: group.id,
            groupName: group.name,
            projectId: group.projectId,
            projectName:
              projectData?.projectName ?? group.project ?? "Unknown Project",
            clientName: projectData?.clientName,
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

        // Warn if no QR codes were found across all selected groups
        const totalItems = groupedData.reduce(
          (sum, g) => sum + g.items.length,
          0,
        );
        if (totalItems === 0 && groupedData.length > 0) {
          toast.error(
            groupedData.length === 1
              ? "This group does not contain any QR codes."
              : "None of the selected groups contain any QR codes.",
          );
        }
      } catch (error) {
        logApiError(error, "qr-print-fetch-failed", {
          companyId: user.companyId,
          groupCount: groupsToPrint.length,
        });
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
    showPrintItemsModal,
    bulkActions,
    filtered,
    selected,
    targetRow,
    groupsData?.data,
    user.companyId,
    allProjectsRes.data,
  ]);

  // Build itemGroups for grouped printing - each group gets its own pages with its header info
  const printItemGroups = useMemo((): PrintItemGroup[] | undefined => {
    // Only use grouped mode when bulk printing multiple groups
    if (!bulkActions || groupedQrCodes.length <= 1) {
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
  }, [bulkActions, groupedQrCodes]);

  // Build flat items payload for single-group printing (backward compatibility)
  // Include qrCodeId for signed URL refetch and fallbackSrc for SVG fallback
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

  const allSelected =
    bulkActions &&
    selected.size > 0 &&
    filtered.every((r) => selected.has(r.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }

  function projectStatusVariant(s: Row["projectStatus"]): BadgeVariant {
    switch (s) {
      case "active":
        return "green";
      case "completed":
        return "blue";
      case "on-hold":
        return "yellow";
      case "archived":
        return "gray";
      default:
        return "gray";
    }
  }

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <DownloadModal
        open={showDownloadModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="group"
        onClose={() => {
          setShowDownloadModal(false);
          setActionTargetId(null);
        }}
        onConfirm={() => {
          setShowDownloadModal(false);
          setActionTargetId(null);
        }}
      />
      <PrintItemsModal
        open={showPrintItemsModal}
        onClose={() => {
          setShowPrintItemsModal(false);
          setPrintGroupIds(null);
        }}
        onConfirm={() => {
          setShowPrintItemsModal(false);
          setPrintGroupIds(null);
        }}
        selectedCount={totalQrCodeCount}
        title="Print Groups"
        subtitle={
          <span>
            Configure print options for {totalQrCodeCount} QR code
            {totalQrCodeCount === 1 ? "" : "s"}
            {printGroupIds && printGroupIds.length > 0 && (
              <>
                {" "}
                from {printGroupIds.length} group
                {printGroupIds.length === 1 ? "" : "s"}
              </>
            )}
            .
          </span>
        }
        companyName={companyRes.data?.companyName ?? "Taliho"}
        companyWebsite={companyRes.data?.companyWebsite}
        brandLogoSrc={companyRes.data?.printBrandingLogo}
        groupLine={
          printGroupIds && printGroupIds.length === 1
            ? (rows.find((r) => r.id === printGroupIds[0])?.name ?? "Group")
            : ""
        }
        projectLine={
          isRowTarget
            ? (targetProject?.projectName ?? targetRow?.project ?? "")
            : "My Groups"
        }
        clientName={isRowTarget ? (targetProject?.clientName ?? "") : undefined}
        addressLine={
          isRowTarget && targetProject
            ? [
                targetProject.projectAddress,
                targetProject.projectCity,
                targetProject.projectState
                  ? `${targetProject.projectState} ${targetProject.projectZIP || ""}`.trim()
                  : targetProject.projectZIP,
              ]
                .filter(Boolean)
                .join(", ") || undefined
            : undefined
        }
        // For grouped mode (bulk printing multiple groups), use itemGroups for separate pages
        itemGroups={printItemGroups}
        // For flat mode (single group or backward compatibility), use items
        items={printItemGroups ? undefined : printItems}
        isLoadingItems={isFetchingQrCodes}
        onRefetchUrl={fetchSignedUrl}
        allowMultiple
        maxItemsPerPage={12}
      />
      <SetPasswordModal
        open={showSetPasswordModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="group"
        title={
          actionTargetId && targetGroupData?.passwordActivated
            ? "Update Group Password"
            : "Set Group Password"
        }
        subtitle={
          actionTargetId && targetGroupData?.passwordActivated ? (
            <span>
              Update the password for this group and all its QR codes.
            </span>
          ) : actionTargetId ? (
            <span>Set a password for this group and all its QR codes.</span>
          ) : (
            <span>
              Set a password for {selected.size} group
              {selected.size === 1 ? "" : "s"} and all their QR codes.
            </span>
          )
        }
        initialPasswordActivated={targetGroupData?.passwordActivated}
        initialPassword={targetGroupData?.password}
        initialTimezone={targetGroupData?.timezone}
        initialWeekdayPassword={targetGroupData?.weekdayPassword}
        initialWeekdayPasswordTimeStart={
          targetGroupData?.weekdayPasswordTimeStart
        }
        initialWeekdayPasswordTimeEnd={targetGroupData?.weekdayPasswordTimeEnd}
        initialWeekendPassword={targetGroupData?.weekendPassword}
        initialWeekendPasswordTimeStart={
          targetGroupData?.weekendPasswordTimeStart
        }
        initialWeekendPasswordTimeEnd={targetGroupData?.weekendPasswordTimeEnd}
        onClose={() => {
          setShowSetPasswordModal(false);
          setActionTargetId(null);
          setTargetGroupData(null);
        }}
        onConfirmValues={async (vals) => {
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

          const groupIds = actionTargetId
            ? [actionTargetId]
            : Array.from(selected);
          if (groupIds.length === 0) {
            toast.error("No groups selected");
            return;
          }

          setIsSettingPassword(true);
          let successCount = 0;
          let failCount = 0;

          try {
            // Update each group individually
            for (const groupId of groupIds) {
              try {
                // Get the group data to find project and company IDs
                const groupData = rows.find((g: Row) => g.id === groupId);
                if (!groupData) {
                  failCount++;
                  continue;
                }

                // Update the group
                await patchGroup(groupId, {
                  companyId: String(user.companyId || ""),
                  projectId: groupData.projectId
                    ? String(groupData.projectId)
                    : undefined,
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

                // Fetch all QR codes in this group and update them
                try {
                  const groupType = (groupsData?.data ?? []).find(
                    (g: { _id: string }) => String(g._id) === groupId,
                  )?.type;
                  const groupingType =
                    groupType === "arrangement" || groupType === "equipment"
                      ? groupType
                      : "group";

                  const params: Record<string, unknown> = {
                    groupingId: groupId,
                    groupingType,
                    per_page: 1000,
                    companyId: user.companyId,
                  };
                  if (groupData.projectId)
                    params.projectId = groupData.projectId;

                  const response = await axiosInstance.get("/qr-code", {
                    params,
                  });
                  const qrCodes = response.data?.data ?? [];

                  if (qrCodes.length > 0) {
                    const qrCodeIds = qrCodes.map(
                      (qr: { _id: string }) => qr._id,
                    );
                    await bulkSetQRCodePassword(
                      qrCodeIds,
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
                  }
                } catch (qrError) {
                  logApiError(qrError, "group-password-update-failed", {
                    companyId: user.companyId,
                    groupId,
                  });
                  if (import.meta.env.DEV) {
                    console.error(
                      `Failed to update QR codes for group ${groupId}:`,
                      qrError,
                    );
                  }
                  // Don't fail the whole operation if QR codes update fails
                  // The group password was still set successfully
                }

                successCount++;
              } catch (e) {
                logApiError(e, "group-password-set-failed", {
                  companyId: user.companyId,
                  groupId,
                });
                if (import.meta.env.DEV) {
                  console.error(
                    `Failed to set password for group ${groupId}:`,
                    e,
                  );
                }
                failCount++;
              }
            }

            // Show appropriate success/error messages
            if (successCount > 0 && failCount === 0) {
              toast.success(
                `Password ${vals.passwordActivated ? "set" : "removed"} for ${successCount} group${successCount === 1 ? "" : "s"}`,
              );
            } else if (successCount > 0 && failCount > 0) {
              toast.success(
                `Password updated for ${successCount} group${successCount === 1 ? "" : "s"}, but ${failCount} failed`,
              );
            } else {
              toast.error("Failed to update password for all selected groups");
            }

            // Refetch and cleanup
            await groupsQuery.refetch();
            setShowSetPasswordModal(false);
            setActionTargetId(null);
            setTargetGroupData(null);
            if (!actionTargetId) {
              setSelected(new Set());
              setbulkActions(false);
            }
          } catch (e) {
            logApiError(e, "group-operation-failed", {
              companyId: user.companyId,
              groupCount: groupIds.length,
            });
            if (import.meta.env.DEV) {
              console.error("Failed to set password for groups:", e);
            }
            const errorMessage =
              e instanceof Error
                ? e.message
                : "Failed to set password. Please try again.";
            toast.error(errorMessage);
          } finally {
            setIsSettingPassword(false);
          }
        }}
      />
      <DeleteModal
        open={showDeleteModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="group"
        bodyMessage="This will permanently delete the selected group(s) and all associated QR codes, folders, documents, and Procore item links. This action cannot be undone."
        isLoading={isDeleting}
        onClose={() => {
          setShowDeleteModal(false);
          setActionTargetId(null);
        }}
        onConfirm={async () => {
          const idsToRemove: string[] = actionTargetId
            ? [actionTargetId]
            : Array.from(selected);
          setIsDeleting(true);
          try {
            // Fade out rows immediately
            setRemovingIds((prev) => {
              const next = new Set(prev);
              idsToRemove.forEach((id) => next.add(id));
              return next;
            });

            if (idsToRemove.length === 1 && actionTargetId) {
              // Single group async delete
              const { jobId } = await deleteGroupAsync(
                user.companyId,
                actionTargetId,
              );
              addJob({
                jobId,
                status: "pending",
                progress: 0,
                total: 1,
                type: "bulk-group-delete",
              });
            } else if (idsToRemove.length > 0) {
              // Bulk group async delete
              const { jobId } = await createBulkGroupDeleteJob(
                user.companyId,
                idsToRemove,
              );
              addJob({
                jobId,
                status: "pending",
                progress: 0,
                total: idsToRemove.length,
                type: "bulk-group-delete",
              });
            }

            toast.success("Deletion started");
            setShowDeleteModal(false);
            setActionTargetId(null);

            // Clean up state after fade-out animation
            window.setTimeout(() => {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.add(id));
                return next;
              });
              setSelected((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.delete(id));
                return next;
              });
              setRemovingIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.delete(id));
                return next;
              });
              setbulkActions(false);
            }, 200);
          } catch (e: unknown) {
            // Clear removing animation on error
            setRemovingIds(new Set());
            const err = e as {
              response?: { data?: { message?: string } };
              message?: string;
            };
            toast.error(
              err?.response?.data?.message ||
                err?.message ||
                "Failed to delete groups",
            );
          } finally {
            setIsDeleting(false);
          }
        }}
      />
      <EditModal
        open={showEditModal}
        title="Edit Group"
        subtitle={<span>Update group details.</span>}
        fields={[
          {
            key: "name",
            label: "Name",
            type: "text",
            required: true,
            initialValue: actionTargetId
              ? (rows.find((r) => r.id === actionTargetId)?.name ?? "")
              : "",
          },
          {
            key: "type",
            label: "Group Type",
            type: "select",
            required: true,
            initialValue: actionTargetId
              ? (rows.find((r) => r.id === actionTargetId)?.groupType ??
                "arrangement")
              : "arrangement",
            options: [
              { label: "Arrangement", value: "arrangement" },
              { label: "Equipment", value: "equipment" },
            ],
          },
        ]}
        onClose={() => {
          setShowEditModal(false);
          setActionTargetId(null);
        }}
        onConfirm={async (values) => {
          if (!actionTargetId) {
            setShowEditModal(false);
            return;
          }
          const targetRow = rows.find((r) => r.id === actionTargetId);
          try {
            await patchGroup(actionTargetId, {
              companyId: user.companyId,
              projectId: targetRow?.projectId ?? "",
              groupName: values.name,
              type: values.type as "arrangement" | "equipment",
            });
            setNameOverrides((prev) => ({
              ...prev,
              [actionTargetId]: values.name,
            }));
            toast.success("Group updated successfully");
            await refetchGroups?.();
          } catch (e) {
            logApiError(e, "group-update-failed", {
              companyId: user.companyId,
              groupId: actionTargetId,
            });
            if (import.meta.env.DEV) {
              console.error(e);
            }
            toast.error("Failed to update group");
          } finally {
            setShowEditModal(false);
            setActionTargetId(null);
          }
        }}
      />

      <ListPageLayout
        title="Groups"
        titleIconClass="bx bx-collection text-fuchsia-600"
        subtitle="Organize and manage QR code groups for arrangements and equipment."
        headerActions={
          <>
            {canModify && (
              <Button
                onClick={() => {
                  setbulkActions((a) => !a);
                  setSelected(new Set());
                }}
                variant="secondary"
                leftIconClass={`bx ${bulkActions ? "bx-x" : "bx-grid-alt"} text-gray-500`}
              >
                {bulkActions ? "Cancel" : "Bulk Actions"}
              </Button>
            )}
            {canModify && (
              <Button
                type="button"
                variant="primary"
                onClick={() =>
                  navigate({
                    to: "/create-qr",
                    search: {
                      step: "2",
                      tab: "bulk",
                      groupAction: "create",
                    },
                  })
                }
              >
                Create Group
              </Button>
            )}
          </>
        }
        search={{
          value: query,
          onChange: (v) => {
            setSelected(new Set());
            setQuery(v);
            setCurrentPage(1);
            setTableVersion((tv) => tv + 1);
          },
          placeholder: "Search groups...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Group Type"
              options={[
                { label: "Arrangement", value: "arrangement" },
                { label: "Equipment", value: "equipment" },
                { label: "Procore Drawings", value: "procore-drawings" },
              ]}
              value={filters.type as unknown as string[] | undefined}
              onChange={(next) =>
                setFilters((prev) => ({ ...prev, type: next }))
              }
            />
            <FilterComboBox
              multiple
              placeholder="Project"
              options={[
                { label: "Active", value: "active" },
                { label: "On Hold", value: "on-hold" },
                { label: "Completed", value: "completed" },
                { label: "Archived", value: "archived" },
              ]}
              value={filters.projectStatus as unknown as string[] | undefined}
              onChange={(next) =>
                setFilters((prev) => ({ ...prev, projectStatus: next }))
              }
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setFilters({});
                setQuery("");
                setTableVersion((v) => v + 1);
                setSelected(new Set());
              }}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5"
            >
              Clear Filters
            </Button>
          </>
        }
        activeFilters={filters}
        onResetPage={() => {
          setTableVersion((v) => v + 1);
          setSelected(new Set());
        }}
        bulkActionsBar={
          bulkActions ? (
            <BulkActionsBar
              selectedCount={selected.size}
              showSelectAll
              selectAllChecked={allSelected}
              onSelectAllChange={(checked) => {
                if (checked !== allSelected) toggleSelectAll();
              }}
              onClearSelection={() => setSelected(new Set())}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-printer"
                    onClick={() => {
                      setPrintGroupIds(Array.from(selected));
                      setShowPrintItemsModal(true);
                    }}
                  >
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass={
                      isSettingPassword
                        ? "bx bx-loader-alt animate-spin"
                        : "bx bx-lock-alt"
                    }
                    onClick={() => {
                      setActionTargetId(null);
                      setShowSetPasswordModal(true);
                    }}
                    disabled={isSettingPassword}
                  >
                    {isSettingPassword ? "Setting..." : "Set Password"}
                  </Button>
                  {userCanDelete && (
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass="bx bx-trash"
                      onClick={() => {
                        setActionTargetId(null);
                        setShowDeleteModal(true);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </>
              }
              moreOptions={[
                {
                  label: "Print",
                  value: "print",
                  iconClass: "bx bx-printer",
                  onSelect: () => {
                    setPrintGroupIds(Array.from(selected));
                    setShowPrintItemsModal(true);
                  },
                },
                {
                  label: "Set Password",
                  value: "password",
                  iconClass: isSettingPassword
                    ? "bx bx-loader-alt animate-spin"
                    : "bx bx-lock-alt",
                  disabled: isSettingPassword,
                  onSelect: () => {
                    setActionTargetId(null);
                    setShowSetPasswordModal(true);
                  },
                },
                ...(userCanDelete
                  ? [
                      {
                        label: "Delete",
                        value: "delete",
                        iconClass: "bx bx-trash",
                        onSelect: () => {
                          setActionTargetId(null);
                          setShowDeleteModal(true);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          ) : undefined
        }
        table={(() => {
          const { columns, getRowId } = getGroupsTable({
            showProjectColumn: true,
            showTypeColumn: true,
            getGroupTypeBadgeVariant: (groupType) =>
              groupType === "arrangement" ? "indigo" : "red",
            getProjectBadgeVariant: projectStatusVariant,
            onProjectClick: (r) => {
              if (r.projectId)
                navigate({
                  to: "/project/$projectId",
                  params: { projectId: r.projectId },
                });
            },
          });

          const hasSearchOrFilters =
            query.trim() !== "" || Object.keys(filters).length > 0;

          // IMPORTANT: Check loading state FIRST before checking for empty data.
          // This prevents the empty state from flashing before the skeleton appears.
          // Only show empty state when we're certain the fetch succeeded AND data is truly empty.
          if (!loadingState.showSkeleton && filtered.length === 0) {
            return (
              <EmptyState
                icon={
                  <i className="bx bx-collection text-fuchsia-500 text-2xl" />
                }
                title={hasSearchOrFilters ? "No Groups found" : "No Groups yet"}
                description={
                  hasSearchOrFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : canModify
                      ? "Create a group to organize multiple QR codes together for bulk operations."
                      : "No groups have been created yet. Contact an admin to create groups."
                }
                actionLabel={
                  hasSearchOrFilters || !canModify ? undefined : "Create Group"
                }
                onActionClick={
                  hasSearchOrFilters || !canModify
                    ? undefined
                    : () =>
                        navigate({
                          to: "/create-qr",
                          search: {
                            step: "2",
                            tab: "bulk",
                            groupAction: "create",
                          },
                        })
                }
                iconBgClass="bg-fuchsia-50"
                compact
                className="h-full min-h-[400px]"
              />
            );
          }

          return (
            <DataTable<Row>
              columns={columns}
              rows={filtered}
              getRowId={getRowId}
              onRowClick={(r: Row) =>
                navigate({ to: "/group/$groupId", params: { groupId: r.id } })
              }
              getRowUrl={(r: Row) => `/group/${r.id}`}
              loadingState={loadingState}
              serverSide={true}
              serverSideSort={true}
              sortState={{ key: sortKey, dir: sortDir }}
              onSortChange={(key, dir) => {
                setSortKey(key);
                setSortDir(dir);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={Number(groupsData?.total_items ?? filtered.length)}
              onPageChange={(p) => setCurrentPage(p)}
              onItemsPerPageChange={(v) => {
                setItemsPerPage(v);
                setCurrentPage(1);
              }}
              showSelection={bulkActions}
              searchText={query}
              isRowSelected={(r: Row) => selected.has(r.id)}
              onToggleRow={(r: Row) => toggleRow(r.id)}
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              getRowClassName={(r: Row) =>
                removingIds.has(r.id)
                  ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
                  : ""
              }
              renderActions={(r: Row) => {
                const options: ItemComboBoxOption[] = [
                  // Print is available to all users
                  {
                    label: "Print",
                    value: "print",
                    iconClass: "bx bx-printer",
                    onSelect: () => {
                      setPrintGroupIds([r.id]);
                      setShowPrintItemsModal(true);
                    },
                  },
                ];

                // Edit and Set Password require modify permissions (admin/PM)
                if (canModify) {
                  options.unshift({
                    label: "Edit",
                    value: "edit",
                    iconClass: "bx bx-pencil",
                    onSelect: () => {
                      setActionTargetId(r.id);
                      setShowEditModal(true);
                    },
                  });
                  options.push({
                    label: "Set Password",
                    value: "password",
                    iconClass: isSettingPassword
                      ? "bx bx-loader-alt animate-spin"
                      : "bx bx-lock-alt",
                    disabled: isSettingPassword,
                    onSelect: () => {
                      setActionTargetId(r.id);
                      setShowSetPasswordModal(true);
                    },
                  });
                }

                // Delete requires admin permissions only
                if (userCanDelete) {
                  options.push({
                    label: "Delete",
                    value: "delete",
                    iconClass: "bx bx-trash",
                    onSelect: () => {
                      setActionTargetId(r.id);
                      setShowDeleteModal(true);
                    },
                  });
                }

                return (
                  <div
                    className="relative inline-block text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ItemComboBox
                      options={options}
                      sourceId={`groups-actions-${r.id}`}
                    />
                  </div>
                );
              }}
            />
          );
        })()}
      />
    </main>
  );
}
