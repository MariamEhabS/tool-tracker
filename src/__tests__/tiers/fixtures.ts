/**
 * Test fixtures for tiering system tests
 * Mock Company objects for each tier type and various storage states
 */

import { Company } from "@/types";
import { STRIPE_PRODUCT_IDS } from "@/lib/tiers/constants";

/**
 * Base company data that all fixtures inherit from
 */
const baseCompany: Partial<Company> = {
  _id: "test-company-id",
  companyName: "Test Company",
  companyIndustry: "Construction",
  documentStorageUsed: 0,
  qrCodeStorageUsed: 0,
  stripeAddons: [],
  editProcoreItemsAllowed: false,
  procoreIntegration: false,
  subscriptionCanceled: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/**
 * Free Trial company fixture
 * - 50 MB storage capacity
 * - 20 QR code batch limit
 * - No Procore integration
 */
export const freeTrialCompany: Company = {
  ...baseCompany,
  freeTrialActive: true,
  paidAccount: false,
  documentStorageCapacity: 52_428_800, // 50 MB
  qrCodeStorageCapacity: 52_428_800, // 50 MB (total capacity shared)
  createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (9 days remaining)
} as Company;

/**
 * Standard tier company fixture
 * - 50 GB storage capacity
 * - 20 QR code batch limit
 * - No Procore integration
 */
export const standardCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  stripeProductID: STRIPE_PRODUCT_IDS.STANDARD,
  documentStorageCapacity: 53_687_091_200, // 50 GB
  qrCodeStorageCapacity: 53_687_091_200, // 50 GB (total capacity shared)
  subscribedAt: new Date("2024-06-01"),
} as Company;

/**
 * Professional tier company fixture
 * - 200 GB storage capacity
 * - Unlimited QR code batch creation
 * - No Procore integration
 */
export const professionalCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  stripeProductID: STRIPE_PRODUCT_IDS.PROFESSIONAL,
  documentStorageCapacity: 214_748_364_800, // 200 GB
  qrCodeStorageCapacity: 214_748_364_800, // 200 GB (total capacity shared)
  subscribedAt: new Date("2024-06-01"),
} as Company;

/**
 * Business tier company fixture
 * - 500 GB storage capacity
 * - Unlimited QR code batch creation
 * - Full Procore integration available
 */
export const businessCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  stripeProductID: STRIPE_PRODUCT_IDS.BUSINESS,
  documentStorageCapacity: 536_870_912_000, // 500 GB
  qrCodeStorageCapacity: 536_870_912_000, // 500 GB (total capacity shared)
  subscribedAt: new Date("2024-06-01"),
  procoreIntegration: true,
  editProcoreItemsAllowed: true,
  procoreCompanyID: 12345,
} as Company;

/**
 * Early Adopter tier company fixture
 * - 50 GB storage capacity
 * - Unlimited QR code batch creation
 * - Full Procore integration available
 */
export const earlyAdopterCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  stripeProductID: STRIPE_PRODUCT_IDS.EARLY_ADOPTER,
  documentStorageCapacity: 53_687_091_200, // 50 GB
  qrCodeStorageCapacity: 53_687_091_200, // 50 GB (total capacity shared)
  subscribedAt: new Date("2024-01-01"),
  procoreIntegration: true,
  editProcoreItemsAllowed: false,
  procoreCompanyID: 67890,
} as Company;

/**
 * Company with storage add-ons
 * Standard tier + 2 storage add-ons
 * Each add-on provides +50GB document storage
 */
export const companyWithAddons: Company = {
  ...standardCompany,
  stripeAddons: [
    { type: "storage", id: "addon_1" },
    { type: "storage", id: "addon_2" },
  ],
  documentStorageCapacity: 53_687_091_200 + 2 * 53_687_091_200, // 50GB + 2×50GB = 150GB
  qrCodeStorageCapacity: 53_687_091_200 + 2 * 10_737_418_240, // 50GB + 2×10GB = 70GB
};

/**
 * Company with canceled subscription
 */
export const canceledCompany: Company = {
  ...standardCompany,
  subscriptionCanceled: true,
  cancelledAt: new Date("2024-11-01"),
};

/**
 * Storage state fixtures
 * Various storage usage scenarios for testing storage limits
 */

