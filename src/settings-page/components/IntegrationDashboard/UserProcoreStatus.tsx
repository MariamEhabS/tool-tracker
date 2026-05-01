import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  useUserProcoreStatus,
  useDisconnectUserProcore,
} from "@/api/endpoints/user";
import toast from "react-hot-toast";

interface UserProcoreStatusProps {
  userId: string;
  companyId: string;
  onConnect: () => void;
  connecting: boolean;
  connectDisabled?: boolean;
  companyConnected?: boolean;
  integrationOwner?: {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  isAdmin?: boolean;
}

export default function UserProcoreStatus({
  userId,
  companyId,
  onConnect,
  connecting,
  connectDisabled,
  companyConnected,
  integrationOwner,
  isAdmin,
}: UserProcoreStatusProps) {
  const { data: status, refetch } = useUserProcoreStatus(userId, companyId);
  const disconnectMutation = useDisconnectUserProcore();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleDisconnect = async () => {
    try {
      const result = await disconnectMutation.mutateAsync({
        userId,
        companyId,
      });
      toast.success(result.message);
      setShowDisconnectConfirm(false);
      refetch();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to disconnect",
      );
    }
  };

  if (status?.connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <i className="bx bx-user text-orange-600 text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  Connected Procore Account
                </p>
                {status.isIntegrationOwner && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    Integration Owner
                  </span>
                )}
              </div>
              <p className="font-medium text-gray-900">
                {status.procoreEmail || "Connected"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowDisconnectConfirm(true)}
            disabled={disconnectMutation.isPending}
            leftIconClass="bx bx-log-out"
          >
            Disconnect
          </Button>
        </div>

        {showDisconnectConfirm && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="bx bx-error-circle text-red-600 text-xl mt-0.5"></i>
              <div className="flex-1">
                <p className="font-medium text-red-800">
                  Disconnect your Procore?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {status.isIntegrationOwner
                    ? "You are the integration owner. Disconnecting will also disconnect the company's Procore integration. An admin will need to reconnect."
                    : "This will remove your personal Procore connection."}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    leftIconClass={
                      disconnectMutation.isPending
                        ? "bx bx-loader-alt bx-spin"
                        : "bx bx-log-out"
                    }
                  >
                    {disconnectMutation.isPending
                      ? "Disconnecting..."
                      : "Yes, Disconnect"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // User not personally connected, but company has an active integration
  if (companyConnected && integrationOwner) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <i className="bx bx-user text-orange-600 text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  Connected Procore Account
                </p>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  Integration Owner
                </span>
              </div>
              <p className="font-medium text-gray-900">
                {integrationOwner.email}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={disconnectMutation.isPending}
              leftIconClass="bx bx-log-out"
            >
              Disconnect
            </Button>
          )}
        </div>

        {showDisconnectConfirm && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="bx bx-error-circle text-red-600 text-xl mt-0.5"></i>
              <div className="flex-1">
                <p className="font-medium text-red-800">
                  Disconnect Procore Integration?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This will disconnect the company's Procore integration. An
                  admin will need to reconnect.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    leftIconClass={
                      disconnectMutation.isPending
                        ? "bx bx-loader-alt bx-spin"
                        : "bx bx-log-out"
                    }
                  >
                    {disconnectMutation.isPending
                      ? "Disconnecting..."
                      : "Yes, Disconnect"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Company has no integration - prompt to connect
  return (
    <div className="text-center py-4">
      <p className="text-sm text-gray-500 mb-3">
        Connect your personal Procore account to enable integration features.
      </p>
      <Button
        type="button"
        variant="primary"
        onClick={onConnect}
        disabled={connecting || connectDisabled}
        leftIconClass={connecting ? "bx bx-loader-alt bx-spin" : "bx bx-link"}
        className="!bg-orange-500 hover:!bg-orange-600"
      >
        {connecting ? "Connecting..." : "Connect Procore"}
      </Button>
    </div>
  );
}
