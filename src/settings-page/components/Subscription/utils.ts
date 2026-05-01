/**
 * Utility functions for subscription state management
 */

export interface CompanyDetails {
  _id?: string;
  freeTrialRefreshDate?: string | Date;
  createdAt?: string | Date;
  paidAccount?: boolean;
  subscribedAt?: string | Date;
  subscriptionCanceled?: boolean;
  cancelledAt?: string | Date;
  stripeAddons?: Array<Record<string, unknown>> | string[];
  freeTrialActive?: boolean;
  /** Stripe subscription status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused' */
  stripeSubscriptionStatus?: string;
  stripeSubscriptionID?: string;
}

export type UserSubscriptionState =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRING"
  | "TRIAL_EXPIRED"
  | "PAID_ACTIVE"
  | "PAST_DUE"
  | "CANCELED_ACTIVE"
  | "CANCELED_EXPIRED";

/**
 * Calculate trial end date from company data
 * Note: freeTrialRefreshDate represents when the trial was started/refreshed,
 * not the end date. The trial period is always 14 days from this date.
 */
export function getTrialEndDate(
  company: CompanyDetails | null | undefined,
): Date | null {
  if (!company) return null;

  // Priority 1: freeTrialRefreshDate + 14 days (admin-extended/refreshed trial)
  // freeTrialRefreshDate is when the trial was refreshed, not when it ends
  if (company.freeTrialRefreshDate) {
    const refreshDate = new Date(company.freeTrialRefreshDate);
    return new Date(refreshDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  }

  // Priority 2: createdAt + 14 days
  if (company.createdAt) {
    const created = new Date(company.createdAt);
    return new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysRemaining(
  company: CompanyDetails | null | undefined,
): number {
  const endDate = getTrialEndDate(company);
  if (!endDate) return 0;

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days remaining for display purposes (never negative)
 * Use this for UI display, use getTrialDaysRemaining for state logic
 */
export function getDisplayDaysRemaining(
  company: CompanyDetails | null | undefined,
): number {
  return Math.max(0, getTrialDaysRemaining(company));
}

/**
 * Check if company has valid date information for trial calculation
 */
function hasValidDateInfo(company: CompanyDetails | null | undefined): boolean {
  if (!company) return false;
  return !!(company.freeTrialRefreshDate || company.createdAt);
}

/**
 * Determine the user's subscription state
 */
export function getUserState(
  company: CompanyDetails | null | undefined,
  isFreeTrial: boolean,
): UserSubscriptionState {
  // Stripe flagged the latest invoice as unpaid. This must be checked FIRST:
  // past_due customers may have `paidAccount: false` AND a missing/cleared
  // stripeProductID, which would otherwise make `useTier` treat them as a
  // free-trial user and route them to TRIAL_EXPIRED. A subscription in
  // past_due is, by definition, not a trial — the banner + CTA always win.
  if (company?.stripeSubscriptionStatus === "past_due") {
    return "PAST_DUE";
  }

  if (isFreeTrial) {
    const daysRemaining = getTrialDaysRemaining(company);

    if (daysRemaining <= 0) {
      // Only trust freeTrialActive when date info is genuinely MISSING
      // If we have valid dates and they show expired, the trial IS expired
      if (!hasValidDateInfo(company) && company?.freeTrialActive === true) {
        return "TRIAL_ACTIVE";
      }
      return "TRIAL_EXPIRED";
    }

    if (daysRemaining <= 3) return "TRIAL_EXPIRING";
    return "TRIAL_ACTIVE";
  }

  if (company?.subscriptionCanceled && company?.paidAccount) {
    return "CANCELED_ACTIVE";
  }

  if (company?.subscriptionCanceled && !company?.paidAccount) {
    return "CANCELED_EXPIRED";
  }

  if (company?.paidAccount) {
    return "PAID_ACTIVE";
  }

  // Fallback - check freeTrialActive before defaulting to expired
  // This handles cases where isFreeTrial is false but the backend flag is true
  if (company?.freeTrialActive === true) {
    return "TRIAL_ACTIVE";
  }

  return "TRIAL_EXPIRED";
}

// How long a "Dismiss" click suppresses the past-due banner. Short enough
// that a persistent problem keeps nagging the user; long enough that they
// aren't annoyed during a single support session.
export const PAST_DUE_DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Build the localStorage key used to remember past-due banner dismissals.
 * Keyed on subscription ID (preferred) or company ID so a dismiss on one
 * failed subscription doesn't silence banners for a later, different one.
 * Returns null when we have no stable identifier — callers should fall back
 * to in-memory state in that case.
 */
export function getPastDueDismissKey(
  company: CompanyDetails | null | undefined,
): string | null {
  const id = company?.stripeSubscriptionID || company?._id;
  if (!id) return null;
  return `past-due-banner-dismissed:${id}`;
}
