import type { ProcoreAccessStatus } from "@/api/endpoints/company";
import Button from "@/components/ui/Button";

interface TrialStatusBannerProps {
  accessStatus: ProcoreAccessStatus;
  onUpgrade?: () => void;
}

export default function TrialStatusBanner({
  accessStatus,
  onUpgrade,
}: TrialStatusBannerProps) {
  if (accessStatus.reason === "paid_subscription") {
    return null; // No banner for paid users
  }

  if (
    accessStatus.reason === "free_trial" &&
    accessStatus.trialDaysRemaining !== undefined
  ) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <i className="bx bxs-star text-amber-500 text-xl mt-0.5"></i>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            Enjoying Taliho's Procore Integration?
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Upgrade to Business to keep access after your trial ends.
            {accessStatus.trialDaysRemaining <= 7 && (
              <span className="font-medium">
                {" "}
                ({accessStatus.trialDaysRemaining} day
                {accessStatus.trialDaysRemaining === 1 ? "" : "s"} remaining)
              </span>
            )}
          </p>
        </div>
        {onUpgrade && (
          <Button
            type="button"
            variant="primary"
            onClick={onUpgrade}
            className="!bg-amber-600 hover:!bg-amber-700 whitespace-nowrap flex-shrink-0"
          >
            Upgrade to Business
          </Button>
        )}
      </div>
    );
  }

  if (accessStatus.reason === "trial_expired") {
    return (
      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
        <i className="bx bx-lock-alt text-red-600 text-xl mt-0.5"></i>
        <div>
          <p className="text-sm font-medium text-red-800">Trial Expired</p>
          <p className="text-sm text-red-700 mt-1">
            Your free trial has ended. Upgrade to Business to reconnect your
            Procore integration.
          </p>
        </div>
      </div>
    );
  }

  if (accessStatus.reason === "upgrade_required") {
    return (
      <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <i className="bx bx-lock-alt text-gray-600 text-xl mt-0.5"></i>
        <div>
          <p className="text-sm font-medium text-gray-800">Upgrade Required</p>
          <p className="text-sm text-gray-700 mt-1">
            Upgrade to Business to access Procore integration features.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
