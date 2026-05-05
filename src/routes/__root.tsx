import {
  createRootRoute,
  Outlet,
  useRouter,
  useRouterState,
  useNavigate,
  ErrorComponentProps,
} from "@tanstack/react-router";
import logo from "/images/white-taliho-logo.png";
import "@/index.css";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { logger } from "@/utils/logger";
import {
  rollbar,
  ErrorCategories,
  logApiError,
  logAuthError,
  logQRError,
} from "@/utils/rollbar";
import { AnimatePresence, motion } from "framer-motion";
import { axiosInstance } from "@/api";
import Sidebar from "@/components/layout/Sidebar";
import { requireAuth } from "@/middleware/auth/authMiddleware";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { setAuthenticated } from "@/store/slices/appSlice";
import { updateCompany } from "@/store/slices/companySlice";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { UploadQueueProvider } from "@/components/upload/UploadQueueProvider";
import GlobalUploadTray from "@/components/upload/GlobalUploadTray";
import { logout } from "@/api/endpoints/authentication";
import { GlobalJobTracker } from "@/components/global-job-tracker";
import { Toast } from "@/utils/toaster/toast";
import NotFoundPage from "@/components/ui/NotFoundPage";
import ErrorPage from "@/components/ui/ErrorPage";
import { parseHttpError } from "@/utils/httpErrors";
import { StorageWarningBanner } from "@/components/upgrade";
import { useStorageLimits, useTier } from "@/lib/tiers";
import { isAdminUser } from "@/lib/adminWhitelist";
import { DevOverrideProvider } from "@/lib/devOverride";
import { trackOnlinePresence } from "@/api/endpoints/admin-customers";
import { getAnonymousSessionId } from "@/utils/anonymous-session";
import {
  CustomerViewBanner,
  DevOverrideMenu,
  OverrideIndicator,
} from "@/components/ui/DevOverrideMenu";
import {
  CUSTOMER_VIEW_ACTOR_KEY,
  CUSTOMER_VIEW_SESSION_KEY,
  isCustomerViewActive,
} from "@/lib/devOverride/impersonationStorage";
import { getStoredUser } from "@/utils/getStoredUser";
import {
  createBillingPortalSession,
  manageCompanyStorage,
  verifyCheckoutSession,
} from "@/api/endpoints/stripe";
import { PlanSelectionModal } from "@/settings-page/components/Subscription";
import { STATIC_APP_LABEL, STATIC_APP_MODE } from "@/lib/staticAppMode";

function RootNotFoundComponent() {
  return <NotFoundPage />;
}

function RootErrorComponent(props: ErrorComponentProps) {
  const { error } = props;

  // Log to Rollbar on mount (skip 404s - expected navigation errors)
  useEffect(() => {
    const errorInfo = parseHttpError(error);
    if (errorInfo.statusCode !== 404) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.NAVIGATION,
        action: "route-error-root",
        metadata: {
          pathname: window.location.pathname,
          statusCode: errorInfo.statusCode,
        },
      });
    }
  }, [error]);

  return <ErrorPage {...props} />;
}

export const Route = createRootRoute({
  ...requireAuth,
  component: RootComponent,
  notFoundComponent: RootNotFoundComponent,
  errorComponent: RootErrorComponent,
});

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

