import { useMemo, useState, useCallback } from "react";
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
  getQRCodesTable,
  type QRCodeTableRow,
} from "@components/table/taliho/QRCodesTable";
import { useProjectQRCodes } from "@/api/endpoints/aggregation";
import {
  updateQRCodeDetails,
  createBulkQRDeleteJob,
  useSingleQRCode,
  QrKeys,
  fetchSignedUrl,
} from "@/api/endpoints/qr-codes";
import { addJob } from "@/utils/localStorage-jobs";
import { queryClient } from "@/api";
import { toast } from "react-hot-toast";
import { useDebounce } from "@/utils/helpers/tableHelpers";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import { groupBadgeVariant } from "@/utils/badge-helpers";
import type { QuickRow, QRRow, QRImageRow, ProjectDataType } from "./types";
import { transformQRRows, buildQRImageMap } from "./row-transforms";

interface ProjectQRCodesTabProps {
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
  bulkActions: boolean;
  setbulkActions: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ProjectQRCodesTab({
  companyId,
  projectId,
  projectData,
  projectDetails,
  companyRes,
  isProjectArchived,
  userCanDelete,
  userCanModify,
  bulkActions,
  setbulkActions,
}: ProjectQRCodesTabProps) {
  const navigate = useNavigate();

  // --- Query / filter state ---
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>({});

  // --- Pagination / sort ---
  const [quickCurrentPage, setQuickCurrentPage] = useState<number>(1);
  const [quickItemsPerPage, setQuickItemsPerPage] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("itemsPerPage:project-detail-quick");
      const n = Number(raw);
      return [12, 20, 24, 48].includes(n) ? n : 20;
    } catch {
      return 20;
    }
  });
  const [quickSortKey, setQuickSortKey] = useState<string | null>("date");
  const [quickSortDir, setQuickSortDir] = useState<"asc" | "desc">("desc");

  const debouncedQuickQuery = useDebounce(query, 300);
  const quickTypeFilters = (filters.type as string[] | undefined) ?? [];
  const quickGroupTypeFilters = useMemo(
    () => (filters.groupType as string[] | undefined) ?? [],
    [filters.groupType],
  );

  // Map UI filter values to backend type values
  const quickGroupingTypes = useMemo(() => {
    if (quickGroupTypeFilters.length === 0) return undefined;
    return quickGroupTypeFilters.map((v) =>
      v === "procore-drawings" ? "procore-drawing-codes" : v,
    );
  }, [quickGroupTypeFilters]);

  const quickGroupingType = useMemo(() => {
    if (quickGroupTypeFilters.length !== 1) return undefined;
    const filter = quickGroupTypeFilters[0];
    if (filter === "procore-drawings") return "procore-drawing-codes";
    return filter as "equipment" | "arrangement" | "none";
  }, [quickGroupTypeFilters]);

  // --- Server query ---
  const qrCodesQuery = useProjectQRCodes({
    companyId,
    projectId,
    per_page: quickItemsPerPage,
    current_page: quickCurrentPage,
    search: debouncedQuickQuery || undefined,
    groupingType: quickGroupingType,
    groupingTypes: quickGroupingTypes,
    types: quickTypeFilters.length ? quickTypeFilters : undefined,
    sortBy: quickSortKey === "group" ? "group" : quickSortKey || undefined,
    sortDir: quickSortDir || undefined,
  });
  const { data: qrApi } = qrCodesQuery;
  const qrLoadingState = useTableLoadingState(qrCodesQuery);

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenQuickIds, setHiddenQuickIds] = useState<Set<string>>(new Set());
  const [removingQuickIds, setRemovingQuickIds] = useState<Set<string>>(
    new Set(),
  );
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {},
  );

  // --- Row transforms ---
  const quickRows = useMemo<QuickRow[]>(() => {
    const rows = (qrApi as { data?: QRRow[] })?.data ?? [];
    return transformQRRows(rows, nameOverrides);
  }, [qrApi, nameOverrides]);

  const { typeOptions, quickGroupTypeOptions } = useMemo(() => {
    const typeLabel: Record<QuickRow["type"], string> = {
      file: "File",
      folder: "Taliho",
      url: "URL",
      static: "Static",
      "procore-tool": "Procore Tool",
      "procore-location": "Procore Location",
      "procore-drawing-code": "Procore Drawing",
    };
    const typeOrder: QuickRow["type"][] = [
      "file",
      "folder",
      "url",
      "static",
      "procore-tool",
      "procore-location",
      "procore-drawing-code",
    ];
    const types = typeOrder.map((t) => ({ label: typeLabel[t], value: t }));
    const quickGroupTypeOptions = [
      { label: "Arrangement", value: "arrangement" },
      { label: "Equipment", value: "equipment" },
      { label: "Procore Drawings", value: "procore-drawings" },
      { label: "Unassigned", value: "none" },
    ];
    return { typeOptions: types, quickGroupTypeOptions };
  }, []);

  const qrImageById = useMemo(() => {
    const rows = (qrApi as { data?: QRImageRow[] })?.data ?? [];
    return buildQRImageMap(rows);
  }, [qrApi]);

  const filteredQuick = useMemo(
    () => quickRows.filter((r) => !hiddenQuickIds.has(r.id)),
    [quickRows, hiddenQuickIds],
  );

  // --- Print targets ---
  const [printQuickIds, setPrintQuickIds] = useState<string[] | null>(null);
  const targetedQuickRow = useMemo(
    () =>
      Array.isArray(printQuickIds) && printQuickIds.length > 0
        ? quickRows.find((r) => r.id === printQuickIds[0])
        : undefined,
    [printQuickIds, quickRows],
  );
  const selectedQuickItems = useMemo(() => {
    const targetIds = new Set<string>(
      printQuickIds && printQuickIds.length > 0
        ? printQuickIds
        : Array.from(selected),
    );
    const sel = quickRows.filter((r) => targetIds.has(r.id));
    return sel.map((r) => ({
      name: r.name,
      imgSrc: qrImageById.get(r.id) || "",
      qrCodeId: r.id,
    }));
  }, [quickRows, selected, printQuickIds, qrImageById]);

  const isQuickRowTarget = useMemo(
    () => Array.isArray(printQuickIds) && printQuickIds.length > 0,
    [printQuickIds],
  );

  // Stable callback for refetching signed URLs
  const handleRefetchUrl = useCallback(async (qrCodeId: string) => {
    return await fetchSignedUrl(qrCodeId);
  }, []);

  // --- Select helpers ---
  const allSelected =
    bulkActions &&
    selected.size > 0 &&
    filteredQuick.every((r) => selected.has(r.id));

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
        filteredQuick.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredQuick.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }

  // --- Modal state ---
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPrintItemsModal, setShowPrintItemsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeletingQRCode, setIsDeletingQRCode] = useState(false);
  const [isEditingQRCode, setIsEditingQRCode] = useState(false);

  const { data: editQrCodeData } = useSingleQRCode(actionTargetId ?? "");

  // --- Table config ---
  const { columns, getRowId } = getQRCodesTable({
    showProjectColumn: false,
    getGroupBadgeVariant: groupBadgeVariant,
    getRowUrl: (r: QRCodeTableRow) => `/qrcode/${r.id}`,
    onRowClick: (r: QRCodeTableRow) =>
      navigate({
        to: "/qrcode/$qrcodeId",
        params: { qrcodeId: r.id },
      }),
    onGroupClick: (r) => {
      if (r.groupId)
        navigate({
          to: "/group/$groupId",
          params: { groupId: r.groupId },
        });
    },
  });

  return (
    <>
      {/* Modals */}
      <DownloadModal
        open={showDownloadModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="QR code"
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
          setPrintQuickIds(null);
        }}
        onConfirm={() => {
          setShowPrintItemsModal(false);
          setPrintQuickIds(null);
        }}
        selectedCount={isQuickRowTarget ? 1 : selected.size}
        title={isQuickRowTarget ? "Print QR Code" : "Print QR Codes"}
        subtitle={
          <span>
            Configure print options for {isQuickRowTarget ? 1 : selected.size}{" "}
            selected item{isQuickRowTarget || selected.size === 1 ? "" : "s"}.
          </span>
        }
        companyName={companyRes.data?.companyName ?? "Taliho"}
        companyWebsite={companyRes.data?.companyWebsite}
        brandLogoSrc={companyRes.data?.printBrandingLogo}
        clientName={projectDetails?.clientName || ""}
        projectLine={projectDetails?.projectName || ""}
        addressLine={
          projectData
            ? `${projectDetails?.projectAddress}, ${projectDetails?.projectCity}, ${projectDetails?.projectState} ${projectDetails?.projectZIP}`
            : ""
        }
        groupLine={
          isQuickRowTarget ? (targetedQuickRow?.group ?? "") : "My QR Codes"
        }
        items={selectedQuickItems}
        allowMultiple={!isQuickRowTarget}
        maxItemsPerPage={isQuickRowTarget ? 1 : 12}
        inlinePrint={true}
        onRefetchUrl={handleRefetchUrl}
      />
      <SetPasswordModal
        open={showSetPasswordModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="QR code"
        initialPasswordActivated={
          actionTargetId ? editQrCodeData?.data?.passwordActivated : undefined
        }
        initialPassword={
          actionTargetId ? editQrCodeData?.data?.password : undefined
        }
        initialTimezone={
          actionTargetId ? editQrCodeData?.data?.timezone : undefined
        }
        initialWeekdayPassword={
          actionTargetId ? editQrCodeData?.data?.weekdayPassword : undefined
        }
        initialWeekdayPasswordTimeStart={
          actionTargetId
            ? editQrCodeData?.data?.weekdayPasswordTimeStart
            : undefined
        }
        initialWeekdayPasswordTimeEnd={
          actionTargetId
            ? editQrCodeData?.data?.weekdayPasswordTimeEnd
            : undefined
        }
        initialWeekendPassword={
          actionTargetId ? editQrCodeData?.data?.weekendPassword : undefined
        }
        initialWeekendPasswordTimeStart={
          actionTargetId
            ? editQrCodeData?.data?.weekendPasswordTimeStart
            : undefined
        }
        initialWeekendPasswordTimeEnd={
          actionTargetId
            ? editQrCodeData?.data?.weekendPasswordTimeEnd
            : undefined
        }
        onClose={() => {
          setShowSetPasswordModal(false);
          setActionTargetId(null);
        }}
        onConfirmValues={async (values) => {
          try {
            const targetIds: string[] = actionTargetId
              ? [actionTargetId]
              : Array.from(selected);
            if (targetIds.length === 0) return;
            await Promise.all(
              targetIds.map((id) =>
                updateQRCodeDetails(id, {
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
            toast.success(
              targetIds.length > 1
                ? "Password settings saved."
                : "Password settings saved.",
            );
            await queryClient.invalidateQueries({
              queryKey: ["Aggregation", "project-qrcodes"],
            });
            if (actionTargetId) {
              void queryClient.invalidateQueries({
                queryKey: QrKeys.single(actionTargetId),
              });
            }
          } catch (e: unknown) {
            const err = e as { message?: string };
            toast.error(err?.message || "Failed to save password settings.");
          } finally {
            setShowSetPasswordModal(false);
            setActionTargetId(null);
          }
        }}
      />
      <EditModal
        open={showEditModal}
        title="Edit QR Code"
        subtitle={<span>Update your QR code details.</span>}
        isLoading={isEditingQRCode}
        fields={[
          {
            key: "name",
            label: "Name",
            type: "text",
            required: true,
            initialValue: actionTargetId
              ? (quickRows.find((q) => q.id === actionTargetId)?.name ?? "")
              : "",
          },
          {
            key: "description",
            label: "Description",
            type: "textarea",
            placeholder: "(Optional)",
            initialValue: editQrCodeData?.data?.description ?? "",
          },
        ]}
        onClose={() => {
          setShowEditModal(false);
          setActionTargetId(null);
        }}
        onConfirm={async (values) => {
          if (!actionTargetId) return;
          setIsEditingQRCode(true);
          try {
            await updateQRCodeDetails(actionTargetId, {
              companyId,
              projectId,
              qrcodeName: String(values.name || "").trim(),
              description: values.description,
            });
            setNameOverrides((prev) => ({
              ...prev,
              [actionTargetId]: values.name,
            }));
            toast.success("QR code updated.");
            await queryClient.invalidateQueries({
              queryKey: QrKeys.single(actionTargetId),
            });
            await queryClient.invalidateQueries({
              queryKey: ["Aggregation", "project-qrcodes"],
            });
          } catch (e: unknown) {
            const err = e as { message?: string };
            toast.error(err?.message || "Failed to update QR code.");
          } finally {
            setIsEditingQRCode(false);
            setShowEditModal(false);
            setActionTargetId(null);
          }
        }}
      />
      <DeleteModal
        open={showDeleteModal}
        selectedCount={actionTargetId ? 1 : selected.size}
        subjectLabel="QR code"
        isLoading={isDeletingQRCode}
        onClose={() => {
          setShowDeleteModal(false);
          setActionTargetId(null);
        }}
        onConfirm={() => {
          (async () => {
            const idsToRemove: string[] = actionTargetId
              ? [actionTargetId]
              : Array.from(selected);
            if (idsToRemove.length === 0) return;
            setIsDeletingQRCode(true);
            try {
              setRemovingQuickIds((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.add(id));
                return next;
              });

              const { jobId } = await createBulkQRDeleteJob(
                companyId,
                idsToRemove,
                projectId,
              );
              addJob({
                jobId,
                status: "pending",
                progress: 0,
                total: idsToRemove.length,
                type: "bulk-qr-delete",
              });

              toast.success("Deletion started");

              setSelected((prev) => {
                const next = new Set(prev);
                idsToRemove.forEach((id) => next.delete(id));
                return next;
              });
              window.setTimeout(() => {
                setHiddenQuickIds((prev) => {
                  const next = new Set(prev);
                  idsToRemove.forEach((id) => next.add(id));
                  return next;
                });
                setRemovingQuickIds((prev) => {
                  const next = new Set(prev);
                  idsToRemove.forEach((id) => next.delete(id));
                  return next;
                });
                setShowDeleteModal(false);
                setActionTargetId(null);
                setbulkActions(false);
              }, 200);
            } catch (e: unknown) {
              setRemovingQuickIds(new Set());
              const err = e as { message?: string };
              toast.error(err?.message || "Failed to delete QR code(s).");
            } finally {
              setIsDeletingQRCode(false);
            }
          })();
        }}
      />

      {/* Search / Filters */}
      <SearchFiltersCard
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Search quick codes...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="QR Type"
              options={typeOptions}
              value={filters.type as string[] | undefined}
              onChange={(next) =>
                setFilters((prev) => ({ ...prev, type: next }))
              }
            />
            <FilterComboBox
              multiple
              placeholder="Group"
              options={quickGroupTypeOptions}
              value={filters.groupType as string[] | undefined}
              onChange={(next) =>
                setFilters((prev) => ({
                  ...prev,
                  groupType: next,
                }))
              }
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setFilters({});
                setQuery("");
              }}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5 "
            >
              Clear Filters
            </Button>
          </>
        }
      />

      {/* Bulk actions bar */}
      {bulkActions ? (
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
                  setActionTargetId(null);
                  setShowPrintItemsModal(true);
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
                    setActionTargetId(null);
                    setShowSetPasswordModal(true);
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
                setActionTargetId(null);
                setShowPrintItemsModal(true);
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
                      setActionTargetId(null);
                      setShowSetPasswordModal(true);
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
                      setActionTargetId(null);
                      setShowDeleteModal(true);
                    },
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {/* Data table */}
      <div className="relative z-0 bg-white rounded-lg shadow overflow-hidden flex-grow">
        {!qrLoadingState.showSkeleton && filteredQuick.length === 0 ? (
          <EmptyState
            icon={<i className="bx bx-qr-scan text-blue-500 text-2xl" />}
            title={
              query.trim() !== "" || Object.keys(filters).length > 0
                ? "No QR Codes found"
                : "No QR Codes yet"
            }
            description={
              query.trim() !== "" || Object.keys(filters).length > 0
                ? "Try adjusting your search or filters to find what you're looking for."
                : isProjectArchived
                  ? "This project has been archived. No new QR codes can be created."
                  : "Create your first QR code to start organizing your project."
            }
            actionLabel={
              query.trim() !== "" ||
              Object.keys(filters).length > 0 ||
              isProjectArchived
                ? undefined
                : "Create QR Code"
            }
            onActionClick={
              query.trim() !== "" ||
              Object.keys(filters).length > 0 ||
              isProjectArchived
                ? undefined
                : () =>
                    navigate({
                      to: "/create-qr",
                      search: { projectId },
                    })
            }
            iconBgClass="bg-blue-50"
            compact
            className="h-full min-h-[400px]"
          />
        ) : (
          <DataTable<QuickRow>
            columns={columns}
            rows={filteredQuick}
            getRowId={getRowId}
            loadingState={qrLoadingState}
            serverSide={true}
            serverSideSort={true}
            sortState={
              quickSortKey ? { key: quickSortKey, dir: quickSortDir } : null
            }
            onSortChange={(key, dir) => {
              setQuickSortKey(key);
              setQuickSortDir(dir);
              setQuickCurrentPage(1);
            }}
            currentPage={quickCurrentPage}
            itemsPerPage={quickItemsPerPage}
            totalItems={
              (qrApi as { total_items?: number })?.total_items ??
              filteredQuick.length
            }
            onPageChange={(p) => setQuickCurrentPage(p)}
            onItemsPerPageChange={(v) => {
              setQuickItemsPerPage(v);
              setQuickCurrentPage(1);
              try {
                localStorage.setItem(
                  "itemsPerPage:project-detail-quick",
                  String(v),
                );
              } catch {
                // Ignore localStorage errors (e.g., private mode / quota)
              }
            }}
            onRowClick={(r) =>
              navigate({
                to: "/qrcode/$qrcodeId",
                params: { qrcodeId: r.id },
              })
            }
            showSelection={bulkActions}
            isRowSelected={(r) => selected.has(r.id)}
            onToggleRow={(r) => toggleRow(r.id)}
            allSelected={allSelected}
            onToggleAll={toggleSelectAll}
            getRowClassName={(r) =>
              removingQuickIds.has(r.id)
                ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
                : ""
            }
            renderActions={(r: QuickRow) => {
              const options: ItemComboBoxOption[] = [
                {
                  label: "Edit",
                  value: "edit",
                  iconClass: "bx bx-pencil",
                  disabled: isProjectArchived,
                  onSelect: () => {
                    setActionTargetId(r.id);
                    setShowEditModal(true);
                  },
                },
                {
                  label: "Print",
                  value: "print",
                  iconClass: "bx bx-printer",
                  onSelect: () => {
                    setActionTargetId(r.id);
                    setPrintQuickIds([r.id]);
                    setShowPrintItemsModal(true);
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
                          setActionTargetId(r.id);
                          setShowSetPasswordModal(true);
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
                          setActionTargetId(r.id);
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
                    sourceId={`project-qrcodes-actions-${r.id}`}
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
