/**
 * @fileoverview Subscription intent utilities for parsing and building
 * URL search params that encode a user's intent to subscribe to a plan.
 * Used to carry subscription context through navigation (e.g., from
 * pricing page to checkout).
 */

export const SUBSCRIPTION_TASK = "subscribe" as const;

export type SubscriptionPlan = "standard" | "professional" | "business";

export type SubscriptionIntent = {
  task: typeof SUBSCRIPTION_TASK;
  plan: SubscriptionPlan;
};

export type SubscriptionBillingInterval = "monthly" | "annual";

type SearchInput =
  | string
  | URLSearchParams
  | { task?: unknown; plan?: unknown }
  | null
  | undefined;

const PLAN_NORMALIZERS: Record<string, SubscriptionPlan> = {
  standard: "standard",
  professional: "professional",
  business: "business",
};

const STRIPE_PRICE_IDS: Record<
  SubscriptionPlan,
  Record<SubscriptionBillingInterval, string>
> = {
  standard: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_STANDARD_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_STANDARD_ANNUAL || "",
  },
  professional: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL || "",
  },
  business: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_BUSINESS_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_BUSINESS_ANNUAL || "",
  },
};

const normalizePlan = (
  plan: string | null | undefined,
): SubscriptionPlan | null => {
  if (!plan) {
    return null;
  }
  return PLAN_NORMALIZERS[plan.toLowerCase()] || null;
};

const toSearchParams = (input: SearchInput): URLSearchParams => {
  if (!input) {
    return new URLSearchParams();
  }

  if (typeof input === "string") {
    const normalized = input.startsWith("?") ? input.slice(1) : input;
    return new URLSearchParams(normalized);
  }

  if (input instanceof URLSearchParams) {
    return input;
  }

  const params = new URLSearchParams();

  if (typeof input.task === "string") {
    params.set("task", input.task);
  }
  if (typeof input.plan === "string") {
    params.set("plan", input.plan);
  }

  return params;
};

/**
 * Parses a subscription intent from URL search params, a plain object, or a query string.
 * Returns null if the params don't represent a valid subscription intent.
 * @param searchInput - URL search string, URLSearchParams, or plain object
 */
export const parseSubscriptionIntent = (
  searchInput: SearchInput,
): SubscriptionIntent | null => {
  const searchParams = toSearchParams(searchInput);
  const task = searchParams.get("task");

  if (task !== SUBSCRIPTION_TASK) {
    return null;
  }

  const normalizedPlan = normalizePlan(searchParams.get("plan"));
  if (!normalizedPlan) {
    return null;
  }

  return {
    task: SUBSCRIPTION_TASK,
    plan: normalizedPlan,
  };
};

/** Converts a SubscriptionIntent into a plain object suitable for URL search params. */
export const toSubscriptionSearch = (intent: SubscriptionIntent) => ({
  task: intent.task,
  plan: intent.plan,
});

/**
 * Looks up the Stripe Price ID for a given plan and billing interval.
 * Price IDs are configured via VITE_STRIPE_PRICE_* environment variables.
 * @param plan - The subscription plan name
 * @param interval - Billing interval ("monthly" or "annual"), defaults to "monthly"
 */
export const getStripePriceIdForPlan = (
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval = "monthly",
): string => {
  return STRIPE_PRICE_IDS[plan][interval] || "";
};
