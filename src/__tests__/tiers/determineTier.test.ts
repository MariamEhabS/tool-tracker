/**
 * Tests for determineTier function
 * Validates correct tier identification based on company data
 */

import { describe, it, expect, vi } from "vitest";
import { determineTier } from "@/lib/tiers/determineTier";
import { TIER_IDS } from "@/lib/tiers/constants";
import {
  freeTrialCompany,
  standardCompany,
  professionalCompany,
  businessCompany,
  earlyAdopterCompany,
  missingProductIDCompany,
  invalidProductIDCompany,
  expiredTrialCompany,
} from "./fixtures";

describe("determineTier", () => {
  describe("Tier identification by Stripe Product ID", () => {
    it("should identify Free Trial tier", () => {
      const tier = determineTier(freeTrialCompany);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should identify Standard tier", () => {
      const tier = determineTier(standardCompany);
      expect(tier).toBe(TIER_IDS.STANDARD);
    });

    it("should identify Professional tier", () => {
      const tier = determineTier(professionalCompany);
      expect(tier).toBe(TIER_IDS.PROFESSIONAL);
    });

    it("should identify Business tier", () => {
      const tier = determineTier(businessCompany);
      expect(tier).toBe(TIER_IDS.BUSINESS);
    });

    it("should identify Early Adopter tier", () => {
      const tier = determineTier(earlyAdopterCompany);
      expect(tier).toBe(TIER_IDS.EARLY_ADOPTER);
    });
  });

  describe("Edge cases and fallback logic", () => {
    it("should fall back to FREE_TRIAL when stripeProductID is missing", () => {
      const tier = determineTier(missingProductIDCompany);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should fall back to FREE_TRIAL for invalid stripeProductID", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const tier = determineTier(invalidProductIDCompany);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
      warnSpy.mockRestore();
    });

    it("should handle expired trial (no longer active, not paid)", () => {
      const tier = determineTier(expiredTrialCompany);
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should handle null/undefined company gracefully", () => {
      const tier = determineTier(
        null as unknown as Parameters<typeof determineTier>[0],
      );
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should handle empty company object gracefully", () => {
      const tier = determineTier(
        {} as unknown as Parameters<typeof determineTier>[0],
      );
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });
  });

  describe("Trial and paid account logic", () => {
    it("should prioritize stripeProductID over trial flags", () => {
      // Company with stripeProductID should use that, even if trial flag is set
      const companyWithBothFlags = {
        ...standardCompany,
        freeTrialActive: true, // This should be ignored
      };
      const tier = determineTier(companyWithBothFlags);
      expect(tier).toBe(TIER_IDS.STANDARD);
    });

    it("should use trial flag when no stripeProductID", () => {
      const trialCompany = {
        freeTrialActive: true,
        paidAccount: false,
        stripeProductID: undefined,
      };
      const tier = determineTier(
        trialCompany as unknown as Parameters<typeof determineTier>[0],
      );
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });

    it("should handle paid account without stripeProductID", () => {
      const paidCompany = {
        freeTrialActive: false,
        paidAccount: true,
        stripeProductID: undefined,
      };
      const tier = determineTier(
        paidCompany as unknown as Parameters<typeof determineTier>[0],
      );
      // Should fall back to FREE_TRIAL since we can't determine the tier
      expect(tier).toBe(TIER_IDS.FREE_TRIAL);
    });
  });

  describe("Type safety", () => {
    it("should return a valid TierId type", () => {
      const tier = determineTier(businessCompany);
      expect(Object.values(TIER_IDS)).toContain(tier);
    });

    it("should always return a tier (never undefined)", () => {
      const tier = determineTier(missingProductIDCompany);
      expect(tier).toBeDefined();
      expect(tier).toBeTruthy();
    });
  });
});
