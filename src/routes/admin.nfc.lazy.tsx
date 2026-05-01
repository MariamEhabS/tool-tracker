import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  useNfcList,
  useNfcBatchNames,
  createNfcBatch,
  downloadNfcBatchCsv,
  updateNfc,
  deleteNfc,
  NfcKeys,
  type NfcTag,
  type NfcListParams,
  type CreateNfcBatchParams,
  type UpdateNfcParams,
} from "@/api/endpoints/nfc";
import ListPageLayout from "@/components/layout/ListPageLayout";
import DataTable from "@/components/table/DataTable";
import type { Column } from "@/components/table/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterComboBox from "@/components/combobox/detail/FilterComboBox";
import ItemComboBox from "@/components/combobox/detail/ItemComboBox";
import type { ItemComboBoxOption } from "@/components/combobox/detail/ItemComboBox";
import SearchComboBox, {
  type SearchComboBoxOption,
} from "@/components/combobox/detail/SearchComboBox";
import Modal from "@/components/modal/Modal";
import NfcMetadataBackfillModal from "@/components/modal/taliho/NfcMetadataBackfillModal";
import { useAdminCompanies } from "@/api/endpoints/admin-customers";
import { formatDate } from "@/lib/format";
import type { ActiveFilters } from "@/components/ui/SearchFiltersCard";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import { useDebounce } from "@/utils/helpers/tableHelpers";
import { getStoredUser } from "@/utils/getStoredUser";

// ── Enums (mirroring backend) ──────────────────────────────────────────

const NFC_TAG_TYPES = [
  { label: "Card", value: "card" },
  { label: "Zip Tie", value: "zip_tie" },
  { label: "Sticker", value: "sticker" },
  { label: "Key Fob", value: "key_fob" },
  { label: "Wristband", value: "wristband" },
  { label: "Other", value: "other" },
] as const;

const NFC_PURPOSES = [
  { label: "Customer", value: "customer" },
  { label: "Marketing", value: "marketing" },
  { label: "Unassigned", value: "unassigned" },
] as const;

// ── Zod schemas ────────────────────────────────────────────────────────

const createBatchSchema = z
  .object({
    batchName: z.string().optional(),
    count: z.coerce
      .number()
      .int("Must be a whole number")
      .min(1, "Minimum 1 tag")
      .max(500, "Maximum 500 tags"),
    tagType: z.string().min(1, "Tag type is required"),
    purpose: z.enum(["customer", "marketing"], {
      required_error: "Purpose is required",
    }),
    company: z.string().optional(),
    websiteOverrideRedirect: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.purpose === "customer" && !data.company) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company"],
        message: "Company is required for customer purpose",
      });
    }

    if (data.purpose === "marketing") {
      const redirect = data.websiteOverrideRedirect?.trim() ?? "";
      if (!redirect) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["websiteOverrideRedirect"],
          message: "Website redirect is required for marketing purpose",
        });
        return;
      }

      const validUrl = z.string().url().safeParse(redirect).success;
      if (!validUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["websiteOverrideRedirect"],
          message: "Please enter a valid URL",
        });
      }
    }
  });

type CreateBatchFormData = z.infer<typeof createBatchSchema>;

const editNfcSchema = z.object({
  purpose: z.string().min(1, "Purpose is required"),
  tagType: z.string().min(1, "Tag type is required"),
  websiteOverrideRedirect: z.string().optional(),
  qrcodeRedirect: z.string().optional(),
});

type EditNfcFormData = z.infer<typeof editNfcSchema>;

// ── Helpers ────────────────────────────────────────────────────────────

function purposeBadgeVariant(
  purpose?: string,
): "green" | "blue" | "gray" | "orange" {
  switch (purpose) {
    case "customer":
      return "green";
    case "marketing":
      return "blue";
    case "unassigned":
      return "gray";
    default:
      return "orange";
  }
}

function tagTypeBadgeVariant(
  tagType?: string,
): "indigo" | "purple" | "teal" | "cyan" | "pink" | "gray" {
  switch (tagType) {
    case "card":
      return "indigo";
    case "zip_tie":
      return "purple";
    case "sticker":
      return "teal";
    case "key_fob":
      return "cyan";
    case "wristband":
      return "pink";
    case "other":
      return "gray";
    default:
      return "gray";
  }
}

