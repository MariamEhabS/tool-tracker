import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import { useAdminPlatformStats } from "@/api/endpoints/admin-customers";
import Badge from "@/components/ui/Badge";
import { formatBytes } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createLazyFileRoute("/admin/stats")({
  component: AdminStats,
});

// Chart color constants
const PLAN_COLORS: Record<string, string> = {
  "Free Trial": "#eab308",
  "Trial (Refreshed)": "#f59e0b",
  Standard: "#22c55e",
  Professional: "#3b82f6",
  Business: "#8b5cf6",
  "Early Adopter": "#06b6d4",
  Expired: "#9ca3af",
  Cancelled: "#ef4444",
};

const STORAGE_COLORS = {
  documents: "#2563eb",
  qrCodes: "#fbbf24",
};

// Custom tooltip for plan donut
function PlanTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: item } = payload[0];
  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-200 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-sm font-medium text-gray-900">{name}</span>
      </div>
      <p className="text-sm text-gray-600 mt-0.5">
        {value} {value === 1 ? "company" : "companies"}
      </p>
    </div>
  );
}

// Custom tooltip for storage donut
function StorageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: item } = payload[0];
  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-200 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-sm font-medium text-gray-900">{name}</span>
      </div>
      <p className="text-sm text-gray-600 mt-0.5">{formatBytes(value)}</p>
    </div>
  );
}

