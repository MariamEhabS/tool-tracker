import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useTier, useStorageLimits } from "@/lib/tiers";
import { TierId } from "@/lib/tiers/types";
import { safeLocalStorage } from "@/utils/safeStorage";
import {
  getDisplayDaysRemaining,
  getPastDueDismissKey,
  getUserState,
  PAST_DUE_DISMISS_TTL_MS,
  type CompanyDetails,
  type UserSubscriptionState,
} from "./utils";

export interface SubscriptionProps {
  companyDetails: CompanyDetails | null | undefined;
  onSubscribe: () => void;
  onManageSubscription: () => void;
  onManageStorage: () => void;
  isSubscribeDisabled?: boolean;
  isManageSubscriptionDisabled?: boolean;
  isManageStorageDisabled?: boolean;
}

const TIER_BADGE_STYLES: Record<TierId, string> = {
  FREE_TRIAL: "bg-amber-100 text-amber-800",
  STANDARD: "bg-blue-100 text-blue-800",
  PROFESSIONAL: "bg-purple-100 text-purple-800",
  BUSINESS: "bg-green-100 text-green-800",
  EARLY_ADOPTER: "bg-yellow-100 text-yellow-800",
};

/**
 * Trial Status Banner Component
 */
function TrialStatusBanner({
  state,
  daysRemaining,
  onSubscribe,
  isSubscribeDisabled,
}: {
  state: UserSubscriptionState;
  daysRemaining: number;
  onSubscribe: () => void;
  isSubscribeDisabled?: boolean;
}) {
  if (state === "TRIAL_ACTIVE") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <i className="bx bx-time-five text-emerald-600 text-xl" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Free trial: {daysRemaining}{" "}
                {daysRemaining === 1 ? "day" : "days"} remaining
              </p>
              <p className="text-xs text-emerald-600">
                Subscribe now to keep access to all features
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={onSubscribe}
            disabled={isSubscribeDisabled}
          >
            Subscribe Now
          </Button>
        </div>
      </div>
    );
  }

  if (state === "TRIAL_EXPIRING") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <i className="bx bx-error-circle text-amber-600 text-xl" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Trial ending soon: {daysRemaining}{" "}
                {daysRemaining === 1 ? "day" : "days"} left!
              </p>
              <p className="text-xs text-amber-600">
                Subscribe today to avoid losing access
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={onSubscribe}
            disabled={isSubscribeDisabled}
          >
            Subscribe Now
          </Button>
        </div>
      </div>
    );
  }

  if (state === "TRIAL_EXPIRED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <i className="bx bx-error text-red-600 text-xl" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Your free trial has expired
              </p>
              <p className="text-xs text-red-600">
                Subscribe now to restore access to your account
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={onSubscribe}
            disabled={isSubscribeDisabled}
          >
            Subscribe to Continue
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Past-Due Payment Banner
 * Shown when the Stripe subscription is `past_due` (latest charge failed).
 * CTA opens the Stripe Billing Portal so the user can update their card.
 * Dismissable — the "Manage Subscription" button below keeps the recovery
 * path reachable even after dismiss.
 */
function PastDueBanner({
  onUpdatePayment,
  onDismiss,
  isDisabled,
}: {
  onUpdatePayment: () => void;
  onDismiss: () => void;
  isDisabled?: boolean;
}) {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 relative"
      data-testid="past-due-banner"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss past-due payment banner"
        data-testid="past-due-dismiss-button"
        className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-100 transition-colors"
      >
        <i className="bx bx-x text-lg" />
      </button>
      <div className="flex items-center justify-between gap-4 pr-8">
        <div className="flex items-center gap-2">
          <i className="bx bx-error-circle text-red-600 text-xl" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Payment failed — subscription past due
            </p>
            <p className="text-xs text-red-600">
              Update your payment method to restore full access to your account
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          leftIconClass="bx bx-credit-card"
          onClick={onUpdatePayment}
          disabled={isDisabled}
          data-testid="past-due-update-payment-button"
        >
          Update Payment
        </Button>
      </div>
    </div>
  );
}

