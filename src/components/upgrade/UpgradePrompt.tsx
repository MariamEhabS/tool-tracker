import Button from "@/components/ui/Button";

interface UpgradePromptProps {
  feature: string;
  currentTier: string;
  requiredTier: string;
  onUpgrade: () => void;
}

export default function UpgradePrompt({
  feature,
  currentTier,
  requiredTier,
  onUpgrade,
}: UpgradePromptProps) {
  return (
    <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <i className="bx bx-info-circle text-blue-600 text-lg"></i>
        <p className="text-sm text-blue-800">
          Upgrade to <span className="font-semibold">{requiredTier}</span> from{" "}
          <span className="font-semibold">{currentTier}</span> to unlock{" "}
          {feature}
        </p>
      </div>
      <Button
        onClick={onUpgrade}
        variant="primary"
        className="text-sm"
        leftIconClass="bx bx-rocket"
      >
        Upgrade Now
      </Button>
    </div>
  );
}
