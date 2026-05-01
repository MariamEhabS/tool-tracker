import { createLazyFileRoute, useLocation } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { SettingsSection } from "@/settings-page/components/SettingsSection";
import { UserProfile } from "@/settings-page/components/UserProfile";
import { Security } from "@/settings-page/components/Security";
import {
  Subscription,
  PlanSelectionModal,
  StorageAddOnModal,
} from "@/settings-page/components/Subscription";
import { CompanyInfo } from "@/settings-page/components/CompanyInfo";
import { PrintBrandingLogo } from "@/settings-page/components/PrintBrandingLogo";
import { UserTable } from "@/settings-page/components/UserManagement/UserTable";
import { InviteUserForm } from "@/settings-page/components/UserManagement/InviteUserForm";
import { AdminTransfer } from "@/settings-page/components/UserManagement/AdminTransfer";
import QRDesignStudio from "@/settings-page/components/QRDesignStudio";
import { ProcoreCard } from "@/settings-page/components/IntegrationDashboard";
import { Categories } from "@/settings-page/components/Categories";
import { UnsavedChangesModal } from "@/settings-page/components/UnsavedChangesModal";
import { useUnsavedChangesGuard } from "@/settings-page/hooks/useUnsavedChanges";
import {
  SettingsSectionProvider,
  useSettingsSections,
} from "@/settings-page/context/SettingsSectionContext";
import { isValidSettingsSectionId } from "@/settings-page/utils/navigateToSection";

import { useCompany } from "@/api/endpoints/company";
import { useTier, useStorageLimits } from "@/lib/tiers";
import { usePermissionsWithOverride } from "@/utils/permissions";
import {
  createBillingPortalSession,
  createCheckoutSession,
  verifyCheckoutSession,
} from "@/api/endpoints/stripe";
import { axiosInstance } from "@/api";
import { useDispatch } from "react-redux";
import { updateCompany } from "@/store/slices/companySlice";
import { companyKeys } from "@/api/endpoints/company";
import procoreIcon from "@/assets/images/procore-icon.png";
import { logApiError } from "@/utils/rollbar";
import { getStripePriceIdForPlan } from "@/lib/subscriptionIntent";

// Lazy-loaded components for sections that are less frequently accessed
// TODO: Add Activity Log back in after V3 Release
// const ActivityLog = lazy(() => import("@/settings-page/components/ActivityLog"));
// TODO: Add Notification Preferences back in after V3 Release
// const NotificationPreferences = lazy(
//   () => import("@/settings-page/components/NotificationPreferences"),
// );

const StorageStats = lazy(
  () => import("@/settings-page/components/StorageMetrics/StorageStats"),
);
const StorageDonutChart = lazy(
  () => import("@/settings-page/components/StorageMetrics/StorageDonutChart"),
);
const StorageTrendChart = lazy(
  () => import("@/settings-page/components/StorageMetrics/StorageTrendChart"),
);

type StoredUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyId?: string;
  permission?: "admin" | "pm" | "user";
};

function getUserFromLocalStorage(): StoredUser | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export const Route = createLazyFileRoute("/settings")({
  component: SettingsPageWrapper,
});

// Wrapper component to provide context
function SettingsPageWrapper() {
  return (
    <ErrorBoundary>
      <SettingsSectionProvider>
        <SettingsPage />
      </SettingsSectionProvider>
    </ErrorBoundary>
  );
}

