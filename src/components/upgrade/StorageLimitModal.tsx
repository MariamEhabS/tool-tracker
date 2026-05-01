import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import { useStorageLimits, useTier } from "@/lib/tiers";

interface StorageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onAddStorage: () => void;
}

export default function StorageLimitModal({
  isOpen,
  onClose,
  onUpgrade,
  onAddStorage,
}: StorageLimitModalProps) {
  const storageLimits = useStorageLimits();
  const { config: tierConfig } = useTier();

  const totalUsedGB = (storageLimits.totalUsed / 1073741824).toFixed(2);
  const totalCapacityGB = (storageLimits.totalCapacity / 1073741824).toFixed(2);
  const baseTierStorageGB = (tierConfig.storageBytes / 1073741824).toFixed(0);
  const addonsCount = storageLimits.addonsCount;
  const addonsStorageGB = addonsCount * 50; // 50GB per add-on

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Storage Limit Reached"
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={onAddStorage}
            variant="secondary"
            leftIconClass="bx bx-folder-open"
          >
            Add Storage (+50GB)
          </Button>
          <Button
            onClick={onUpgrade}
            variant="primary"
            leftIconClass="bx bx-rocket"
          >
            Upgrade Plan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Icon and Message */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <i className="bx bx-error-circle text-red-500 text-3xl"></i>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              You've reached your storage limit. Upgrade your plan or add
              storage to continue uploading files.
            </p>
          </div>
        </div>

        {/* Storage Usage Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current usage:</span>
            <span className="font-medium text-gray-900">
              {totalUsedGB} GB / {totalCapacityGB} GB
            </span>
          </div>

          {/* Storage Breakdown */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Base ({tierConfig.name}):</span>
              <span className="text-gray-900">{baseTierStorageGB} GB</span>
            </div>
            {addonsCount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Add-ons ({addonsCount} active):
                  </span>
                  <span className="text-gray-900">+{addonsStorageGB} GB</span>
                </div>
                <div className="flex justify-between text-sm font-medium border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Total capacity:</span>
                  <span className="text-gray-900">{totalCapacityGB} GB</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500">
          <p>
            To continue uploading, you can either add a storage add-on (+50GB)
            or upgrade to a higher tier plan with more base storage.
          </p>
        </div>
      </div>
    </Modal>
  );
}
