/**
 * React hooks for tier and storage management
 */

import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { determineTier } from "./determineTier";
import { useDevOverrides } from "@/lib/devOverride";
import {
  TIER_CONFIGS,
  TIER_IDS,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  STORAGE_BLOCKED_THRESHOLD,
  STORAGE_ADDON_DOCUMENT_BYTES,
  STORAGE_ADDON_QR_BYTES,
} from "./constants";
import { TierInfo, StorageLimits } from "./types";

/**
 * Hook to get the current tier information for the logged-in company
 *
 * @returns Tier information including tier ID, config, and boolean helpers
 *
 * @example
 * ```tsx
 * const { tierId, config, isFreeTrial, hasProcoreFullIntegration } = useTier();
 * console.log(`Current tier: ${config.name}`);
 * if (isFreeTrial) {
 *   console.log('User is on free trial');
 * }
 * ```
 */
export function useTier(): TierInfo {
  const company = useSelector((state: RootState) => state.company);
  const { overrides, isEnabled } = useDevOverrides();

  return useMemo(() => {
    // If dev override is active, use overridden tier
    const tierId =
      isEnabled && overrides.tier ? overrides.tier : determineTier(company);
    const config = TIER_CONFIGS[tierId];

    return {
      tierId,
      config,
      isFreeTrial: tierId === TIER_IDS.FREE_TRIAL,
      isStandard: tierId === TIER_IDS.STANDARD,
      isProfessional: tierId === TIER_IDS.PROFESSIONAL,
      isBusiness: tierId === TIER_IDS.BUSINESS,
      isEarlyAdopter: tierId === TIER_IDS.EARLY_ADOPTER,
      hasUnlimitedQR: config.qrBatchLimit === Infinity,
      hasProcoreFullIntegration: config.hasProcoreFullIntegration,
    };
  }, [company, overrides.tier, isEnabled]);
}

/**
 * Hook to get storage usage and limits with warning/critical states
 *
 * @returns Storage limits information including usage, capacity, percentages, and warning states
 *
 * @example
 * ```tsx
 * const { percentageUsed, isWarning, isCritical, isBlocked, remaining } = useStorageLimits();
 * if (isBlocked) {
 *   console.log('Storage is full!');
 * } else if (isCritical) {
 *   console.log(`Only ${remaining} bytes remaining`);
 * }
 * ```
 */
export function useStorageLimits(): StorageLimits {
  const company = useSelector((state: RootState) => state.company);
  const { config, isFreeTrial } = useTier();

  return useMemo(() => {
    // Get base storage from tier
    const baseStorage = config.storageBytes;

    // Calculate additional storage from add-ons
    const addonsCount = company.stripeAddons?.length || 0;
    const addonDocumentStorage = addonsCount * STORAGE_ADDON_DOCUMENT_BYTES;
    const addonQrStorage = addonsCount * STORAGE_ADDON_QR_BYTES;

    // Calculate total capacities
    // For Free Trial: use single shared pool (50 MB total)
    // For paid tiers: separate document and QR pools
    let documentCapacity: number;
    let qrCapacity: number;
    let totalCapacity: number;

    if (isFreeTrial) {
      // Free Trial: single 50 MB shared pool for documents and QR codes
      totalCapacity = baseStorage; // 50 MB from tier config
      // Split the display evenly but share the actual pool
      documentCapacity = baseStorage;
      qrCapacity = 0; // QR codes share the document pool
    } else {
      // Paid tiers: separate pools
      documentCapacity =
        (company.documentStorageCapacity || baseStorage) + addonDocumentStorage;
      qrCapacity =
        (company.qrCodeStorageCapacity || baseStorage * 0.2) + addonQrStorage; // QR codes get 20% of base
      totalCapacity = documentCapacity + qrCapacity;
    }

    // Get current usage
    const documentUsed = company.documentStorageUsed || 0;
    const qrUsed = company.qrCodeStorageUsed || 0;
    const totalUsed = documentUsed + qrUsed;

    // Calculate percentages
    const percentageUsed = totalCapacity > 0 ? totalUsed / totalCapacity : 0;
    const documentPercentage =
      documentCapacity > 0 ? documentUsed / documentCapacity : 0;
    const qrPercentage = qrCapacity > 0 ? qrUsed / qrCapacity : 0;

    // Calculate remaining storage
    const remaining = Math.max(0, totalCapacity - totalUsed);

    // Determine warning states (cumulative - once in warning, stays in warning)
    const isWarning = percentageUsed >= STORAGE_WARNING_THRESHOLD;
    const isCritical = percentageUsed >= STORAGE_CRITICAL_THRESHOLD;
    const isBlocked = percentageUsed >= STORAGE_BLOCKED_THRESHOLD;

    return {
      totalUsed,
      totalCapacity,
      percentageUsed,
      remaining,
      documentUsed,
      qrUsed,
      documentCapacity,
      qrCapacity,
      documentPercentage,
      qrPercentage,
      isWarning,
      isCritical,
      isBlocked,
      addonsCount,
    };
  }, [company, config, isFreeTrial]);
}

/**
 * Hook to check if a specific feature is available for the current tier
 *
 * @param feature - The feature to check (e.g., "procore", "unlimited_qr")
 * @returns Whether the feature is available
 *
 * @example
 * ```tsx
 * const canUseProcore = useFeatureGate('procore');
 * const hasUnlimitedQR = useFeatureGate('unlimited_qr');
 *
 * if (!canUseProcore) {
 *   return <UpgradePrompt feature="Procore Integration" requiredTier="Business" />;
 * }
 * ```
 */
export function useFeatureGate(feature: string): boolean {
  const { config } = useTier();

  return useMemo(() => {
    switch (feature.toLowerCase()) {
      case "procore":
      case "procore_integration":
      case "procore_full_integration":
        return config.hasProcoreFullIntegration;

      case "unlimited_qr":
      case "unlimited_qr_batch":
        return config.qrBatchLimit === Infinity;

      case "qr_batch":
        return true; // All tiers can create QR codes in batches, just with different limits

      default:
        console.warn(`Unknown feature gate: ${feature}`);
        return false;
    }
  }, [config, feature]);
}
