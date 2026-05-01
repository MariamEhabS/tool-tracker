import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import Button from "@components/ui/Button";
import DataTable from "@components/table/DataTable";
import EmptyState from "@components/ui/EmptyState";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import DownloadModal from "@components/modal/taliho/DownloadModal";
import PrintItemsModal from "@components/modal/taliho/PrintItemsModal";
import DeleteModal from "@components/modal/taliho/DeleteModal";
import SetPasswordModal from "@components/modal/taliho/SetPasswordModal";
import EditModal from "@components/modal/taliho/EditModal";
import SearchFiltersCard, {
  type ActiveFilters,
} from "@components/ui/SearchFiltersCard";
import FilterComboBox from "@components/combobox/detail/FilterComboBox";
import BulkActionsBar from "@components/table/BulkActionsBar";
import {
  getGroupsTable,
  type GroupTableRow,
} from "@components/table/taliho/GroupsTable";
import { useListGroups } from "@/api/endpoints/groups";
import {
  patchGroup as patchGroupApi,
  createBulkGroupDeleteJob,
  getSingleGroup,
  type GroupApi,
} from "@/api/endpoints/groups";
import { addJob } from "@/utils/localStorage-jobs";
import { queryClient } from "@/api";
import { toast } from "react-hot-toast";
import { logApiError } from "@/utils/rollbar";
import { useDebounce } from "@/utils/helpers/tableHelpers";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import {
  projectStatusBadgeVariant,
  groupTypeBadgeVariant,
} from "@/utils/badge-helpers";
import type { GroupRow, GroupApiRow, ProjectDataType } from "./types";
import { transformGroupRows } from "./row-transforms";
import { useProjectPrint } from "./hooks/useProjectPrint";

