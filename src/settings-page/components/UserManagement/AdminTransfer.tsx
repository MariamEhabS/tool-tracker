import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import {
  switchAdminRole,
  listCompanyUsers,
  type UserRecord,
} from "@/api/endpoints/user";

interface AdminTransferProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentUserId: string;
  companyId: string;
}

/**
 * Check if user has admin permission
 */
function checkIsAdmin(user: UserRecord): boolean {
  return user.permission === "admin";
}

/**
 * Get display name for role
 */
function getRoleDisplayName(permission?: "admin" | "pm" | "user"): string {
  switch (permission) {
    case "admin":
      return "Admin";
    case "pm":
      return "Project Manager";
    default:
      return "User";
  }
}

export function AdminTransfer({
  open,
  onClose,
  onSuccess,
  currentUserId,
  companyId,
}: AdminTransferProps) {
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<UserRecord | null>(
    null,
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Fetch users when modal is open
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["companyUsers", companyId],
    queryFn: () =>
      listCompanyUsers({ companyId, current_page: 1, per_page: 100 }),
    enabled: open && !!companyId,
  });

  const users = useMemo(() => usersData?.users ?? [], [usersData]);

  // Filter users: verified, non-admin, not current user
  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !checkIsAdmin(u) && u.isVerified !== false && u._id !== currentUserId,
      ),
    [users, currentUserId],
  );

  const handleClose = () => {
    if (isTransferring) return;
    setSelectedNewAdmin(null);
    onClose();
  };

  const handleTransfer = async () => {
    if (!selectedNewAdmin) return;

    if (!companyId) {
      toast.error("Missing company id");
      return;
    }

    try {
      setIsTransferring(true);
      await switchAdminRole(currentUserId, selectedNewAdmin._id, {
        companyId,
      });

      // Update localStorage user object with new permission
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      if (parsedUser) {
        const updatedUser = { ...parsedUser, permission: "user" as const };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      toast.success(
        `Admin role transferred to ${selectedNewAdmin.firstName || selectedNewAdmin.email}. You are now a regular user.`,
      );

      // Call onSuccess callback if provided
      onSuccess?.();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to transfer admin role",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Transfer Admin Role"
      subtitle={
        <span className="text-yellow-600 font-medium">
          This action will transfer all admin privileges
        </span>
      }
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isTransferring}
            data-testid="admin-transfer-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleTransfer}
            disabled={!selectedNewAdmin || isTransferring}
            leftIconClass={
              isTransferring ? "bx bx-loader-alt bx-spin" : "bx bx-transfer"
            }
            data-testid="admin-transfer-confirm"
          >
            {isTransferring ? "Transferring..." : "Confirm Transfer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-md p-3"
          data-testid="admin-transfer-warning"
        >
          <p className="text-sm text-gray-700">
            You are about to transfer admin privileges to another user. After
            this action:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>The selected user will become the new admin</li>
            <li>You will become a regular user</li>
            <li>
              You will no longer be able to manage users or company settings
            </li>
            <li>This change will take effect immediately</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select New Admin
          </label>
          <div
            className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2"
            data-testid="admin-transfer-user-list"
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600" />
              </div>
            ) : eligibleUsers.length === 0 ? (
              <p
                className="text-sm text-gray-500 p-3"
                data-testid="admin-transfer-no-users"
              >
                No verified users available to transfer admin role. Please
                invite and verify users first.
              </p>
            ) : (
              eligibleUsers.map((u) => (
                <div
                  key={u._id}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${
                    selectedNewAdmin?._id === u._id
                      ? "bg-yellow-100 border-2 border-yellow-500"
                      : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedNewAdmin(u)}
                  data-testid={`admin-transfer-user-${u._id}`}
                >
                  <input
                    type="radio"
                    name="newAdmin"
                    checked={selectedNewAdmin?._id === u._id}
                    onChange={() => setSelectedNewAdmin(u)}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 mr-3"
                    data-testid={`admin-transfer-radio-${u._id}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{u.email}</div>
                    {(u.firstName || u.lastName) && (
                      <div className="text-sm text-gray-500">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Current role: {getRoleDisplayName(u.permission)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default AdminTransfer;
