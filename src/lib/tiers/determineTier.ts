/**
 * Tier determination logic for Taliho V3
 *
 * Determines which tier a company belongs to based on their subscription status
 * and Stripe product ID.
 */

import { Company } from "@/types";
import { TIER_IDS, PRODUCT_ID_TO_TIER } from "./constants";
import { TierId } from "./types";

/**
 * Determines the tier for a given company
 *
 * @param company - The company object from Redux store or API
 * @returns The tier ID for the company
 *
 * Logic:
 * 1. If company is deactivated -> FREE_TRIAL (safe default)
 * 2. If company has valid stripeProductID -> Map to tier via PRODUCT_ID_TO_TIER
 * 3. If company has invalid stripeProductID -> FREE_TRIAL (data integrity issue)
 * 4. If company has freeTrialActive -> FREE_TRIAL
 * 5. Default -> FREE_TRIAL (safe fallback)
 */
export function determineTier(company: Company | null | undefined): TierId {
  // Handle null/undefined company
  if (!company) {
    return TIER_IDS.FREE_TRIAL;
  }

  // Deactivated accounts default to free trial
  if (company.deactivated) {
    return TIER_IDS.FREE_TRIAL;
  }

  // Primary determination: Use Stripe Product ID
  if (company.stripeProductID) {
    const tier = PRODUCT_ID_TO_TIER[company.stripeProductID];
    if (tier) {
      return tier;
    }
    // If stripeProductID exists but is not recognized, log a warning and fall back to FREE_TRIAL
    // This is a data integrity issue that should be investigated, so we use the safest default
    console.warn(
      `Unknown Stripe Product ID: ${company.stripeProductID}. Falling back to subscription status.`,
    );
    return TIER_IDS.FREE_TRIAL;
  }

  // Fallback 2: Check if on free trial
  if (company.freeTrialActive) {
    return TIER_IDS.FREE_TRIAL;
  }

  // Fallback 3: Check if subscription was canceled (grace period might still be active)
  if (company.subscriptionCanceled && company.paidAccount) {
    // They had a paid account but it was canceled - keep them on their tier until it expires
    // Try to determine from stripeProductID if available
    if (
      company.stripeProductID &&
      PRODUCT_ID_TO_TIER[company.stripeProductID]
    ) {
      return PRODUCT_ID_TO_TIER[company.stripeProductID];
    }
    // Otherwise default to STANDARD
    return TIER_IDS.STANDARD;
  }

  // Default: Free trial for any other case
  return TIER_IDS.FREE_TRIAL;
}