interface ProjectGroupsTabProps {
  companyId: string;
  projectId: string;
  projectData: { data?: unknown } | undefined;
  projectDetails: ProjectDataType | undefined;
  companyRes: {
    data?: {
      companyName?: string;
      companyWebsite?: string;
      printBrandingLogo?: string;
    };
  };
  isProjectArchived: boolean;
  userCanDelete: boolean;
  userCanModify: boolean;
  bulkActionsGroup: boolean;
  setbulkActionsGroup: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ProjectGroupsTab({
  companyId,
  projectId,
  projectData,
  projectDetails,
  companyRes,
  isProjectArchived,
  userCanDelete,
  userCanModify,
  bulkActionsGroup,
  setbulkActionsGroup,
}: ProjectGroupsTabProps) {
  const navigate = useNavigate();

  // --- Query / filter state ---
  const [groupQuery, setGroupQuery] = useState("");
  const [groupFilters, setGroupFilters] = useState<ActiveFilters>({});

  // --- Pagination / sort ---
  const [groupCurrentPage, setGroupCurrentPage] = useState<number>(1);
  const [groupItemsPerPage, setGroupItemsPerPage] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("itemsPerPage:project-detail-groups");
      const n = Number(raw);
      return [12, 20, 24, 48].includes(n) ? n : 20;
    } catch {
      return 20;
    }
  });
  const [groupSortKey, setGroupSortKey] = useState<string | null>("date");
  const [groupSortDir, setGroupSortDir] = useState<"asc" | "desc">("desc");

  const debouncedGroupQuery = useDebounce(groupQuery, 300);

  // Type filter mapping
  const groupTypeFilterValues =
    (groupFilters.type as string[] | undefined) ?? [];
  const mappedGroupTypeValues = groupTypeFilterValues.map((v) =>
    v === "procore-drawings" ? "procore-drawing-codes" : v,
  ) as Array<"arrangement" | "equipment" | "procore-drawing-codes">;
  const groupTypeParam =
    mappedGroupTypeValues.length === 1 ? mappedGroupTypeValues[0] : undefined;
  const groupTypesParam =
    mappedGroupTypeValues.length > 1 ? mappedGroupTypeValues : undefined;

  // --- Server query ---
  const groupsQuery = useListGroups({
    companyId,
    projectId,
    per_page: groupItemsPerPage,
    current_page: groupCurrentPage,
    search: debouncedGroupQuery || undefined,
    type: groupTypeParam,
    types: groupTypesParam,
    sortBy: groupSortKey || undefined,
    sortDir: groupSortDir || undefined,
  });
  const { data: groupsApi } = groupsQuery;
  const groupsLoadingState = useTableLoadingState(groupsQuery);

  // --- Selection ---
  const [selectedGroup, setSelectedGroup] = useState<Set<string>>(new Set());
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [removingGroupIds, setRemovingGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [nameOverridesGroups, setNameOverridesGroups] = useState<
    Record<string, string>
  >({});

  // --- Row transforms ---
  const groupRows = useMemo<GroupRow[]>(() => {
    const list = (groupsApi as { data?: GroupApiRow[] })?.data ?? [];
    return transformGroupRows(list, nameOverridesGroups);
  }, [groupsApi, nameOverridesGroups]);

  const groupTypeOptions = useMemo(
    () => [
      { label: "Arrangement", value: "arrangement" },
      { label: "Equipment", value: "equipment" },
      { label: "Procore Drawings", value: "procore-drawings" },
    ],
    [],
  );

  const filteredGroups = useMemo(
    () => groupRows.filter((r) => !hiddenGroupIds.has(r.id)),
    [groupRows, hiddenGroupIds],
  );

  // --- Print targets ---
  const [printGroupIds, setPrintGroupIds] = useState<string[] | null>(null);
  const isGroupRowTarget = useMemo(
    () => Array.isArray(printGroupIds) && printGroupIds.length === 1,
    [printGroupIds],
  );
  const groupTargetRow = useMemo(
    () =>
      isGroupRowTarget
        ? groupRows.find((r) => r.id === (printGroupIds as string[])[0])
        : undefined,
    [isGroupRowTarget, printGroupIds, groupRows],
  );

  // --- Modal state ---
  const [actionTargetIdGroup, setActionTargetIdGroup] = useState<string | null>(
    null,
  );
  const [showDownloadGroupModal, setShowDownloadGroupModal] = useState(false);
  const [showPrintItemsGroupModal, setShowPrintItemsGroupModal] =
    useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [showSetPasswordGroupModal, setShowSetPasswordGroupModal] =
    useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [targetGroupData, setTargetGroupData] = useState<GroupApi | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Fetch group data when set password modal opens for a single group
  useEffect(() => {
    if (!showSetPasswordGroupModal || !actionTargetIdGroup) {
      setTargetGroupData(null);
      return;
    }

    const fetchGroupData = async () => {
      try {
        const response = await getSingleGroup(actionTargetIdGroup);
        setTargetGroupData(response.data);
      } catch (error) {
        logApiError(error, "group-data-fetch-failed", {
          companyId,
          groupId: actionTargetIdGroup,
        });
        if (import.meta.env.DEV) {
          console.error("Failed to fetch group data:", error);
        }
        setTargetGroupData(null);
      }
    };

    fetchGroupData();
  }, [showSetPasswordGroupModal, actionTargetIdGroup, companyId]);

  // --- Print hook ---
  const {
    isFetchingQrCodes,
    handleRefetchUrl,
    printItemGroups,
    printItems,
    totalQrCodeCount,
  } = useProjectPrint({
    companyId,
    projectId,
    projectData,
    showPrintItemsGroupModal,
    bulkActionsGroup,
    filteredGroups,
    selectedGroup,
    groupTargetRow,
  });

  // --- Select helpers ---
  const allSelectedGroup =
    bulkActionsGroup &&
    selectedGroup.size > 0 &&
    filteredGroups.every((r) => selectedGroup.has(r.id));

  function toggleRowGroup(id: string) {
    setSelectedGroup((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAllGroup() {
    if (allSelectedGroup)
      setSelectedGroup((prev) => {
        const next = new Set(prev);
        filteredGroups.forEach((r) => next.delete(r.id));
        return next;
      });
    else
      setSelectedGroup((prev) => {
        const next = new Set(prev);
        filteredGroups.forEach((r) => next.add(r.id));
        return next;
      });
  }

  // --- Table config ---
  const { columns, getRowId } = getGroupsTable({
    showProjectColumn: false,
    showTypeColumn: true,
    getGroupTypeBadgeVariant: groupTypeBadgeVariant,
    getProjectBadgeVariant: projectStatusBadgeVariant,
    getRowUrl: (r: GroupTableRow) => `/group/${r.id}`,
    onProjectClick: (r) => {
      if (r.projectId)
        navigate({
          to: "/project/$projectId",
          params: { projectId: r.projectId },
        });
    },
    onRowClick: (r: GroupTableRow) =>
      navigate({
        to: "/group/$groupId",
        params: { groupId: r.id },
      }),
  });

  return (
    <>
      {/* Modals */}
      <DownloadModal
        open={showDownloadGroupModal}
        selectedCount={actionTargetIdGroup ? 1 : selectedGroup.size}
        subjectLabel="group"
        onClose={() => {
          setShowDownloadGroupModal(false);
          setActionTargetIdGroup(null);
        }}
        onConfirm={() => {
          setShowDownloadGroupModal(false);
          setActionTargetIdGroup(null);
        }}
      />
      <PrintItemsModal
        open={showPrintItemsGroupModal}
        onClose={() => {
          setShowPrintItemsGroupModal(false);
          setPrintGroupIds(null);
        }}
        onConfirm={() => {
          setShowPrintItemsGroupModal(false);
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
            ? (groupRows.find((r) => r.id === printGroupIds[0])?.name ??
              "Group")
            : ""
        }
        projectLine={
          isGroupRowTarget
            ? (projectDetails?.projectName ?? "")
            : (projectDetails?.projectName ?? "My Groups")
        }
        clientName={
          isGroupRowTarget ? (projectDetails?.clientName ?? "") : undefined
        }
        addressLine={
          isGroupRowTarget && projectDetails
            ? `${projectDetails.projectAddress}, ${projectDetails.projectCity}, ${projectDetails.projectState} ${projectDetails.projectZIP}`
            : undefined
        }
        itemGroups={printItemGroups}
        items={printItemGroups ? undefined : printItems}
        isLoadingItems={isFetchingQrCodes}
        onRefetchUrl={handleRefetchUrl}
        allowMultiple
        maxItemsPerPage={12}
      />
      <SetPasswordModal
        open={showSetPasswordGroupModal}
        selectedCount={actionTargetIdGroup ? 1 : selectedGroup.size}
        subjectLabel="group"
        initialPasswordActivated={
          actionTargetIdGroup ? targetGroupData?.passwordActivated : undefined
        }
        initialPassword={
          actionTargetIdGroup ? targetGroupData?.password : undefined
        }
        initialTimezone={
          actionTargetIdGroup ? targetGroupData?.timezone : undefined
        }
        initialWeekdayPassword={
          actionTargetIdGroup ? targetGroupData?.weekdayPassword : undefined
        }
        initialWeekdayPasswordTimeStart={
          actionTargetIdGroup
            ? targetGroupData?.weekdayPasswordTimeStart
            : undefined
        }
        initialWeekdayPasswordTimeEnd={
          actionTargetIdGroup
            ? targetGroupData?.weekdayPasswordTimeEnd
            : undefined
        }
        initialWeekendPassword={
          actionTargetIdGroup ? targetGroupData?.weekendPassword : undefined
        }
        initialWeekendPasswordTimeStart={
          actionTargetIdGroup
            ? targetGroupData?.weekendPasswordTimeStart
            : undefined
        }
        initialWeekendPasswordTimeEnd={
          actionTargetIdGroup
            ? targetGroupData?.weekendPasswordTimeEnd
            : undefined
        }
        onClose={() => {
          setShowSetPasswordGroupModal(false);
          setActionTargetIdGroup(null);
          setTargetGroupData(null);
        }}
        onConfirmValues={async (values) => {
          try {
            const ids: string[] = actionTargetIdGroup
              ? [actionTargetIdGroup]
              : Array.from(selectedGroup);
            if (ids.length === 0) return;
            await Promise.all(
              ids.map((id) =>
                patchGroupApi(id, {
                  companyId,
                  projectId,
                  passwordActivated: values.passwordActivated,
                  password: values.password,
                  timezone: values.timezone,
                  weekdayPassword: values.weekdayPassword,
                  weekdayPasswordTimeStart: values.weekdayPasswordTimeStart,
                  weekdayPasswordTimeEnd: values.weekdayPasswordTimeEnd,
                  weekendPassword: values.weekendPassword,
                  weekendPasswordTimeStart: values.weekendPasswordTimeStart,
                  weekendPasswordTimeEnd: values.weekendPasswordTimeEnd,
                }),
              ),
            );
            toast.success("Group password settings saved.");
            await queryClient.invalidateQueries({ queryKey: ["Groups"] });
            await queryClient.invalidateQueries({
              queryKey: ["Aggregation", "project-qrcodes"],
            });
          } catch (e: unknown) {
            const err = e as { message?: string };
            toast.error(
              err?.message || "Failed to save group password settings.",
            );
          } finally {
            setShowSetPasswordGroupModal(false);
            setActionTargetIdGroup(null);
            setTargetGroupData(null);
          }
        }}
      />
      <EditModal
        open={showEditGroupModal}
        title="Edit Group"
        subtitle={<span>Update group details.</span>}
        fields={[
          {
            key: "name",
            label: "Name",
            type: "text",
            required: true,
            initialValue: actionTargetIdGroup
              ? (groupRows.find((r) => r.id === actionTargetIdGroup)?.name ??
                "")
              : "",
          },
          {
            key: "type",
            label: "Group Type",
            type: "select",
            required: true,
            initialValue: actionTargetIdGroup
              ? (groupRows.find((r) => r.id === actionTargetIdGroup)
                  ?.groupType ?? "arrangement")
              : "arrangement",
            options: [
              { label: "Arrangement", value: "arrangement" },
              { label: "Equipment", value: "equipment" },
            ],
          },
        ]}
        onClose={() => {
          setShowEditGroupModal(false);
          setActionTargetIdGroup(null);
        }}
        onConfirm={async (values) => {
          if (!actionTargetIdGroup) return;
          try {
            await patchGroupApi(actionTargetIdGroup, {
              companyId,
              projectId,
              groupName: String(values.name || "").trim(),
              type: values.type as "arrangement" | "equipment",
            });
            setNameOverridesGroups((prev) => ({
              ...prev,
              [actionTargetIdGroup]: values.name,
            }));
            toast.success("Group updated successfully.");
            await queryClient.invalidateQueries({ queryKey: ["Groups"] });
            await queryClient.invalidateQueries({
              queryKey: ["Aggregation", "project-qrcodes"],
            });
          } catch (e: unknown) {
            const err = e as { message?: string };
            toast.error(err?.message || "Failed to update group.");
          } finally {
            setShowEditGroupModal(false);
            setActionTargetIdGroup(null);
          }
        }}
      />
      <DeleteModal
        open={showDeleteGroupModal}
        selectedCount={actionTargetIdGroup ? 1 : selectedGroup.size}
        subjectLabel="group"
        bodyMessage="This will permanently delete the selected group(s) and all associated QR codes, folders, documents, and Procore item links. This action cannot be undone."
        isLoading={isDeletingGroup}
        onClose={() => {
          setShowDeleteGroupModal(false);
          setActionTargetIdGroup(null);
        }}
        onConfirm={async () => {
          const idsToRemove: string[] = actionTargetIdGroup
            ? [actionTargetIdGroup]
            : Array.from(selectedGroup);
          if (idsToRemove.length === 0) return;
          setIsDeletingGroup(true);
          try {
            setRemovingGroupIds((prev) => {
              const next = new Set(prev);
              idsToRemove.forEach((id) => next.add(id));
              return next;
            });

            const { jobId } = await createBulkGroupDeleteJob(
              companyId,
              idsToRemove,
              projectId,
            );
            addJob({
              jobId,
              status: "pending",
              progress: 0,
              total: idsToRemove.length,
              type: "bulk-group-delete",
            });

            toast.success("Deletion started");

            setSelectedGroup((prev) => {
              const next = new Set(prev);
              idsToRemove.forEach((id) => next.delete(id));
              return next;
            });
            window.setTimeout(() => {
              setHiddenGroupIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.add(id));
                return next;
              });
              setRemovingGroupIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.delete(id));
                return next;
              });
              setShowDeleteGroupModal(false);
              setActionTargetIdGroup(null);
              setbulkActionsGroup(false);
            }, 200);
          } catch (e: unknown) {
            setRemovingGroupIds(new Set());
            const err = e as { message?: string };
            toast.error(err?.message || "Failed to delete group(s).");
          } finally {
            setIsDeletingGroup(false);
          }
        }}
      />

      {/* Search / Filters */}
      <SearchFiltersCard
        search={{
          value: groupQuery,
          onChange: setGroupQuery,
          placeholder: "Search groups...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Group Type"
              options={groupTypeOptions}
              value={groupFilters.type as string[] | undefined}
              onChange={(next) =>
                setGroupFilters((prev) => ({
                  ...prev,
                  type: next,
                }))
              }
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setGroupFilters({});
                setGroupQuery("");
              }}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5 "
            >
              Clear Filters
            </Button>
          </>
        }
      />

      {/* Bulk actions bar */}
      {bulkActionsGroup ? (
        <BulkActionsBar
          selectedCount={selectedGroup.size}
          showSelectAll
          selectAllChecked={allSelectedGroup}
          onSelectAllChange={(checked) => {
            if (checked !== allSelectedGroup) toggleSelectAllGroup();
          }}
          onClearSelection={() => setSelectedGroup(new Set())}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                leftIconClass="bx bx-printer"
                onClick={() => {
                  setActionTargetIdGroup(null);
                  setShowPrintItemsGroupModal(true);
                }}
              >
                Print
              </Button>
              {userCanModify && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIconClass="bx bx-lock-alt"
                  disabled={isProjectArchived}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : undefined
                  }
                  onClick={() => {
                    setActionTargetIdGroup(null);
                    setShowSetPasswordGroupModal(true);
                  }}
                >
                  Set Password
                </Button>
              )}
              {userCanDelete && (
                <Button
                  type="button"
                  variant="danger"
                  leftIconClass="bx bx-trash"
                  disabled={isProjectArchived}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : undefined
                  }
                  onClick={() => {
                    setActionTargetIdGroup(null);
                    setShowDeleteGroupModal(true);
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
                setActionTargetIdGroup(null);
                setShowPrintItemsGroupModal(true);
              },
            },
            ...(userCanModify
              ? [
                  {
                    label: "Set Password",
                    value: "password",
                    iconClass: "bx bx-lock-alt",
                    disabled: isProjectArchived,
                    onSelect: () => {
                      setActionTargetIdGroup(null);
                      setShowSetPasswordGroupModal(true);
                    },
                  },
                ]
              : []),
            ...(userCanDelete
              ? [
                  {
                    label: "Delete",
                    value: "delete",
                    iconClass: "bx bx-trash",
                    disabled: isProjectArchived,
                    onSelect: () => {
                      setActionTargetIdGroup(null);
                      setShowDeleteGroupModal(true);
                    },
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {/* Data table */}
      <div className="relative z-0 bg-white rounded-lg shadow overflow-hidden flex-grow">
        {!groupsLoadingState.showSkeleton && filteredGroups.length === 0 ? (
          <EmptyState
            icon={<i className="bx bx-collection text-fuchsia-500 text-2xl" />}
            title={
              groupQuery.trim() !== "" || Object.keys(groupFilters).length > 0
                ? "No Groups found"
                : "No Groups yet"
            }
            description={
              groupQuery.trim() !== "" || Object.keys(groupFilters).length > 0
                ? "Try adjusting your search or filters to find what you're looking for."
                : isProjectArchived
                  ? "This project has been archived. No new groups can be created."
                  : "Create a group to organize multiple QR codes together for bulk operations."
            }
            actionLabel={
              groupQuery.trim() !== "" ||
              Object.keys(groupFilters).length > 0 ||
              isProjectArchived
                ? undefined
                : "Create Group"
            }
            onActionClick={
              groupQuery.trim() !== "" ||
              Object.keys(groupFilters).length > 0 ||
              isProjectArchived
                ? undefined
                : () =>
                    navigate({
                      to: "/create-qr",
                      search: {
                        projectId,
                        tab: "bulk",
                        groupMode: "new",
                      },
                    })
            }
            iconBgClass="bg-fuchsia-50"
            compact
            className="h-full min-h-[400px]"
          />
        ) : (
          <DataTable<GroupRow>
            columns={columns}
            rows={filteredGroups}
            getRowId={getRowId}
            loadingState={groupsLoadingState}
            serverSide={true}
            serverSideSort={true}
            sortState={
              groupSortKey ? { key: groupSortKey, dir: groupSortDir } : null
            }
            onSortChange={(key, dir) => {
              setGroupSortKey(key);
              setGroupSortDir(dir);
              setGroupCurrentPage(1);
            }}
            onRowClick={(r) =>
              navigate({
                to: "/group/$groupId",
                params: { groupId: r.id },
              })
            }
            currentPage={groupCurrentPage}
            itemsPerPage={groupItemsPerPage}
            totalItems={
              (groupsApi as { total_items?: number })?.total_items ??
              filteredGroups.length
            }
            onPageChange={(p) => setGroupCurrentPage(p)}
            onItemsPerPageChange={(v) => {
              setGroupItemsPerPage(v);
              setGroupCurrentPage(1);
              try {
                localStorage.setItem(
                  "itemsPerPage:project-detail-groups",
                  String(v),
                );
              } catch {
                // Ignore localStorage errors (e.g., private mode / quota)
              }
            }}
            showSelection={bulkActionsGroup}
            isRowSelected={(r) => selectedGroup.has(r.id)}
            onToggleRow={(r) => toggleRowGroup(r.id)}
            allSelected={allSelectedGroup}
            onToggleAll={toggleSelectAllGroup}
            getRowClassName={(r) =>
              removingGroupIds.has(r.id)
                ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
                : ""
            }
            renderActions={(r: GroupRow) => {
              const options: ItemComboBoxOption[] = [
                {
                  label: "Edit",
                  value: "edit",
                  iconClass: "bx bx-pencil",
                  disabled: isProjectArchived,
                  onSelect: () => {
                    setActionTargetIdGroup(r.id);
                    setShowEditGroupModal(true);
                  },
                },
                {
                  label: "Print",
                  value: "print",
                  iconClass: "bx bx-printer",
                  onSelect: () => {
                    setActionTargetIdGroup(r.id);
                    setPrintGroupIds([r.id]);
                    setShowPrintItemsGroupModal(true);
                  },
                },
                ...(userCanModify
                  ? [
                      {
                        label: "Set Password",
                        value: "password",
                        iconClass: "bx bx-lock-alt",
                        disabled: isProjectArchived,
                        onSelect: () => {
                          setActionTargetIdGroup(r.id);
                          setShowSetPasswordGroupModal(true);
                        },
                      },
                    ]
                  : []),
                ...(userCanDelete
                  ? [
                      {
                        label: "Delete",
                        value: "delete",
                        iconClass: "bx bx-trash",
                        disabled: isProjectArchived,
                        onSelect: () => {
                          setActionTargetIdGroup(r.id);
                          setShowDeleteGroupModal(true);
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
                    sourceId={`project-groups-actions-${r.id}`}
                  />
                </div>
              );
            }}
          />
        )}
      </div>
    </>
  );
}