/**
 * Mini Storage Progress Bar Component
 */
function StorageProgressBar({
  percentageUsed,
  isWarning,
  isCritical,
}: {
  percentageUsed: number;
  isWarning: boolean;
  isCritical: boolean;
}) {
  const percentage = Math.min(100, Math.round(percentageUsed * 100));

  let barColor = "bg-emerald-500";
  let textColor = "text-gray-600";

  if (isCritical) {
    barColor = "bg-red-500";
    textColor = "text-red-600";
  } else if (isWarning) {
    barColor = "bg-amber-500";
    textColor = "text-amber-600";
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Storage used</span>
        <span className={`text-xs font-medium ${textColor}`}>
          {percentage}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-red-600 mt-1">
          <i className="bx bx-error-circle mr-1" />
          Storage almost full
        </p>
      )}
    </div>
  );
}

export function Subscription({
  companyDetails,
  onSubscribe,
  onManageSubscription,
  onManageStorage,
  isSubscribeDisabled = false,
  isManageSubscriptionDisabled = false,
  isManageStorageDisabled = false,
}: SubscriptionProps) {
  const { config: tierConfig, isFreeTrial } = useTier();
  const storageLimits = useStorageLimits();
  const { addonsCount, percentageUsed, isWarning, isCritical } = storageLimits;

  const userState = getUserState(companyDetails, isFreeTrial);
  const daysRemaining = getDisplayDaysRemaining(companyDetails);

  // Dismissable past-due banner. Dismissal persists for PAST_DUE_DISMISS_TTL_MS
  // (keyed per-subscription), so the reminder comes back if the customer
  // hasn't resolved payment — and immediately if a fresh past_due event
  // occurs on a different subscription.
  const dismissKey = getPastDueDismissKey(companyDetails);
  const [isPastDueDismissed, setIsPastDueDismissed] = useState(false);

  useEffect(() => {
    if (userState !== "PAST_DUE" || !dismissKey) {
      setIsPastDueDismissed(false);
      return;
    }
    const record = safeLocalStorage.getJSON<{ dismissedAt: number }>(
      dismissKey,
    );
    if (!record?.dismissedAt) {
      setIsPastDueDismissed(false);
      return;
    }
    const expired = Date.now() - record.dismissedAt > PAST_DUE_DISMISS_TTL_MS;
    if (expired) {
      safeLocalStorage.removeItem(dismissKey);
      setIsPastDueDismissed(false);
      return;
    }
    setIsPastDueDismissed(true);
  }, [userState, dismissKey]);

  const handleDismissPastDue = () => {
    if (dismissKey) {
      safeLocalStorage.setJSON(dismissKey, { dismissedAt: Date.now() });
    }
    setIsPastDueDismissed(true);
  };

  const formatDate = (dateValue: string | Date) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const showTrialBanner =
    userState === "TRIAL_ACTIVE" ||
    userState === "TRIAL_EXPIRING" ||
    userState === "TRIAL_EXPIRED";

  const showPastDueBanner = userState === "PAST_DUE" && !isPastDueDismissed;

  // Manage Subscription opens the Stripe Billing Portal — needed for any
  // customer with a Stripe subscription, including past_due users whose card
  // must be updated to recover.
  const showManageSubscription =
    userState === "PAID_ACTIVE" ||
    userState === "CANCELED_ACTIVE" ||
    userState === "PAST_DUE";

  // Keep the existing "paid user" chrome (Add Storage button, storage bar,
  // billing hint text) gated on active or gracefully-canceled subs — past_due
  // users get the dedicated banner above instead.
  const showPaidUserButtons =
    userState === "PAID_ACTIVE" || userState === "CANCELED_ACTIVE";

  const showSubscribeButton =
    userState === "TRIAL_ACTIVE" ||
    userState === "TRIAL_EXPIRING" ||
    userState === "TRIAL_EXPIRED" ||
    userState === "CANCELED_EXPIRED";

  return (
    <div data-testid="subscription">
      {/* Trial Status Banner */}
      {showTrialBanner && (
        <TrialStatusBanner
          state={userState}
          daysRemaining={daysRemaining}
          onSubscribe={onSubscribe}
          isSubscribeDisabled={isSubscribeDisabled}
        />
      )}

      {/* Past-Due Payment Banner */}
      {showPastDueBanner && (
        <PastDueBanner
          onUpdatePayment={onManageSubscription}
          onDismiss={handleDismissPastDue}
          isDisabled={isManageSubscriptionDisabled}
        />
      )}

      <div className="space-y-2">
        {/* Tier Name with Badge */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-700">Your current plan:</p>
          <span
            data-testid="tier-badge"
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_STYLES[tierConfig.id]}`}
          >
            {tierConfig.name}
          </span>
        </div>

        {/* Subscription Status - varies by state */}
        {userState === "PAID_ACTIVE" && companyDetails?.subscribedAt && (
          <p className="text-sm text-gray-700" data-testid="subscribed-date">
            Subscribed on:{" "}
            <span className="font-medium text-gray-900">
              {formatDate(companyDetails.subscribedAt)}
            </span>
          </p>
        )}

        {userState === "CANCELED_ACTIVE" && (
          <p
            className="text-sm text-amber-600 font-medium"
            data-testid="cancellation-message"
          >
            <i className="bx bx-info-circle mr-1" />
            Subscription will be canceled at end of billing period
          </p>
        )}

        {userState === "CANCELED_EXPIRED" && (
          <p
            className="text-sm text-red-600 font-medium"
            data-testid="cancellation-expired-message"
          >
            <i className="bx bx-error mr-1" />
            {companyDetails?.cancelledAt
              ? `Subscription canceled on ${formatDate(companyDetails.cancelledAt)}`
              : "Subscription has been canceled"}
          </p>
        )}

        {/* Storage Add-ons Info */}
        {addonsCount > 0 && (
          <p className="text-sm text-gray-700" data-testid="storage-addons">
            Storage add-ons:{" "}
            <span className="font-medium text-gray-900">
              +{addonsCount} active ({addonsCount * 50}GB total)
            </span>
          </p>
        )}

        {/* Mini Storage Progress Bar - for paid users */}
        {showPaidUserButtons && (
          <StorageProgressBar
            percentageUsed={percentageUsed}
            isWarning={isWarning}
            isCritical={isCritical}
          />
        )}

        <p className="text-sm text-gray-600 mt-2">
          {userState === "PAST_DUE"
            ? "Update your payment method to restore full access."
            : showPaidUserButtons
              ? "Manage your billing details and subscription options."
              : "Choose a plan to unlock your company's full potential with Taliho."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-stretch gap-2">
        {showManageSubscription && (
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-credit-card"
            disabled={isManageSubscriptionDisabled}
            onClick={onManageSubscription}
            data-testid="manage-subscription-button"
          >
            Manage Subscription
          </Button>
        )}
        {showPaidUserButtons && (
          <Button
            onClick={onManageStorage}
            type="button"
            variant="secondary"
            leftIconClass="bx bx-folder-open"
            disabled={isManageStorageDisabled}
            data-testid="add-storage-button"
          >
            Add Storage
          </Button>
        )}

        {showSubscribeButton && !showTrialBanner && (
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-rocket"
            disabled={isSubscribeDisabled}
            onClick={onSubscribe}
            data-testid="subscribe-button"
          >
            Subscribe Now
          </Button>
        )}

        {userState === "CANCELED_EXPIRED" && (
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-refresh"
            disabled={isSubscribeDisabled}
            onClick={onSubscribe}
            data-testid="resubscribe-button"
          >
            Resubscribe
          </Button>
        )}
      </div>
    </div>
  );
}

export default Subscription;
