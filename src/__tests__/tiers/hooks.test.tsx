/**
 * Tests for tiering system React hooks
 * Tests useTier, useStorageLimits, and useFeatureGate hooks
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useTier, useStorageLimits, useFeatureGate } from "@/lib/tiers/hooks";
import { TIER_IDS, TIER_CONFIGS } from "@/lib/tiers/constants";
import {
  freeTrialCompany,
  standardCompany,
  professionalCompany,
  businessCompany,
  earlyAdopterCompany,
  emptyStorageCompany,
  halfStorageCompany,
  warningStorageCompany,
  criticalStorageCompany,
  blockedStorageCompany,
  companyWithAddons,
} from "./fixtures";

/**
 * Create a mock Redux store with company data
 */
function createMockStore(company: unknown) {
  return configureStore({
    reducer: {
      company: (state = company) => state,
    },
  });
}

/**
 * Wrapper component that provides Redux store
 */
function createWrapper(company: unknown) {
  const store = createMockStore(company);
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useTier hook", () => {
  describe("Tier identification", () => {
    it("should identify Free Trial tier", () => {
      const { result } = renderHook(() => useTier(), {
        wrapper: createWrapper(freeTrialCompany),
      });

      expect(result.current.tierId).toBe(TIER_IDS.FREE_TRIAL);
      expect(result.current.config).toEqual(TIER_CONFIGS.FREE_TRIAL);
      expect(result.current.isFreeTrial).toBe(true);
    });

    it("should identify Standard tier", () => {
      const { result } = renderHook(() => useTier(), {
        wrapper: createWrapper(standardCompany),
      });

      expect(result.current.tierId).toBe(TIER_IDS.STANDARD);
      expect(result.current.config).toEqual(TIER_CONFIGS.STANDARD);
      expect(result.current.isFreeTrial).toBe(false);
    });

    it("should identify Professional tier", () => {
      const { result } = renderHook(() => useTier(), {
        wrapper: createWrapper(professionalCompany),
      });

      expect(result.current.tierId).toBe(TIER_IDS.PROFESSIONAL);
      expect(result.current.config).toEqual(TIER_CONFIGS.PROFESSIONAL);
      expect(result.current.hasUnlimitedQR).toBe(true);
    });

    it("should identify Business tier", () => {
      const { result } = renderHook(() => useTier(), {
        wrapper: createWrapper(businessCompany),
      });

      expect(result.current.tierId).toBe(TIER_IDS.BUSINESS);
      expect(result.current.config).toEqual(TIER_CONFIGS.BUSINESS);
      expect(result.current.isBusiness).toBe(true);
      expect(result.current.hasProcoreFullIntegration).toBe(true);
    });

    it("should identify Early Adopter tier", () => {
      const { result } = renderHook(() => useTier(), {
        wrapper: createWrapper(earlyAdopterCompany),
      });

      expect(result.current.tierId).toBe(TIER_IDS.EARLY_ADOPTER);
      expect(result.current.config).toEqual(TIER_CONFIGS.EARLY_ADOPTER);
      expect(result.current.hasUnlimitedQR).toBe(true);
      expect(result.current.hasProcoreFullIntegration).toBe(true);
    });
  });

  describe("Boolean helpers", () => {
    it("should set isFreeTrial correctly", () => {
      const freeResult = renderHook(() => useTier(), {
        wrapper: createWrapper(freeTrialCompany),
      });
      const paidResult = renderHook(() => useTier(), {
        wrapper: createWrapper(standardCompany),
      });

      expect(freeResult.result.current.isFreeTrial).toBe(true);
      expect(paidResult.result.current.isFreeTrial).toBe(false);
    });

    it("should set isBusiness correctly", () => {
      const businessResult = renderHook(() => useTier(), {
        wrapper: createWrapper(businessCompany),
      });
      const standardResult = renderHook(() => useTier(), {
        wrapper: createWrapper(standardCompany),
      });

      expect(businessResult.result.current.isBusiness).toBe(true);
      expect(standardResult.result.current.isBusiness).toBe(false);
    });

    it("should set hasUnlimitedQR correctly", () => {
      const professionalResult = renderHook(() => useTier(), {
        wrapper: createWrapper(professionalCompany),
      });
      const standardResult = renderHook(() => useTier(), {
        wrapper: createWrapper(standardCompany),
      });

      expect(professionalResult.result.current.hasUnlimitedQR).toBe(true);
      expect(standardResult.result.current.hasUnlimitedQR).toBe(false);
    });

    it("should set hasProcoreFullIntegration correctly", () => {
      const businessResult = renderHook(() => useTier(), {
        wrapper: createWrapper(businessCompany),
      });
      const standardResult = renderHook(() => useTier(), {
        wrapper: createWrapper(standardCompany),
      });

      expect(businessResult.result.current.hasProcoreFullIntegration).toBe(
        true,
      );
      expect(standardResult.result.current.hasProcoreFullIntegration).toBe(
        false,
      );
    });
  });
});