function RootComponent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const routerState = useRouterState();
  const user = getStoredUser();
  const company = JSON.parse(localStorage.getItem("company") || "null");
  const navigate = useNavigate();
  const isAdmin = isAdminUser(user?.email);
  const hasCustomerViewSession = isCustomerViewActive();
  const isTalihoEmployee =
    user?.isTalihoEmployee === true || isAdmin || hasCustomerViewSession;

  // Mobile header profile menu state
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);
  const mobileProfileRef = useRef<HTMLDivElement | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [creatorCompany, setCreatorCompany] = useState("");
  const [hasCreatorInfo, setHasCreatorInfo] = useState<boolean>(false);

  // Tier and storage state
  const { config: tierConfig } = useTier();
  const storageLimits = useStorageLimits();
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);
  const [startingStorage, setStartingStorage] = useState(false);
  const [startingSubscription, setStartingSubscription] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // State to track company name for immediate header updates (when changed in settings)
  const [displayCompanyName, setDisplayCompanyName] = useState(
    user?.company || "New Company",
  );

  // Redux company state - check if initialized
  const reduxCompany = useSelector((state: RootState) => state.company);

  // Initialize company data in Redux if user is logged in but company data is missing
  useEffect(() => {
    const initializeCompanyData = async () => {
      // Check if user is logged in and has a companyId
      if (!user?.companyId) return;

      // Check if Redux company data is already initialized (has _id)
      if (reduxCompany?._id) return;

      // First, try to hydrate from localStorage (faster, no API call)
      if (company && company._id) {
        dispatch(updateCompany(company));
        return;
      }

      try {
        // Fetch company data from API
        const res = await axiosInstance.get(`/company/${user.companyId}`);
        const companyData = res.data?.data ?? res.data;

        if (companyData) {
          // Dispatch to Redux to initialize company state
          dispatch(updateCompany(companyData));

          // Also store to localStorage for persistence
          localStorage.setItem("company", JSON.stringify(companyData));
        }
      } catch (error) {
        logApiError(error, "initialize-company-failed", {
          companyId: user?.companyId,
        });
        logger.error("Failed to initialize company data:", error);
      }
    };

    initializeCompanyData();
  }, [user?.companyId, reduxCompany?._id, company, dispatch]);

  // Listen for company name updates from settings page (for immediate header update)
  useEffect(() => {
    const handleCompanyNameUpdate = (
      event: CustomEvent<{ companyName: string }>,
    ) => {
      setDisplayCompanyName(event.detail.companyName);
    };

    window.addEventListener(
      "companyNameUpdated",
      handleCompanyNameUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "companyNameUpdated",
        handleCompanyNameUpdate as EventListener,
      );
    };
  }, []);

  // Track if subscription verification has been attempted (to prevent duplicate calls)
  const subscriptionVerifiedRef = useRef(false);

  // Handle subscription success redirect - verify checkout and update company
  // This handles the case when user is redirected back after Stripe checkout
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
    }
  }, [dispatch, user?.companyId]);

  const getCreatorInfoFromStorage = (): {
    name: string;
    company: string;
  } | null => {
    try {
      const raw = localStorage.getItem("talihoCreatorInfo");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.name === "string" &&
        parsed.name &&
        typeof parsed.company === "string" &&
        parsed.company
      ) {
        return { name: parsed.name, company: parsed.company };
      }
      return null;
    } catch {
      return null;
    }
  };

  const openMobileProfileMenu = () => {
    const stored = getCreatorInfoFromStorage();
    if (stored) {
      setCreatorName(stored.name);
      setCreatorCompany(stored.company);
    } else {
      setCreatorName("");
      setCreatorCompany("");
    }
    setShowMobileProfileMenu((prev) => !prev);
  };

  useEffect(() => {
    if (!showMobileProfileMenu) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        mobileProfileRef.current &&
        target &&
        !mobileProfileRef.current.contains(target)
      ) {
        setShowMobileProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showMobileProfileMenu]);

  const openUserInfoFromHeader = () => {
    setShowMobileProfileMenu(false);
    window.dispatchEvent(new Event("taliho:openUserInfoModal"));
  };

  // React to creator info changes to immediately show/hide profile button
  useEffect(() => {
    const refresh = () => {
      const stored = getCreatorInfoFromStorage();
      setHasCreatorInfo(Boolean(stored));
      if (stored) {
        setCreatorName(stored.name);
        setCreatorCompany(stored.company);
      }
    };
    refresh();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "talihoCreatorInfo") {
        refresh();
      }
    };

    window.addEventListener(
      "taliho:creatorInfoUpdated",
      refresh as EventListener,
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        "taliho:creatorInfoUpdated",
        refresh as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Track which QR codes have already been counted in this session to prevent double-counting
  const countedQrCodesRef = useRef<Set<string>>(new Set());

  const countQrScan = useCallback(async (qrcodeId: string) => {
    // Skip if this QR code has already been counted in this session
    if (countedQrCodesRef.current.has(qrcodeId)) {
      return;
    }
    // Mark as counted before making the request to prevent race conditions
    countedQrCodesRef.current.add(qrcodeId);
    try {
      await axiosInstance.post(`/qr-code/scanned/${qrcodeId}`);
    } catch (error) {
      // If the request fails, remove from counted set so it can be retried
      countedQrCodesRef.current.delete(qrcodeId);
      logQRError(error, "qr-scan-count-failed", qrcodeId);
      logger.error("Failed to count QR scan:", error);
    }
  }, []);

  useEffect(() => {
    const { qrcodeId } = router.parseLocation().search;
    if (qrcodeId && typeof qrcodeId === "string") {
      void countQrScan(qrcodeId);
    }
  }, [router, countQrScan]);

  // Listen for creation-complete events to show toasts after data has loaded
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: string }>).detail;
      const kind = (detail?.kind || "").toString();
      if (kind === "inspection") {
        toast.success("Inspection created.");
      }
      if (kind === "punch-list") {
        toast.success("Punch list created.");
      }
      if (kind === "form") {
        toast.success("Form created.");
      }
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("created")) {
          url.searchParams.delete("created");
          window.history.replaceState(window.history.state, "", url.toString());
        }
      } catch (e) {
        logger.error("Failed to clean created param", e);
      }
    };
    window.addEventListener("taliho:created", handler as EventListener);
    return () =>
      window.removeEventListener("taliho:created", handler as EventListener);
  }, []);

  const currentPath = routerState.location.pathname;
  const isMobileFocusedRoute =
    currentPath === "/scannedQR" ||
    // Only the public per-tool item pages (/tools/:tool/:itemId) are
    // mobile-focused. The bare /tools listing is a desktop app page that
    // keeps the sidebar.
    currentPath.startsWith("/tools/") ||
    currentPath.startsWith("/nfc/") ||
    currentPath.startsWith("/ball-in-court/") ||
    currentPath.startsWith("/task-signoff/");

  useEffect(() => {
    const sendPresenceHeartbeat = () => {
      const userId =
        typeof user?._id === "string"
          ? user._id
          : typeof user?.userId === "string"
            ? user.userId
            : "";
      const shouldTrackPresence = Boolean(userId) || isMobileFocusedRoute;

      if (!shouldTrackPresence) {
        return;
      }

      const sessionId = userId
        ? `user:${userId}`
        : `anon:${getAnonymousSessionId()}`;

      void trackOnlinePresence({
        sessionId,
        routePath: currentPath,
        isMobileRoute: isMobileFocusedRoute,
      }).catch(() => {
        // Best-effort heartbeat; failures should not affect navigation UX.
      });
    };

    sendPresenceHeartbeat();
    const intervalId = window.setInterval(sendPresenceHeartbeat, 30_000);

    return () => window.clearInterval(intervalId);
  }, [currentPath, isMobileFocusedRoute, user?._id, user?.userId]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logAuthError(error, "logout-api-failed");
      logger.error("Logout API call failed:", error);
      // Continue with local logout even if API call fails
    }

    // Clear all authentication data
    localStorage.removeItem("user");
    localStorage.removeItem("company");
    localStorage.removeItem("token"); // Legacy token storage
    localStorage.removeItem("accessToken");
    localStorage.removeItem(CUSTOMER_VIEW_SESSION_KEY);
    localStorage.removeItem(CUSTOMER_VIEW_ACTOR_KEY);

    dispatch(setAuthenticated(false));

    // Force a full page reload to ensure auth state is properly reset
    window.location.href = "/";
  };

  const handleUpgradePlan = async () => {
    const stripeCustomerId = company?.stripeCustomerID;

    // For existing customers, open the billing portal
    if (stripeCustomerId) {
      try {
        setStartingSubscription(true);
        const base = window.location.origin;

        const res = await createBillingPortalSession({
          customer: stripeCustomerId,
          return_url: `${base}${currentPath}`,
        });

        if (res) {
          window.open(res.url, "_blank", "noopener,noreferrer");
        } else {
          toast.error("Unable to start checkout. Please try again.");
        }
      } catch (e: unknown) {
        logApiError(e, "upgrade-plan-billing-portal-failed", {
          hasExistingCustomer: true,
          currentPath,
        });
        logger.error("Error opening billing portal:", e);
        const err = e as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMessage = err?.response?.data?.message || err?.message || "";

        if (errorMessage.includes("No such customer")) {
          toast.error(
            "Your billing account could not be found. Please contact support.",
          );
        } else {
          toast.error("Failed to open billing portal.");
        }
      } finally {
        setStartingSubscription(false);
      }
      return;
    }

    // For free trial/new users, present plan selection first (same as Settings page)
    setShowPlanModal(true);
  };

  const handleAddStorage = async () => {
    try {
      setStartingStorage(true);
      const base = window.location.origin;
      // Use company's Stripe customer ID (not user ID)
      const stripeCustomerId = company?.stripeCustomerID;
      if (!stripeCustomerId) {
        toast.error(
          "Unable to find your billing account. Please subscribe to a plan first.",
        );
        setStartingStorage(false);
        return;
      }
      const res = await manageCompanyStorage({
        customer: stripeCustomerId,
        success_url: `${base}/storage/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}${currentPath}`,
      });

      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error("Unable to start storage checkout. Please try again.");
      }
    } catch (e: unknown) {
      logApiError(e, "add-storage-checkout-failed", { currentPath });
      logger.error("Error starting storage checkout:", e);
      toast.error("Failed to start storage checkout.");
    } finally {
      setStartingStorage(false);
    }
  };

  const handleDismissStorageWarning = () => {
    setStorageWarningDismissed(true);
    // Reset dismissal after 24 hours
    setTimeout(
      () => {
        setStorageWarningDismissed(false);
      },
      24 * 60 * 60 * 1000,
    );
  };

  const shouldAllowDesktopScroll =
    currentPath === "/dashboard" ||
    currentPath.startsWith("/settings") ||
    currentPath.startsWith("/admin/") ||
    currentPath === "/create-qr";

  return (
    <DevOverrideProvider enabled={isTalihoEmployee}>
      <UploadQueueProvider>
        <CustomerViewBanner />
        {isMobileFocusedRoute ? (
          // Mobile Pages
          <div>
            <div className="flex p-2 bg-black px-4 py-4 gap-2 sticky -top-1 shadow-yellow-200 shadow-sm z-50">
              <div className="flex items-center justify-between w-full">
                <div>
                  <img src={logo} width={"150px"} alt="Taliho Logo" />
                </div>
                {hasCreatorInfo && (
                  <div ref={mobileProfileRef} className="relative">
                    <button
                      onClick={openMobileProfileMenu}
                      className="relative w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-sm active:scale-95"
                      title="Profile"
                    >
                      <i className="bx bx-user text-xl" />
                    </button>
                    <AnimatePresence>
                      {showMobileProfileMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50"
                        >
                          <button
                            onClick={openUserInfoFromHeader}
                            className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100"
                            title="Edit info"
                            aria-label="Edit info"
                          >
                            <i className="bx bx-edit text-lg text-gray-700" />
                          </button>
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <p className="text-xs text-gray-500">Name</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {creatorName || "—"}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Company
                            </p>
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {creatorCompany || "—"}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
            <Outlet />
          </div>
        ) : currentPath === "/" ||
          currentPath === "/signup" ||
          currentPath === "/forgot-password" ||
          currentPath.startsWith("/verify-email/") ||
          currentPath === "/procore/oauth-success" ||
          currentPath === "/procore/select-company" ? (
          // Signin and Signup Pages
          <Outlet />
        ) : (
          // Desktop Pages
          <div className="h-screen flex antialiased bg-gray-100 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="bg-white border-b border-gray-200 shadow-sm h-16 flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-lg font-semibold text-gray-800">
                        {displayCompanyName}
                      </h1>
                      {STATIC_APP_MODE && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                          {STATIC_APP_LABEL}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Menu as="div" className="relative inline-block text-left">
                      <MenuButton className="focus:outline-none">
                        <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-sm font-medium text-white ring-2 ring-white">
                          <span className="relative">{`${user?.firstName?.charAt(0).toUpperCase()}${user?.lastName?.charAt(0).toUpperCase() || "TH"}`}</span>
                          <OverrideIndicator />
                        </div>
                      </MenuButton>
                      <Transition
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <MenuItems className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-xl ring-1 ring-black/10 focus:outline-none divide-y divide-gray-100">
                          {/* User Info Section */}
                          <div className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {user?.email}
                            </p>
                          </div>

                          {/* Admin Section - Only for whitelisted emails */}
                          {isAdmin && (
                            <div className="py-1">
                              <div className="px-4 py-2">
                                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide flex items-center gap-1.5">
                                  <i className="bx bxs-crown text-sm" />
                                  Taliho Admin
                                </p>
                              </div>
                              <MenuItem>
                                {({ focus }) => (
                                  <button
                                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${
                                      focus
                                        ? "bg-brand-50 text-brand-700"
                                        : "text-gray-700"
                                    }`}
                                    onClick={() =>
                                      navigate({ to: "/admin/customers" })
                                    }
                                  >
                                    <i className="bx bx-buildings text-base" />
                                    <span>Customers</span>
                                  </button>
                                )}
                              </MenuItem>
                              <MenuItem>
                                {({ focus }) => (
                                  <button
                                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${
                                      focus
                                        ? "bg-brand-50 text-brand-700"
                                        : "text-gray-700"
                                    }`}
                                    onClick={() =>
                                      navigate({ to: "/admin/nfc" })
                                    }
                                  >
                                    <i className="bx bx-chip text-base" />
                                    <span>NFC Tags</span>
                                  </button>
                                )}
                              </MenuItem>
                            </div>
                          )}

                          {/* Dev Overrides Section - Only for Taliho employees */}
                          {isTalihoEmployee && <DevOverrideMenu />}

                          {/* Logout Section */}
                          <div className="py-1">
                            <MenuItem>
                              {({ focus }) => (
                                <button
                                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${
                                    focus ? "bg-gray-50" : ""
                                  } text-gray-700`}
                                  onClick={handleLogout}
                                >
                                  <i className="bx bx-log-out text-base" />
                                  <span>Logout</span>
                                </button>
                              )}
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>
                  </div>
                </div>
              </header>
              <main
                className={`flex flex-col flex-1 min-h-0 ${shouldAllowDesktopScroll ? "overflow-y-auto" : "overflow-y-hidden"} bg-gray-100`}
              >
                <Outlet />
              </main>
              {/* Storage Warning Banner */}
              {!storageWarningDismissed &&
                (storageLimits.isWarning || storageLimits.isCritical) && (
                  <StorageWarningBanner
                    onUpgrade={handleUpgradePlan}
                    onAddStorage={handleAddStorage}
                    onDismiss={handleDismissStorageWarning}
                    isUpgrading={startingSubscription}
                    isAddingStorage={startingStorage}
                  />
                )}
              <PlanSelectionModal
                open={showPlanModal}
                onClose={() => setShowPlanModal(false)}
                currentTierId={tierConfig.id}
              />
            </div>
          </div>
        )}
        <Suspense>
          <TanStackRouterDevtools />
        </Suspense>
        <GlobalUploadTray />
        <GlobalJobTracker />
        <Toast />
      </UploadQueueProvider>
    </DevOverrideProvider>
  );
}