function AdminStats() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const { data: platformStats, isLoading } = useAdminPlatformStats(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  // Derive chart data from stats
  const planChartData = useMemo(() => {
    if (!platformStats) return [];
    return [
      {
        name: "Free Trial",
        value: platformStats.planBreakdown.freeTrial,
        color: PLAN_COLORS["Free Trial"],
      },
      {
        name: "Trial (Refreshed)",
        value: platformStats.planBreakdown.trialRefreshed,
        color: PLAN_COLORS["Trial (Refreshed)"],
      },
      {
        name: "Standard",
        value: platformStats.planBreakdown.standard,
        color: PLAN_COLORS["Standard"],
      },
      {
        name: "Professional",
        value: platformStats.planBreakdown.professional,
        color: PLAN_COLORS["Professional"],
      },
      {
        name: "Business",
        value: platformStats.planBreakdown.business,
        color: PLAN_COLORS["Business"],
      },
      {
        name: "Early Adopter",
        value: platformStats.planBreakdown.earlyAdopter,
        color: PLAN_COLORS["Early Adopter"],
      },
      {
        name: "Expired",
        value: platformStats.planBreakdown.expired,
        color: PLAN_COLORS["Expired"],
      },
      {
        name: "Cancelled",
        value: platformStats.planBreakdown.cancelled,
        color: PLAN_COLORS["Cancelled"],
      },
    ].filter((d) => d.value > 0);
  }, [platformStats]);

  const storageChartData = useMemo(() => {
    if (!platformStats) return [];
    return [
      {
        name: "Documents",
        value: platformStats.totalDocumentStorageUsed,
        color: STORAGE_COLORS.documents,
      },
      {
        name: "QR Codes",
        value: platformStats.totalQrCodeStorageUsed,
        color: STORAGE_COLORS.qrCodes,
      },
    ].filter((d) => d.value > 0);
  }, [platformStats]);

  const totalStorageUsed = useMemo(() => {
    if (!platformStats) return 0;
    return (
      platformStats.totalDocumentStorageUsed +
      platformStats.totalQrCodeStorageUsed
    );
  }, [platformStats]);

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Checking authorization...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <main className="h-full overflow-y-auto p-8">
      {/* Back navigation */}
      <button
        onClick={() => navigate({ to: "/admin/customers" })}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors w-fit"
      >
        <i className="bx bx-arrow-back text-lg"></i>
        <span>Back to Customer Management</span>
      </button>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <i className="bx bx-bar-chart-alt-2 text-indigo-600 text-xl"></i>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Platform Stats
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-[52px]">
          Aggregate statistics across all companies
        </p>
      </div>

      {isLoading || !platformStats ? (
        <div className="flex items-center justify-center py-24">
          <i className="bx bx-loader-alt bx-spin text-3xl text-gray-400 mr-3"></i>
          <span className="text-gray-500 text-lg">
            Loading platform stats...
          </span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-buildings text-indigo-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Companies</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalCompanies.toLocaleString()}
                  </p>
                  {platformStats.deactivatedCompanies > 0 && (
                    <p className="text-xs text-red-500">
                      {platformStats.deactivatedCompanies} deactivated
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-user text-blue-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalUsers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-qr text-green-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">QR Codes</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalQrCodes.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {platformStats.totalQrScans.toLocaleString()} scans
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-file text-purple-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Documents</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalDocuments.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-folder text-orange-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Projects</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalProjects.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-collection text-yellow-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">QR Groups</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.totalQrGroups.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Distribution Donut */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Plan Distribution
              </h3>
              {planChartData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div className="w-full h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          animationDuration={800}
                        >
                          {planChartData.map((entry, index) => (
                            <Cell key={`plan-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PlanTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {platformStats.totalCompanies}
                        </p>
                        <p className="text-xs text-gray-500">companies</p>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-4">
                    {planChartData.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-600">{entry.name}</span>
                        <span className="text-gray-900 font-medium ml-auto">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  No company data available
                </div>
              )}
            </div>

            {/* Storage Breakdown Donut */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Storage Breakdown
              </h3>
              {storageChartData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div className="w-full h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={storageChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          animationDuration={800}
                        >
                          {storageChartData.map((entry, index) => (
                            <Cell key={`storage-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<StorageTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatBytes(totalStorageUsed)}
                        </p>
                        <p className="text-xs text-gray-500">total used</p>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-4">
                    {storageChartData.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-600">{entry.name}</span>
                        <span className="text-gray-900 font-medium ml-auto">
                          {formatBytes(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  No storage data available
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Storage Capacity Progress Bars */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Storage Capacity
            </h3>
            <div className="space-y-4">
              {(() => {
                const docUsed = platformStats.totalDocumentStorageUsed;
                const docCap = platformStats.totalDocumentStorageCapacity;
                const docPct = docCap > 0 ? docUsed / docCap : 0;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">
                        Document Storage
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatBytes(docUsed)} / {formatBytes(docCap)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-indigo-500"
                        style={{
                          width: `${Math.min(docPct * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {(docPct * 100).toFixed(1)}% used across all companies
                    </p>
                  </div>
                );
              })()}

              {(() => {
                const qrUsed = platformStats.totalQrCodeStorageUsed;
                const qrCap = platformStats.totalQrCodeStorageCapacity;
                const qrPct = qrCap > 0 ? qrUsed / qrCap : 0;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">
                        QR Code Storage
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatBytes(qrUsed)} / {formatBytes(qrCap)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-green-500"
                        style={{
                          width: `${Math.min(qrPct * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {(qrPct * 100).toFixed(1)}% used across all companies
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">
                  Total: {formatBytes(totalStorageUsed)} used of{" "}
                  {formatBytes(
                    platformStats.totalDocumentStorageCapacity +
                      platformStats.totalQrCodeStorageCapacity,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Plan Breakdown Badges */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Plan Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.freeTrial}
                </p>
                <Badge variant="yellow" shape="full">
                  Free Trial
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.trialRefreshed}
                </p>
                <Badge variant="yellow" shape="full">
                  Trial (Refreshed)
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.standard}
                </p>
                <Badge variant="green" shape="full">
                  Standard
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.professional}
                </p>
                <Badge variant="green" shape="full">
                  Professional
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.business}
                </p>
                <Badge variant="green" shape="full">
                  Business
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.earlyAdopter}
                </p>
                <Badge variant="green" shape="full">
                  Early Adopter
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.expired}
                </p>
                <Badge variant="gray" shape="full">
                  Expired
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {platformStats.planBreakdown.cancelled}
                </p>
                <Badge variant="red" shape="full">
                  Cancelled
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 5: Procore Integration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Procore Integration
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-link text-orange-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Connected</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.procoreConnected}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-unlink text-gray-500 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Not Connected</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {platformStats.procoreNotConnected}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
