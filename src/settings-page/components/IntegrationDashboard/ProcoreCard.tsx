import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  useProcoreStatus,
  useProcoreIntegrationStatus,
  useProcoreIntegrationDetails,
  updateProcoreSettings,
  getProcoreLoginUrl,
  procoreLogout,
  procoreKeys,
  companyProcoreKeys,
  type ExtendedProcoreStatus,
  // type ProcoreSyncHealthStatus,
} from "@/api/endpoints/company";
import { userProcoreKeys } from "@/api/endpoints/user";
import { procoreOauthSuccess } from "@/api/endpoints/authentication";
import { useQueryClient } from "@tanstack/react-query";
import { initialize } from "@procore/procore-iframe-helpers";
import toast from "react-hot-toast";
import procoreIcon from "@/assets/images/procore-icon.png";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import TrialStatusBanner from "./TrialStatusBanner";
import UserProcoreStatus from "./UserProcoreStatus";
// import IntegrationOwnerSelector from "./IntegrationOwnerSelector";

// Initialize Procore context for OAuth flow.
// In the static redesign app we render this outside a Procore iframe, so the
// helper may not be available and should fail open.
let procoreContext: ReturnType<typeof initialize> | null = null;
try {
  procoreContext = initialize();
} catch {
  procoreContext = null;
}

interface ProcoreCardProps {
  companyId: string;
  userId?: string;
  isAdmin?: boolean;
  onUpgrade?: () => void;
}

/**
 * Format a date string to relative time (e.g., "5 minutes ago")
 */
// function formatRelativeTime(dateString?: string): string {
//   if (!dateString) return "Never";

//   const date = new Date(dateString);
//   const now = new Date();
//   const diffMs = now.getTime() - date.getTime();
//   const diffSeconds = Math.floor(diffMs / 1000);
//   const diffMinutes = Math.floor(diffSeconds / 60);
//   const diffHours = Math.floor(diffMinutes / 60);
//   const diffDays = Math.floor(diffHours / 24);

//   if (diffSeconds < 60) return "Just now";
//   if (diffMinutes < 60) {
//     return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
//   }
//   if (diffHours < 24) {
//     return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
//   }
//   if (diffDays < 7) {
//     return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
//   }

//   return date.toLocaleDateString();
// }

/**
 * Get health status badge configuration
 */
// function getHealthBadgeConfig(status?: ProcoreSyncHealthStatus) {
//   switch (status) {
//     case "healthy":
//       return {
//         bgColor: "bg-green-100",
//         textColor: "text-green-700",
//         label: "Healthy",
//       };
//     case "degraded":
//       return {
//         bgColor: "bg-yellow-100",
//         textColor: "text-yellow-700",
//         label: "Degraded",
//       };
//     case "error":
//       return {
//         bgColor: "bg-red-100",
//         textColor: "text-red-700",
//         label: "Error",
//       };
//     default:
//       return {
//         bgColor: "bg-gray-100",
//         textColor: "text-gray-600",
//         label: "Unknown",
//       };
//   }
// }