describe("useStorageLimits hook", () => {
  describe("Storage calculations", () => {
    it("should calculate empty storage correctly", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(emptyStorageCompany),
      });

      expect(result.current.totalUsed).toBe(0);
      expect(result.current.totalCapacity).toBeGreaterThan(0);
      expect(result.current.remaining).toBe(result.current.totalCapacity);
      expect(result.current.percentageUsed).toBe(0);
    });

    it("should calculate half-full storage correctly", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(halfStorageCompany),
      });

      expect(result.current.totalUsed).toBeGreaterThan(0);
      expect(result.current.percentageUsed).toBeCloseTo(0.5, 2); // 50% as decimal
      expect(result.current.isWarning).toBe(false);
      expect(result.current.isCritical).toBe(false);
      expect(result.current.isBlocked).toBe(false);
    });

    it("should handle storage with add-ons", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(companyWithAddons),
      });

      expect(result.current.addonsCount).toBe(2);
      expect(result.current.totalCapacity).toBeGreaterThan(
        TIER_CONFIGS.STANDARD.storageBytes,
      );
    });
  });

  describe("Storage warning states", () => {
    it("should detect warning state (80-89% used)", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(warningStorageCompany),
      });

      expect(result.current.isWarning).toBe(true);
      expect(result.current.isCritical).toBe(false);
      expect(result.current.isBlocked).toBe(false);
      expect(result.current.percentageUsed).toBeGreaterThanOrEqual(0.8); // 80% as decimal
      expect(result.current.percentageUsed).toBeLessThan(0.9); // 90% as decimal
    });

    it("should detect critical state (90-99% used)", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(criticalStorageCompany),
      });

      expect(result.current.isWarning).toBe(true);
      expect(result.current.isCritical).toBe(true);
      expect(result.current.isBlocked).toBe(false);
      expect(result.current.percentageUsed).toBeGreaterThanOrEqual(0.9); // 90% as decimal
      expect(result.current.percentageUsed).toBeLessThan(1.0); // 100% as decimal
    });

    it("should detect blocked state (100% used)", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(blockedStorageCompany),
      });

      expect(result.current.isWarning).toBe(true);
      expect(result.current.isCritical).toBe(true);
      expect(result.current.isBlocked).toBe(true);
      expect(result.current.percentageUsed).toBeGreaterThanOrEqual(1.0); // 100% as decimal
    });

    it("should not show warnings for normal usage", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(halfStorageCompany),
      });

      expect(result.current.isWarning).toBe(false);
      expect(result.current.isCritical).toBe(false);
      expect(result.current.isBlocked).toBe(false);
    });
  });

  describe("Remaining storage calculation", () => {
    it("should calculate remaining storage correctly", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(halfStorageCompany),
      });

      const expectedRemaining =
        result.current.totalCapacity - result.current.totalUsed;
      expect(result.current.remaining).toBeCloseTo(expectedRemaining, -6);
    });

    it("should show zero remaining when at capacity", () => {
      const { result } = renderHook(() => useStorageLimits(), {
        wrapper: createWrapper(blockedStorageCompany),
      });

      expect(result.current.remaining).toBeLessThanOrEqual(0);
    });
  });
});

describe("useFeatureGate hook", () => {
  describe("Feature access by tier", () => {
    it("should allow unlimited QR for Professional tier", () => {
      const { result } = renderHook(
        () => useFeatureGate("unlimited_qr_batch"),
        {
          wrapper: createWrapper(professionalCompany),
        },
      );

      expect(result.current).toBe(true);
    });

    it("should deny unlimited QR for Standard tier", () => {
      const { result } = renderHook(
        () => useFeatureGate("unlimited_qr_batch"),
        {
          wrapper: createWrapper(standardCompany),
        },
      );

      expect(result.current).toBe(false);
    });

    it("should allow Procore for Business tier", () => {
      const { result } = renderHook(
        () => useFeatureGate("procore_integration"),
        {
          wrapper: createWrapper(businessCompany),
        },
      );

      expect(result.current).toBe(true);
    });

    it("should deny Procore for Standard tier", () => {
      const { result } = renderHook(
        () => useFeatureGate("procore_integration"),
        {
          wrapper: createWrapper(standardCompany),
        },
      );

      expect(result.current).toBe(false);
    });

    it("should allow Procore for Early Adopter tier", () => {
      const { result } = renderHook(
        () => useFeatureGate("procore_integration"),
        {
          wrapper: createWrapper(earlyAdopterCompany),
        },
      );

      expect(result.current).toBe(true);
    });
  });

  describe("Unknown features", () => {
    it("should deny access to unknown features", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { result } = renderHook(
        () =>
          useFeatureGate(
            "unknown_feature" as Parameters<typeof useFeatureGate>[0],
          ),
        {
          wrapper: createWrapper(businessCompany),
        },
      );

      expect(result.current).toBe(false);
      warnSpy.mockRestore();
    });
  });
});
