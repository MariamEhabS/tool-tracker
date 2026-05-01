import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import { useTier } from "@/lib/tiers";
import {
  getUserState,
  getDisplayDaysRemaining,
  type UserSubscriptionState,
} from "@/settings-page/components/Subscription/utils";
import type { RootState } from "@/store";

interface TrialBannerProps {
  onUpgrade: () => void;
  onResubscribe?: () => void;
  onDismiss: () => void;
  isUpgrading?: boolean;
}

const STORAGE_KEY = "trial-banner-dismissed";
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface BannerConfig {
  icon: string;
  message: string;
  ctaText: string;
  ctaIcon: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  dismissHoverBg: string;
  showDismiss: boolean;
  ctaAction: "upgrade" | "resubscribe";
}

const getBannerConfig = (
  state: UserSubscriptionState,
  daysRemaining: number,
): BannerConfig => {
  switch (state) {
    case "TRIAL_ACTIVE":
      return {
        icon: "bx-info-circle",
        message: `You're on a free trial (50 MB storage). Upgrade to unlock more storage and features.`,
        ctaText: "Upgrade Now",
        ctaIcon: "bx-rocket",
        bgGradient: "from-orange-50 to-amber-50",
        borderColor: "border-orange-200",
        textColor: "text-orange-900",
        iconColor: "text-orange-600",
        dismissHoverBg: "hover:bg-orange-100",
        showDismiss: true,
        ctaAction: "upgrade",
      };

    case "TRIAL_EXPIRING":
      return {
        icon: "bx-time-five",
        message: `Your free trial ends in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Upgrade now to keep access to your data and features.`,
        ctaText: "Upgrade Now",
        ctaIcon: "bx-rocket",
        bgGradient: "from-amber-50 to-yellow-50",
        borderColor: "border-amber-300",
        textColor: "text-amber-900",
        iconColor: "text-amber-600",
        dismissHoverBg: "hover:bg-amber-100",
        showDismiss: true,
        ctaAction: "upgrade",
      };

    case "TRIAL_EXPIRED":
      return {
        icon: "bx-error-circle",
        message:
          "Your free trial has expired. Subscribe now to restore access to your data and continue using Taliho.",
        ctaText: "Subscribe Now",
        ctaIcon: "bx-rocket",
        bgGradient: "from-red-50 to-orange-50",
        borderColor: "border-red-300",
        textColor: "text-red-900",
        iconColor: "text-red-600",
        dismissHoverBg: "hover:bg-red-100",
        showDismiss: false,
        ctaAction: "upgrade",
      };

    case "CANCELED_ACTIVE":
      return {
        icon: "bx-info-circle",
        message:
          "Your subscription has been cancelled but remains active until your billing period ends. Resubscribe to continue your service.",
        ctaText: "Resubscribe",
        ctaIcon: "bx-refresh",
        bgGradient: "from-blue-50 to-indigo-50",
        borderColor: "border-blue-300",
        textColor: "text-blue-900",
        iconColor: "text-blue-600",
        dismissHoverBg: "hover:bg-blue-100",
        showDismiss: true,
        ctaAction: "resubscribe",
      };

    case "CANCELED_EXPIRED":
      return {
        icon: "bx-error-circle",
        message:
          "Your subscription has ended. Resubscribe now to restore access to your data and features.",
        ctaText: "Resubscribe Now",
        ctaIcon: "bx-refresh",
        bgGradient: "from-red-50 to-orange-50",
        borderColor: "border-red-300",
        textColor: "text-red-900",
        iconColor: "text-red-600",
        dismissHoverBg: "hover:bg-red-100",
        showDismiss: false,
        ctaAction: "resubscribe",
      };

    case "PAID_ACTIVE":
    case "PAST_DUE":
      // No banner here: PAID_ACTIVE has nothing to prompt; PAST_DUE is handled
      // by the dedicated banner on the Settings page, which routes to the
      // Stripe Billing Portal via onManageSubscription (a handler TrialBanner
      // doesn't receive). Component short-circuits to null for both states.
      return {
        icon: "",
        message: "",
        ctaText: "",
        ctaIcon: "",
        bgGradient: "",
        borderColor: "",
        textColor: "",
        iconColor: "",
        dismissHoverBg: "",
        showDismiss: false,
        ctaAction: "upgrade",
      };
  }
};

export default function TrialBanner({
  onUpgrade,
  onResubscribe,
  onDismiss,
  isUpgrading = false,
}: TrialBannerProps) {
  const { isFreeTrial } = useTier();
  const company = useSelector((state: RootState) => state.company);

  // Initialize dismissal state synchronously from localStorage to prevent banner flash
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissedData = localStorage.getItem(STORAGE_KEY);
    if (dismissedData) {
      try {
        const { timestamp } = JSON.parse(dismissedData);
        const now = Date.now();

        // If dismissed less than 24 hours ago, keep it dismissed
        if (now - timestamp < DISMISS_DURATION) {
          return true;
        }
        // Reset if 24 hours have passed
        localStorage.removeItem(STORAGE_KEY);
      } catch (_e) {
        // Invalid data, remove it
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return false;
  });

  const subscriptionState = getUserState(company, isFreeTrial);
  const daysRemaining = getDisplayDaysRemaining(company);
  const config = getBannerConfig(subscriptionState, daysRemaining);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ timestamp: Date.now() }),
    );
    onDismiss();
  };

  const handleCTA = () => {
    if (config.ctaAction === "resubscribe" && onResubscribe) {
      onResubscribe();
    } else {
      onUpgrade();
    }
  };

  // Don't show for active paid accounts, or past_due — the Settings page
  // owns the past_due UX with its own Update Payment CTA.
  if (subscriptionState === "PAID_ACTIVE" || subscriptionState === "PAST_DUE") {
    return null;
  }

  const shouldShow = !(isDismissed && config.showDismiss);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            opacity: { duration: 0.2 },
          }}
          style={{ overflow: "hidden" }}
          className={`bg-gradient-to-r ${config.bgGradient} border-t ${config.borderColor} shadow-lg relative z-40`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap px-4 py-3">
            <div className="flex items-center gap-3">
              <i
                className={`bx ${config.icon} ${config.iconColor} text-xl`}
              ></i>
              <p className={`text-sm font-medium ${config.textColor}`}>
                {config.message}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleCTA}
                variant="primary"
                className="text-xs"
                leftIconClass={
                  isUpgrading
                    ? "bx bx-loader-alt animate-spin"
                    : `bx ${config.ctaIcon}`
                }
                disabled={isUpgrading}
              >
                {isUpgrading ? "Opening..." : config.ctaText}
              </Button>
              {config.showDismiss && (
                <button
                  onClick={handleDismiss}
                  className={`p-1 rounded ${config.dismissHoverBg} transition-colors flex items-center justify-center`}
                  aria-label="Dismiss banner"
                >
                  <i className={`bx bx-x text-xl ${config.iconColor}`}></i>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
