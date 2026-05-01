/**
 * Tier system types for Taliho V3
 */

/**
 * Unique identifier for each tier
 */
export type TierId =
  | "FREE_TRIAL"
  | "STANDARD"
  | "PROFESSIONAL"
  | "BUSINESS"
  | "EARLY_ADOPTER";

/**
 * Configuration for a specific tier
 */
export interface TierConfig {
  /** Unique tier identifier */
  id: TierId;
  /** Display name for the tier */
  name: string;
  /** Human-readable price (e.g., "$29/month", "Legacy", "$0") */
  price: string;
  /** Storage capacity in bytes */
  storageBytes: number;
  /** Maximum number of QR codes that can be created in a single batch (Infinity for unlimited) */
  qrBatchLimit: number;
  /** Whether this tier has full Procore integration access */
  hasProcoreFullIntegration: boolean;
  /** List of features included in this tier (for display in plan selection) */
  features?: string[];
}

/**
 * Storage limit state returned by useStorageLimits hook
 */
export interface StorageLimits {
  /** Total storage used (documents + QR codes) in bytes */
  totalUsed: number;
  /** Total storage capacity (base tier + add-ons) in bytes */
  totalCapacity: number;
  /** Percentage of storage used (0-1) */
  percentageUsed: number;
  /** Storage remaining in bytes */
  remaining: number;
  /** Document storage used in bytes */
  documentUsed: number;
  /** QR code storage used in bytes */
  qrUsed: number;
  /** Document storage capacity in bytes */
  documentCapacity: number;
  /** QR code storage capacity in bytes */
  qrCapacity: number;
  /** Percentage of document storage used (0-1) */
  documentPercentage: number;
  /** Percentage of QR storage used (0-1) */
  qrPercentage: number;
  /** Whether storage is in warning state (80-89% used) */
  isWarning: boolean;
  /** Whether storage is in critical state (90-99% used) */
  isCritical: boolean;
  /** Whether storage is blocked (100% used) */
  isBlocked: boolean;
  /** Number of storage add-ons purchased */
  addonsCount: number;
}

/**
 * Tier information returned by useTier hook
 */
export interface TierInfo {
  /** Current tier ID */
  tierId: TierId;
  /** Current tier configuration */
  config: TierConfig;
  /** Whether user is on free trial */
  isFreeTrial: boolean;
  /** Whether user is on Standard tier */
  isStandard: boolean;
  /** Whether user is on Professional tier */
  isProfessional: boolean;
  /** Whether user is on Business tier */
  isBusiness: boolean;
  /** Whether user is an Early Adopter */
  isEarlyAdopter: boolean;
  /** Whether user has unlimited QR batch creation */
  hasUnlimitedQR: boolean;
  /** Whether user has full Procore integration access */
  hasProcoreFullIntegration: boolean;
}
