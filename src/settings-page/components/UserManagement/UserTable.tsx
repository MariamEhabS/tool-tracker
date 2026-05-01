import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  listCompanyUsers,
  patchUserDetails,
  deleteUser,
  resendUserInvite,
  type UserRecord,
} from "@/api/endpoints/user";
import { isAdmin as checkIsAdmin, canManageUsers } from "@/utils/permissions";
import Button from "@/components/ui/Button";
import DeleteModal from "@/components/modal/taliho/DeleteModal";
import { useTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import TableSkeleton from "@/components/loader/TableSkeleton";
import { logApiError } from "@/utils/rollbar";

type Role = "admin" | "pm" | "user";

interface StoredUser {
  _id?: string;
  email?: string;
  companyId?: string;
  permission?: Role;
}

function getUserFromLocalStorage(): StoredUser | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function sortUsers(users: UserRecord[]): UserRecord[] {
  return [...users].sort((a, b) => {
    const aIsAdmin = checkIsAdmin(a);
    const bIsAdmin = checkIsAdmin(b);
    const aIsVerified = a.isVerified !== false;
    const bIsVerified = b.isVerified !== false;

    // Admin users first
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;

    // Then verified users
    if (aIsVerified && !bIsVerified) return -1;
    if (!aIsVerified && bIsVerified) return 1;

    // Finally sort alphabetically by email
    return (a.email || "").localeCompare(b.email || "");
  });
}

export function UserTable() {
  const currentUser = getUserFromLocalStorage();
  const companyId = currentUser?.companyId || "";
  const queryClient = useQueryClient();
  const hasPermission = canManageUsers(currentUser);

  const [roleEdits, setRoleEdits] = useState<Record<string, Role>>({});
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(
    null,
  );
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);

  // Fetch users - always call hook unconditionally
  const usersQuery = useQuery({
    queryKey: ["companyUsers", companyId],
    queryFn: () =>
      listCompanyUsers({ companyId, current_page: 1, per_page: 100 }),
    enabled: !!companyId && hasPermission,
  });
  const { data: usersData, error } = usersQuery;
  const loadingState = useTableLoadingState(usersQuery);

  const users = useMemo(() => {
    const list = usersData?.users ?? [];
    return sortUsers(list);
  }, [usersData]);

  // Initialize roleEdits when users change - use useEffect for side effects
  const usersKey = users.map((u) => u._id).join(",");
  useMemo(() => {
    if (users.length > 0 && Object.keys(roleEdits).length === 0) {
      const initial: Record<string, Role> = {};
      users.forEach((u) => {
        initial[u._id] = (u.permission as Role) || "user";
      });
      setRoleEdits(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersKey]);

  // Computed values
  const proposedAdminIds = useMemo(() => {
    return Object.entries(roleEdits)
      .filter(([, role]) => role === "admin")
      .map(([id]) => id);
  }, [roleEdits]);

  const willHaveAdmin = proposedAdminIds.length > 0;

  const hasRoleChanges = useMemo(() => {
    if (!users?.length) return false;
    return users.some((u) => roleEdits[u._id] !== (u.permission || "user"));
  }, [users, roleEdits]);

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const changed = users.filter(
        (u) => roleEdits[u._id] !== (u.permission || "user"),
      );
      if (changed.length === 0) return;

      await Promise.all(
        changed.map((u) =>
          patchUserDetails(u._id, {
            companyId,
            permission: roleEdits[u._id],
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyUsers", companyId] });
      toast.success("User roles updated successfully.");
    },
    onError: (e: unknown) => {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      // Log to Rollbar for tracking
      logApiError(e, "update-user-roles-failed", { companyId });
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update user roles",
      );
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId, { companyId }),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["companyUsers", companyId] });
      setRoleEdits((prev) => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
      toast.success("User deleted successfully.");
    },
    onError: (e: unknown, userId) => {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      // Log to Rollbar for tracking
      logApiError(e, "delete-user-failed", { userId, companyId });
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete user",
      );
    },
  });

  // Resend invite mutation
  const resendMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      if (!currentUser?._id) throw new Error("Missing inviter user id");
      return resendUserInvite(targetUserId, currentUser._id, { companyId });
    },
    onSuccess: (_data, targetUserId) => {
      const targetUser = users.find((u) => u._id === targetUserId);
      toast.success(`Invitation email resent to ${targetUser?.email}`);
    },
    onError: (e: unknown, targetUserId) => {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      // Log to Rollbar for tracking
      logApiError(e, "resend-user-invite-failed", { targetUserId, companyId });
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to resend invitation",
      );
    },
    onSettled: () => {
      setResendingInviteId(null);
    },
  });

  const handleRoleChange = useCallback((userId: string, role: Role) => {
    setRoleEdits((prev) => ({
      ...prev,
      [userId]: role,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (!willHaveAdmin) {
      toast.error("At least one admin is required. Please assign an admin.");
      return;
    }
    saveMutation.mutate();
  }, [willHaveAdmin, saveMutation]);

  const handleDeleteClick = useCallback((target: UserRecord) => {
    if (checkIsAdmin(target)) {
      toast.error(
        "Cannot delete an admin user. Please transfer admin role first.",
      );
      return;
    }
    setUserToDelete(target);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!userToDelete) return;
    deleteMutation.mutate(userToDelete._id);
    setUserToDelete(null);
  }, [userToDelete, deleteMutation]);

  const handleDeleteCancel = useCallback(() => {
    setUserToDelete(null);
  }, []);

  const handleResendInvite = useCallback(
    (targetUser: UserRecord) => {
      setResendingInviteId(targetUser._id);
      resendMutation.mutate(targetUser._id);
    },
    [resendMutation],
  );

  // Permission check - moved after all hooks
  if (!hasPermission) {
    return (
      <div className="text-sm text-gray-600" data-testid="access-denied">
        You do not have permission to manage users.
      </div>
    );
  }

  if (loadingState.showSkeleton) {
    return (
      <div data-testid="loading">
        <TableSkeleton columnCount={4} rowCount={10} showActions />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600" data-testid="error">
        Failed to load users. Please try again.
      </p>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-gray-600" data-testid="empty">
        No users found.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="user-table-container">
      {/* User Table */}
      <div className="overflow-hidden border border-gray-200 rounded-md">
        <table
          className="min-w-full divide-y divide-gray-200"
          data-testid="user-table"
        >
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                PM
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => {
              const currentRole =
                roleEdits[u._id] || (u.permission as Role) || "user";
              const isCurrentAdmin = currentRole === "admin";
              const isOnlyAdmin =
                isCurrentAdmin &&
                proposedAdminIds.length === 1 &&
                proposedAdminIds[0] === u._id;
              const isMe =
                !!currentUser?.email && u.email === currentUser.email;
              const isPending = u.isVerified === false;
              const isResending = resendingInviteId === u._id;

              return (
                <tr key={u._id} data-testid={`user-row-${u._id}`}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium"
                          data-testid={`user-email-${u._id}`}
                        >
                          {u.email}
                        </span>
                        {isMe && (
                          <span
                            className="text-xs text-gray-500"
                            data-testid="you-badge"
                          >
                            (You)
                          </span>
                        )}
                        {isPending && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                            data-testid={`pending-badge-${u._id}`}
                          >
                            Pending
                          </span>
                        )}
                        {!isPending && u.isVerified !== undefined && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                            data-testid={`verified-badge-${u._id}`}
                          >
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">
                        {(u.firstName || u.lastName) &&
                          [u.firstName, u.lastName].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="radio"
                      name={`role-${u._id}`}
                      className="h-4 w-4 text-yellow-500"
                      checked={currentRole === "admin"}
                      disabled={isMe}
                      onChange={() => handleRoleChange(u._id, "admin")}
                      data-testid={`radio-admin-${u._id}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="radio"
                      name={`role-${u._id}`}
                      className="h-4 w-4 text-yellow-500"
                      checked={currentRole === "pm"}
                      disabled={isMe || isOnlyAdmin}
                      onChange={() => handleRoleChange(u._id, "pm")}
                      data-testid={`radio-pm-${u._id}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="radio"
                      name={`role-${u._id}`}
                      className="h-4 w-4 text-yellow-500"
                      checked={currentRole === "user"}
                      disabled={isMe || isOnlyAdmin}
                      onChange={() => handleRoleChange(u._id, "user")}
                      data-testid={`radio-user-${u._id}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isPending && !isMe && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleResendInvite(u)}
                          disabled={isResending}
                          leftIconClass="bx bx-mail-send"
                          data-testid={`resend-invite-${u._id}`}
                        >
                          {isResending ? "Sending..." : "Resend Invite"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleDeleteClick(u)}
                        disabled={isMe || isCurrentAdmin}
                        leftIconClass="bx bx-trash"
                        data-testid={`delete-user-${u._id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Warning if no admin will remain */}
        {!willHaveAdmin && (
          <div
            className="px-4 py-2 bg-yellow-50 text-yellow-800 text-sm"
            data-testid="no-admin-warning"
          >
            At least one admin is required. Please assign an admin before
            saving.
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={
            saveMutation.isPending ||
            loadingState.showSkeleton ||
            !hasRoleChanges ||
            !willHaveAdmin
          }
          data-testid="save-button"
        >
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        open={!!userToDelete}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        title="Delete User"
        subtitle={
          userToDelete ? (
            <span>
              Are you sure you want to delete{" "}
              <strong>
                {userToDelete.firstName && userToDelete.lastName
                  ? `${userToDelete.firstName} ${userToDelete.lastName}`
                  : userToDelete.email}
              </strong>
              ?
            </span>
          ) : undefined
        }
        bodyMessage="This action cannot be undone. The user will lose access to this company."
        isLoading={deleteMutation.isPending}
        size="md"
      />
    </div>
  );
}

export default UserTable;
