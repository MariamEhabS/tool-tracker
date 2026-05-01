/**
 * StorageStats - Quick storage statistics cards
 * Displays remaining storage, document/QR counts, and active add-ons
 *
 * Fetches fresh data from /storage-stats endpoint which recalculates
 * storage from actual documents (handles legacy V2 data).
 */

import { useStorageLimits, useTier } from "@/lib/tiers/hooks";
import { useStorageStats } from "@/api/endpoints/company";
import {
  formatStorageForTier,
  formatStorageAdaptive,
  formatCount,
} from "../../utils/settingsFormatters";

function getCompanyIdFromLocalStorage(): string {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return "";
    const user = JSON.parse(userStr);
    return user?.companyId || "";
  } catch {
    return "";
  }
}

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  iconColorClass?: string;
  iconBgClass?: string;
  isLoading?: boolean;
}

function StatCard({
  icon,
  value,
  label,
  iconColorClass = "text-gray-600",
  iconBgClass = "bg-gray-100",
  isLoading = false,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div
        className={`w-12 h-12 rounded-full ${iconBgClass} flex items-center justify-center mb-3`}
      >
        <i className={`bx ${icon} text-3xl ${iconColorClass}`} />
      </div>
      {isLoading ? (
        <>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-1" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </>
      )}
    </div>
  );
}

/**
 * Determines the color classes for remaining storage based on percentage
 */
function getRemainingStorageColors(percentageUsed: number): {
  iconColorClass: string;
  iconBgClass: string;
} {
  const percentageRemaining = 1 - percentageUsed;

  if (percentageRemaining < 0.1) {
    // Less than 10% remaining - red
    return {
      iconColorClass: "text-red-600",
      iconBgClass: "bg-red-100",
    };
  } else if (percentageRemaining < 0.2) {
    // 10-20% remaining - yellow
    return {
      iconColorClass: "text-yellow-600",
      iconBgClass: "bg-yellow-100",
    };
  } else {
    // More than 20% remaining - green
    return {
      iconColorClass: "text-green-600",
      iconBgClass: "bg-green-100",
    };
  }
}

export function StorageStats() {
  const companyId = getCompanyIdFromLocalStorage();
  const storageLimits = useStorageLimits();
  const { isFreeTrial } = useTier();

  // Fetch fresh storage stats from backend (recalculates from actual documents)
  const { data: freshStats, isLoading } = useStorageStats(companyId);

  // Use fresh data if available, otherwise fall back to storageLimits (from tier hooks)
  const documentCount = freshStats?.documentsCount ?? 0;
  const qrCodeCount = freshStats?.qrCodesCount ?? 0;
  const documentUsed =
    freshStats?.documentStorageUsed ?? storageLimits.documentUsed;
  const qrUsed = freshStats?.qrCodeStorageUsed ?? storageLimits.qrUsed;

  // Calculate remaining based on fresh data if available
  const totalUsed = documentUsed + qrUsed;
  const totalCapacity = freshStats
    ? freshStats.documentStorageCapacity + freshStats.qrCodeStorageCapacity
    : storageLimits.totalCapacity;
  const remaining = Math.max(0, totalCapacity - totalUsed);
  const percentageUsed = totalCapacity > 0 ? totalUsed / totalCapacity : 0;

  // Use adaptive formatting for remaining storage (shows MB for small values, GB for large)
  const remainingFormatted = formatStorageAdaptive(remaining);
  // Use tier-aware formatting: always MB for Free Trial, adaptive for paid tiers
  const documentSize = formatStorageForTier(documentUsed, isFreeTrial);
  const qrSize = formatStorageForTier(qrUsed, isFreeTrial);
  const addonStorage = storageLimits.addonsCount * 100; // Each add-on provides 100 GB

  const remainingColors = getRemainingStorageColors(percentageUsed);

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      data-testid="storage-stats"
    >
      <StatCard
        icon="bx-folder-open"
        value={`${remainingFormatted.value} ${remainingFormatted.unit}`}
        label="Remaining"
        iconColorClass={remainingColors.iconColorClass}
        iconBgClass={remainingColors.iconBgClass}
        isLoading={isLoading}
      />

      <StatCard
        icon="bx-file"
        value={`${formatCount(documentCount)} files`}
        label={`${documentSize.value} ${documentSize.unit}`}
        isLoading={isLoading}
      />

      <StatCard
        icon="bx-qr"
        value={`${formatCount(qrCodeCount)} codes`}
        label={`${qrSize.value} ${qrSize.unit}`}
        isLoading={isLoading}
      />

      <StatCard
        icon="bx-package"
        value={`${storageLimits.addonsCount} active`}
        label={addonStorage > 0 ? `+${addonStorage} GB` : "No add-ons"}
      />
    </div>
  );
}

export default StorageStats;