function tagTypeLabel(tagType?: string): string {
  const found = NFC_TAG_TYPES.find((t) => t.value === tagType);
  return found ? found.label : tagType || "-";
}

function purposeLabel(purpose?: string): string {
  const found = NFC_PURPOSES.find((p) => p.value === purpose);
  return found ? found.label : purpose || "-";
}

// ── Route definition ───────────────────────────────────────────────────

export const Route = createLazyFileRoute("/admin/nfc")({
  component: AdminNfc,
});

// ── Component ──────────────────────────────────────────────────────────

function AdminNfc() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Table state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<ActiveFilters>({});

  // Modal state
  const [editingTag, setEditingTag] = useState<NfcTag | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingTag, setDeletingTag] = useState<NfcTag | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showBackfillMetadataModal, setShowBackfillMetadataModal] =
    useState(false);

  // Batch creation loading state
  const [batchCreating, setBatchCreating] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const debouncedCompanySearch = useDebounce(companySearch, 300);

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  // ── Build params from filters ──────────────────────────────────────

  const purposeFilter = Array.isArray(filters.purpose)
    ? filters.purpose.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const tagTypeFilter = Array.isArray(filters.tagType)
    ? filters.tagType.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const assignedFilter =
    typeof filters.assigned === "string" ? filters.assigned : undefined;
  const batchNameFilter =
    typeof filters.batchName === "string" ? filters.batchName : undefined;

  const params: NfcListParams = {
    page,
    limit,
    search: query || undefined,
    sortBy,
    sortDir,
    purpose: purposeFilter?.length ? purposeFilter.join(",") : undefined,
    tagType: tagTypeFilter?.length ? tagTypeFilter.join(",") : undefined,
    batchName: batchNameFilter || undefined,
    assigned:
      assignedFilter === "true"
        ? true
        : assignedFilter === "false"
          ? false
          : undefined,
  };

  // ── Queries ────────────────────────────────────────────────────────

  const listQuery = useNfcList(params);
  const batchNamesQuery = useNfcBatchNames();
  const companiesQuery = useAdminCompanies({
    page: 1,
    limit: 100,
    sortBy: "companyName",
    sortDir: "asc",
    search: debouncedCompanySearch || undefined,
  });
  const { data: listData, isLoading } = listQuery;
  const loadingState = useTableLoadingState(listQuery);
  const batchNameOptions = (batchNamesQuery.data?.batchNames ?? []).map(
    (batchName) => ({
      label: batchName,
      value: batchName,
    }),
  );
  const companyOptions: SearchComboBoxOption[] = (
    companiesQuery.data?.companies ?? []
  ).map((company) => ({
    label: company.deactivated
      ? `${company.companyName} (Deactivated)`
      : company.companyName,
    value: company._id,
  }));

  // ── Mutations ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (nfcId: string) => deleteNfc(nfcId),
    onSuccess: () => {
      toast.success("NFC tag deleted");
      setShowDeleteModal(false);
      setDeletingTag(null);
      queryClient.invalidateQueries({ queryKey: NfcKeys.all });
    },
    onError: (err: unknown) => {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      toast.error(
        axiosError?.response?.data?.message || "Failed to delete NFC tag",
      );
    },
  });

  // ── Batch creation form ────────────────────────────────────────────

  const batchForm = useForm<CreateBatchFormData>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      batchName: "",
      count: 10,
      tagType: "other",
      purpose: "marketing",
      company: undefined,
      websiteOverrideRedirect: "https://www.taliho.com",
    },
  });
  const createPurpose = batchForm.watch("purpose");

  useEffect(() => {
    if (createPurpose === "customer") {
      batchForm.setValue("websiteOverrideRedirect", "");
      return;
    }

    batchForm.setValue("company", undefined);
    setCompanySearch("");
    if (!batchForm.getValues("websiteOverrideRedirect")) {
      batchForm.setValue("websiteOverrideRedirect", "https://www.taliho.com");
    }
  }, [batchForm, createPurpose]);

  const handleCreateBatch = async (formData: CreateBatchFormData) => {
    setBatchCreating(true);
    try {
      const batchData: CreateNfcBatchParams = {
        count: formData.count,
        tagType: formData.tagType,
        purpose: formData.purpose,
        batchName: formData.batchName || undefined,
      };
      if (formData.purpose === "customer" && formData.company) {
        batchData.company = formData.company;
      }
      if (formData.purpose === "marketing") {
        batchData.websiteOverrideRedirect =
          formData.websiteOverrideRedirect?.trim();
      }
      const result = await createNfcBatch(batchData);

      toast.success(`Batch created: ${result.count} NFC tags`);

      // Trigger CSV download
      try {
        const blob = await downloadNfcBatchCsv(result.batchId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nfc-batch-${result.batchId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Batch created but CSV download failed. Try again later.");
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: NfcKeys.all });

      // Reset form
      batchForm.reset();
      setCompanySearch("");
      setShowCreateBatchModal(false);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      toast.error(
        axiosError?.response?.data?.message || "Failed to create batch",
      );
    } finally {
      setBatchCreating(false);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────

  const columns: Column<NfcTag>[] = [
    {
      key: "_id",
      header: "NFC ID",
      sortable: false,
      columnType: "primary",
      render: (row) => (
        <span className="font-mono text-xs text-gray-700" title={row._id}>
          {row._id}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      sortable: true,
      columnType: "status",
      render: (row) => (
        <Badge variant={purposeBadgeVariant(row.purpose)} shape="full">
          {purposeLabel(row.purpose)}
        </Badge>
      ),
    },
    {
      key: "tagType",
      header: "Tag Type",
      sortable: true,
      columnType: "status",
      render: (row) => (
        <Badge variant={tagTypeBadgeVariant(row.tagType)} shape="full">
          {tagTypeLabel(row.tagType)}
        </Badge>
      ),
    },
    {
      key: "batchName",
      header: "Batch Name",
      sortable: true,
      columnType: "text",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.batchName || "-"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      columnType: "date",
      render: (row) => (
        <span className="text-sm text-gray-500">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  // ── Auth guard rendering ───────────────────────────────────────────

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Checking authorization...</div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const hasSearchOrFilters =
    query.trim() !== "" ||
    (purposeFilter?.length ?? 0) > 0 ||
    (tagTypeFilter?.length ?? 0) > 0 ||
    Boolean(assignedFilter) ||
    Boolean(batchNameFilter);

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <ListPageLayout
        title="NFC Management"
        titleIconClass="bx bx-chip text-indigo-600"
        subtitle="Manage NFC tags, create NFC batches, and update tag assignment details."
        headerActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIconClass="bx bx-upload"
              onClick={() => setShowBackfillMetadataModal(true)}
            >
              Backfill Metadata
            </Button>
            <Button
              variant="primary"
              leftIconClass="bx bx-plus"
              onClick={() => setShowCreateBatchModal(true)}
            >
              Create NFC Batch
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: NfcKeys.all });
              }}
            >
              <i className="bx bx-refresh mr-1"></i>
              Refresh
            </Button>
          </div>
        }
        search={{
          value: query,
          onChange: (v) => {
            setQuery(v);
            setPage(1);
          },
          placeholder: "Search by URL or batch name...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Purpose"
              options={NFC_PURPOSES.map((p) => ({
                label: p.label,
                value: p.value,
              }))}
              value={filters.purpose as string[] | undefined}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, purpose: next }));
                setPage(1);
              }}
            />
            <FilterComboBox
              multiple
              placeholder="Tag Type"
              options={NFC_TAG_TYPES.map((t) => ({
                label: t.label,
                value: t.value,
              }))}
              value={filters.tagType as string[] | undefined}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, tagType: next }));
                setPage(1);
              }}
            />
            <FilterComboBox
              placeholder="Assigned"
              options={[
                { label: "Yes", value: "true" },
                { label: "No", value: "false" },
              ]}
              value={assignedFilter}
              onChange={(next) => {
                setFilters((prev) => ({
                  ...prev,
                  assigned: typeof next === "string" ? next : undefined,
                }));
                setPage(1);
              }}
            />
            <FilterComboBox
              placeholder="Batch Name"
              options={batchNameOptions}
              value={batchNameFilter}
              onChange={(next) => {
                setFilters((prev) => ({
                  ...prev,
                  batchName: typeof next === "string" ? next : undefined,
                }));
                setPage(1);
              }}
            />
            <Button
              type="button"
              variant="clear"
              onClick={() => {
                setFilters({});
                setQuery("");
                setPage(1);
              }}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5"
            >
              Clear Filters
            </Button>
          </>
        }
        activeFilters={filters}
        onResetPage={() => setPage(1)}
        table={(() => {
          if ((listData?.tags?.length ?? 0) === 0 && !isLoading) {
            return (
              <EmptyState
                icon={<i className="bx bx-chip text-indigo-500 text-2xl" />}
                title={
                  hasSearchOrFilters ? "No NFC tags found" : "No NFC tags yet"
                }
                description={
                  hasSearchOrFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Create an NFC batch to generate NFC tags."
                }
                iconBgClass="bg-indigo-50"
                compact
                className="h-full min-h-[400px]"
              />
            );
          }

          return (
            <DataTable<NfcTag>
              columns={columns}
              rows={listData?.tags ?? []}
              getRowId={(row: NfcTag) => row._id}
              loadingState={loadingState}
              serverSideSort
              sortState={{ key: sortBy, dir: sortDir }}
              onSortChange={(key: string, dir: "asc" | "desc") => {
                setSortBy(key);
                setSortDir(dir);
                setPage(1);
              }}
              serverSide
              currentPage={page}
              itemsPerPage={limit}
              totalItems={listData?.total ?? 0}
              onPageChange={(newPage: number) => setPage(newPage)}
              onItemsPerPageChange={(newLimit: number) => {
                setLimit(newLimit);
                setPage(1);
              }}
              searchText={query}
              renderActions={(row: NfcTag) => {
                const options: ItemComboBoxOption[] = [
                  {
                    label: "Edit",
                    value: "edit",
                    iconClass: "bx bx-edit",
                    onSelect: () => {
                      setEditingTag(row);
                      setShowEditModal(true);
                    },
                  },
                  {
                    label: "Delete",
                    value: "delete",
                    iconClass: "bx bx-trash text-red-500",
                    onSelect: () => {
                      setDeletingTag(row);
                      setShowDeleteModal(true);
                    },
                  },
                ];

                return (
                  <div
                    className="relative inline-block text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ItemComboBox
                      options={options}
                      sourceId={`admin-nfc-actions-${row._id}`}
                    />
                  </div>
                );
              }}
            />
          );
        })()}
      />

      <Modal
        open={showCreateBatchModal}
        onClose={() => {
          if (batchCreating) return;
          setShowCreateBatchModal(false);
          batchForm.reset();
          setCompanySearch("");
        }}
        title="Create NFC Batch"
        subtitle="Generate a new NFC batch and download a CSV with generated URLs."
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateBatchModal(false);
                batchForm.reset();
                setCompanySearch("");
              }}
              disabled={batchCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={batchCreating}
              leftIconClass={
                batchCreating ? "bx bx-loader-alt bx-spin" : "bx bx-plus"
              }
              onClick={batchForm.handleSubmit(handleCreateBatch)}
            >
              {batchCreating ? "Creating..." : "Create Batch"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="batchName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Batch Name{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="batchName"
              type="text"
              placeholder="e.g., Feb 2026 Cards"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              {...batchForm.register("batchName")}
            />
          </div>

          <div>
            <label
              htmlFor="count"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Count <span className="text-red-500">*</span>
            </label>
            <input
              id="count"
              type="number"
              min={1}
              max={500}
              className={`block w-full rounded-md shadow-sm sm:text-sm ${
                batchForm.formState.errors.count
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
              {...batchForm.register("count")}
            />
            {batchForm.formState.errors.count && (
              <p className="mt-1 text-xs text-red-600">
                {batchForm.formState.errors.count.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tagType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tag Type <span className="text-red-500">*</span>
            </label>
            <select
              id="tagType"
              className={`block w-full rounded-md shadow-sm sm:text-sm ${
                batchForm.formState.errors.tagType
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
              {...batchForm.register("tagType")}
            >
              {NFC_TAG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {batchForm.formState.errors.tagType && (
              <p className="mt-1 text-xs text-red-600">
                {batchForm.formState.errors.tagType.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="purpose"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Purpose <span className="text-red-500">*</span>
            </label>
            <select
              id="purpose"
              className={`block w-full rounded-md shadow-sm sm:text-sm ${
                batchForm.formState.errors.purpose
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
              {...batchForm.register("purpose")}
            >
              <option value="marketing">Marketing</option>
              <option value="customer">Customer</option>
            </select>
            {batchForm.formState.errors.purpose && (
              <p className="mt-1 text-xs text-red-600">
                {batchForm.formState.errors.purpose.message}
              </p>
            )}
          </div>

          {createPurpose === "customer" ? (
            <div>
              <label
                htmlFor="create-company"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Company <span className="text-red-500">*</span>
              </label>
              <SearchComboBox
                id="create-company"
                options={companyOptions}
                value={batchForm.watch("company")}
                onChange={(next) => {
                  batchForm.setValue(
                    "company",
                    typeof next === "string" ? next : undefined,
                    { shouldValidate: true, shouldDirty: true },
                  );
                }}
                placeholder={
                  companiesQuery.isLoading
                    ? "Loading companies..."
                    : "Search companies"
                }
                query={companySearch}
                onQueryChange={setCompanySearch}
                loading={companiesQuery.isFetching}
                usePortal
              />
              {batchForm.formState.errors.company && (
                <p className="mt-1 text-xs text-red-600">
                  {batchForm.formState.errors.company.message}
                </p>
              )}
            </div>
          ) : null}

          {createPurpose === "marketing" ? (
            <div>
              <label
                htmlFor="websiteOverrideRedirect"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Website Override Redirect{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="websiteOverrideRedirect"
                type="url"
                placeholder="https://www.taliho.com"
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                  batchForm.formState.errors.websiteOverrideRedirect
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                }`}
                {...batchForm.register("websiteOverrideRedirect")}
              />
              {batchForm.formState.errors.websiteOverrideRedirect && (
                <p className="mt-1 text-xs text-red-600">
                  {batchForm.formState.errors.websiteOverrideRedirect.message}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Edit Modal */}
      {editingTag && (
        <EditNfcModal
          open={showEditModal}
          tag={editingTag}
          onClose={() => {
            setShowEditModal(false);
            setEditingTag(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingTag(null);
            queryClient.invalidateQueries({ queryKey: NfcKeys.all });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTag && (
        <DeleteNfcModal
          open={showDeleteModal}
          tag={deletingTag}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletingTag(null);
          }}
          isLoading={deleteMutation.isPending}
          onConfirm={() => {
            deleteMutation.mutate(deletingTag._id);
          }}
        />
      )}

      <NfcMetadataBackfillModal
        open={showBackfillMetadataModal}
        onClose={() => setShowBackfillMetadataModal(false)}
        onApplied={() => {
          queryClient.invalidateQueries({ queryKey: NfcKeys.all });
          queryClient.invalidateQueries({ queryKey: NfcKeys.list({}) });
          queryClient.invalidateQueries({ queryKey: NfcKeys.batchNames() });
          queryClient.invalidateQueries({ queryKey: NfcKeys.stats() });
        }}
      />
    </main>
  );
}

// ── Edit NFC Modal ───────────────────────────────────────────────────

function EditNfcModal({
  open,
  tag,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tag: NfcTag;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditNfcFormData>({
    resolver: zodResolver(editNfcSchema),
    defaultValues: {
      purpose: tag.purpose || "unassigned",
      tagType: tag.tagType || "other",
      websiteOverrideRedirect: tag.websiteOverrideRedirect || "",
      qrcodeRedirect: tag.qrcodeRedirect || "",
    },
  });

  const watchPurpose = watch("purpose");

  // Reset form when tag changes
  useEffect(() => {
    reset({
      purpose: tag.purpose || "unassigned",
      tagType: tag.tagType || "other",
      websiteOverrideRedirect: tag.websiteOverrideRedirect || "",
      qrcodeRedirect: tag.qrcodeRedirect || "",
    });
  }, [tag, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpdateNfcParams) => updateNfc(tag._id, data),
    onSuccess: () => {
      toast.success("NFC tag updated");
      onSuccess();
    },
    onError: (err: unknown) => {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      toast.error(
        axiosError?.response?.data?.message || "Failed to update NFC tag",
      );
    },
  });

  const onSubmit = (formData: EditNfcFormData) => {
    const payload: UpdateNfcParams = {
      purpose: formData.purpose,
      tagType: formData.tagType,
    };
    if (formData.purpose === "marketing") {
      payload.websiteOverrideRedirect = formData.websiteOverrideRedirect;
    }
    if (formData.purpose === "customer") {
      payload.qrcodeRedirect = formData.qrcodeRedirect;
    }
    mutation.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit NFC Tag"
      subtitle={`URL: ${tag.url}`}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              mutation.isPending ? "bx bx-loader-alt bx-spin" : "bx bx-save"
            }
            disabled={mutation.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Purpose */}
        <div>
          <label
            htmlFor="edit-purpose"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Purpose
          </label>
          <select
            id="edit-purpose"
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
              errors.purpose
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            }`}
            {...register("purpose")}
          >
            {NFC_PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {errors.purpose && (
            <p className="mt-1 text-xs text-red-600">
              {errors.purpose.message}
            </p>
          )}
        </div>

        {/* Tag Type */}
        <div>
          <label
            htmlFor="edit-tagType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tag Type
          </label>
          <select
            id="edit-tagType"
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
              errors.tagType
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            }`}
            {...register("tagType")}
          >
            {NFC_TAG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.tagType && (
            <p className="mt-1 text-xs text-red-600">
              {errors.tagType.message}
            </p>
          )}
        </div>

        {/* Website Override Redirect (shown when purpose=marketing) */}
        {watchPurpose === "marketing" && (
          <div>
            <label
              htmlFor="edit-websiteOverrideRedirect"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Website Override Redirect
            </label>
            <input
              id="edit-websiteOverrideRedirect"
              type="text"
              placeholder="https://example.com"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              {...register("websiteOverrideRedirect")}
            />
          </div>
        )}

        {/* QR Code Redirect (shown when purpose=customer) */}
        {watchPurpose === "customer" && (
          <div>
            <label
              htmlFor="edit-qrcodeRedirect"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              QR Code Redirect (QR Code ID)
            </label>
            <input
              id="edit-qrcodeRedirect"
              type="text"
              placeholder="Enter QR Code ID"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              {...register("qrcodeRedirect")}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Delete NFC Modal ─────────────────────────────────────────────────

function DeleteNfcModal({
  open,
  tag,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  tag: NfcTag;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete NFC Tag"
      subtitle="This action cannot be undone."
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            leftIconClass={
              isLoading ? "bx bx-loader-alt bx-spin" : "bx bx-trash"
            }
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? "Deleting..." : "Delete Tag"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md p-4 bg-red-50 border border-red-200">
          <div className="flex">
            <i className="bx bxs-error-circle text-red-500 text-xl mr-3 flex-shrink-0"></i>
            <div>
              <h4 className="text-sm font-medium text-red-800">Warning</h4>
              <p className="mt-1 text-sm text-red-700">
                Are you sure you want to delete this NFC tag? Any physical NFC
                tag pointing to this URL will stop working.
              </p>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <p>
            <span className="font-medium">URL:</span>{" "}
            <span className="font-mono text-xs">{tag.url}</span>
          </p>
          {tag.batchName && (
            <p>
              <span className="font-medium">Batch:</span> {tag.batchName}
            </p>
          )}
          <p>
            <span className="font-medium">Purpose:</span>{" "}
            {purposeLabel(tag.purpose)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