export default function ProcoreCard({
  companyId,
  userId,
  isAdmin = false,
  onUpgrade,
}: ProcoreCardProps) {
  const queryClient = useQueryClient();

  // Basic status for OAuth flow and edit settings
  const { data: procoreStatusData } = useProcoreStatus(companyId);

  // Extended integration status with metrics
  const { data: integrationStatus } = useProcoreIntegrationStatus(companyId);

  // New: Detailed integration info with owner and connected users (for admins)
  const { data: integrationDetails } = useProcoreIntegrationDetails(companyId);

  // Combine basic status with extended integration metrics
  const procoreStatus: ExtendedProcoreStatus | undefined = integrationStatus
    ? {
        ...integrationStatus,
        // Add editProcoreItemsAllowed from basic status if not in integration response
        editProcoreItemsAllowed:
          integrationStatus.editProcoreItemsAllowed ??
          procoreStatusData?.editProcoreItemsAllowed ??
          false,
        procoreEmail:
          integrationStatus.procoreEmail ?? procoreStatusData?.procoreEmail,
      }
    : procoreStatusData
      ? {
          connected: procoreStatusData.isConnected,
          procoreEmail: procoreStatusData.procoreEmail,
          editProcoreItemsAllowed: procoreStatusData.editProcoreItemsAllowed,
          projectsCount: 0,
          documentsCount: 0,
          inspectionsCount: 0,
          syncHealthStatus: "error" as const,
        }
      : undefined;

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Optimistic state for toggle
  const [optimisticEditAllowed, setOptimisticEditAllowed] = useState<
    boolean | null
  >(null);

  const editProcoreItemsAllowed =
    optimisticEditAllowed ?? procoreStatus?.editProcoreItemsAllowed ?? false;

  // Check if access is blocked due to trial expiration
  const accessBlocked =
    integrationDetails?.accessStatus?.allowed === false &&
    (integrationDetails?.accessStatus?.reason === "trial_expired" ||
      integrationDetails?.accessStatus?.reason === "upgrade_required");

  const handleConnectProcore = async () => {
    setConnecting(true);

    if (STATIC_APP_MODE) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: procoreKeys.status(companyId),
        }),
        queryClient.invalidateQueries({
          queryKey: procoreKeys.integrationStatus(companyId),
        }),
        queryClient.invalidateQueries({
          queryKey: companyProcoreKeys.integrationDetails(companyId),
        }),
      ]);
      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: userProcoreKeys.status(userId, companyId),
        });
      }
      toast.success("Static Procore connection ready for review");
      setConnecting(false);
      return;
    }

    try {
      const loginUrl = getProcoreLoginUrl(companyId, userId);
      procoreContext?.authentication?.authenticate?.({
        url: loginUrl,
        onSuccess: async (payload: { userId?: string }) => {
          if (payload.userId) {
            try {
              await procoreOauthSuccess(payload.userId);

              // Small delay to ensure backend has fully processed the OAuth
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Use refetchQueries to force immediate refetch (not just invalidate)
              // This ensures data is fetched even if components aren't actively rendering
              await Promise.all([
                queryClient.refetchQueries({
                  queryKey: procoreKeys.status(companyId),
                }),
                queryClient.refetchQueries({
                  queryKey: procoreKeys.integrationStatus(companyId),
                }),
                queryClient.refetchQueries({
                  queryKey: companyProcoreKeys.integrationDetails(companyId),
                }),
              ]);

              // Refetch user procore status to update the UI immediately
              if (userId) {
                await queryClient.refetchQueries({
                  queryKey: userProcoreKeys.status(userId, companyId),
                });
              }

              toast.success("Procore connected successfully");
            } catch {
              toast.error("Failed to complete Procore connection");
            }
          }
          setConnecting(false);
        },
        onFailure: (errorData?: { error?: string; message?: string }) => {
          toast.error(errorData?.message || "Procore authentication failed");
          setConnecting(false);
        },
      });
      if (!procoreContext?.authentication?.authenticate) {
        toast.error("Procore iframe helpers are unavailable in this browser context");
        setConnecting(false);
      }
    } catch {
      toast.error("Failed to start Procore connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!companyId) return;
    setDisconnecting(true);
    try {
      await procoreLogout(companyId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: procoreKeys.status(companyId),
        }),
        queryClient.invalidateQueries({
          queryKey: procoreKeys.integrationStatus(companyId),
        }),
        queryClient.invalidateQueries({
          queryKey: companyProcoreKeys.integrationDetails(companyId),
        }),
      ]);
      // Also invalidate user procore status
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: userProcoreKeys.status(userId, companyId),
        });
      }
      toast.success("Procore disconnected");
      setShowDisconnectConfirm(false);
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to disconnect",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleEditAllowed = async () => {
    if (!companyId) return;

    const newValue = !editProcoreItemsAllowed;

    // Optimistic update
    setOptimisticEditAllowed(newValue);
    setSettingsSaving(true);

    try {
      await updateProcoreSettings(companyId, newValue);
      await queryClient.refetchQueries({
        queryKey: procoreKeys.status(companyId),
      });
      toast.success(
        newValue
          ? "Procore item editing enabled"
          : "Procore item editing disabled",
      );
    } catch (e: unknown) {
      // Rollback on error
      setOptimisticEditAllowed(null);
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update setting",
      );
    } finally {
      setSettingsSaving(false);
      setOptimisticEditAllowed(null);
    }
  };

  // const handleIntegrationOwnerChanged = () => {
  //   refetchIntegrationDetails();
  //   refetchProcoreStatus();
  //   refetchIntegrationStatus();
  // };

  // const healthBadge = getHealthBadgeConfig(procoreStatus?.syncHealthStatus);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-gray-100">
              <img src={procoreIcon} alt="Procore" className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Procore</h3>
              <p className="text-sm text-gray-500">
                Construction management platform
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              procoreStatus?.connected
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                procoreStatus?.connected
                  ? "bg-green-500 animate-pulse"
                  : "bg-gray-400"
              }`}
            />
            {procoreStatus?.connected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-4">
        {/* Trial Status Banner */}
        {integrationDetails?.accessStatus && (
          <TrialStatusBanner
            accessStatus={integrationDetails.accessStatus}
            onUpgrade={onUpgrade}
          />
        )}

        {procoreStatus?.connected ? (
          <>
            {/* Section 1: Your Procore Connection - All users */}
            {userId && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <i className="bx bx-user text-gray-500"></i>
                  Company Procore Connection
                </h4>
                <UserProcoreStatus
                  userId={userId}
                  companyId={companyId}
                  onConnect={handleConnectProcore}
                  connecting={connecting}
                  connectDisabled={accessBlocked}
                  companyConnected={procoreStatus?.connected}
                  integrationOwner={integrationDetails?.integrationOwner}
                  isAdmin={isAdmin}
                />
              </div>
            )}

            {/* Section 2: Company Integration - Admin only */}
            {isAdmin && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                {/* <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <i className="bx bx-building-house text-gray-500"></i>
                  Company Integration
                </h4> */}

                {/* Integration Owner Info */}
                {/* {integrationDetails?.integrationOwner && (
                  <div className="flex items-center justify-between py-3 px-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="bx bx-crown text-blue-600 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">
                          Integration Owner
                        </p>
                        <p className="font-medium text-blue-900">
                          {integrationDetails.integrationOwner.email}
                          {integrationDetails.integrationOwner.firstName && (
                            <span className="text-blue-700 font-normal ml-1">
                              ({integrationDetails.integrationOwner.firstName}{" "}
                              {integrationDetails.integrationOwner.lastName ||
                                ""}
                              )
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )} */}

                {/* Connected Users List */}
                {/* {integrationDetails?.connectedUsers &&
                  integrationDetails.connectedUsers.length > 1 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Connected Users (
                        {integrationDetails.connectedUsers.length})
                      </p>
                      <ul className="space-y-2">
                        {integrationDetails.connectedUsers.map((user) => (
                          <li
                            key={user.userId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-700">
                              {user.email}
                              {user.firstName && (
                                <span className="text-gray-500 ml-1">
                                  ({user.firstName} {user.lastName || ""})
                                </span>
                              )}
                            </span>
                            {user.isIntegrationOwner && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                Owner
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )} */}

                {/* Change Integration Owner */}
                {/* {integrationDetails?.connectedUsers &&
                  integrationDetails.connectedUsers.length > 0 &&
                  userId && (
                    <IntegrationOwnerSelector
                      companyId={companyId}
                      currentUserId={userId}
                      connectedUsers={integrationDetails.connectedUsers}
                      currentOwnerId={
                        integrationDetails.integrationOwner?.userId
                      }
                      onSuccess={handleIntegrationOwnerChanged}
                    />
                  )} */}

                {/* Sync Health Metrics */}
                {/* <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                      Sync Health Metrics
                    </h4>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${healthBadge.bgColor} ${healthBadge.textColor}`}
                    >
                      {healthBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Last Sync */}
                {/* <div className="flex items-center gap-2 text-sm">
                  <i className="bx bx-time text-gray-400"></i>
                  <span className="text-gray-600">Last sync:</span>
                  <span className="font-medium text-gray-900">
                    {formatRelativeTime(procoreStatus.lastSyncTime)}
                  </span>
                </div> */}

                {/* Projects */}
                {/* <div className="flex items-center gap-2 text-sm">
                  <i className="bx bx-check-circle text-green-500"></i>
                  <span className="text-gray-600">Projects:</span>
                  <span className="font-medium text-gray-900">
                    {procoreStatus.projectsCount ?? 0}
                  </span>
                </div> */}

                {/* Documents */}
                {/* <div className="flex items-center gap-2 text-sm">
                  <i className="bx bx-check-circle text-green-500"></i>
                  <span className="text-gray-600">Documents:</span>
                  <span className="font-medium text-gray-900">
                    {procoreStatus.documentsCount ?? 0}
                  </span>
                </div> */}

                {/* Inspections */}
                {/* <div className="flex items-center gap-2 text-sm">
                  <i className="bx bx-check-circle text-green-500"></i>
                  <span className="text-gray-600">Inspections:</span>
                  <span className="font-medium text-gray-900">
                    {procoreStatus.inspectionsCount ?? 0}
                  </span>
                </div>
              </div> */}
                {/* </div> */}

                {/* Settings */}
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        Allow Procore Item Edits
                      </p>
                      <p className="text-sm text-gray-500">
                        Enable users to edit Procore items directly from Taliho
                        QR codes.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editProcoreItemsAllowed}
                      aria-label="Toggle Procore item editing"
                      disabled={settingsSaving}
                      onClick={handleToggleEditAllowed}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                        editProcoreItemsAllowed
                          ? "bg-orange-500"
                          : "bg-gray-200"
                      } ${settingsSaving ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          editProcoreItemsAllowed
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Disconnect Company Integration (Legacy fallback) */}
                {!userId && (
                  <>
                    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <i className="bx bx-user text-orange-600 text-xl"></i>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">
                            Connected Account
                          </p>
                          <p className="font-medium text-gray-900">
                            {procoreStatus.procoreEmail || "Procore User"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setShowDisconnectConfirm(true)}
                        disabled={disconnecting}
                        leftIconClass="bx bx-log-out"
                      >
                        Disconnect
                      </Button>
                    </div>

                    {/* Disconnect Confirmation */}
                    {showDisconnectConfirm && (
                      <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <i className="bx bx-error-circle text-red-600 text-xl mt-0.5"></i>
                          <div className="flex-1">
                            <p className="font-medium text-red-800">
                              Disconnect Procore?
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                              This will remove the connection to your Procore
                              account. Synced data will remain but will no
                              longer update.
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Button
                                type="button"
                                variant="danger"
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                leftIconClass={
                                  disconnecting
                                    ? "bx bx-loader-alt bx-spin"
                                    : "bx bx-log-out"
                                }
                              >
                                {disconnecting
                                  ? "Disconnecting..."
                                  : "Yes, Disconnect"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowDisconnectConfirm(false)}
                                disabled={disconnecting}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <i className="bx bx-info-circle text-blue-600 text-xl mt-0.5"></i>
              <p className="text-sm text-blue-800">
                Your Procore integration syncs projects, locations, and
                construction data to power your QR codes. Changes in Procore
                will be reflected in Taliho.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Disconnected State */}
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="bx bx-link-external text-gray-400 text-3xl"></i>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Connect to Procore
              </h4>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Link your Procore account to sync projects, locations, and
                construction data with your Taliho QR codes.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={handleConnectProcore}
                disabled={connecting || accessBlocked}
                leftIconClass={
                  connecting ? "bx bx-loader-alt bx-spin" : "bx bx-link"
                }
                className="!bg-orange-500 hover:!bg-orange-600 disabled:!bg-gray-400 disabled:cursor-wait"
              >
                {connecting ? "Connecting..." : "Connect Procore Account"}
              </Button>
              {connecting && (
                <p className="text-xs text-gray-500 mt-3">
                  Please complete the authorization in the popup window. This
                  may take up to 30 seconds.
                </p>
              )}
            </div>

            {/* Features List */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <i className="bx bx-check-circle text-green-500"></i>
                <span>Sync Projects</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <i className="bx bx-check-circle text-green-500"></i>
                <span>Import Locations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <i className="bx bx-check-circle text-green-500"></i>
                <span>Fetch Documents</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <i className="bx bx-check-circle text-green-500"></i>
                <span>Track RFIs & Submittals</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