/** Empty storage (0% used) */
export const emptyStorageCompany: Company = {
  ...standardCompany,
  documentStorageUsed: 0,
  qrCodeStorageUsed: 0,
};

/**
 * 50% storage used
 * Total capacity: documentCapacity (50 GB) + qrCapacity (50 GB) = 100 GB
 * Target: 50% = 50 GB total used
 */
export const halfStorageCompany: Company = {
  ...standardCompany,
  documentStorageUsed: 40_000_000_000, // ~37.25 GB
  qrCodeStorageUsed: 13_687_091_200, // ~12.75 GB (total ~50 GB = 50% of 100 GB)
};

/**
 * 85% storage used (warning threshold: 80-89%)
 * Total capacity: 100 GB
 * Target: 85% = 85 GB total used
 */
export const warningStorageCompany: Company = {
  ...standardCompany,
  documentStorageUsed: 45_000_000_000, // ~41.9 GB
  qrCodeStorageUsed: 46_233_927_680, // ~43.1 GB (total ~85 GB = 85% of 100 GB)
};

/**
 * 95% storage used (critical threshold: 90-99%)
 * Total capacity: 100 GB
 * Target: 95% = 95 GB total used
 */
export const criticalStorageCompany: Company = {
  ...standardCompany,
  documentStorageUsed: 50_000_000_000, // ~46.6 GB
  qrCodeStorageUsed: 52_003_036_800, // ~48.4 GB (total ~95 GB = 95% of 100 GB)
};

/**
 * 100% storage used (blocked)
 * Total capacity: 100 GB
 * Target: 100% = 100 GB+ total used
 */
export const blockedStorageCompany: Company = {
  ...standardCompany,
  documentStorageUsed: 53_687_091_200, // 50 GB (full document capacity)
  qrCodeStorageUsed: 53_687_091_200, // 50 GB (full QR capacity) - total 100 GB = 100%
};

/**
 * Edge cases
 */

/** Company with missing stripeProductID (should fall back to free trial) */
export const missingProductIDCompany: Company = {
  ...baseCompany,
  freeTrialActive: true,
  paidAccount: false,
  stripeProductID: undefined as unknown as string,
  documentStorageCapacity: 52_428_800, // 50 MB
  qrCodeStorageCapacity: 52_428_800,
} as Company;

/** Company with invalid stripeProductID */
export const invalidProductIDCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  stripeProductID: "prod_INVALID_ID",
  documentStorageCapacity: 53_687_091_200, // Default to Standard
  qrCodeStorageCapacity: 53_687_091_200,
} as Company;

/** Company with trial expired (no longer active, not paid) */
export const expiredTrialCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: false,
  documentStorageCapacity: 52_428_800,
  qrCodeStorageCapacity: 52_428_800,
  createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (expired)
} as Company;

/** Company with trial expiring soon (1-3 days remaining) */
export const expiringTrialCompany: Company = {
  ...baseCompany,
  freeTrialActive: true,
  paidAccount: false,
  documentStorageCapacity: 52_428_800,
  qrCodeStorageCapacity: 52_428_800,
  createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago (2 days remaining)
} as Company;

/** Company with canceled subscription but still active (grace period) */
export const canceledActiveCompany: Company = {
  ...standardCompany,
  subscriptionCanceled: true,
  paidAccount: true,
  cancelledAt: new Date("2024-11-01"),
} as Company;

/** Company with canceled and expired subscription (churned) */
export const canceledExpiredCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: false,
  subscriptionCanceled: true,
  documentStorageCapacity: 53_687_091_200,
  qrCodeStorageCapacity: 53_687_091_200,
  cancelledAt: new Date("2024-10-01"),
  stripeProductID: STRIPE_PRODUCT_IDS.STANDARD,
} as Company;

/**
 * Company with freeTrialActive but missing createdAt date
 * This is an edge case where the backend flag is true but date info is missing
 */
export const freeTrialMissingDateCompany: Company = {
  ...baseCompany,
  freeTrialActive: true,
  paidAccount: false,
  documentStorageCapacity: 52_428_800,
  qrCodeStorageCapacity: 52_428_800,
  createdAt: undefined,
  freeTrialRefreshDate: undefined,
} as Company;
