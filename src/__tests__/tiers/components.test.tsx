/**
 * Tests for tiering system React components
 * Tests StorageWarningBanner, StorageLimitModal, TrialBanner, and LockedFeatureCard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import StorageWarningBanner from "@/components/upgrade/StorageWarningBanner";
import StorageLimitModal from "@/components/upgrade/StorageLimitModal";
import TrialBanner from "@/components/upgrade/TrialBanner";
import LockedFeatureCard from "@/components/upgrade/LockedFeatureCard";
import {
  freeTrialCompany,
  standardCompany,
  warningStorageCompany,
  criticalStorageCompany,
  blockedStorageCompany,
  expiredTrialCompany,
  expiringTrialCompany,
  canceledActiveCompany,
  canceledExpiredCompany,
  freeTrialMissingDateCompany,
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

describe("StorageWarningBanner", () => {
  const mockOnUpgrade = vi.fn();
  const mockOnAddStorage = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering based on storage state", () => {
    it("should render warning banner at 80-89% usage", () => {
      render(
        <Provider store={createMockStore(warningStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(/You're approaching your storage limit/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Add Storage \(\+50GB\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Upgrade Plan/i)).toBeInTheDocument();
    });

    it("should render critical banner at 90-99% usage", () => {
      render(
        <Provider store={createMockStore(criticalStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(/You're almost out of storage/i),
      ).toBeInTheDocument();
    });

    it("should not render when storage is below warning threshold", () => {
      render(
        <Provider store={createMockStore(standardCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.queryByText(/storage limit/i)).not.toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call onUpgrade when Upgrade Plan button is clicked", () => {
      render(
        <Provider store={createMockStore(warningStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const upgradeButton = screen.getByText(/Upgrade Plan/i);
      fireEvent.click(upgradeButton);

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
    });

    it("should call onAddStorage when Add Storage button is clicked", () => {
      render(
        <Provider store={createMockStore(warningStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const addStorageButton = screen.getByText(/Add Storage \(\+50GB\)/i);
      fireEvent.click(addStorageButton);

      expect(mockOnAddStorage).toHaveBeenCalledTimes(1);
    });

    it("should call onDismiss when dismiss button is clicked", () => {
      render(
        <Provider store={createMockStore(warningStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const dismissButton = screen.getByLabelText(/Dismiss/i);
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("Visual styling", () => {
    it("should have warning styling (amber) for 80-89% usage", () => {
      const { container } = render(
        <Provider store={createMockStore(warningStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const banner = container.querySelector(".bg-amber-50");
      expect(banner).toBeInTheDocument();
    });

    it("should have critical styling (red) for 90-99% usage", () => {
      const { container } = render(
        <Provider store={createMockStore(criticalStorageCompany)}>
          <StorageWarningBanner
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const banner = container.querySelector(".bg-red-50");
      expect(banner).toBeInTheDocument();
    });
  });
});

describe("StorageLimitModal", () => {
  const mockOnClose = vi.fn();
  const mockOnUpgrade = vi.fn();
  const mockOnAddStorage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render modal when isOpen is true", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={true}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      expect(screen.getByText(/Storage Limit Reached/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /You've reached your storage limit. Upgrade your plan or add storage to continue uploading files./i,
        ),
      ).toBeInTheDocument();
    });

    it("should not render modal when isOpen is false", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={false}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      expect(
        screen.queryByText(/Storage Limit Reached/i),
      ).not.toBeInTheDocument();
    });

    it("should display current usage and capacity", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={true}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      expect(screen.getByText(/Current usage:/i)).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call onUpgrade when Upgrade Plan button is clicked", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={true}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      const upgradeButton = screen.getByText(/Upgrade Plan/i);
      fireEvent.click(upgradeButton);

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
    });

    it("should call onAddStorage when Add Storage button is clicked", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={true}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      const addStorageButton = screen.getByText(/Add Storage \(\+50GB\)/i);
      fireEvent.click(addStorageButton);

      expect(mockOnAddStorage).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Cancel button is clicked", () => {
      render(
        <Provider store={createMockStore(blockedStorageCompany)}>
          <StorageLimitModal
            isOpen={true}
            onClose={mockOnClose}
            onUpgrade={mockOnUpgrade}
            onAddStorage={mockOnAddStorage}
          />
        </Provider>,
      );

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe("TrialBanner", () => {
  const mockOnUpgrade = vi.fn();
  const mockOnResubscribe = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Rendering based on subscription state", () => {
    it("should render TRIAL_ACTIVE state for active free trial", () => {
      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(/You're on a free trial \(50 MB storage\)/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Upgrade Now/i }),
      ).toBeInTheDocument();
    });

    it("should render TRIAL_EXPIRING state for expiring trial", () => {
      render(
        <Provider store={createMockStore(expiringTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.getByText(/Your free trial ends in/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Upgrade Now/i }),
      ).toBeInTheDocument();
    });

    it("should render TRIAL_EXPIRED state for expired trial", () => {
      render(
        <Provider store={createMockStore(expiredTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(/Your free trial has expired/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Subscribe Now/i }),
      ).toBeInTheDocument();
    });

    it("should render CANCELED_ACTIVE state for canceled but active subscription", () => {
      render(
        <Provider store={createMockStore(canceledActiveCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(
          /Your subscription has been cancelled but remains active/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Resubscribe$/i }),
      ).toBeInTheDocument();
    });

    it("should render CANCELED_EXPIRED state for churned subscription", () => {
      render(
        <Provider store={createMockStore(canceledExpiredCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(
        screen.getByText(/Your subscription has ended/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Resubscribe Now/i }),
      ).toBeInTheDocument();
    });

    it("should not render for PAID_ACTIVE users", () => {
      render(
        <Provider store={createMockStore(standardCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.queryByText(/trial/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/subscription/i)).not.toBeInTheDocument();
    });

    it("should render TRIAL_ACTIVE state when freeTrialActive is true but date info is missing", () => {
      render(
        <Provider store={createMockStore(freeTrialMissingDateCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      // Should show active trial message, NOT expired
      expect(
        screen.getByText(/You're on a free trial \(50 MB storage\)/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Upgrade Now/i }),
      ).toBeInTheDocument();
      // Should NOT show expired message
      expect(
        screen.queryByText(/Your free trial has expired/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("Dismissal behavior", () => {
    it("should allow dismissal for TRIAL_ACTIVE state", () => {
      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const dismissButton = screen.getByLabelText(/Dismiss/i);
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it("should not show dismiss button for TRIAL_EXPIRED state", () => {
      render(
        <Provider store={createMockStore(expiredTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.queryByLabelText(/Dismiss/i)).not.toBeInTheDocument();
    });

    it("should not show dismiss button for CANCELED_EXPIRED state", () => {
      render(
        <Provider store={createMockStore(canceledExpiredCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.queryByLabelText(/Dismiss/i)).not.toBeInTheDocument();
    });

    it("should store dismissed state in localStorage", () => {
      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const dismissButton = screen.getByLabelText(/Dismiss/i);
      fireEvent.click(dismissButton);

      const dismissedData = localStorage.getItem("trial-banner-dismissed");
      expect(dismissedData).toBeTruthy();
      expect(JSON.parse(dismissedData!)).toHaveProperty("timestamp");
    });

    it("should not render when previously dismissed within 24 hours", () => {
      const recentTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
      localStorage.setItem(
        "trial-banner-dismissed",
        JSON.stringify({ timestamp: recentTimestamp }),
      );

      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    });

    it("should render when dismissal is older than 24 hours", () => {
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 25; // 25 hours ago
      localStorage.setItem(
        "trial-banner-dismissed",
        JSON.stringify({ timestamp: oldTimestamp }),
      );

      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      expect(screen.getByText(/free trial/i)).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call onUpgrade for trial users", () => {
      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const upgradeButton = screen.getByRole("button", {
        name: /Upgrade Now/i,
      });
      fireEvent.click(upgradeButton);

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
    });

    it("should call onResubscribe for canceled active users", () => {
      render(
        <Provider store={createMockStore(canceledActiveCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const resubscribeButton = screen.getByRole("button", {
        name: /^Resubscribe$/i,
      });
      fireEvent.click(resubscribeButton);

      expect(mockOnResubscribe).toHaveBeenCalledTimes(1);
    });

    it("should call onResubscribe for canceled expired users", () => {
      render(
        <Provider store={createMockStore(canceledExpiredCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
          />
        </Provider>,
      );

      const resubscribeButton = screen.getByRole("button", {
        name: /Resubscribe Now/i,
      });
      fireEvent.click(resubscribeButton);

      expect(mockOnResubscribe).toHaveBeenCalledTimes(1);
    });

    it("should show loading state when upgrading", () => {
      render(
        <Provider store={createMockStore(freeTrialCompany)}>
          <TrialBanner
            onUpgrade={mockOnUpgrade}
            onResubscribe={mockOnResubscribe}
            onDismiss={mockOnDismiss}
            isUpgrading={true}
          />
        </Provider>,
      );

      const openingButton = screen.getByRole("button", { name: /Opening.../i });
      expect(openingButton).toBeInTheDocument();
      expect(openingButton).toBeDisabled();
    });
  });
});

describe("LockedFeatureCard", () => {
  const mockOnUpgrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render with all required props", () => {
      render(
        <LockedFeatureCard
          title="Procore Integration"
          description="Connect your Procore account to sync projects and data"
          requiredTier="Business"
          onUpgrade={mockOnUpgrade}
        />,
      );

      expect(screen.getByText("Procore Integration")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Connect your Procore account to sync projects and data",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Available on Business plan/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Upgrade Now/i)).toBeInTheDocument();
    });

    it("should display lock icon", () => {
      const { container } = render(
        <LockedFeatureCard
          title="Procore Integration"
          description="Test description"
          requiredTier="Business"
          onUpgrade={mockOnUpgrade}
        />,
      );

      const lockIcon = container.querySelector(".bx-lock-alt");
      expect(lockIcon).toBeInTheDocument();
    });

    it("should have appropriate styling (gray/muted)", () => {
      const { container } = render(
        <LockedFeatureCard
          title="Procore Integration"
          description="Test description"
          requiredTier="Business"
          onUpgrade={mockOnUpgrade}
        />,
      );

      const card = container.querySelector(".bg-gray-50");
      expect(card).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call onUpgrade when Upgrade Now button is clicked", () => {
      render(
        <LockedFeatureCard
          title="Procore Integration"
          description="Test description"
          requiredTier="Business"
          onUpgrade={mockOnUpgrade}
        />,
      );

      const upgradeButton = screen.getByText(/Upgrade Now/i);
      fireEvent.click(upgradeButton);

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe("Different required tiers", () => {
    it("should display Professional tier requirement", () => {
      render(
        <LockedFeatureCard
          title="Unlimited QR Codes"
          description="Create unlimited QR codes at once"
          requiredTier="Professional"
          onUpgrade={mockOnUpgrade}
        />,
      );

      expect(
        screen.getByText(/Available on Professional plan/i),
      ).toBeInTheDocument();
    });

    it("should display Business tier requirement", () => {
      render(
        <LockedFeatureCard
          title="Procore Integration"
          description="Full Procore integration"
          requiredTier="Business"
          onUpgrade={mockOnUpgrade}
        />,
      );

      expect(
        screen.getByText(/Available on Business plan/i),
      ).toBeInTheDocument();
    });
  });
});
