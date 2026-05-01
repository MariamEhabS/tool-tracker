import { redirect } from "@tanstack/react-router";
import {
  parseSubscriptionIntent,
  toSubscriptionSearch,
} from "@/lib/subscriptionIntent";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import {
  CUSTOMER_VIEW_ACTOR_KEY,
  CUSTOMER_VIEW_SESSION_KEY,
} from "@/lib/devOverride/impersonationStorage";

const PUBLIC_PATHS = [
  "/",
  "/signup",
  "/scannedQR",
  "/forgot-password",
  "/procore/oauth-success",
  "/procore/oauth-error",
  "/procore/select-company",
];

const clearAuthStorage = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("company");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem(CUSTOMER_VIEW_SESSION_KEY);
  localStorage.removeItem(CUSTOMER_VIEW_ACTOR_KEY);
};

const isValidUserObject = (user: unknown): boolean => {
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return false;
  }
  const userObj = user as Record<string, unknown>;
  return Boolean(userObj._id);
};

export const requireAuth = {
  beforeLoad: async ({
    location,
  }: {
    location: { pathname: string; search?: unknown };
  }) => {
    if (STATIC_APP_MODE) {
      return;
    }

    const user = localStorage.getItem("user");
    const accessToken =
      localStorage.getItem("accessToken") || localStorage.getItem("token"); // Check both old and new token keys

    const isInvalidUser = !user || user === "undefined" || user === "null";

    if (isInvalidUser) {
      clearAuthStorage();
    }

    let parsedUser = null;
    if (!isInvalidUser) {
      try {
        const parsed = JSON.parse(user);
        if (isValidUserObject(parsed)) {
          parsedUser = parsed;
        } else {
          // User is malformed (empty object, array, missing _id)
          clearAuthStorage();
        }
      } catch {
        // Malformed JSON - clear storage
        clearAuthStorage();
      }
    }

    if (
      !PUBLIC_PATHS.includes(location.pathname) &&
      !location.pathname.includes("/tools") &&
      !location.pathname.startsWith("/nfc/") &&
      !location.pathname.startsWith("/verify-email/") &&
      !location.pathname.startsWith("/ball-in-court/") &&
      !location.pathname.startsWith("/task-signoff/") &&
      (!parsedUser || !accessToken)
    ) {
      const subscriptionIntent = parseSubscriptionIntent(
        location.search as
          | string
          | URLSearchParams
          | { task?: unknown; plan?: unknown }
          | null
          | undefined,
      );
      throw redirect({
        to: "/",
        ...(subscriptionIntent
          ? { search: toSubscriptionSearch(subscriptionIntent) }
          : {}),
      });
    }
  },
};
