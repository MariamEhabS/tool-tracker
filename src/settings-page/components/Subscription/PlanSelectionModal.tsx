import { useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import { createCheckoutSession } from "@/api/endpoints/stripe";
import { logApiError } from "@/utils/rollbar";
import { TierId } from "@/lib/tiers/types";
import { TIER_CONFIGS, TIER_IDS } from "@/lib/tiers/constants";
import type { RootState } from "@/store";

export interface PlanSelectionModalProps {
  open: boolean;
  onClose: () => void;
  currentTierId?: TierId;
  isUpgrade?: boolean;
}

type BillingInterval = "monthly" | "annual";

interface PlanConfig {
  tierId: TierId;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  storage: string;
  features: string[];
  isPopular?: boolean;
  priceIdMonthly: string;
  priceIdAnnual: string;
}

/**
 * Stripe price IDs for each tier loaded from environment variables
 *
 * Configure these in .env:
 * - VITE_STRIPE_PRICE_STANDARD_MONTHLY / VITE_STRIPE_PRICE_STANDARD_ANNUAL
 * - VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY / VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL
 * - VITE_STRIPE_PRICE_BUSINESS_MONTHLY / VITE_STRIPE_PRICE_BUSINESS_ANNUAL
 */
const STRIPE_PRICE_IDS: Record<
  "STANDARD" | "PROFESSIONAL" | "BUSINESS",
  { monthly: string; annual: string }
> = {
  STANDARD: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_STANDARD_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_STANDARD_ANNUAL || "",
  },
  PROFESSIONAL: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL || "",
  },
  BUSINESS: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_BUSINESS_MONTHLY || "",
    annual: import.meta.env.VITE_STRIPE_PRICE_BUSINESS_ANNUAL || "",
  },
};

/**
 * Human-readable storage display strings derived from tier storage bytes
 */
const STORAGE_DISPLAY: Record<
  "STANDARD" | "PROFESSIONAL" | "BUSINESS",
  string
> = {
  STANDARD: "50 GB",
  PROFESSIONAL: "200 GB",
  BUSINESS: "500 GB",
};

/**
 * Pricing configuration (not stored in TIER_CONFIGS as annual pricing differs)
 */
const PRICING: Record<
  "STANDARD" | "PROFESSIONAL" | "BUSINESS",
  { monthly: number; annual: number }
> = {
  STANDARD: { monthly: 29, annual: 290 },
  PROFESSIONAL: { monthly: 69, annual: 690 },
  BUSINESS: { monthly: 189, annual: 1890 },
};

/**
 * Build PLANS array dynamically from TIER_CONFIGS
 * Features are pulled from TIER_CONFIGS, while price IDs and pricing remain separate
 */
const PLANS: PlanConfig[] = [
  {
    tierId: TIER_IDS.STANDARD,
    name: TIER_CONFIGS.STANDARD.name,
    monthlyPrice: PRICING.STANDARD.monthly,
    annualPrice: PRICING.STANDARD.annual,
    storage: STORAGE_DISPLAY.STANDARD,
    features: TIER_CONFIGS.STANDARD.features || [],
    priceIdMonthly: STRIPE_PRICE_IDS.STANDARD.monthly,
    priceIdAnnual: STRIPE_PRICE_IDS.STANDARD.annual,
  },
  {
    tierId: TIER_IDS.PROFESSIONAL,
    name: TIER_CONFIGS.PROFESSIONAL.name,
    monthlyPrice: PRICING.PROFESSIONAL.monthly,
    annualPrice: PRICING.PROFESSIONAL.annual,
    storage: STORAGE_DISPLAY.PROFESSIONAL,
    features: TIER_CONFIGS.PROFESSIONAL.features || [],
    isPopular: true,
    priceIdMonthly: STRIPE_PRICE_IDS.PROFESSIONAL.monthly,
    priceIdAnnual: STRIPE_PRICE_IDS.PROFESSIONAL.annual,
  },
  {
    tierId: TIER_IDS.BUSINESS,
    name: TIER_CONFIGS.BUSINESS.name,
    monthlyPrice: PRICING.BUSINESS.monthly,
    annualPrice: PRICING.BUSINESS.annual,
    storage: STORAGE_DISPLAY.BUSINESS,
    features: TIER_CONFIGS.BUSINESS.features || [],
    priceIdMonthly: STRIPE_PRICE_IDS.BUSINESS.monthly,
    priceIdAnnual: STRIPE_PRICE_IDS.BUSINESS.annual,
  },
];

