import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  useChangeIntegrationOwner,
  type ConnectedProcoreUser,
} from "@/api/endpoints/company";
import toast from "react-hot-toast";

interface IntegrationOwnerSelectorProps {
  companyId: string;
  currentUserId: string;
  connectedUsers: ConnectedProcoreUser[];
  currentOwnerId?: string;
  onSuccess: () => void;
}

export default function IntegrationOwnerSelector({
  companyId,
  currentUserId,
  connectedUsers,
  currentOwnerId,
  onSuccess,
}: IntegrationOwnerSelectorProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showSelector, setShowSelector] = useState(false);
  const changeOwnerMutation = useChangeIntegrationOwner();

  const eligibleUsers = connectedUsers.filter(
    (u) => u.userId !== currentOwnerId,
  );

  const handleChangeOwner = async () => {
    if (!selectedUserId) return;

    try {
      const result = await changeOwnerMutation.mutateAsync({
        companyId,
        newOwnerUserId: selectedUserId,
        requestingUserId: currentUserId,
      });
      toast.success(result.message);
      setShowSelector(false);
      setSelectedUserId("");
      onSuccess();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to change owner",
      );
    }
  };

  if (eligibleUsers.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        No other users have connected their Procore accounts yet.
      </p>
    );
  }

  if (!showSelector) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setShowSelector(true)}
        leftIconClass="bx bx-transfer"
      >
        Change Integration Owner
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
      <p className="text-sm font-medium text-gray-700">
        Select new integration owner:
      </p>
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      >
        <option value="">Choose a user...</option>
        {eligibleUsers.map((user) => (
          <option key={user.userId} value={user.userId}>
            {user.email}{" "}
            {user.firstName && `(${user.firstName} ${user.lastName || ""})`}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={handleChangeOwner}
          disabled={!selectedUserId || changeOwnerMutation.isPending}
          leftIconClass={
            changeOwnerMutation.isPending
              ? "bx bx-loader-alt bx-spin"
              : "bx bx-check"
          }
          className="!bg-orange-500 hover:!bg-orange-600"
        >
          {changeOwnerMutation.isPending ? "Changing..." : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowSelector(false);
            setSelectedUserId("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
