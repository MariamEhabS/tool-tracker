import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";

interface FeatureGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  currentTier: string;
  requiredTier: string;
  onUpgrade: () => void;
  description?: string;
}

export default function FeatureGateModal({
  isOpen,
  onClose,
  feature,
  currentTier,
  requiredTier,
  onUpgrade,
  description,
}: FeatureGateModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`${feature} is a ${requiredTier} feature`}
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={onUpgrade}
            variant="primary"
            leftIconClass="bx bx-rocket"
          >
            Upgrade to {requiredTier}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Feature Icon */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="bx bx-lock-alt text-blue-600 text-2xl"></i>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              {description ||
                `This feature is only available on the ${requiredTier} plan.`}
            </p>
          </div>
        </div>

        {/* Current vs Required Tier */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Your current plan:</span>
            <span className="font-medium text-gray-900">{currentTier}</span>
          </div>
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Required plan:</span>
              <span className="font-semibold text-blue-600">
                {requiredTier}
              </span>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <i className="bx bx-info-circle text-blue-600 mr-1"></i>
            Upgrade to {requiredTier} to unlock this feature and gain access to
            additional storage, integrations, and capabilities.
          </p>
        </div>
      </div>
    </Modal>
  );
}
