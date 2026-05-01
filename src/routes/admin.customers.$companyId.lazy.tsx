import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  useAdminCompany,
  useAdminCompanyUsers,
  useAdminCompanies,
  useUpdateEmailDomains,
  useApprovePendingDomains,
  useTransferUser,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useInviteUser,
  useRefreshCompanyTrial,
  useUpdateCompanyStatus,
  useDeleteAdminCompany,
  type AdminUser,
} from "@/api/endpoints/admin-customers";
import AdminEmailModal from "@/components/modal/admin/AdminEmailModal";
import AdminDestructiveConfirmModal from "@/components/modal/admin/AdminDestructiveConfirmModal";
import DataTable from "@/components/table/DataTable";
import type { Column } from "@/components/table/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/modal/Modal";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import toast from "react-hot-toast";
import { formatDate, formatBytes } from "@/lib/format";
import {
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
} from "@/lib/tiers/constants";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createLazyFileRoute("/admin/customers/$companyId")({
  component: AdminCompanyDetail,
});

export function AdminCompanyDetail() {
  const { companyId } = Route.useParams();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailDomainsModal, setShowEmailDomainsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Company action modal states
  const [showCompanyEmailModal, setShowCompanyEmailModal] = useState(false);
  const [showDeactivateCompanyModal, setShowDeactivateCompanyModal] =
    useState(false);
  const [showDeleteCompanyModal, setShowDeleteCompanyModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Form states
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferMakeAdmin, setTransferMakeAdmin] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPermission, setEditPermission] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [invitePermission, setInvitePermission] = useState("user");
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [companySearch, setCompanySearch] = useState("");

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

  // Data fetching
  const { data: company, isLoading: companyLoading } =
    useAdminCompany(companyId);
  const { data: users, isLoading: usersLoading } =
    useAdminCompanyUsers(companyId);
  const { data: companiesData } = useAdminCompanies({
    limit: 100,
    search: companySearch,
  });

  // Mutations
  const updateEmailDomainsMutation = useUpdateEmailDomains();
  const approvePendingDomainsMutation = useApprovePendingDomains();
  const transferUserMutation = useTransferUser();
  const updateUserMutation = useUpdateAdminUser();
  const deleteUserMutation = useDeleteAdminUser();
  const inviteUserMutation = useInviteUser();

  // Company action mutations
  const refreshTrialMutation = useRefreshCompanyTrial();
  const updateCompanyStatusMutation = useUpdateCompanyStatus();
  const deleteCompanyMutation = useDeleteAdminCompany();

  // Initialize email domains when company loads
  useEffect(() => {
    if (company?.emailDomains) {
      setEmailDomains([...company.emailDomains]);
    }
  }, [company?.emailDomains]);

  // Filter out current company from transfer targets
  const transferTargetCompanies =
    companiesData?.companies.filter((c) => c._id !== companyId) ?? [];

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditPermission(user.permission);
    setShowEditModal(true);
  };

  const openTransferModal = (user: AdminUser) => {
    setSelectedUser(user);
    setTransferTargetId("");
    setTransferMakeAdmin(false);
    setShowTransferModal(true);
  };

  const openDeleteModal = (user: AdminUser) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleTransfer = async (force = false) => {
    if (!selectedUser || !transferTargetId) return;

    // Check if user is the sole admin or only user in this company
    if (!force && selectedUser.permission === "admin" && users) {
      const adminCount = users.filter((u) => u.permission === "admin").length;
      if (adminCount === 1) {
        // Show confirmation instead of transferring directly
        setShowTransferModal(false);
        setShowTransferConfirm(true);
        return;
      }
    }

    try {
      await transferUserMutation.mutateAsync({
        userId: selectedUser._id,
        params: {
          targetCompanyId: transferTargetId,
          makeAdmin: transferMakeAdmin,
          ...(force ? { force: true } : {}),
        },
        sourceCompanyId: companyId,
      });
      toast.success("User transferred successfully");
      setShowTransferModal(false);
      setShowTransferConfirm(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to transfer user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await updateUserMutation.mutateAsync({
        userId: selectedUser._id,
        params: {
          firstName: editFirstName,
          lastName: editLastName,
          permission: editPermission,
        },
        companyId,
      });
      toast.success("User updated successfully");
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteUserMutation.mutateAsync({
        userId: selectedUser._id,
        companyId,
      });
      toast.success("User deleted successfully");
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to delete user");
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;

    try {
      await inviteUserMutation.mutateAsync({
        companyId,
        params: {
          email: inviteEmail,
          firstName: inviteFirstName || undefined,
          lastName: inviteLastName || undefined,
          permission: invitePermission,
        },
      });
      toast.success("User invited successfully");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInvitePermission("user");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to invite user");
    }
  };

  const handleUpdateEmailDomains = async () => {
    try {
      await updateEmailDomainsMutation.mutateAsync({
        companyId,
        emailDomains: emailDomains.filter((d) => d.trim()),
      });
      toast.success("Email domains updated successfully");
      setShowEmailDomainsModal(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err?.response?.data?.message || "Failed to update email domains",
      );
    }
  };

  const handleApprovePendingDomains = async (domains: string[]) => {
    try {
      await approvePendingDomainsMutation.mutateAsync({
        companyId,
        domains,
      });
      toast.success("Domains approved successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to approve domains");
    }
  };

  const addDomain = () => {
    const domain = newDomain.toLowerCase().trim();
    if (domain && !emailDomains.includes(domain)) {
      setEmailDomains([...emailDomains, domain]);
      setNewDomain("");
    }
  };

  const removeDomain = (domain: string) => {
    setEmailDomains(emailDomains.filter((d) => d !== domain));
  };

  // Get user initials for avatar
  const getUserInitials = (user: AdminUser) => {
    const first = user.firstName?.[0]?.toUpperCase() || "";
    const last = user.lastName?.[0]?.toUpperCase() || "";
    return first + last || user.email[0].toUpperCase();
  };

  // Get avatar background color based on permission
  const getAvatarColor = (permission: string) => {
    switch (permission) {
      case "admin":
        return "bg-indigo-100 text-indigo-700";
      case "pm":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const userColumns: Column<AdminUser>[] = [
    {
      key: "email",
      header: "User",
      columnType: "primary",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div
            className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-medium text-sm ${getAvatarColor(row.permission)}`}
          >
            {getUserInitials(row)}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{row.email}</span>
              {!row.isVerified && (
                <Badge variant="yellow" shape="full">
                  Pending
                </Badge>
              )}
            </div>
            {(row.firstName || row.lastName) && (
              <span className="text-sm text-gray-500">
                {`${row.firstName || ""} ${row.lastName || ""}`.trim()}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "permission",
      header: "Role",
      columnType: "status",
      render: (row) => (
        <Badge
          variant={
            row.permission === "admin"
              ? "indigo"
              : row.permission === "pm"
                ? "blue"
                : "gray"
          }
          shape="full"
        >
          {row.permission === "admin"
            ? "Admin"
            : row.permission === "pm"
              ? "Project Manager"
              : "User"}
        </Badge>
      ),
    },
    {
      key: "lastLoggedIn",
      header: "Last Login",
      columnType: "date",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-600">
            {row.lastLoggedIn ? formatDate(row.lastLoggedIn) : "Never"}
          </span>
          {row.createdAt && (
            <span className="text-xs text-gray-400">
              Joined {formatDate(row.createdAt)}
            </span>
          )}
        </div>
      ),
    },
  ];

  if (authorized === null || companyLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="bx bx-loader-alt bx-spin text-3xl text-indigo-500"></i>
          <span className="text-gray-500">Loading company details...</span>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="h-full overflow-y-auto p-8">
      {/* Back navigation */}
      <button
        onClick={() => window.history.go(-1)}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors w-fit"
      >
        <i className="bx bx-arrow-back text-lg"></i>
        <span>Back to Customer Management</span>
      </button>

      {/* Company Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 h-16 w-16 bg-indigo-100 rounded-xl flex items-center justify-center">
              <i className="bx bx-buildings text-indigo-600 text-3xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {company?.companyName || "Unnamed Company"}
              </h1>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Badge
                  variant={
                    company?.paidAccount
                      ? "green"
                      : company?.freeTrialActive
                        ? "yellow"
                        : "gray"
                  }
                  shape="full"
                >
                  {company?.paidAccount
                    ? "Paid Account"
                    : company?.freeTrialActive
                      ? "Free Trial"
                      : "Free Plan"}
                </Badge>
                <Badge
                  variant={company?.procoreIntegration ? "blue" : "gray"}
                  shape="full"
                >
                  <i
                    className={`bx ${company?.procoreIntegration ? "bx-check-circle" : "bx-x-circle"} mr-1`}
                  ></i>
                  {company?.procoreIntegration
                    ? "Procore Connected"
                    : "No Procore"}
                </Badge>
                {company?.deactivated && (
                  <Badge variant="red" shape="full">
                    <i className="bx bx-error-circle mr-1"></i>
                    Deactivated
                  </Badge>
                )}
              </div>
              {company?.createdAt && (
                <p className="mt-2 text-sm text-gray-500">
                  <i className="bx bx-calendar mr-1"></i>
                  Created {formatDate(company.createdAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowStatsModal(true)}>
              <i className="bx bx-bar-chart-alt-2 mr-1"></i>
              Stats
            </Button>
            <ItemComboBox
              options={(() => {
                const canRefreshTrial =
                  !company?.paidAccount || company?.subscriptionCanceled;

                const options: ItemComboBoxOption[] = [
                  {
                    label: "Refresh Free Trial",
                    value: "refresh-trial",
                    iconClass: "bx bx-revision",
                    disabled: !canRefreshTrial,
                    onSelect: () => {
                      refreshTrialMutation.mutate(
                        { companyId },
                        {
                          onSuccess: () => {
                            toast.success(
                              `Trial refreshed for ${company?.companyName}`,
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
                      setShowCompanyEmailModal(true);
                    },
                  },
                  {
                    label: company?.deactivated
                      ? "Reactivate Company"
                      : "Deactivate Company",
                    value: "toggle-status",
                    iconClass: company?.deactivated
                      ? "bx bx-check-circle"
                      : "bx bx-block",
                    onSelect: () => {
                      if (company?.deactivated) {
                        // Reactivate directly without confirmation
                        updateCompanyStatusMutation.mutate(
                          {
                            companyId,
                            params: { deactivated: false },
                          },
                          {
                            onSuccess: () => {
                              toast.success(
                                `${company?.companyName} reactivated`,
                              );
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
                        setShowDeactivateCompanyModal(true);
                      }
                    },
                  },
                  {
                    label: "Delete Company",
                    value: "delete",
                    iconClass: "bx bx-trash text-red-500",
                    onSelect: () => {
                      setShowDeleteCompanyModal(true);
                    },
                  },
                ];

                return options;
              })()}
              sourceId={`company-actions-${companyId}`}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-user text-indigo-600 text-xl"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Users</p>
              <p className="text-2xl font-semibold text-gray-900">
                {company?.usersCount || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-qr text-green-600 text-xl"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">QR Codes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {company?.qrCodesCount || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-file text-blue-600 text-xl"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Documents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {company?.documentsCount || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-folder text-orange-600 text-xl"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Projects</p>
              <p className="text-2xl font-semibold text-gray-900">
                {company?.projectsCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Domains Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-at text-purple-600 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Email Domains
              </h2>
              <p className="text-sm text-gray-500">
                OAuth matching for Procore sign-in
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowEmailDomainsModal(true)}
            leftIconClass="bx bx-edit"
          >
            Edit Domains
          </Button>
        </div>
        <div className="border-t border-gray-100 pt-4">
          {company?.emailDomains && company.emailDomains.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {company.emailDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                >
                  <i className="bx bx-globe text-sm"></i>
                  {domain}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <i className="bx bx-info-circle"></i>
              <span className="text-sm">No email domains configured</span>
            </div>
          )}
        </div>

        {/* Pending Domain Review Section */}
        {company?.pendingDomainReview &&
          company.pendingDomainReview.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <i className="bx bx-flag text-amber-600"></i>
                <h4 className="font-medium text-amber-800">
                  Domains Pending Review
                </h4>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                Multiple business domains detected. Approve to add to company
                profile:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {company.pendingDomainReview.map((domain) => (
                  <span
                    key={domain}
                    className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm"
                  >
                    {domain}
                  </span>
                ))}
              </div>
              <Button
                variant="primary"
                className="px-2 py-1.5 text-sm"
                onClick={() =>
                  handleApprovePendingDomains(company.pendingDomainReview || [])
                }
                disabled={approvePendingDomainsMutation.isPending}
              >
                {approvePendingDomainsMutation.isPending ? (
                  <>
                    <i className="bx bx-loader-alt animate-spin mr-1.5"></i>
                    Approving...
                  </>
                ) : (
                  <>
                    <i className="bx bx-check mr-1.5"></i>
                    Approve All Domains
                  </>
                )}
              </Button>
            </div>
          )}
      </div>

      {/* Users Section - fills remaining viewport height */}
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden"
        style={{
          height: "max(500px, calc(100vh - 650px))",
          minHeight: "500px",
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <i className="bx bx-group text-indigo-600 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <p className="text-sm text-gray-500">
                {users?.length || 0} team member{users?.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowInviteModal(true)}
            leftIconClass="bx bx-user-plus"
          >
            Invite User
          </Button>
        </div>
        <div className="flex-grow min-h-0 h-full">
          {users && users.length > 0 ? (
            <DataTable<AdminUser>
              columns={userColumns}
              rows={users}
              getRowId={(row: AdminUser) => row._id}
              loading={usersLoading}
              renderActions={(row) => {
                const options: ItemComboBoxOption[] = [
                  {
                    label: "Edit User",
                    value: "edit",
                    iconClass: "bx bx-edit",
                    onSelect: () => openEditModal(row),
                  },
                  {
                    label: "Transfer to Company",
                    value: "transfer",
                    iconClass: "bx bx-transfer",
                    onSelect: () => openTransferModal(row),
                  },
                  {
                    label: "Delete User",
                    value: "delete",
                    iconClass: "bx bx-trash",
                    onSelect: () => openDeleteModal(row),
                  },
                ];
                return (
                  <div
                    className="relative inline-block text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ItemComboBox
                      options={options}
                      sourceId={`user-actions-${row._id}`}
                    />
                  </div>
                );
              }}
            />
          ) : (
            <EmptyState
              icon={<i className="bx bx-user text-indigo-500 text-2xl" />}
              title="No users yet"
              description="Invite users to this company to get started."
              actionLabel="Invite User"
              onActionClick={() => setShowInviteModal(true)}
              iconBgClass="bg-indigo-50"
              compact
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Company Stats Modal */}
      <Modal
        open={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title="Company Stats"
        subtitle="Storage, subscription, and usage details"
        size="2xl"
        scrollable
        footer={
          <Button variant="secondary" onClick={() => setShowStatsModal(false)}>
            Close
          </Button>
        }
      >
        {(() => {
          const docUsed = company?.documentStorageUsed ?? 0;
          const docCap = company?.documentStorageCapacity ?? 0;
          const qrUsed = company?.qrCodeStorageUsed ?? 0;
          const qrCap = company?.qrCodeStorageCapacity ?? 0;
          const docPct = docCap > 0 ? docUsed / docCap : 0;
          const qrPct = qrCap > 0 ? qrUsed / qrCap : 0;
          const totalUsed = docUsed + qrUsed;
          const totalCap = docCap + qrCap;
          const addonsCount = company?.stripeAddons?.length ?? 0;

          const barColor = (pct: number) => {
            if (pct >= STORAGE_CRITICAL_THRESHOLD) return "bg-red-500";
            if (pct >= STORAGE_WARNING_THRESHOLD) return "bg-yellow-500";
            return "bg-indigo-500";
          };

          const statusBadge = (pct: number) => {
            if (pct >= 1.0) return { variant: "red" as const, label: "Full" };
            if (pct >= STORAGE_CRITICAL_THRESHOLD)
              return { variant: "red" as const, label: "Critical" };
            if (pct >= STORAGE_WARNING_THRESHOLD)
              return { variant: "yellow" as const, label: "Warning" };
            return { variant: "green" as const, label: "Healthy" };
          };

          const docStatus = statusBadge(docPct);
          const qrStatus = statusBadge(qrPct);

          const tierLabel =
            company?.planTier
              ?.replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()) ??
            (company?.freeTrialActive
              ? "Free Trial"
              : company?.paidAccount
                ? "Paid"
                : "Free Plan");

          const subStatusVariant = (
            status?: string,
          ): "green" | "yellow" | "red" | "gray" => {
            switch (status) {
              case "active":
              case "trialing":
                return "green";
              case "past_due":
              case "incomplete":
                return "yellow";
              case "canceled":
              case "unpaid":
              case "incomplete_expired":
                return "red";
              default:
                return "gray";
            }
          };

          return (
            <div className="space-y-6">
              {/* Storage Usage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  Storage Usage
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">
                        Document Storage
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {formatBytes(docUsed)} / {formatBytes(docCap)}
                        </span>
                        <Badge variant={docStatus.variant} shape="full">
                          {docStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(docPct)}`}
                        style={{
                          width: `${Math.min(docPct * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {(docPct * 100).toFixed(1)}% used
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">
                        QR Code Storage
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {formatBytes(qrUsed)} / {formatBytes(qrCap)}
                        </span>
                        <Badge variant={qrStatus.variant} shape="full">
                          {qrStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(qrPct)}`}
                        style={{
                          width: `${Math.min(qrPct * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {(qrPct * 100).toFixed(1)}% used
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Total: {formatBytes(totalUsed)} used of{" "}
                      {formatBytes(totalCap)}
                    </span>
                    {addonsCount > 0 && (
                      <span className="text-sm text-gray-500">
                        {addonsCount} storage add-on
                        {addonsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan & Subscription */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  Plan & Subscription
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Plan:</span>
                      <Badge variant="indigo" shape="full">
                        {tierLabel}
                      </Badge>
                    </div>
                    {company?.stripeSubscriptionStatus && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Status:</span>
                        <Badge
                          variant={subStatusVariant(
                            company.stripeSubscriptionStatus,
                          )}
                          shape="full"
                        >
                          {company.stripeSubscriptionStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {company?.subscribedAt && (
                    <p className="text-sm text-gray-600">
                      <i className="bx bx-calendar mr-1.5 text-gray-400"></i>
                      Subscribed {formatDate(company.subscribedAt)}
                      {company?.cancelledAt &&
                        ` \u2022 Cancelled ${formatDate(company.cancelledAt)}`}
                    </p>
                  )}
                  {(company?.stripeCustomerID ||
                    company?.stripeSubscriptionID) && (
                    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400 font-mono">
                      {company.stripeCustomerID && (
                        <span>Customer: {company.stripeCustomerID}</span>
                      )}
                      {company.stripeSubscriptionID && (
                        <span>Sub: {company.stripeSubscriptionID}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Counts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  Additional Counts
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-teal-50 rounded-lg flex items-center justify-center">
                      <i className="bx bx-layer text-teal-600 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">QR Groups</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {company?.qrGroupsCount ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <i className="bx bx-scan text-cyan-600 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">QR Scans</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {(company?.qrScansCount ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Procore Integration (conditional) */}
              {company?.procoreIntegration && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                    Procore Integration
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        <i className="bx bx-time-five mr-1.5 text-gray-400"></i>
                        Last Sync
                      </span>
                      <span className="text-sm text-gray-900">
                        {company.procoreLastSyncTime
                          ? formatDate(company.procoreLastSyncTime)
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        <i className="bx bx-error-circle mr-1.5 text-gray-400"></i>
                        Sync Errors
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">
                          {company.procoreSyncErrorCount ?? 0}
                        </span>
                        {(company.procoreSyncErrorCount ?? 0) > 0 && (
                          <Badge variant="yellow" shape="full">
                            Errors
                          </Badge>
                        )}
                      </div>
                    </div>
                    {company.procoreLastSyncError && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 font-mono break-all">
                        {company.procoreLastSyncError}
                      </div>
                    )}
                    {company.procoreCompanyID && (
                      <div className="text-xs text-gray-400 font-mono pt-1">
                        Procore Company ID: {company.procoreCompanyID}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Transfer User Modal */}
      <Modal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Transfer User"
        subtitle={<span>Move this user to a different company account.</span>}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowTransferModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => handleTransfer()}
              disabled={!transferTargetId || transferUserMutation.isPending}
            >
              {transferUserMutation.isPending
                ? "Transferring..."
                : "Transfer User"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Current User Info */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div
              className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center font-medium ${selectedUser ? getAvatarColor(selectedUser.permission) : "bg-gray-100"}`}
            >
              {selectedUser ? getUserInitials(selectedUser) : "?"}
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedUser?.email}</p>
              <p className="text-sm text-gray-500">
                {selectedUser?.firstName} {selectedUser?.lastName}
              </p>
            </div>
          </div>

          {/* Transfer Direction */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 border-t border-gray-200"></div>
            <div className="flex items-center gap-2 text-gray-400">
              <i className="bx bx-right-arrow-alt text-xl"></i>
              <span className="text-sm">Transfer to</span>
            </div>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Target Company Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select destination company
            </label>
            <input
              type="text"
              placeholder="Search companies..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {transferTargetCompanies.length > 0 ? (
                transferTargetCompanies.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setTransferTargetId(c._id)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      transferTargetId === c._id
                        ? "bg-indigo-50 border-l-2 border-indigo-500"
                        : ""
                    }`}
                  >
                    <div>
                      <p
                        className={`font-medium ${transferTargetId === c._id ? "text-indigo-700" : "text-gray-900"}`}
                      >
                        {c.companyName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.usersCount} user{c.usersCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {transferTargetId === c._id && (
                      <i className="bx bx-check-circle text-indigo-600 text-xl"></i>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No companies found
                </div>
              )}
            </div>
          </div>

          {/* Make Admin Option */}
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              id="makeAdmin"
              checked={transferMakeAdmin}
              onChange={(e) => setTransferMakeAdmin(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Grant admin privileges
              </span>
              <p className="text-xs text-gray-500">
                User will have admin access in the new company
              </p>
            </div>
          </label>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <i className="bx bx-info-circle text-amber-600 text-xl flex-shrink-0 mt-0.5"></i>
            <p className="text-sm text-amber-800">
              This user will be removed from{" "}
              <strong>{company?.companyName}</strong> and all their access will
              be revoked.
            </p>
          </div>
        </div>
      </Modal>

      {/* Transfer Confirmation Modal - shown when transferring sole admin / only user */}
      <Modal
        open={showTransferConfirm}
        onClose={() => {
          setShowTransferConfirm(false);
          setSelectedUser(null);
        }}
        title="Confirm Transfer"
        subtitle={<span>This user is the only admin of this company.</span>}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowTransferConfirm(false);
                setShowTransferModal(true);
              }}
            >
              Go Back
            </Button>
            <Button
              variant="danger"
              onClick={() => handleTransfer(true)}
              disabled={transferUserMutation.isPending}
            >
              {transferUserMutation.isPending
                ? "Transferring..."
                : "Confirm Transfer"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <i className="bx bx-error-circle text-red-600 text-xl flex-shrink-0 mt-0.5"></i>
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">
                {selectedUser?.firstName} {selectedUser?.lastName} is the only
                admin of {company?.companyName}.
              </p>
              <p>
                Transferring them will leave this company with no admin. This is
                typically only needed for legacy duplicate companies from the
                old Procore OAuth process.
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Are you sure you want to proceed?
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        subtitle={<span>Update user details and permissions.</span>}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <i className="bx bx-envelope text-gray-400"></i>
              <span className="text-sm text-gray-600">
                {selectedUser?.email}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={editPermission}
              onChange={(e) => setEditPermission(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="admin">Admin</option>
              <option value="pm">Project Manager</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
        subtitle={<span>This action cannot be undone.</span>}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-gray-600">
            Are you sure you want to permanently delete this user?
          </p>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div
              className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center font-medium ${selectedUser ? getAvatarColor(selectedUser.permission) : "bg-gray-100"}`}
            >
              {selectedUser ? getUserInitials(selectedUser) : "?"}
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedUser?.email}</p>
              <p className="text-sm text-gray-500">
                {selectedUser?.firstName} {selectedUser?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <i className="bx bx-error-circle text-red-600 text-xl flex-shrink-0 mt-0.5"></i>
            <p className="text-sm text-red-800">
              This will permanently remove the user and all their associated
              data. This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>

      {/* Invite User Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite User"
        subtitle={
          <span>
            Send an invitation to join{" "}
            <strong>{company?.companyName || "this company"}</strong>.
          </span>
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowInviteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleInviteUser}
              disabled={!inviteEmail || inviteUserMutation.isPending}
            >
              {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="John"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="user">User</option>
              <option value="pm">Project Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <i className="bx bx-envelope text-blue-600 text-xl flex-shrink-0 mt-0.5"></i>
            <p className="text-sm text-blue-800">
              An invitation email will be sent with a link to create their
              account.
            </p>
          </div>
        </div>
      </Modal>

      {/* Edit Email Domains Modal */}
      <Modal
        open={showEmailDomainsModal}
        onClose={() => setShowEmailDomainsModal(false)}
        title="Edit Email Domains"
        subtitle={
          <span>Configure email domains for automatic company matching.</span>
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowEmailDomainsModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateEmailDomains}
              disabled={updateEmailDomainsMutation.isPending}
            >
              {updateEmailDomainsMutation.isPending
                ? "Saving..."
                : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <i className="bx bx-info-circle text-purple-600 text-xl flex-shrink-0 mt-0.5"></i>
            <p className="text-sm text-purple-800">
              Users signing in with Procore OAuth will be automatically matched
              to this company if their email domain is listed here.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add domain
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
                placeholder="example.com"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <Button variant="secondary" onClick={addDomain}>
                Add
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current domains
            </label>
            {emailDomains.length > 0 ? (
              <div className="space-y-2">
                {emailDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <i className="bx bx-globe text-gray-400"></i>
                      <span className="text-sm font-medium text-gray-700">
                        {domain}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDomain(domain)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove domain"
                    >
                      <i className="bx bx-x text-xl"></i>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <div className="text-center">
                  <i className="bx bx-globe text-3xl mb-2"></i>
                  <p className="text-sm">No domains configured</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Company Email Modal */}
      {company && (
        <AdminEmailModal
          open={showCompanyEmailModal}
          onClose={() => setShowCompanyEmailModal(false)}
          companyId={companyId}
          companyName={company.companyName || "Unnamed Company"}
          defaultTemplate="procore_disconnection"
        />
      )}

      {/* Deactivate Company Confirmation Modal */}
      {company && (
        <AdminDestructiveConfirmModal
          open={showDeactivateCompanyModal}
          onClose={() => setShowDeactivateCompanyModal(false)}
          onConfirm={() => {
            updateCompanyStatusMutation.mutate(
              {
                companyId,
                params: { deactivated: true },
              },
              {
                onSuccess: () => {
                  toast.success(`${company.companyName} deactivated`);
                  setShowDeactivateCompanyModal(false);
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
          companyName={company.companyName || "Unnamed Company"}
          action="deactivate"
          isLoading={updateCompanyStatusMutation.isPending}
        />
      )}

      {/* Delete Company Confirmation Modal */}
      {company && (
        <AdminDestructiveConfirmModal
          open={showDeleteCompanyModal}
          onClose={() => setShowDeleteCompanyModal(false)}
          onConfirm={() => {
            deleteCompanyMutation.mutate(
              { companyId },
              {
                onSuccess: () => {
                  toast.success(`${company.companyName} deleted`);
                  setShowDeleteCompanyModal(false);
                  navigate({ to: "/admin/customers" });
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
          companyName={company.companyName || "Unnamed Company"}
          action="delete"
          isLoading={deleteCompanyMutation.isPending}
        />
      )}
    </main>
  );
}
