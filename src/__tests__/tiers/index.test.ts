/**
 * Integration tests for lib/tiers barrel export
 *
 * These tests verify that all tier-related functionality is correctly
 * re-exported from the index file and can be imported as a single module.
 */

import { describe, it, expect } from "vitest";
import {
  // Constants
  TIER_IDS,
  TIER_CONFIGS,
  STRIPE_PRODUCT_IDS,
  PRODUCT_ID_TO_TIER,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  STORAGE_BLOCKED_THRESHOLD,
  STORAGE_ADDON_DOCUMENT_BYTES,
  STORAGE_ADDON_QR_BYTES,
  // Functions
  determineTier,
  // Hooks
  useTier,
  useStorageLimits,
  useFeatureGate,
} from "@/lib/tiers";

// Import types to verify they are exported (TypeScript compilation check)
import type { TierId, TierConfig, StorageLimits, TierInfo } from "@/lib/tiers";

describe("lib/tiers index exports", () => {
  describe("Constants exports", () => {
    it("should export TIER_IDS with all tier identifiers", () => {
      expect(TIER_IDS).toBeDefined();
      expect(TIER_IDS.FREE_TRIAL).toBe("FREE_TRIAL");
      expect(TIER_IDS.STANDARD).toBe("STANDARD");
      expect(TIER_IDS.PROFESSIONAL).toBe("PROFESSIONAL");
      expect(TIER_IDS.BUSINESS).toBe("BUSINESS");
      expect(TIER_IDS.EARLY_ADOPTER).toBe("EARLY_ADOPTER");
    });

    it("should export TIER_CONFIGS with configuration for all tiers", () => {
      expect(TIER_CONFIGS).toBeDefined();
      expect(TIER_CONFIGS.FREE_TRIAL).toBeDefined();
      expect(TIER_CONFIGS.STANDARD).toBeDefined();
      expect(TIER_CONFIGS.PROFESSIONAL).toBeDefined();
      expect(TIER_CONFIGS.BUSINESS).toBeDefined();
      expect(TIER_CONFIGS.EARLY_ADOPTER).toBeDefined();
    });

    it("should export TIER_CONFIGS with correct structure", () => {
      const config = TIER_CONFIGS.STANDARD;
      expect(config).toHaveProperty("id");
      expect(config).toHaveProperty("name");
      expect(config).toHaveProperty("price");
      expect(config).toHaveProperty("storageBytes");
      expect(config).toHaveProperty("qrBatchLimit");
      expect(config).toHaveProperty("hasProcoreFullIntegration");
    });

    it("should export STRIPE_PRODUCT_IDS", () => {
      expect(STRIPE_PRODUCT_IDS).toBeDefined();
      expect(STRIPE_PRODUCT_IDS).toHaveProperty("EARLY_ADOPTER");
      expect(STRIPE_PRODUCT_IDS).toHaveProperty("STANDARD");
      expect(STRIPE_PRODUCT_IDS).toHaveProperty("PROFESSIONAL");
      expect(STRIPE_PRODUCT_IDS).toHaveProperty("BUSINESS");
    });

    it("should export PRODUCT_ID_TO_TIER mapping", () => {
      expect(PRODUCT_ID_TO_TIER).toBeDefined();
      expect(typeof PRODUCT_ID_TO_TIER).toBe("object");
    });

    it("should export storage threshold constants", () => {
      expect(STORAGE_WARNING_THRESHOLD).toBe(0.8);
      expect(STORAGE_CRITICAL_THRESHOLD).toBe(0.9);
      expect(STORAGE_BLOCKED_THRESHOLD).toBe(1.0);
    });

    it("should export storage addon constants", () => {
      expect(STORAGE_ADDON_DOCUMENT_BYTES).toBe(53_687_091_200); // 50 GB
      expect(STORAGE_ADDON_QR_BYTES).toBe(10_737_418_240); // 10 GB
    });
  });

  describe("Function exports", () => {
    it("should export determineTier function", () => {
      expect(determineTier).toBeDefined();
      expect(typeof determineTier).toBe("function");
    });

    it("should have working determineTier function", () => {
      // Test with null company
      const tier = determineTier(null);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should have working determineTier with undefined company", () => {
      const tier = determineTier(undefined);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });
  });

  describe("Hook exports", () => {
    it("should export useTier hook", () => {
      expect(useTier).toBeDefined();
      expect(typeof useTier).toBe("function");
    });

    it("should export useStorageLimits hook", () => {
      expect(useStorageLimits).toBeDefined();
      expect(typeof useStorageLimits).toBe("function");
    });

    it("should export useFeatureGate hook", () => {
      expect(useFeatureGate).toBeDefined();
      expect(typeof useFeatureGate).toBe("function");
    });
  });

  describe("Type exports (compile-time verification)", () => {
    it("should allow using TierId type", () => {
      // This test verifies TypeScript compilation works with the exported type
      const tierId: TierId = "FREE_TRIAL";
      expect(tierId).toBe("FREE_TRIAL");
    });

    it("should allow using TierConfig type", () => {
      // Verify TierConfig type is compatible with TIER_CONFIGS values
      const config: TierConfig = TIER_CONFIGS.STANDARD;
      expect(config.id).toBe("STANDARD");
      expect(config.name).toBe("Standard");
    });

    it("should have StorageLimits type defined", () => {
      // Type assertion to verify StorageLimits interface shape
      const mockLimits: StorageLimits = {
        totalUsed: 0,
        totalCapacity: 100,
        percentageUsed: 0,
        remaining: 100,
        documentUsed: 0,
        qrUsed: 0,
        documentCapacity: 50,
        qrCapacity: 50,
        documentPercentage: 0,
        qrPercentage: 0,
        isWarning: false,
        isCritical: false,
        isBlocked: false,
        addonsCount: 0,
      };
      expect(mockLimits.totalUsed).toBe(0);
    });

    it("should have TierInfo type defined", () => {
      // Type assertion to verify TierInfo interface shape
      const mockInfo: TierInfo = {
        tierId: "FREE_TRIAL",
        config: TIER_CONFIGS.FREE_TRIAL,
        isFreeTrial: true,
        isStandard: false,
        isProfessional: false,
        isBusiness: false,
        isEarlyAdopter: false,
        hasUnlimitedQR: false,
        hasProcoreFullIntegration: true,
      };
      expect(mockInfo.isFreeTrial).toBe(true);
    });
  });

  describe("Integration: Tier configuration consistency", () => {
    it("should have TIER_IDS keys match TIER_CONFIGS keys", () => {
      const tierIdKeys = Object.keys(TIER_IDS);
      const configKeys = Object.keys(TIER_CONFIGS);
      expect(tierIdKeys.sort()).toEqual(configKeys.sort());
    });

    it("should have TIER_CONFIGS ids match their keys", () => {
      Object.entries(TIER_CONFIGS).forEach(([key, config]) => {
        expect(config.id).toBe(key);
      });
    });

    it("should have all tiers with valid storage bytes", () => {
      Object.values(TIER_CONFIGS).forEach((config) => {
        expect(config.storageBytes).toBeGreaterThan(0);
        expect(Number.isFinite(config.storageBytes)).toBe(true);
      });
    });

    it("should have all tiers with valid QR batch limits", () => {
      Object.values(TIER_CONFIGS).forEach((config) => {
        expect(config.qrBatchLimit).toBeGreaterThan(0);
        // Can be Infinity for unlimited tiers
        expect(
          Number.isFinite(config.qrBatchLimit) ||
            config.qrBatchLimit === Infinity,
        ).toBe(true);
      });
    });

    it("should have Business and Early Adopter tiers with Procore integration", () => {
      expect(TIER_CONFIGS.BUSINESS.hasProcoreFullIntegration).toBe(true);
      expect(TIER_CONFIGS.EARLY_ADOPTER.hasProcoreFullIntegration).toBe(true);
    });

    it("should have Standard and Professional tiers without Procore integration", () => {
      expect(TIER_CONFIGS.STANDARD.hasProcoreFullIntegration).toBe(false);
      expect(TIER_CONFIGS.PROFESSIONAL.hasProcoreFullIntegration).toBe(false);
    });

    it("should have Professional and Business tiers with unlimited QR", () => {
      expect(TIER_CONFIGS.PROFESSIONAL.qrBatchLimit).toBe(Infinity);
      expect(TIER_CONFIGS.BUSINESS.qrBatchLimit).toBe(Infinity);
      expect(TIER_CONFIGS.EARLY_ADOPTER.qrBatchLimit).toBe(Infinity);
    });

    it("should have Free Trial and Standard tiers with limited QR", () => {
      expect(TIER_CONFIGS.FREE_TRIAL.qrBatchLimit).toBe(20);
      expect(TIER_CONFIGS.STANDARD.qrBatchLimit).toBe(20);
    });
  });

  describe("Integration: Storage thresholds", () => {
    it("should have thresholds in ascending order", () => {
      expect(STORAGE_WARNING_THRESHOLD).toBeLessThan(
        STORAGE_CRITICAL_THRESHOLD,
      );
      expect(STORAGE_CRITICAL_THRESHOLD).toBeLessThan(
        STORAGE_BLOCKED_THRESHOLD,
      );
    });

    it("should have valid threshold values between 0 and 1", () => {
      expect(STORAGE_WARNING_THRESHOLD).toBeGreaterThan(0);
      expect(STORAGE_WARNING_THRESHOLD).toBeLessThanOrEqual(1);
      expect(STORAGE_CRITICAL_THRESHOLD).toBeGreaterThan(0);
      expect(STORAGE_CRITICAL_THRESHOLD).toBeLessThanOrEqual(1);
      expect(STORAGE_BLOCKED_THRESHOLD).toBeGreaterThan(0);
      expect(STORAGE_BLOCKED_THRESHOLD).toBeLessThanOrEqual(1);
    });
  });

  describe("Integration: determineTier with tier configs", () => {
    it("should return a valid tier ID that exists in TIER_CONFIGS", () => {
      const tier = determineTier(null);
      expect(TIER_CONFIGS[tier]).toBeDefined();
    });

    it("should return FREE_TRIAL config for null company", () => {
      const tier = determineTier(null);
      const config = TIER_CONFIGS[tier];
      expect(config.name).toBe("Free Trial");
      expect(config.price).toBe("$0");
    });
  });
});
