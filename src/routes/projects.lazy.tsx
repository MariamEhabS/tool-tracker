import { useEffect, useMemo, useRef, useState } from "react";
import {
  createLazyFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { canCreateProjects, canDelete } from "@/utils/permissions";
// import AppShell from '@components/layout/AppShell';
import ListPageLayout from "@components/layout/ListPageLayout";
import Button from "@components/ui/Button";
import Badge from "@components/ui/Badge";
import EmptyState from "@components/ui/EmptyState";
import type { BadgeVariant } from "@/types/Badge.types";
import DataTable, { type Column } from "@components/table/DataTable";
import { formatCount, formatDate } from "@lib/format";
import Icon, { type RowType } from "@components/ui/Icon";
import BulkActionsBar from "@components/table/BulkActionsBar";
import ArchiveModal from "@components/modal/taliho/ArchiveModal";
import DeleteModal from "@components/modal/taliho/DeleteModal";
import SetPasswordModal from "@components/modal/taliho/SetPasswordModal";
import CreateProjectModal from "@components/modal/taliho/CreateProjectModal";
import type { ActiveFilters } from "@components/ui/SearchFiltersCard";
import FilterComboBox from "@components/combobox/detail/FilterComboBox";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import Modal from "@components/modal/Modal";
import {
  deleteProjectAsync,
  createBulkProjectDeleteJob,
  patchProject,
  projectKeys,
  useListProjects,
} from "@api/endpoints/projects";
import { addJob } from "@/utils/localStorage-jobs";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import { queryClient, axiosInstance } from "@/api";
import {
  patchGroup,
  type PaginatedGroupsResponse,
} from "@api/endpoints/groups";
import {
  useProcoreProjectsSearch,
  type ProcoreProject,
} from "@api/endpoints/procore";
import { useProcoreStatus } from "@api/endpoints/company";
import toast from "react-hot-toast";
import procoreIcon from "../assets/images/procore-icon.png";
import { getStoredUser } from "@/utils/getStoredUser";

type Row = {
  id: string;
  name: string;
  location: string;
  qrCodes: number;
  groups?: number;
  status: "active" | "completed" | "on-hold" | "archived";
  updated: string;
  icon: string;
  client?: string;
  // Procore fields
  procoreProjectID?: string;
  procoreCompanyID?: string;
  // Raw project data for editing
  raw?: {
    projectName?: string;
    projectAddress?: string;
    projectCity?: string;
    projectState?: string;
    projectZIP?: string;
    clientName?: string;
  };
};

export const Route = createLazyFileRoute("/projects")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = getStoredUser();
  const canModify = canCreateProjects(user); // Admin or PM can create/edit
  const userCanDelete = canDelete(user); // Only admin can delete
  //   const navigate = useNavigate();
  // export default function Projects() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/projects" }) as
    | {
        q?: string;
        status?: string;
        page?: string | number;
        perPage?: string | number;
        sortKey?: string;
        sortDir?: "asc" | "desc";
      }
    | undefined;
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [bulkActions, setbulkActions] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPopover, setOpenPopover] = useState<null | "status">(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<ActiveFilters>({});
  const [sortKey, setSortKey] = useState<string>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [archiveMode, setArchiveMode] = useState<"archive" | "unarchive">(
    "archive",
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_userRows, setUserRows] = useState<Row[]>([]); // Prefixed: userRows no longer used in server-side pagination
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Row | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editProjectAddress, setEditProjectAddress] = useState("");
  const [editProjectCity, setEditProjectCity] = useState("");
  const [editProjectState, setEditProjectState] = useState("");
  const [editProjectZIP, setEditProjectZIP] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState<string>("active");
  const [editProcoreProjectID, setEditProcoreProjectID] = useState<string>("");
  const [editProcoreCompanyID, setEditProcoreCompanyID] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [procoreSearchQuery, setProcoreSearchQuery] = useState("");
  // Edit modal accordion state
  const [isProcoreSectionExpanded, setIsProcoreSectionExpanded] =
    useState(false);
  // Edit modal field errors
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  // Compute status filter: include all statuses (including archived) when searching without explicit filter
  const computedStatusFilter = useMemo(() => {
    const explicitStatus = (filters.status as string[] | undefined)?.join(",");
    // If user explicitly selected status filters, use those
    if (explicitStatus) return explicitStatus;
    // If searching without explicit filters, include all statuses to find archived items
    if (query && query.trim()) {
      return "active,completed,on-hold,archived";
    }
    // No search, no filters: let backend use its default (exclude archived)
    return undefined;
  }, [filters.status, query]);

  const projectsQuery = useListProjects({
    companyId: user.companyId,
    page: currentPage,
    perPage: itemsPerPage,
    search: query || undefined,
    status: computedStatusFilter,
    sortKey: sortKey || undefined,
    sortDir: sortDir || undefined,
  });
  const { data: projectsResponse, isLoading, refetch } = projectsQuery;
  const loadingState = useTableLoadingState(projectsQuery);

  // Procore integration status
  const { data: procoreStatus } = useProcoreStatus(user.companyId);

  // Procore projects search for edit modal
  const {
    data: procoreProjectsData,
    isLoading: isProcoreLoading,
    isError: hasProcoreProjectsError,
    error: procoreProjectsError,
  } = useProcoreProjectsSearch(
    user.companyId,
    procoreSearchQuery,
    showEditModal && !!procoreStatus?.isConnected,
  );

  const procoreProjectsErrorMessage = useMemo(() => {
    if (!hasProcoreProjectsError || !procoreProjectsError) return "";
    const err = procoreProjectsError as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      err?.response?.data?.message ||
      err?.message ||
      "Unable to load Procore projects right now."
    );
  }, [hasProcoreProjectsError, procoreProjectsError]);

  // Flatten Procore projects for easier selection (edit modal)
  const flatProcoreProjects = useMemo(() => {
    if (!procoreProjectsData?.projects || !procoreProjectsData?.companies)
      return [];
    const result: Array<
      ProcoreProject & { procoreCompanyId: number; procoreCompanyName: string }
    > = [];
    procoreProjectsData.companies.forEach((company, idx) => {
      const projects = procoreProjectsData.projects[idx] || [];
      projects.forEach((project) => {
        result.push({
          ...project,
          procoreCompanyId: company.id,
          procoreCompanyName: company.name,
        });
      });
    });
    return result;
  }, [procoreProjectsData]);

  // Initialize from URL once
  const initFromSearchRef = useRef(false);
  useEffect(() => {
    if (initFromSearchRef.current) return;
    initFromSearchRef.current = true;
    const s = searchParams || {};
    if (typeof s.q === "string") setQuery(s.q);
    if (typeof s.sortKey === "string" && s.sortKey) setSortKey(s.sortKey);
    if (s.sortDir === "asc" || s.sortDir === "desc") setSortDir(s.sortDir);
    if (s.page) {
      const pageNum =
        typeof s.page === "string" ? parseInt(s.page, 10) : s.page;
      if (!isNaN(pageNum) && pageNum > 0) setCurrentPage(pageNum);
    }
    if (s.perPage) {
      const perPageNum =
        typeof s.perPage === "string" ? parseInt(s.perPage, 10) : s.perPage;
      if (!isNaN(perPageNum) && perPageNum > 0) setItemsPerPage(perPageNum);
    }
    setFilters((prev) => {
      const next = { ...prev };
      if (typeof s.status === "string" && s.status.length > 0) {
        next.status = s.status.split(",").filter(Boolean);
      }
      return next;
    });
  }, [searchParams]);

  // NOTE: Page reset on search/filter change is now handled directly in the onChange handlers
  // (search onChange and FilterComboBox onChange) for more predictable behavior.

  // Persist to URL on changes
  useEffect(() => {
    const params: Record<string, string> = {};
    if (query) params.q = query;
    if (sortKey) params.sortKey = sortKey;
    if (sortDir) params.sortDir = sortDir;
    if (currentPage > 1) params.page = String(currentPage);
    if (itemsPerPage !== 20) params.perPage = String(itemsPerPage);
    const statuses =
      (filters.status as string[] | undefined)?.filter(Boolean) ?? [];
    if (statuses.length) params.status = statuses.join(",");
    navigate({ to: "/projects", search: params, replace: true });
  }, [query, sortKey, sortDir, currentPage, itemsPerPage, filters, navigate]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        openPopover === "status" &&
        statusRef.current &&
        !statusRef.current.contains(t)
      )
        setOpenPopover(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openPopover]);

  const apiRows = useMemo<Row[]>(() => {
    const list = projectsResponse?.data ?? [];
    return list.map((p) => {
      const rawStatus = p.archived ? "archived" : (p.projectStatus ?? "active");
      const normalizedStatus = (String(rawStatus)
        .toLowerCase()
        .replace(/\s+/g, "-") || "active") as Row["status"];
      const address = [
        p.projectAddress,
        p.projectCity,
        p.projectState,
        p.projectZIP,
      ]
        .filter(Boolean)
        .join(", ")
        .replace(", ,", ",");
      const qrCount = typeof p.qrCodes === "number" ? p.qrCodes : 0;
      const groupsCount = typeof p.groups === "number" ? p.groups : 0;
      const updatedAt = p.createdAt;
      return {
        id: p._id ?? "",
        name: p.name || p.projectName || "Project Name",
        client: p.clientName ?? "",
        location: address,
        qrCodes: qrCount,
        groups: groupsCount,
        status: normalizedStatus,
        updated: formatDate(updatedAt ? new Date(updatedAt) : new Date()),
        icon:
          normalizedStatus === "active"
            ? "bx bx-building-house"
            : normalizedStatus === "completed"
              ? "bx bx-badge-check"
              : normalizedStatus === "on-hold"
                ? "bx bx-pause-circle"
                : "bx bx-archive",
        // Procore fields
        procoreProjectID: p.procoreProjectID || "",
        procoreCompanyID: p.procoreCompanyID || "",
        // Raw data for editing
        raw: {
          projectName: p.projectName || p.name || "",
          projectAddress: p.projectAddress || "",
          projectCity: p.projectCity || "",
          projectState: p.projectState || "",
          projectZIP: p.projectZIP || "",
          clientName: p.clientName || "",
        },
      } satisfies Row;
    });
  }, [projectsResponse?.data]);

  // Server handles search and status filtering for server-side pagination.
  // We only need to:
  // 1. Use apiRows directly (server already filtered and paginated)
  // 2. Exclude locally deleted rows (optimistic UI update)
  // NOTE: userRows are for local mock data before saving - in server-side mode,
  // newly created items should appear after refetch, not be mixed in.
  const filtered = useMemo(() => {
    // For server-side pagination, use server-provided rows directly
    // Only filter out rows that were locally deleted (optimistic delete)
    return apiRows.filter((r) => !deletedIds.has(r.id));
  }, [apiRows, deletedIds]);

  const allSelected =
    bulkActions &&
    selected.size > 0 &&
    filtered.every((r) => selected.has(r.id));
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.id)),
    [filtered, selected],
  );
  const allSelectedArchived =
    selectedRows.length > 0 &&
    selectedRows.every((r) => r.status === "archived");

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

  // Shared archive/unarchive executor for both modal-confirm and immediate actions
  async function processArchive(
    idsToProcess: string[],
    mode: "archive" | "unarchive",
  ) {
    // Start fade-out animation for archiving (rows will disappear from default view)
    // or fade animation for unarchiving (visual feedback before refresh)
    setArchivingIds((prev) => {
      const next = new Set(prev);
      idsToProcess.forEach((id) => next.add(id));
      return next;
    });

    // Wait for animation to complete before making API calls
    await new Promise((resolve) => setTimeout(resolve, 250));

    const backendIds = idsToProcess.filter(
      (id) => !id.startsWith("proj-user-"),
    );
    if (backendIds.length > 0) {
      if (mode === "archive") {
        await Promise.all(
          backendIds.map((id) =>
            patchProject(id, {
              companyId: user.companyId,
              archived: true,
              projectStatus: "archived",
            }),
          ),
        );
      } else {
        await Promise.all(
          backendIds.map((id) =>
            patchProject(id, {
              companyId: user.companyId,
              archived: false,
              projectStatus: "active",
            }),
          ),
        );
      }
    }
    // Update local user-created rows
    if (idsToProcess.some((id) => id.startsWith("proj-user-"))) {
      setUserRows((prev) =>
        prev.map((r) => {
          if (!idsToProcess.includes(r.id)) return r;
          if (mode === "archive")
            return { ...r, status: "archived", icon: "bx bx-archive" };
          return { ...r, status: "active", icon: "bx bx-building-house" };
        }),
      );
    }
    // Clear selection for processed rows
    setSelected((prev) => {
      const next = new Set(prev);
      idsToProcess.forEach((id) => next.delete(id));
      return next;
    });
    // Clear archiving animation state
    setArchivingIds((prev) => {
      const next = new Set(prev);
      idsToProcess.forEach((id) => next.delete(id));
      return next;
    });
    // Invalidate ALL project queries to ensure fresh data across all filter combinations
    // This fixes the issue where unarchived projects don't appear after clearing filters
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });

    // Reset to page 1 after archive/unarchive to prevent showing empty page
    // when the current page becomes invalid due to reduced item count
    setCurrentPage(1);
  }

  function statusVariant(s: Row["status"]): BadgeVariant {
    switch (s) {
      case "active":
        return "green";
      case "completed":
        return "blue";
      case "on-hold":
        return "yellow";
      case "archived":
        return "gray";
    }
  }

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        companyId={user.companyId}
        onSuccess={(newProjectId) => {
          navigate({ to: `/project/${newProjectId}` });
        }}
      />
      <ArchiveModal
        open={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setActionTargetId(null);
        }}
        onConfirm={async () => {
          setIsBulkArchiving(true);
          try {
            const idsToProcess: string[] = actionTargetId
              ? [actionTargetId]
              : Array.from(selected);
            await processArchive(idsToProcess, archiveMode);
            setShowArchiveModal(false);
            setActionTargetId(null);
            setbulkActions(false);
          } finally {
            setIsBulkArchiving(false);
          }
        }}
        isLoading={isBulkArchiving}
        subjectLabel="project"
        selectedCount={actionTargetId ? 1 : selected.size}
        confirmLabel={archiveMode === "archive" ? "Archive" : "Unarchive"}
        loadingLabel={archiveMode === "archive" ? "Archiving…" : "Unarchiving…"}
        bodyMessage={
          archiveMode === "archive"
            ? "Archived projects will be hidden from your active list. You can unarchive them later from project settings."
            : "This will restore the selected projects to Active."
        }
      />
      <DeleteModal
        open={showDeleteModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="project"
        bodyMessage="This will permanently delete the selected project(s) and all associated groups, QR codes, folders, documents, and Procore item links. This action cannot be undone."
        onClose={() => {
          setShowDeleteModal(false);
          setActionTargetId(null);
        }}
        isLoading={isBulkDeleting}
        onConfirm={async () => {
          setIsBulkDeleting(true);
          try {
            const idsToRemove: string[] = actionTargetId
              ? [actionTargetId]
              : Array.from(selected);
            // Start fade-out animation
            setRemovingIds((prev) => {
              const next = new Set(prev);
              idsToRemove.forEach((id) => next.add(id));
              return next;
            });
            // Call async delete API for backend-backed ids
            const backendIds = idsToRemove.filter(
              (id) => !id.startsWith("proj-user-"),
            );
            if (backendIds.length === 1) {
              const { jobId } = await deleteProjectAsync(
                user.companyId,
                backendIds[0],
              );
              addJob({
                jobId,
                status: "pending",
                progress: 0,
                total: 1,
                type: "bulk-project-delete",
              });
            } else if (backendIds.length > 0) {
              const { jobId } = await createBulkProjectDeleteJob(
                user.companyId,
                backendIds,
              );
              addJob({
                jobId,
                status: "pending",
                progress: 0,
                total: backendIds.length,
                type: "bulk-project-delete",
              });
            }

            toast.success("Deletion started");

            window.setTimeout(() => {
              // Remove user-created rows from state and hide any others
              setUserRows((prev) =>
                prev.filter((r) => !idsToRemove.includes(r.id)),
              );
              setDeletedIds((prev) => {
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
              setShowDeleteModal(false);
              setActionTargetId(null);
              setIsBulkDeleting(false);
              setbulkActions(false);
            }, 200);
          } catch {
            // Clear removing animation on error
            setRemovingIds(new Set());
            setIsBulkDeleting(false);
          }
        }}
      />
      <SetPasswordModal
        open={showSetPasswordModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="project"
        title="Set Group Passwords"
        subtitle={
          actionTargetId ? (
            <span>
              Set a password for all groups in this project and their QR codes.
            </span>
          ) : (
            <span>
              Set a password for all groups in {selected.size} project
              {selected.size === 1 ? "" : "s"} and their QR codes.
            </span>
          )
        }
        isLoading={isSettingPassword}
        loadingLabel="Setting password..."
        onClose={() => {
          setShowSetPasswordModal(false);
          setActionTargetId(null);
        }}
        onConfirmValues={async (vals) => {
          if (
            vals.passwordActivated &&
            (!vals.password || vals.password.trim() === "")
          ) {
            toast.error(
              "Password cannot be empty when activating password protection",
            );
            return;
          }

          const projectIds = actionTargetId
            ? [actionTargetId]
            : Array.from(selected);
          if (projectIds.length === 0) {
            toast.error("No projects selected");
            return;
          }

          setIsSettingPassword(true);
          let successCount = 0;
          let failCount = 0;

          try {
            for (const projectId of projectIds) {
              try {
                // Fetch all groups for this project
                const { data: groupsResponse } =
                  await axiosInstance.get<PaginatedGroupsResponse>("/groups", {
                    params: {
                      companyId: user.companyId,
                      projectId,
                      per_page: 1000,
                    },
                  });
                const groups = groupsResponse?.data ?? [];

                if (groups.length === 0) {
                  // No groups in this project — nothing to update
                  continue;
                }

                for (const group of groups) {
                  try {
                    await patchGroup(group._id, {
                      companyId: String(user.companyId || ""),
                      projectId,
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
                    successCount++;
                  } catch (e) {
                    if (import.meta.env.DEV) {
                      console.error(
                        `Failed to set password for group ${group._id}:`,
                        e,
                      );
                    }
                    failCount++;
                  }
                }
              } catch (e) {
                if (import.meta.env.DEV) {
                  console.error(
                    `Failed to fetch groups for project ${projectId}:`,
                    e,
                  );
                }
                failCount++;
              }
            }

            if (successCount > 0 && failCount === 0) {
              toast.success(
                `Password ${vals.passwordActivated ? "set" : "removed"} for ${successCount} group${successCount === 1 ? "" : "s"}`,
              );
            } else if (successCount > 0 && failCount > 0) {
              toast.success(
                `Password updated for ${successCount} group${successCount === 1 ? "" : "s"}, but ${failCount} failed`,
              );
            } else {
              toast.error("Failed to update password for all groups");
            }

            // Invalidate caches
            void queryClient.invalidateQueries({ queryKey: ["Groups"] });
            void queryClient.invalidateQueries({
              queryKey: ["Aggregation", "project-qrcodes"],
            });
            void refetch?.();

            setShowSetPasswordModal(false);
            setActionTargetId(null);
            if (!actionTargetId) {
              setSelected(new Set());
              setbulkActions(false);
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error("Failed to set password for projects:", e);
            }
            toast.error(
              e instanceof Error
                ? e.message
                : "Failed to set password. Please try again.",
            );
          } finally {
            setIsSettingPassword(false);
          }
        }}
      />

      {/* Edit Project Modal */}
      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingProject(null);
          setEditErrors({});
          setIsProcoreSectionExpanded(false);
        }}
        title="Edit Project"
        subtitle={<span>Update project details and Procore integration.</span>}
        size="lg"
        scrollable
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setEditingProject(null);
                setEditErrors({});
                setIsProcoreSectionExpanded(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                isSaving ||
                !editProjectName.trim() ||
                !editProjectCity.trim() ||
                !editProjectState.trim() ||
                !editProjectZIP.trim()
              }
              onClick={async () => {
                if (!editingProject) return;
                try {
                  setIsSaving(true);
                  const normalizedStatus =
                    editProjectStatus === "archived" ||
                    editProjectStatus === "active" ||
                    editProjectStatus === "completed" ||
                    editProjectStatus === "on-hold"
                      ? editProjectStatus
                      : undefined;
                  await patchProject(editingProject.id, {
                    companyId: user.companyId,
                    projectName: editProjectName.trim(),
                    projectAddress: editProjectAddress.trim(),
                    projectCity: editProjectCity.trim(),
                    projectState: editProjectState.trim(),
                    projectZIP: editProjectZIP.trim(),
                    clientName: editClientName.trim(),
                    projectStatus: normalizedStatus,
                    archived: normalizedStatus === "archived",
                    procoreProjectID: editProcoreProjectID || undefined,
                    procoreCompanyID: editProcoreCompanyID || undefined,
                  });
                  toast.success("Project updated successfully");
                  setShowEditModal(false);
                  setEditingProject(null);
                  setEditErrors({});
                  setIsProcoreSectionExpanded(false);
                  void refetch?.();
                } catch (e: unknown) {
                  const err = e as {
                    response?: {
                      data?: {
                        message?: string;
                        errors?: Record<string, string>;
                      };
                    };
                    message?: string;
                  };

                  // Extract field-specific errors if available
                  const fieldErrors = err?.response?.data?.errors;
                  if (
                    fieldErrors &&
                    typeof fieldErrors === "object" &&
                    Object.keys(fieldErrors).length > 0
                  ) {
                    setEditErrors(fieldErrors);
                    toast.error("Please fix the validation errors below");
                  } else {
                    setEditErrors({});
                    toast.error(
                      err?.response?.data?.message ||
                        err?.message ||
                        "Failed to update project",
                    );
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Procore Integration Section - Collapsible Accordion */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setIsProcoreSectionExpanded(!isProcoreSectionExpanded)
              }
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <img src={procoreIcon} alt="Procore" className="w-4 h-4" />
                Link to Procore Project
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (Optional)
                </span>
                {editProcoreProjectID && editProcoreProjectID !== "none" && (
                  <span className="text-green-600 text-xs font-normal ml-1 flex items-center gap-1">
                    <i className="bx bx-check-circle"></i>
                    Linked
                  </span>
                )}
              </h3>
              <i
                className={`bx bx-chevron-down text-gray-500 text-lg transition-transform duration-200 ${
                  isProcoreSectionExpanded ? "rotate-180" : ""
                }`}
              ></i>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isProcoreSectionExpanded
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 space-y-4">
                {procoreStatus?.isConnected ? (
                  <div className="transition-all duration-300 ease-in-out">
                    {/* Selected Project Display */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        editProcoreProjectID && editProcoreProjectID !== "none"
                          ? "max-h-24 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <i className="bx bx-check text-green-600"></i>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {flatProcoreProjects.find(
                                (p) => String(p.id) === editProcoreProjectID,
                              )?.name ||
                                `Procore Project #${editProcoreProjectID}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Linked to Procore
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditProcoreProjectID("");
                            setEditProcoreCompanyID("");
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>

                    {/* Search/Selection UI */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        !editProcoreProjectID || editProcoreProjectID === "none"
                          ? "max-h-96 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-600 mb-3">
                          Optionally link this project to a Procore project to
                          sync data.
                        </p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={procoreSearchQuery}
                            onChange={(e) =>
                              setProcoreSearchQuery(e.target.value)
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                            placeholder="Search Procore projects..."
                          />
                          {/* Loading State */}
                          <div
                            className={`overflow-hidden transition-all duration-200 ease-in-out ${
                              isProcoreLoading
                                ? "max-h-16 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="flex items-center justify-center py-4">
                              <i className="bx bx-loader-alt bx-spin text-orange-500 text-xl"></i>
                              <span className="ml-2 text-sm text-gray-500">
                                Loading projects...
                              </span>
                            </div>
                          </div>

                          {/* Error State */}
                          <div
                            className={`overflow-hidden transition-all duration-200 ease-in-out ${
                              !isProcoreLoading && hasProcoreProjectsError
                                ? "max-h-24 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                              <i className="bx bx-error-circle mr-2"></i>
                              {procoreProjectsErrorMessage}
                            </div>
                          </div>

                          {/* Projects List */}
                          <div
                            className={`overflow-hidden transition-all duration-200 ease-in-out ${
                              !isProcoreLoading &&
                              !hasProcoreProjectsError &&
                              flatProcoreProjects.length > 0
                                ? "max-h-40 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                              {flatProcoreProjects.map((project) => (
                                <button
                                  key={`${project.procoreCompanyId}-${project.id}`}
                                  type="button"
                                  onClick={() => {
                                    setEditProcoreProjectID(String(project.id));
                                    setEditProcoreCompanyID(
                                      String(project.procoreCompanyId),
                                    );
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-orange-50 transition-colors"
                                >
                                  <p className="text-sm font-medium text-gray-900">
                                    {project.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {project.procoreCompanyName}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* No Results Message */}
                          <div
                            className={`overflow-hidden transition-all duration-200 ease-in-out ${
                              !isProcoreLoading &&
                              !hasProcoreProjectsError &&
                              flatProcoreProjects.length === 0 &&
                              procoreSearchQuery
                                ? "max-h-12 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <p className="text-sm text-gray-500 text-center py-2">
                              No Procore projects found. Try a different search
                              term.
                            </p>
                          </div>

                          {/* Default Message */}
                          <div
                            className={`overflow-hidden transition-all duration-200 ease-in-out ${
                              !isProcoreLoading &&
                              !hasProcoreProjectsError &&
                              flatProcoreProjects.length === 0 &&
                              !procoreSearchQuery
                                ? "max-h-12 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <p className="text-sm text-gray-500 text-center py-2">
                              Type to search for Procore projects.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center transition-all duration-300 ease-in-out">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="bx bx-error text-amber-600"></i>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">
                      Procore Not Connected
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Connect Procore in Settings → Integrations to link
                      projects.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <i className="bx bx-building-house text-gray-500"></i>
              Project Details
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="Enter project name"
              />
              {editErrors.projectName && (
                <p className="mt-1 text-sm text-red-600">
                  {editErrors.projectName}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name
              </label>
              <input
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="Enter client name"
              />
              {editErrors.clientName && (
                <p className="mt-1 text-sm text-red-600">
                  {editErrors.clientName}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                value={editProjectAddress}
                onChange={(e) => setEditProjectAddress(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="123 Main St"
              />
              {editErrors.projectAddress && (
                <p className="mt-1 text-sm text-red-600">
                  {editErrors.projectAddress}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  value={editProjectCity}
                  onChange={(e) => setEditProjectCity(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="Anytown"
                />
                {editErrors.projectCity && (
                  <p className="mt-1 text-sm text-red-600">
                    {editErrors.projectCity}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  value={editProjectState}
                  onChange={(e) => setEditProjectState(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="CA"
                />
                {editErrors.projectState && (
                  <p className="mt-1 text-sm text-red-600">
                    {editErrors.projectState}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP
                </label>
                <input
                  value={editProjectZIP}
                  onChange={(e) => setEditProjectZIP(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="90001"
                />
                {editErrors.projectZIP && (
                  <p className="mt-1 text-sm text-red-600">
                    {editErrors.projectZIP}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={editProjectStatus}
                onChange={(e) => setEditProjectStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
              >
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <ListPageLayout
        title="Projects"
        titleIconClass="bx bx-folder text-orange-600"
        subtitle="View, search, and manage all projects across your company."
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
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Project
              </Button>
            )}
          </>
        }
        search={{
          value: query,
          onChange: (v) => {
            setSelected(new Set());
            setQuery(v);
            setCurrentPage(1); // Explicitly reset to page 1 on search
          },
          placeholder: "Search projects...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Status"
              options={[
                { label: "Active", value: "active" },
                { label: "Completed", value: "completed" },
                { label: "On Hold", value: "on-hold" },
                { label: "Archived", value: "archived" },
              ]}
              value={filters.status as unknown as string[] | undefined}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, status: next }));
                setCurrentPage(1); // Reset to page 1 on filter change
                setSelected(new Set());
              }}
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setFilters({});
                setQuery("");
                setCurrentPage(1);
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
          setCurrentPage(1);
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
                    leftIconClass="bx bxs-briefcase"
                    onClick={async () => {
                      setActionTargetId(null);
                      const mode = allSelectedArchived
                        ? "unarchive"
                        : "archive";
                      setArchiveMode(mode);
                      if (mode === "unarchive") {
                        // immediate, no modal
                        const ids = Array.from(selected);
                        if (ids.length > 0)
                          await processArchive(ids, "unarchive");
                        setbulkActions(false);
                      } else {
                        setShowArchiveModal(true);
                      }
                    }}
                  >
                    {allSelectedArchived ? "Unarchive" : "Archive"}
                  </Button>
                  {/* TODO: REIMPLEMENT AFTER V3 LAUNCH */}
                  {/* <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-lock-alt"
                    onClick={() => {
                      setActionTargetId(null);
                      setShowSetPasswordModal(true);
                    }}
                  >
                    Set Password
                  </Button> */}
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
                  label: allSelectedArchived ? "Unarchive" : "Archive",
                  value: allSelectedArchived ? "unarchive" : "archive",
                  iconClass: "bx bxs-briefcase",
                  onSelect: () => {
                    setActionTargetId(null);
                    setArchiveMode(
                      allSelectedArchived ? "unarchive" : "archive",
                    );
                    setShowArchiveModal(true);
                  },
                },
                // TODO: REIMPLEMENT AFTER V3 LAUNCH
                // {
                //   label: "Set Password",
                //   value: "password",
                //   iconClass: "bx bx-lock-alt",
                //   onSelect: () => {
                //     setActionTargetId(null);
                //     setShowSetPasswordModal(true);
                //   },
                // },
                // Only show delete option for admin users
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
          const columns: Column<Row>[] = [
            {
              key: "name",
              header: "Project Name",
              sortable: true,
              columnType: "primary",
              render: (r: Row) => (
                <div className="relative flex items-center">
                  <a
                    href={`/projects/${r.id}`}
                    className="absolute inset-0 z-0 top-0 left-0"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ to: `/project/${r.id}` });
                    }}
                    aria-label={`View ${r.name}`}
                  />
                  <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                    <Icon variant="rowType" type={r.status as RowType} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-indigo-700">
                        {r.name}
                      </span>
                      {r.procoreProjectID && r.procoreProjectID !== "none" && (
                        <img
                          src={procoreIcon}
                          alt="Linked to Procore"
                          title="Linked to Procore"
                          className="w-3 h-3"
                        />
                      )}
                    </div>
                    {r.client ? (
                      <span className="text-xs text-gray-500">{r.client}</span>
                    ) : null}
                  </div>
                </div>
              ),
            },
            {
              key: "location",
              header: "Location",
              sortable: true,
              className: "text-gray-500",
              columnType: "text",
              render: (r: Row) => {
                const street = r.raw?.projectAddress || "";
                const cityStateZip = [
                  r.raw?.projectCity,
                  r.raw?.projectState,
                  r.raw?.projectZIP,
                ]
                  .filter(Boolean)
                  .join(", ")
                  .replace(/, ,/g, ",");

                // If no raw data, fall back to the combined location string
                if (!r.raw) {
                  return <span>{r.location}</span>;
                }

                return (
                  <div className="flex flex-col">
                    {street && <span>{street}</span>}
                    {cityStateZip && (
                      <span className="text-xs text-gray-400">
                        {cityStateZip}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "qrCodes",
              header: "QR Codes",
              sortable: true,
              className: "text-gray-500",
              columnType: "status",
              render: (r: Row) => (
                <p className="pl-0.5">{formatCount(r.qrCodes)}</p>
              ),
            },
            {
              key: "groups",
              header: "Groups",
              sortable: true,
              className: "text-gray-500",
              columnType: "status",
              render: (r: Row) => (
                <p className="pl-0.5">{formatCount(r.groups ?? 0)}</p>
              ),
            },
            {
              key: "status",
              header: "Status",
              sortable: true,
              columnType: "status",
              render: (r: Row) => (
                <Badge variant={statusVariant(r.status)} shape="full">
                  {r.status === "active"
                    ? "Active"
                    : r.status === "completed"
                      ? "Completed"
                      : r.status === "on-hold"
                        ? "On Hold"
                        : "Archived"}
                </Badge>
              ),
            },
            {
              key: "updated",
              header: "Last Updated",
              sortable: true,
              className: "text-gray-500",
              columnType: "date",
            },
          ];

          // Check if user has applied search or filters
          const hasSearchOrFilters =
            query.trim() !== "" ||
            ((filters.status as string[] | undefined)?.length ?? 0) > 0;

          // Simple empty state check: show empty state only when we have no data AND we're not loading.
          // This pattern is proven to work correctly with keepPreviousData (see my-qrcodes.lazy.tsx).
          // isLoading = isPending && isFetching, which is only true on initial load with no cache.
          if (filtered.length === 0 && !isLoading) {
            return (
              <EmptyState
                icon={
                  <i className="bx bx-building-house text-orange-500 text-2xl" />
                }
                title={
                  hasSearchOrFilters ? "No Projects found" : "No Projects yet"
                }
                description={
                  hasSearchOrFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : canModify
                      ? "Create a project to organize your QR codes by location or client."
                      : "No projects have been created yet. Contact an admin to create projects."
                }
                actionLabel={
                  hasSearchOrFilters || !canModify
                    ? undefined
                    : "Create Project"
                }
                onActionClick={
                  hasSearchOrFilters || !canModify
                    ? undefined
                    : () => setShowCreateModal(true)
                }
                iconBgClass="bg-orange-50"
                compact
                className="h-full min-h-[400px]"
              />
            );
          }

          return (
            <DataTable<Row>
              columns={columns}
              rows={filtered}
              getRowId={(r: Row) => r.id}
              onRowClick={(r: Row) => navigate({ to: `/project/${r.id}` })}
              getRowUrl={(r: Row) => `/project/${r.id}`}
              showSelection={bulkActions}
              searchText={query}
              loadingState={loadingState}
              // Server-side pagination
              serverSide
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={Number(
                projectsResponse?.total_items ?? filtered.length,
              )}
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(perPage) => {
                setItemsPerPage(perPage);
                setCurrentPage(1);
              }}
              // Server-side sorting
              serverSideSort
              sortState={{ key: sortKey, dir: sortDir }}
              onSortChange={(key, dir) => {
                setSortKey(key);
                setSortDir(dir);
                setCurrentPage(1); // Reset to first page on sort change
              }}
              isRowSelected={(r: Row) => selected.has(r.id)}
              onToggleRow={(r: Row) => toggleRow(r.id)}
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              getRowClassName={(r: Row) => {
                if (removingIds.has(r.id)) {
                  return "transition-all duration-200 ease-in-out opacity-0 -translate-y-2";
                }
                if (archivingIds.has(r.id)) {
                  return "transition-all duration-250 ease-out opacity-0 scale-[0.98] bg-gray-50";
                }
                return "";
              }}
              renderActions={(r: Row) => {
                // Only show actions menu if user can modify
                if (!canModify) return null;

                const isArchived = r.status === "archived";
                const options: ItemComboBoxOption[] = [
                  {
                    label: "Edit",
                    value: "edit",
                    iconClass: "bx bx-pencil",
                  },
                  {
                    label: isArchived ? "Unarchive" : "Archive",
                    value: isArchived ? "unarchive" : "archive",
                    iconClass: "bx bx-archive",
                  },
                  // TODO: REIMPLEMENT AFTER V3 LAUNCH
                  // {
                  //   label: "Set Password",
                  //   value: "password",
                  //   iconClass: "bx bx-lock-alt",
                  // },
                  // Only show delete option for admin users
                  ...(userCanDelete
                    ? [
                        {
                          label: "Delete",
                          value: "delete",
                          iconClass: "bx bx-trash",
                        },
                      ]
                    : []),
                ];
                return (
                  <div
                    className="relative inline-block text-left"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        e.stopPropagation();
                    }}
                  >
                    <ItemComboBox
                      options={options.map((opt) => ({
                        ...opt,
                        onSelect: () => {
                          setActionTargetId(r.id);
                          if (opt.value === "edit") {
                            // Open edit modal with project data
                            setEditingProject(r);
                            setEditProjectName(r.raw?.projectName || r.name);
                            setEditClientName(
                              r.raw?.clientName || r.client || "",
                            );
                            setEditProjectAddress(r.raw?.projectAddress || "");
                            setEditProjectCity(r.raw?.projectCity || "");
                            setEditProjectState(r.raw?.projectState || "");
                            setEditProjectZIP(r.raw?.projectZIP || "");
                            setEditProjectStatus(r.status || "active");
                            setEditProcoreProjectID(r.procoreProjectID || "");
                            setEditProcoreCompanyID(r.procoreCompanyID || "");
                            setProcoreSearchQuery("");
                            setEditErrors({});
                            setShowEditModal(true);
                          } else if (opt.value === "archive") {
                            setArchiveMode("archive");
                            setShowArchiveModal(true);
                          } else if (opt.value === "unarchive") {
                            // immediate, no modal
                            void processArchive([r.id], "unarchive");
                          } else if (opt.value === "password")
                            setShowSetPasswordModal(true);
                          else if (opt.value === "delete")
                            setShowDeleteModal(true);
                        },
                      }))}
                      sourceId={`projects-actions-${r.id}`}
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