function SettingsPage() {
  const user = getUserFromLocalStorage();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const location = useLocation();
  const { data: companyDetails } = useCompany(user?.companyId || "");
  const { config: tierConfig, isFreeTrial } = useTier();
  const storageLimits = useStorageLimits();
  const permissions = usePermissionsWithOverride(user);
  const { expandAndScrollTo } = useSettingsSections();

  // Unsaved changes guard
  const { isBlocked, unsavedSections, confirmAndProceed, cancelNavigation } =
    useUnsavedChangesGuard();

  // Billing loading states
  const [startingSubscription, setStartingSubscription] = useState(false);

  // Subscription modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Admin transfer modal state (exception: kept as modal for safety)
  const [showAdminTransferModal, setShowAdminTransferModal] = useState(false);

  // Track current email in state to allow immediate UI updates after email change
  const [currentEmail, setCurrentEmail] = useState(user?.email || "");

  // Track if subscription verification has been attempted
  const subscriptionVerifiedRef = useRef(false);

  // Handle subscription success redirect - verify checkout and update company
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionStatus = urlParams.get("subscription");
    const sessionId = urlParams.get("session_id");

    // Only process once per session
    if (subscriptionVerifiedRef.current) return;

    if (subscriptionStatus === "success" && sessionId) {
      subscriptionVerifiedRef.current = true;

      // Verify the checkout session and update company
      verifyCheckoutSession(sessionId)
        .then(async (result) => {
          if (result.success) {
            toast.success("Subscription activated successfully!");
            // Invalidate company queries to refresh data
            queryClient.invalidateQueries({ queryKey: companyKeys.all });

            // Fetch fresh company data from API to ensure we have the latest
            try {
              const companyId = result.companyId || user?.companyId;
              if (companyId) {
                const res = await axiosInstance.get(`/company/${companyId}`);
                const freshCompanyData = res.data?.data ?? res.data;

                if (freshCompanyData) {
                  // Update Redux state
                  dispatch(updateCompany(freshCompanyData));
                  // Update localStorage for persistence across refreshes
                  localStorage.setItem(
                    "company",
                    JSON.stringify(freshCompanyData),
                  );
                }
              }
            } catch (fetchError) {
              logApiError(fetchError, "fetch-company-after-checkout");
              // Fallback: update with verification result data if companyDetails available
              if (companyDetails) {
                const updatedCompany = {
                  ...companyDetails,
                  paidAccount: true,
                  freeTrialActive: false,
                  stripeCustomerID: result.customerId,
                  stripeSubscriptionID: result.subscriptionId,
                  stripeProductID: result.productId,
                  stripePriceID: result.priceId,
                  stripeSubscriptionStatus: "active",
                };
                dispatch(updateCompany(updatedCompany));
                localStorage.setItem("company", JSON.stringify(updatedCompany));
              }
            }
          }
        })
        .catch((error) => {
          logApiError(error, "verify-checkout-failed");
        })
        .finally(() => {
          // Clean up URL parameters
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("subscription");
          newUrl.searchParams.delete("session_id");
          window.history.replaceState({}, "", newUrl.toString());
        });
    } else if (subscriptionStatus === "success" && !sessionId) {
      // Legacy flow without session ID - just show success message
      toast.success("Subscription checkout completed!");
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription");
      window.history.replaceState({}, "", newUrl.toString());
    } else if (subscriptionStatus === "canceled") {
      toast.error("Subscription checkout was canceled.");
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [queryClient, dispatch, companyDetails, user?.companyId]);

  // Track if initial hash navigation has been processed
  const initialLoadCompleteRef = useRef(false);
  // Track the last hash we scrolled to, to prevent rapid duplicate scrolls
  const lastScrolledHashRef = useRef<string | null>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Get the current hash from the URL.
   * TanStack Router may not populate location.hash, so we use window.location as primary source.
   */
  const getCurrentHash = useCallback((): string => {
    // Primary: window.location.hash (always available)
    const windowHash = window.location.hash.replace("#", "");
    if (windowHash) return windowHash;

    // Fallback: TanStack Router location (may not include hash)
    const routerHash = location.hash?.replace("#", "");
    if (routerHash) return routerHash;

    return "";
  }, [location.hash]);

  /**
   * Handle hash-based navigation to expand and scroll to a section.
   * Uses debouncing to prevent rapid duplicate scrolls while still allowing
   * intentional re-navigation to the same section.
   */
  const handleHashNavigation = useCallback(
    (hash: string, isInitialLoad = false) => {
      if (!hash || !isValidSettingsSectionId(hash)) return;

      // Clear any pending scroll
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
        scrollDebounceRef.current = null;
      }

      // For initial load, mark as complete
      if (isInitialLoad) {
        initialLoadCompleteRef.current = true;
      }

      // Debounce rapid duplicate scrolls (within 100ms) but allow intentional re-clicks
      if (lastScrolledHashRef.current === hash) {
        scrollDebounceRef.current = setTimeout(() => {
          lastScrolledHashRef.current = null;
        }, 100);
        // Still scroll - user may have scrolled away and wants to return
      }

      lastScrolledHashRef.current = hash;
      expandAndScrollTo(hash);
    },
    [expandAndScrollTo],
  );

  // Handle initial page load with hash (runs once after mount)
  useEffect(() => {
    // Only run once on initial mount
    if (initialLoadCompleteRef.current) return;

    // Small delay to ensure all SettingsSection components have mounted and registered their refs
    const timeoutId = setTimeout(() => {
      // Double-check we haven't already processed (in case of fast re-render)
      if (initialLoadCompleteRef.current) return;

      const hash = getCurrentHash();
      if (hash) {
        handleHashNavigation(hash, true);
      } else {
        // Mark complete even without hash to prevent future processing
        initialLoadCompleteRef.current = true;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
    // Only depend on stable refs - this should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for hashchange events (for in-page navigation and browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = getCurrentHash();
      if (hash) {
        handleHashNavigation(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [getCurrentHash, handleHashNavigation]);

  // React to TanStack Router location hash changes (for programmatic navigation via router)
  useEffect(() => {
    // Skip on initial load (handled by the mount effect above)
    if (!initialLoadCompleteRef.current) return;

    const hash = getCurrentHash();
    if (hash) {
      handleHashNavigation(hash);
    }
  }, [location.hash, getCurrentHash, handleHashNavigation]);

  // Handle opening plan selection modal for trial users
  const handleSubscribe = () => {
    setShowPlanModal(true);
  };

  // Handle opening storage add-on modal
  const handleOpenStorageModal = () => {
    setShowStorageModal(true);
  };

  // Handle manage subscription for existing paid customers (billing portal)
  const handleManageSubscription = async () => {
    try {
      setStartingSubscription(true);
      const base = window.location.origin;

      // Use the company's Stripe customer ID (not user ID)
      const stripeCustomerId = companyDetails?.stripeCustomerID;
      if (!stripeCustomerId) {
        toast.error(
          "Unable to find your billing account. Please contact support if this issue persists.",
        );
        return;
      }

      const res = await createBillingPortalSession({
        customer: stripeCustomerId,
        return_url: `${base}/settings`,
      });

      if (res?.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };
      const status = err?.response?.status;
      if (!status || status >= 500) {
        logApiError(e, "settings-manage-subscription-failed", {
          companyId: user?.companyId,
        });
      }
      const errorMessage = err?.response?.data?.message || err?.message || "";

      // Provide more helpful error messages for common Stripe errors
      if (errorMessage.includes("No such customer")) {
        toast.error(
          "Your billing account could not be found. Please contact support.",
        );
      } else {
        toast.error(
          errorMessage ||
            "Failed to start subscription checkout. Please try again.",
        );
      }
    } finally {
      setStartingSubscription(false);
    }
  };

  // Unified upgrade handler: routes to checkout (new customers) or billing portal (existing customers)
  // For new customers, directly redirects to Stripe checkout for Business plan
  const handleUpgrade = async () => {
    // If user already has a Stripe customer ID (paid subscriber), open the billing portal
    if (companyDetails?.stripeCustomerID) {
      handleManageSubscription();
      return;
    }

    // For free trial users, directly initiate Stripe checkout for Business plan
    try {
      setStartingSubscription(true);
      const base = window.location.origin;

      // Business plan monthly price ID
      const businessPriceId = getStripePriceIdForPlan("business", "monthly");

      const response = await createCheckoutSession({
        priceId: businessPriceId,
        successUrl: `${base}/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/settings?subscription=canceled`,
        companyId: user?.companyId,
      });

      if (response?.url) {
        window.location.href = response.url;
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };
      const status = err?.response?.status;
      if (!status || status >= 500) {
        logApiError(e, "settings-upgrade-checkout-failed", {
          companyId: user?.companyId,
        });
      }
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start checkout. Please try again.",
      );
    } finally {
      setStartingSubscription(false);
    }
  };

  const handleAdminTransferSuccess = () => {
    setShowAdminTransferModal(false);
    queryClient.invalidateQueries({ queryKey: ["companyUsers"] });
    // Reload to reflect new permissions
    setTimeout(() => window.location.reload(), 1500);
  };

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <i className="bx bx-cog text-blue-600" />
            <span>Settings</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your account and company settings.
          </p>
        </div>

        {/* User Settings - Available to all users */}
        <SettingsSection
          id="user-settings"
          title="User Settings"
          subtitle="Update your profile"
          icon={<i className="bx bx-user text-xl" />}
          accentColor="indigo"
        >
          <UserProfile />
        </SettingsSection>

        {/* Security - Available to all users */}
        <SettingsSection
          id="security"
          title="Security"
          subtitle="Password and email"
          icon={<i className="bx bx-lock-alt text-xl" />}
          accentColor="amber"
        >
          <Security
            userId={user?._id || ""}
            companyId={user?.companyId || ""}
            currentEmail={currentEmail}
            onEmailUpdate={setCurrentEmail}
          />
        </SettingsSection>

        {/* QR Code Design - Admin only */}
        {permissions.isAdmin && (
          <SettingsSection
            id="qr-design"
            title="QR Code Design"
            subtitle="Customize QR codes"
            icon={<i className="bx bx-qr text-xl" />}
            accentColor="rose"
          >
            <QRDesignStudio
              companyId={user?.companyId || ""}
              companyName={companyDetails?.companyName}
              companyUrl={companyDetails?.companyWebsite}
            />
          </SettingsSection>
        )}

        {/* Categories - Admin only */}
        {permissions.isAdmin && (
          <SettingsSection
            id="categories"
            title="Categories"
            subtitle="Organize QR code template names"
            icon={<i className="bx bx-folder text-xl" />}
            accentColor="indigo"
          >
            <Categories
              companyId={user?.companyId || ""}
              readOnly={!permissions.canManageCompany}
            />
          </SettingsSection>
        )}

        {/* Company Information - View-only for PM/user, editable for admin */}
        <SettingsSection
          id="company"
          title="Company Information"
          subtitle="Business details"
          icon={<i className="bx bx-buildings text-xl" />}
          accentColor="cyan"
        >
          <div className="space-y-6">
            <CompanyInfo readOnly={!permissions.canManageCompany} />
            {/* Divider */}
            <div className="border-t border-gray-200"></div>
            {/* Print Branding Logo - Independent subsection */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                Company Logos
              </h4>
              <PrintBrandingLogo readOnly={!permissions.canManageCompany} />
            </div>
          </div>
        </SettingsSection>

        {/* Team & Users - Admin only */}
        {permissions.isAdmin && (
          <SettingsSection
            id="users"
            title="Team & Users"
            subtitle="Manage team members"
            icon={<i className="bx bx-user-circle text-xl" />}
            accentColor="violet"
          >
            <div className="space-y-6">
              <InviteUserForm companyId={user?.companyId || ""} />
              <UserTable />
              {/* Admin Transfer Button */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminTransferModal(true)}
                  className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-2"
                >
                  <i className="bx bx-transfer" />
                  Transfer Admin Role to Another User
                </button>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Integrations - Admin only, tier-locked if not Business */}
        {permissions.isAdmin && (
          <SettingsSection
            id="integrations"
            title="Integrations"
            subtitle="Connect third-party services"
            icon={<img src={procoreIcon} alt="Procore" className="h-5 w-5" />}
            accentColor="orange"
            isLocked={!tierConfig.hasProcoreFullIntegration}
            requiredTier="Business"
            onUpgrade={handleUpgrade}
          >
            <ProcoreCard
              companyId={user?.companyId || ""}
              userId={user?._id}
              isAdmin={permissions.isAdmin}
              onUpgrade={handleUpgrade}
            />
          </SettingsSection>
        )}

        {/* Subscription - Admin only */}
        {permissions.isAdmin && (
          <SettingsSection
            id="subscription"
            title="Subscription"
            subtitle="Billing and plans"
            icon={<i className="bx bx-credit-card text-xl" />}
            accentColor="emerald"
          >
            <Subscription
              companyDetails={companyDetails}
              onSubscribe={handleSubscribe}
              onManageSubscription={handleManageSubscription}
              onManageStorage={handleOpenStorageModal}
              isSubscribeDisabled={startingSubscription}
              isManageSubscriptionDisabled={startingSubscription}
            />
          </SettingsSection>
        )}

        {/* Storage & Usage - Admin only */}
        {permissions.isAdmin && (
          <SettingsSection
            id="storage"
            title="Storage & Usage"
            subtitle="Monitor storage"
            icon={<i className="bx bx-folder-open text-xl" />}
            accentColor="teal"
          >
            <Suspense fallback={<LoadingFallback />}>
              <div className="space-y-6">
                <StorageStats />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex items-center justify-center">
                    <StorageDonutChart
                      documentUsedBytes={storageLimits.documentUsed}
                      qrUsedBytes={storageLimits.qrUsed}
                      isFreeTrial={isFreeTrial}
                    />
                  </div>
                  <StorageTrendChart
                    companyId={user?.companyId || ""}
                    isFreeTrial={isFreeTrial}
                  />
                </div>
                {/* Storage warning message */}
                {(storageLimits.isWarning ||
                  storageLimits.isCritical ||
                  storageLimits.isBlocked) && (
                  <div
                    className={`p-4 rounded-lg ${
                      storageLimits.isBlocked
                        ? "bg-red-50 border border-red-200"
                        : storageLimits.isCritical
                          ? "bg-red-50 border border-red-200"
                          : "bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        storageLimits.isBlocked || storageLimits.isCritical
                          ? "text-red-700"
                          : "text-amber-700"
                      }`}
                    >
                      <i className="bx bx-error-circle mr-1" />
                      {storageLimits.isBlocked
                        ? "Storage full. Delete files or upgrade to continue."
                        : storageLimits.isCritical
                          ? `Critical: Storage almost full (${storageLimits.percentageUsed.toFixed(0)}% used)`
                          : `Warning: Storage getting low (${storageLimits.percentageUsed.toFixed(0)}% used)`}
                    </p>
                  </div>
                )}
              </div>
            </Suspense>
          </SettingsSection>
        )}

        {/* Activity Log - Admin only */}
        {/* TODO: Add Activity Log back in after V3 Release */}
        {/* {permissions.isAdmin && (
          <SettingsSection
            id="activity"
            title="Activity Log"
            subtitle="Recent changes"
            icon={<i className="bx bx-time text-xl" />}
            accentColor="blue"
          >
            <Suspense fallback={<LoadingFallback />}>
              <ActivityLog companyId={user?.companyId || ""} />
            </Suspense>
          </SettingsSection>
        )} */}

        {/* Notification Preferences - Available to all users */}
        {/* TODO: Add Notification Preferences back in after V3 Release */}
        {/* <SettingsSection
          id="notifications"
          title="Notification Preferences"
          subtitle="Email settings"
          icon={<i className="bx bx-bell text-xl" />}
          accentColor="rose"
        >
          <Suspense fallback={<LoadingFallback />}>
            <NotificationPreferences
              userId={user?._id || ""}
              companyId={user?.companyId || ""}
            />
          </Suspense>
        </SettingsSection> */}

        {/* Admin Transfer Modal - Exception: kept as modal for safety */}
        <AdminTransfer
          open={showAdminTransferModal}
          onClose={() => setShowAdminTransferModal(false)}
          onSuccess={handleAdminTransferSuccess}
          currentUserId={user?._id || ""}
          companyId={user?.companyId || ""}
        />

        {/* Unsaved Changes Modal - Navigation blocker */}
        <UnsavedChangesModal
          open={isBlocked}
          sections={unsavedSections}
          onConfirm={confirmAndProceed}
          onCancel={cancelNavigation}
        />

        {/* Plan Selection Modal */}
        <PlanSelectionModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          currentTierId={tierConfig.id}
        />

        {/* Storage Add-On Modal */}
        <StorageAddOnModal
          open={showStorageModal}
          onClose={() => setShowStorageModal(false)}
          stripeCustomerId={companyDetails?.stripeCustomerID}
        />
      </div>
    </div>
  );
}

export default SettingsPage;
