import {
  createLazyFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  useAdminCompanies,
  useRefreshCompanyTrial,
  useUpdateCompanyStatus,
  useDeleteAdminCompany,
  type AdminCompany,
  type ListCompaniesParams,
} from "@/api/endpoints/admin-customers";
import ListPageLayout from "@/components/layout/ListPageLayout";
import DataTable from "@/components/table/DataTable";
import type { Column } from "@/components/table/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterComboBox from "@/components/combobox/detail/FilterComboBox";
import ItemComboBox from "@/components/combobox/detail/ItemComboBox";
import type { ItemComboBoxOption } from "@/components/combobox/detail/ItemComboBox";
import AdminEmailModal from "@/components/modal/admin/AdminEmailModal";
import AdminDestructiveConfirmModal from "@/components/modal/admin/AdminDestructiveConfirmModal";
import { formatDate } from "@/lib/format";
import type { ActiveFilters } from "@/components/ui/SearchFiltersCard";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import BackfillActionsDropdown from "@/components/admin/BackfillActionsDropdown";
import toast from "react-hot-toast";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createLazyFileRoute("/admin/customers/")({
  component: AdminCustomers,
});

export function AdminCustomers() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/admin/customers/" }) as
    | {
        q?: string;
        plan?: string;
        procore?: string;
        sortKey?: string;
        sortDir?: "asc" | "desc";
        page?: string | number;
        perPage?: string | number;
      }
    | undefined;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<ActiveFilters>({});
  const initFromSearchRef = useRef<boolean>(false);

  // Row action state
  const [actionTargetCompany, setActionTargetCompany] =
    useState<AdminCompany | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Mutation hooks
  const refreshTrialMutation = useRefreshCompanyTrial();
  const updateStatusMutation = useUpdateCompanyStatus();
  const deleteCompanyMutation = useDeleteAdminCompany();

  // Auth check on mount
  useEffect(() => {
    const storedUser = getStoredUser();

    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  // Initialize state from query params on mount
  useEffect(() => {
    if (initFromSearchRef.current) return;
    initFromSearchRef.current = true;
    const s = searchParams || {};
    if (typeof s.q === "string") setQuery(s.q);
    if (typeof s.plan === "string" && s.plan.length > 0)
      setFilters((prev) => ({
        ...prev,
        plan: s.plan!.split(",").filter(Boolean),
      }));
    if (typeof s.procore === "string" && s.procore.length > 0)
      setFilters((prev) => ({
        ...prev,
        procore: s.procore!.split(",").filter(Boolean),
      }));
    if (typeof s.sortKey === "string" && s.sortKey) setSortBy(s.sortKey);
    if (s.sortDir === "asc" || s.sortDir === "desc") setSortDir(s.sortDir);
    if (s.page && !Number.isNaN(Number(s.page))) setPage(Number(s.page));
    if (s.perPage && !Number.isNaN(Number(s.perPage)))
      setLimit(Number(s.perPage));
  }, [searchParams]);

  // Persist state to query params on changes
  useEffect(() => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    const planFilter = filters.plan as string[] | undefined;
    const procoreFilter = filters.procore as string[] | undefined;
    if (planFilter?.length) next.plan = planFilter.join(",");
    if (procoreFilter?.length) next.procore = procoreFilter.join(",");
    if (sortBy && sortBy !== "createdAt") next.sortKey = sortBy;
    if (sortDir && sortDir !== "desc") next.sortDir = sortDir;
    if (page && page !== 1) next.page = String(page);
    if (limit && limit !== 20) next.perPage = String(limit);
    navigate({ to: "/admin/customers", search: next, replace: true });
  }, [query, filters, sortBy, sortDir, page, limit, navigate]);

  // Build params from filters
  const planFilter = filters.plan as string[] | undefined;
  const procoreFilter = filters.procore as string[] | undefined;

  // When free_trial is selected, also include trial_refreshed in the API call
  const effectivePlanFilter = useMemo(() => {
    if (
      planFilter?.includes("free_trial") &&
      !planFilter?.includes("trial_refreshed")
    ) {
      return [...planFilter, "trial_refreshed"];
    }
    return planFilter;
  }, [planFilter]);

  const params: ListCompaniesParams = {
    page,
    limit,
    search: query || undefined,
    sortBy,
    sortDir,
    plan: effectivePlanFilter?.length
      ? effectivePlanFilter.join(",")
      : undefined,
    procore: procoreFilter?.length ? procoreFilter.join(",") : undefined,
  };

  const companiesQuery = useAdminCompanies(params);
  const { data, isLoading, refetch } = companiesQuery;
  const loadingState = useTableLoadingState(companiesQuery);

  const handleRowClick = (company: AdminCompany) => {
    navigate({ to: `/admin/customers/${company._id}` });
  };

  // Helper to get display name with fallback for companies without a name
  const getCompanyDisplayName = (row: AdminCompany): string => {
    if (row.companyName) return row.companyName;
    if (row.oldestAdminFirstName && row.oldestAdminLastName) {
      const fullName = `${row.oldestAdminFirstName} ${row.oldestAdminLastName}`;
      if (row.emailDomains?.[0]) {
        return `${fullName} (${row.emailDomains[0]})`;
      }
      return fullName;
    }
    if (row.oldestAdminEmail) return row.oldestAdminEmail;
    return "Unnamed";
  };

  const columns: Column<AdminCompany>[] = [
    {
      key: "companyName",
      header: "Company Name",
      sortable: true,
      columnType: "primary",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-md flex items-center justify-center">
            <i className="bx bx-buildings text-indigo-600 text-lg"></i>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-indigo-700">
              {getCompanyDisplayName(row)}
            </span>
            {row.matchedUserName && query && (
              <span className="text-xs text-gray-500">
                <i className="bx bx-user mr-0.5"></i>
                {row.matchedUserName}
              </span>
            )}
            {row.deactivated && (
              <span className="text-xs text-red-500">Deactivated</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "usersCount",
      header: "Users",
      sortable: true,
      columnType: "number",
      render: (row) => <span className="text-gray-600">{row.usersCount}</span>,
    },
    {
      key: "qrCodesCount",
      header: "QR Codes",
      sortable: true,
      columnType: "number",
      render: (row) => (
        <span className="text-gray-600">{row.qrCodesCount}</span>
      ),
    },
    {
      key: "documentsCount",
      header: "Docs",
      sortable: true,
      columnType: "number",
      render: (row) => (
        <span className="text-gray-600">{row.documentsCount}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortable: false,
      columnType: "status",
      render: (row) => {
        // Cancelled takes priority
        if (row.subscriptionCanceled) {
          return (
            <Badge variant="red" shape="full">
              Cancelled
            </Badge>
          );
        }
        // Paid accounts with a tier
        if (row.paidAccount && row.planTier) {
          const tierLabels: Record<string, string> = {
            early_adopter: "Early Adopter",
            professional: "Professional",
            business: "Business",
            standard: "Standard",
          };
          return (
            <Badge variant="green" shape="full">
              {tierLabels[row.planTier] || row.planTier}
            </Badge>
          );
        }
        // Paid without tier (legacy)
        if (row.paidAccount) {
          return (
            <Badge variant="green" shape="full">
              Paid
            </Badge>
          );
        }
        // Active trial
        if (row.freeTrialActive) {
          return (
            <Badge variant="yellow" shape="full">
              {row.freeTrialRefreshDate ? "Trial (Refreshed)" : "Free Trial"}
            </Badge>
          );
        }
        // Expired/free
        return (
          <Badge variant="gray" shape="full">
            Expired
          </Badge>
        );
      },
    },
    {
      key: "procoreIntegration",
      header: "Procore",
      sortable: false,
      columnType: "status",
      render: (row) => (
        <Badge
          variant={row.procoreIntegration ? "orange" : "gray"}
          shape="full"
        >
          {row.procoreIntegration ? "Connected" : "No"}
        </Badge>
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
    (planFilter?.length ?? 0) > 0 ||
    (procoreFilter?.length ?? 0) > 0;

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <ListPageLayout
        title="Customer Management"
        titleIconClass="bx bx-shield-alt-2 text-indigo-600"
        subtitle="View and manage all companies and their users across the platform."
        headerActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/admin/stats" })}
            >
              <i className="bx bx-bar-chart-alt-2 mr-1"></i>
              Stats
            </Button>
            <BackfillActionsDropdown />
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/admin/ghl" })}
            >
              <i className="bx bx-cloud-upload mr-1"></i>
              GHL
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/admin/online" })}
            >
              <i className="bx bx-wifi mr-1"></i>
              Online
            </Button>
            <Button variant="secondary" onClick={() => refetch()}>
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
          placeholder: "Search companies or users in companies...",
        }}
        filters={
          <>
            <FilterComboBox
              multiple
              placeholder="Plan"
              options={[
                { label: "Free Trial", value: "free_trial" },
                { label: "Trial Refreshed", value: "trial_refreshed" },
                { label: "Standard", value: "standard" },
                { label: "Early Adopter", value: "early_adopter" },
                { label: "Professional", value: "professional" },
                { label: "Business", value: "business" },
                { label: "Expired", value: "expired" },
                { label: "Cancelled", value: "cancelled" },
              ]}
              value={filters.plan as string[] | undefined}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, plan: next }));
                setPage(1);
              }}
            />
            <FilterComboBox
              multiple
              placeholder="Procore"
              options={[
                { label: "Connected", value: "connected" },
                { label: "Not Connected", value: "none" },
              ]}
              value={filters.procore as string[] | undefined}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, procore: next }));
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
          // Show empty state when no data and not loading
          if ((data?.companies?.length ?? 0) === 0 && !isLoading) {
            return (
              <EmptyState
                icon={
                  <i className="bx bx-buildings text-indigo-500 text-2xl" />
                }
                title={
                  hasSearchOrFilters ? "No companies found" : "No companies yet"
                }
                description={
                  hasSearchOrFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Companies will appear here once they sign up."
                }
                iconBgClass="bg-indigo-50"
                compact
                className="h-full min-h-[400px]"
              />
            );
          }

          return (
            <DataTable<AdminCompany>
              columns={columns}
              rows={data?.companies ?? []}
              getRowId={(row: AdminCompany) => row._id}
              onRowClick={handleRowClick}
              getRowUrl={(row: AdminCompany) => `/admin/customers/${row._id}`}
              loadingState={loadingState}
              // Server-side sorting
              serverSideSort
              sortState={{ key: sortBy, dir: sortDir }}
              onSortChange={(key: string, dir: "asc" | "desc") => {
                setSortBy(key);
                setSortDir(dir);
                setPage(1);
              }}
              // Server-side pagination
              serverSide
              currentPage={page}
              itemsPerPage={limit}
              totalItems={data?.total ?? 0}
              onPageChange={(newPage: number) => setPage(newPage)}
              onItemsPerPageChange={(newLimit: number) => {
                setLimit(newLimit);
                setPage(1);
              }}
              searchText={query}
              renderActions={(row: AdminCompany) => {
                const canRefreshTrial =
                  !row.paidAccount || row.subscriptionCanceled;

                const options: ItemComboBoxOption[] = [
                  {
                    label: "Refresh Free Trial",
                    value: "refresh-trial",
                    iconClass: "bx bx-revision",
                    disabled: !canRefreshTrial,
                    onSelect: () => {
                      refreshTrialMutation.mutate(
                        { companyId: row._id },
                        {
                          onSuccess: () => {
                            toast.success(
                              `Trial refreshed for ${row.companyName}`,
                            );
                          },
                          onError: (err: unknown) => {
                            const axiosError = err as {
                              response?: { data?: { message?: string } };
                            };
                            toast.error(
                              axiosError?.response?.data?.message ||
                                "Failed to refresh trial",
                            );
                          },
                        },
                      );
                    },
                  },
                  {
                    label: "Send Email to Admins",
                    value: "email-admins",
                    iconClass: "bx bx-envelope",
                    onSelect: () => {
                      setActionTargetCompany(row);
                      setShowEmailModal(true);
                    },
                  },
                  {
                    label: row.deactivated
                      ? "Reactivate Company"
                      : "Deactivate Company",
                    value: "toggle-status",
                    iconClass: row.deactivated
                      ? "bx bx-check-circle"
                      : "bx bx-block",
                    onSelect: () => {
                      if (row.deactivated) {
                        // Reactivate directly without confirmation
                        updateStatusMutation.mutate(
                          {
                            companyId: row._id,
                            params: { deactivated: false },
                          },
                          {
                            onSuccess: () => {
                              toast.success(`${row.companyName} reactivated`);
                            },
                            onError: (err: unknown) => {
                              const axiosError = err as {
                                response?: { data?: { message?: string } };
                              };
                              toast.error(
                                axiosError?.response?.data?.message ||
                                  "Failed to reactivate",
                              );
                            },
                          },
                        );
                      } else {
                        // Deactivate requires confirmation
                        setActionTargetCompany(row);
                        setShowDeactivateModal(true);
                      }
                    },
                  },
                  {
                    label: "Delete Company",
                    value: "delete",
                    iconClass: "bx bx-trash text-red-500",
                    onSelect: () => {
                      setActionTargetCompany(row);
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
                      sourceId={`admin-company-actions-${row._id}`}
                    />
                  </div>
                );
              }}
            />
          );
        })()}
      />

      {/* Admin Email Modal */}
      {actionTargetCompany && (
        <AdminEmailModal
          open={showEmailModal}
          onClose={() => {
            setShowEmailModal(false);
            setActionTargetCompany(null);
          }}
          companyId={actionTargetCompany._id}
          companyName={actionTargetCompany.companyName}
          defaultTemplate="procore_disconnection"
        />
      )}

      {/* Deactivate Confirmation Modal */}
      {actionTargetCompany && (
        <AdminDestructiveConfirmModal
          open={showDeactivateModal}
          onClose={() => {
            setShowDeactivateModal(false);
            setActionTargetCompany(null);
          }}
          onConfirm={() => {
            updateStatusMutation.mutate(
              {
                companyId: actionTargetCompany._id,
                params: { deactivated: true },
              },
              {
                onSuccess: () => {
                  toast.success(
                    `${actionTargetCompany.companyName} deactivated`,
                  );
                  setShowDeactivateModal(false);
                  setActionTargetCompany(null);
                },
                onError: (err: unknown) => {
                  const axiosError = err as {
                    response?: { data?: { message?: string } };
                  };
                  toast.error(
                    axiosError?.response?.data?.message ||
                      "Failed to deactivate",
                  );
                },
              },
            );
          }}
          companyName={actionTargetCompany.companyName}
          action="deactivate"
          isLoading={updateStatusMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {actionTargetCompany && (
        <AdminDestructiveConfirmModal
          open={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setActionTargetCompany(null);
          }}
          onConfirm={() => {
            deleteCompanyMutation.mutate(
              { companyId: actionTargetCompany._id },
              {
                onSuccess: () => {
                  toast.success(`${actionTargetCompany.companyName} deleted`);
                  setShowDeleteModal(false);
                  setActionTargetCompany(null);
                },
                onError: (err: unknown) => {
                  const axiosError = err as {
                    response?: { data?: { message?: string } };
                  };
                  toast.error(
                    axiosError?.response?.data?.message ||
                      "Failed to delete company",
                  );
                },
              },
            );
          }}
          companyName={actionTargetCompany.companyName}
          action="delete"
          isLoading={deleteCompanyMutation.isPending}
        />
      )}
    </main>
  );
}
