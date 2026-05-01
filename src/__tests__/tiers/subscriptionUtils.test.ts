/**
 * Tests for subscription utility functions
 * Validates getUserState, getTrialDaysRemaining, and getTrialEndDate logic
 */

import { describe, it, expect } from "vitest";
import {
  getUserState,
  getTrialDaysRemaining,
  getTrialEndDate,
  type CompanyDetails,
} from "@/settings-page/components/Subscription/utils";

describe("getTrialEndDate", () => {
  it("should return null for null company", () => {
    expect(getTrialEndDate(null)).toBeNull();
  });

  it("should return null for undefined company", () => {
    expect(getTrialEndDate(undefined)).toBeNull();
  });

  it("should prioritize freeTrialRefreshDate + 14 days over createdAt + 14 days", () => {
    const refreshDate = new Date("2024-12-01");
    const createdDate = new Date("2024-01-01");
    const company: CompanyDetails = {
      freeTrialRefreshDate: refreshDate,
      createdAt: createdDate,
    };

    const result = getTrialEndDate(company);
    // freeTrialRefreshDate + 14 days = Dec 15, 2024
    const expectedEndDate = new Date(
      refreshDate.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
    expect(result).toEqual(expectedEndDate);
  });

  it("should return createdAt + 14 days when no freeTrialRefreshDate", () => {
    const createdDate = new Date("2024-01-01");
    const expectedEndDate = new Date(
      createdDate.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
    const company: CompanyDetails = {
      createdAt: createdDate,
    };

    const result = getTrialEndDate(company);
    expect(result).toEqual(expectedEndDate);
  });

  it("should return null when both dates are missing", () => {
    const company: CompanyDetails = {};
    expect(getTrialEndDate(company)).toBeNull();
  });
});

describe("getTrialDaysRemaining", () => {
  it("should return 0 for null company", () => {
    expect(getTrialDaysRemaining(null)).toBe(0);
  });

  it("should return 0 when no date info available", () => {
    const company: CompanyDetails = {};
    expect(getTrialDaysRemaining(company)).toBe(0);
  });

  it("should return positive days for future end date", () => {
    // freeTrialRefreshDate represents when trial started, end date = refresh date + 14 days
    // To get 5 days remaining, set refresh date to 9 days ago (14 - 9 = 5)
    const refreshDate = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000); // 9 days ago
    const company: CompanyDetails = {
      freeTrialRefreshDate: refreshDate,
    };

    const result = getTrialDaysRemaining(company);
    expect(result).toBe(5);
  });

  it("should return negative days for past end date", () => {
    // freeTrialRefreshDate of 17 days ago means trial ended 3 days ago (17 - 14 = 3)
    const pastDate = new Date(Date.now() - 17 * 24 * 60 * 60 * 1000); // 17 days ago
    const company: CompanyDetails = {
      freeTrialRefreshDate: pastDate,
    };

    const result = getTrialDaysRemaining(company);
    expect(result).toBeLessThanOrEqual(-2); // Could be -2 or -3 depending on time of day
  });
});

describe("getUserState", () => {
  describe("free trial states", () => {
    it("should return TRIAL_ACTIVE for active trial with days remaining", () => {
      const company: CompanyDetails = {
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago = 9 days remaining
        freeTrialActive: true,
      };

      expect(getUserState(company, true)).toBe("TRIAL_ACTIVE");
    });

    it("should return TRIAL_EXPIRING for trial with 1-3 days remaining", () => {
      const company: CompanyDetails = {
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago = 2 days remaining
        freeTrialActive: true,
      };

      expect(getUserState(company, true)).toBe("TRIAL_EXPIRING");
    });

    it("should return TRIAL_EXPIRED for trial with 0 or negative days remaining and freeTrialActive false", () => {
      const company: CompanyDetails = {
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago = -6 days remaining
        freeTrialActive: false,
      };

      expect(getUserState(company, true)).toBe("TRIAL_EXPIRED");
    });

    it("should return TRIAL_ACTIVE when freeTrialActive is true but date info is missing", () => {
      const company: CompanyDetails = {
        freeTrialActive: true,
        // No createdAt or freeTrialRefreshDate
      };

      // This is the key bug fix test - without the fix, this would return TRIAL_EXPIRED
      expect(getUserState(company, true)).toBe("TRIAL_ACTIVE");
    });

    it("should return TRIAL_EXPIRED when date info is missing and freeTrialActive is false", () => {
      const company: CompanyDetails = {
        freeTrialActive: false,
        // No createdAt or freeTrialRefreshDate
      };

      expect(getUserState(company, true)).toBe("TRIAL_EXPIRED");
    });

    it("should return TRIAL_EXPIRED when date info is missing and freeTrialActive is undefined", () => {
      const company: CompanyDetails = {
        // No createdAt, freeTrialRefreshDate, or freeTrialActive
      };

      expect(getUserState(company, true)).toBe("TRIAL_EXPIRED");
    });
  });

  describe("paid account states", () => {
    it("should return PAID_ACTIVE for paid account without cancellation", () => {
      const company: CompanyDetails = {
        paidAccount: true,
        subscriptionCanceled: false,
      };

      expect(getUserState(company, false)).toBe("PAID_ACTIVE");
    });

    it("should return CANCELED_ACTIVE for canceled but still paid account", () => {
      const company: CompanyDetails = {
        paidAccount: true,
        subscriptionCanceled: true,
      };

      expect(getUserState(company, false)).toBe("CANCELED_ACTIVE");
    });

    it("should return CANCELED_EXPIRED for canceled and no longer paid account", () => {
      const company: CompanyDetails = {
        paidAccount: false,
        subscriptionCanceled: true,
      };

      expect(getUserState(company, false)).toBe("CANCELED_EXPIRED");
    });
  });

  describe("fallback behavior", () => {
    it("should return TRIAL_EXPIRED as fallback for non-trial, non-paid user", () => {
      const company: CompanyDetails = {
        paidAccount: false,
        subscriptionCanceled: false,
      };

      expect(getUserState(company, false)).toBe("TRIAL_EXPIRED");
    });

    it("should return TRIAL_ACTIVE in fallback when isFreeTrial is false but freeTrialActive is true", () => {
      // This is the critical bug fix test: when tier determination returns
      // a non-FREE_TRIAL tier (isFreeTrial=false), but the backend says
      // freeTrialActive=true, we should still show active trial
      const company: CompanyDetails = {
        freeTrialActive: true,
        paidAccount: false,
        subscriptionCanceled: false,
      };

      // isFreeTrial is FALSE (simulating tier mismatch), but freeTrialActive is TRUE
      expect(getUserState(company, false)).toBe("TRIAL_ACTIVE");
    });

    it("should handle null company gracefully", () => {
      expect(getUserState(null, false)).toBe("TRIAL_EXPIRED");
    });

    it("should handle undefined company gracefully", () => {
      expect(getUserState(undefined, false)).toBe("TRIAL_EXPIRED");
    });
  });
});
