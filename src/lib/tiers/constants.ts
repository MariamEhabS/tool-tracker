/**
 * Tier system constants for Taliho V3
 *
 * Storage values are in bytes:
 * - 50 MB = 52,428,800 bytes
 * - 50 GB = 53,687,091,200 bytes
 * - 200 GB = 214,748,364,800 bytes
 * - 500 GB = 536,870,912,000 bytes
 * - 10 GB = 10,737,418,240 bytes
 */

import { TierConfig, TierId } from "./types";

/**
 * Tier identifiers as constants
 */
export const TIER_IDS = {
  FREE_TRIAL: "FREE_TRIAL" as TierId,
  STANDARD: "STANDARD" as TierId,
  PROFESSIONAL: "PROFESSIONAL" as TierId,
  BUSINESS: "BUSINESS" as TierId,
  EARLY_ADOPTER: "EARLY_ADOPTER" as TierId,
} as const;

/**
 * Storage capacity in bytes for each tier
 */
const STORAGE_BYTES = {
  FREE_TRIAL: 52_428_800, // 50 MB
  STANDARD: 53_687_091_200, // 50 GB
  PROFESSIONAL: 214_748_364_800, // 200 GB
  BUSINESS: 536_870_912_000, // 500 GB
  EARLY_ADOPTER: 53_687_091_200, // 50 GB
} as const;

/**
 * Complete tier configurations
 */
export const TIER_CONFIGS: Record<TierId, TierConfig> = {
  FREE_TRIAL: {
    id: TIER_IDS.FREE_TRIAL,
    name: "Free Trial",
    price: "$0",
    storageBytes: STORAGE_BYTES.FREE_TRIAL,
    qrBatchLimit: 20,
    hasProcoreFullIntegration: true,
    features: ["QR Code Arrangements", "50 MB Cloud Storage", "14-Day Trial"],
  },
  STANDARD: {
    id: TIER_IDS.STANDARD,
    name: "Standard",
    price: "$29/month",
    storageBytes: STORAGE_BYTES.STANDARD,
    qrBatchLimit: 20,
    hasProcoreFullIntegration: false,
    features: [
      "Create 20 QR codes at a time",
      "50 GB Cloud Storage",
      "Basic Support",
    ],
  },
  PROFESSIONAL: {
    id: TIER_IDS.PROFESSIONAL,
    name: "Professional",
    price: "$69/month",
    storageBytes: STORAGE_BYTES.PROFESSIONAL,
    qrBatchLimit: Infinity,
    hasProcoreFullIntegration: false,
    features: [
      "Create unlimited QR codes at a time",
      "200 GB Cloud Storage",
      "Priority Support",
    ],
  },
  BUSINESS: {
    id: TIER_IDS.BUSINESS,
    name: "Business",
    price: "$189/month",
    storageBytes: STORAGE_BYTES.BUSINESS,
    qrBatchLimit: Infinity,
    hasProcoreFullIntegration: true,
    features: [
      "Procore Integration",
      "500 GB Cloud Storage",
      "Dedicated Support",
    ],
  },
  EARLY_ADOPTER: {
    id: TIER_IDS.EARLY_ADOPTER,
    name: "Early Adopter",
    price: "Legacy",
    storageBytes: STORAGE_BYTES.EARLY_ADOPTER,
    qrBatchLimit: Infinity,
    hasProcoreFullIntegration: true,
    features: [
      "QR Code Arrangements",
      "Product & Equipment QR Codes",
      "Procore Integration",
      "50 GB Cloud Storage",
      "Priority Support",
    ],
  },
};

/**
 * Stripe Product ID mappings from environment variables
 * These are used to determine which tier a company is on based on their stripeProductID
 *
 * Configure these in .env:
 * - VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER
 * - VITE_STRIPE_PRODUCT_ID_STANDARD
 * - VITE_STRIPE_PRODUCT_ID_PROFESSIONAL
 * - VITE_STRIPE_PRODUCT_ID_BUSINESS
 */
export const STRIPE_PRODUCT_IDS = {
  EARLY_ADOPTER: import.meta.env.VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER || "",
  STANDARD: import.meta.env.VITE_STRIPE_PRODUCT_ID_STANDARD || "",
  PROFESSIONAL: import.meta.env.VITE_STRIPE_PRODUCT_ID_PROFESSIONAL || "",
  BUSINESS: import.meta.env.VITE_STRIPE_PRODUCT_ID_BUSINESS || "",
} as const;

/**
 * Reverse mapping: Stripe Product ID -> Tier ID
 */
export const PRODUCT_ID_TO_TIER: Record<string, TierId> = {
  [STRIPE_PRODUCT_IDS.EARLY_ADOPTER]: TIER_IDS.EARLY_ADOPTER,
  [STRIPE_PRODUCT_IDS.STANDARD]: TIER_IDS.STANDARD,
  [STRIPE_PRODUCT_IDS.PROFESSIONAL]: TIER_IDS.PROFESSIONAL,
  [STRIPE_PRODUCT_IDS.BUSINESS]: TIER_IDS.BUSINESS,
};

/**
 * Storage warning threshold (80% of capacity)
 */
export const STORAGE_WARNING_THRESHOLD = 0.8;

/**
 * Storage critical threshold (90% of capacity)
 */
export const STORAGE_CRITICAL_THRESHOLD = 0.9;

/**
 * Storage blocked threshold (100% of capacity)
 */
export const STORAGE_BLOCKED_THRESHOLD = 1.0;

/**
 * Document storage added per storage add-on (50 GB in bytes)
 */
export const STORAGE_ADDON_DOCUMENT_BYTES = 53_687_091_200; // 50 GB

/**
 * QR code storage added per storage add-on (10 GB in bytes)
 */
export const STORAGE_ADDON_QR_BYTES = 10_737_418_240; // 10 GB
