import type { ReactNode } from "react";
import Button from "@/components/ui/Button";

export interface BlurLockOverlayProps {
  /** The feature UI content to display blurred behind the overlay */
  children: ReactNode;
  /** Message explaining why the feature is locked */
  message?: string;
  /** The tier required to access this feature (e.g., "Business", "Professional") */
  requiredTier?: string;
  /** Callback when the upgrade button is clicked */
  onUpgrade?: () => void;
}

/**
 * BlurLockOverlay displays tier-restricted features with an aspirational blur effect.
 * The actual feature UI is shown blurred in the background, with an overlay
 * prompting the user to upgrade their subscription.
 */
export function BlurLockOverlay({
  children,
  message = "This feature requires a higher tier subscription.",
  requiredTier = "Business",
  onUpgrade,
}: BlurLockOverlayProps) {
  return (
    <div className="relative min-h-[200px]">
      {/* Blurred feature content */}
      <div
        className="blur-sm pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay with centered upgrade card */}
      <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-[1px] flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4 text-center">
          {/* Lock icon */}
          <i
            className="bx bx-lock-alt text-5xl text-gray-400 mb-4"
            aria-hidden="true"
          />

          {/* Heading */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upgrade to {requiredTier}
          </h3>

          {/* Description message */}
          <p className="text-sm text-gray-600 mb-4">{message}</p>

          {/* Upgrade button */}
          {onUpgrade && (
            <Button
              variant="primary"
              onClick={onUpgrade}
              leftIconClass="bx bx-rocket"
            >
              Upgrade Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlurLockOverlay;
