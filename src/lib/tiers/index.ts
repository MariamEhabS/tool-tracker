/**
 * Taliho V3 Tier System
 *
 * This module provides tier-based feature gating and storage limit management
 * for the Taliho application.
 *
 * @module lib/tiers
 */

// Types
export type { TierId, TierConfig, StorageLimits, TierInfo } from "./types";

// Constants
export {
  TIER_IDS,
  TIER_CONFIGS,
  STRIPE_PRODUCT_IDS,
  PRODUCT_ID_TO_TIER,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  STORAGE_BLOCKED_THRESHOLD,
  STORAGE_ADDON_DOCUMENT_BYTES,
  STORAGE_ADDON_QR_BYTES,
} from "./constants";

// Functions
export { determineTier } from "./determineTier";

// Hooks
export { useTier, useStorageLimits, useFeatureGate } from "./hooks";
