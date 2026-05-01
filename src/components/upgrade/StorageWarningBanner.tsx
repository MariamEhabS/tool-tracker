import { useStorageLimits } from "@/lib/tiers";
import Button from "@/components/ui/Button";

interface StorageWarningBannerProps {
  onUpgrade: () => void;
  onAddStorage: () => void;
  onDismiss: () => void;
  isUpgrading?: boolean;
  isAddingStorage?: boolean;
}

export default function StorageWarningBanner({
  onUpgrade,
  onAddStorage,
  onDismiss,
  isUpgrading = false,
  isAddingStorage = false,
}: StorageWarningBannerProps) {
  const storageLimits = useStorageLimits();

  // Only show for warning or critical states (not blocked, that uses modal)
  if (!storageLimits.isWarning && !storageLimits.isCritical) {
    return null;
  }

  const isCritical = storageLimits.isCritical;
  const remainingGB = (storageLimits.remaining / 1073741824).toFixed(2);

  return (
    <div
      className={`${
        isCritical ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
      } border-b px-4 py-3 relative z-40`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <i
            className={`bx ${isCritical ? "bx-error text-red-600" : "bx-info-circle text-amber-600"} text-xl`}
          ></i>
          <p
            className={`text-sm font-medium ${isCritical ? "text-red-800" : "text-amber-800"}`}
          >
            {isCritical ? (
              <>
                You're almost out of storage! Only {remainingGB} GB remaining.
              </>
            ) : (
              <>
                You're approaching your storage limit. {remainingGB} GB
                remaining.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onAddStorage}
            variant="secondary"
            className="text-xs"
            leftIconClass={
              isAddingStorage
                ? "bx bx-loader-alt animate-spin"
                : "bx bx-folder-open"
            }
            disabled={isAddingStorage || isUpgrading}
          >
            {isAddingStorage ? "Opening..." : "Add Storage (+50GB)"}
          </Button>
          <Button
            onClick={onUpgrade}
            variant="primary"
            className="text-xs"
            leftIconClass={
              isUpgrading ? "bx bx-loader-alt animate-spin" : "bx bx-rocket"
            }
            disabled={isUpgrading || isAddingStorage}
          >
            {isUpgrading ? "Opening..." : "Upgrade Plan"}
          </Button>
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-${isCritical ? "red" : "amber"}-100 transition-colors`}
            aria-label="Dismiss"
          >
            <i
              className={`bx bx-x text-xl ${isCritical ? "text-red-600" : "text-amber-600"}`}
            ></i>
          </button>
        </div>
      </div>
    </div>
  );
}