function PlanCard({
  plan,
  billingInterval,
  isCurrentPlan,
  isLoading,
  isTransitioning,
  onSelect,
}: {
  plan: PlanConfig;
  billingInterval: BillingInterval;
  isCurrentPlan: boolean;
  isLoading: boolean;
  isTransitioning: boolean;
  onSelect: () => void;
}) {
  const price =
    billingInterval === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  const priceLabel = billingInterval === "monthly" ? "/month" : "/year";
  const monthlyEquivalent =
    billingInterval === "annual" ? Math.round(plan.annualPrice / 12) : null;

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 p-6 ${
        plan.isPopular
          ? "border-purple-500 shadow-lg shadow-purple-100"
          : "border-gray-200"
      } ${isCurrentPlan ? "bg-gray-50" : "bg-white"}`}
    >
      {/* Popular Badge */}
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="bg-gray-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Current Plan
          </span>
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        <div
          className={`mt-4 transition-opacity duration-150 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
        >
          <span className="text-4xl font-bold text-gray-900">${price}</span>
          <span className="text-gray-500">{priceLabel}</span>
          {/* Always reserve space for monthly equivalent to prevent height shift */}
          <p className="text-sm text-gray-500 mt-1 h-5">
            {monthlyEquivalent ? `($${monthlyEquivalent}/month)` : "\u00A0"}
          </p>
        </div>
        <p className="text-sm text-gray-600 mt-2">{plan.storage} storage</p>
      </div>

      {/* Features List */}
      <ul className="space-y-3 mb-6 flex-grow">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <i className="bx bx-check text-green-500 text-lg flex-shrink-0" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Select Button */}
      <Button
        type="button"
        variant={plan.isPopular ? "primary" : "secondary"}
        className="w-full justify-center"
        disabled={isCurrentPlan || isLoading}
        onClick={onSelect}
      >
        {isCurrentPlan
          ? "Current Plan"
          : isLoading
            ? "Loading..."
            : "Select Plan"}
      </Button>
    </div>
  );
}

export function PlanSelectionModal({
  open,
  onClose,
  currentTierId,
  isUpgrade = false,
}: PlanSelectionModalProps) {
  const companyId = useSelector((state: RootState) => state.company?._id);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<TierId | null>(null);

  const handleBillingChange = (newInterval: BillingInterval) => {
    if (newInterval === billingInterval) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setBillingInterval(newInterval);
      setIsTransitioning(false);
    }, 150);
  };

  const handleSelectPlan = async (plan: PlanConfig) => {
    try {
      setLoadingPlan(plan.tierId);

      const priceId =
        billingInterval === "monthly"
          ? plan.priceIdMonthly
          : plan.priceIdAnnual;

      const base = window.location.origin;

      const response = await createCheckoutSession({
        priceId,
        successUrl: `${base}/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/settings?subscription=canceled`,
        companyId,
      });

      if (response?.url) {
        window.location.href = response.url;
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (error) {
      logApiError(error, "subscription-checkout", {
        tierId: plan.tierId,
        billingInterval,
      });
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start checkout. Please try again.",
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  const annualSavingsPercent = 17;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isUpgrade ? "Upgrade Your Plan" : "Choose Your Plan"}
      subtitle="Select the plan that best fits your needs"
      size="2xl"
      scrollable
    >
      {/* Billing Interval Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => handleBillingChange("monthly")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingInterval === "monthly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => handleBillingChange("annual")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              billingInterval === "annual"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Annual
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              Save {annualSavingsPercent}%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.tierId}
            plan={plan}
            billingInterval={billingInterval}
            isCurrentPlan={currentTierId === plan.tierId}
            isLoading={loadingPlan === plan.tierId}
            isTransitioning={isTransitioning}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          All plans include a 14-day money-back guarantee.{" "}
          <a
            href="mailto:support@taliho.com"
            className="text-blue-600 hover:underline"
          >
            Contact us
          </a>{" "}
          if you need help choosing.
        </p>
      </div>
    </Modal>
  );
}

export default PlanSelectionModal;
