import Button from "@/components/ui/Button";

interface LockedFeatureCardProps {
  title: string;
  description: string;
  requiredTier: string;
  onUpgrade: () => void;
}

export default function LockedFeatureCard({
  title,
  description,
  requiredTier,
  onUpgrade,
}: LockedFeatureCardProps) {
  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-6">
      {/* Lock Icon Overlay */}
      <div className="absolute top-4 right-4">
        <i className="bx bx-lock-alt text-gray-400 text-2xl"></i>
      </div>

      <div className="space-y-4">
        {/* Feature Title */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>

        {/* Availability Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-md px-3 py-1.5">
          <i className="bx bx-info-circle text-blue-600 text-sm"></i>
          <span className="text-sm font-medium text-blue-800">
            Available on {requiredTier} plan
          </span>
        </div>

        {/* Upgrade Button */}
        <div>
          <Button
            onClick={onUpgrade}
            variant="primary"
            leftIconClass="bx bx-rocket"
          >
            Upgrade Now
          </Button>
        </div>
      </div>
    </div>
  );
}
