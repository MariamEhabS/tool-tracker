// Dev-only auth bypass. Activated by VITE_DEV_BYPASS_AUTH=true in .env.
// Seeds localStorage with a fake user + token so the app renders past
// the login gate without a live backend. Backend calls will still fail
// (no server running); UI layout and components will render regardless.

// Bump this version string whenever the seeded-user shape changes; the
// bypass will overwrite any previously-seeded data to match the new shape.
const BYPASS_VERSION = "3";
const BYPASS_MARKER = "__talihoDevBypassSeeded";

export function applyDevAuthBypass(): void {
  if (import.meta.env.VITE_DEV_BYPASS_AUTH !== "true") return;
  if (!import.meta.env.DEV) return;

  if (localStorage.getItem(BYPASS_MARKER) === BYPASS_VERSION) return;

  const fakeUser = {
    _id: "dev-bypass-user-id",
    userId: "dev-bypass-user-id",
    firstName: "Dev",
    lastName: "User",
    email: "dev@taliho.local",
    company: "Dev Company",
    companyId: "dev-bypass-company-id",
    permission: "admin",
    isVerified: true,
    isTalihoEmployee: true,
    accessToken: "dev-bypass-access-token",
  };

  const fakeCompany = {
    _id: "dev-bypass-company-id",
    companyName: "Dev Company",
    procoreAccess: false,
    // Subscription fields — make the app think this company is on the Business
    // tier so the trial/expired banners stay hidden and feature gates unlock.
    // The product ID matches `VITE_STRIPE_PRODUCT_ID_BUSINESS` in .env so
    // `determineTier()` resolves to BUSINESS.
    paidAccount: true,
    freeTrialActive: false,
    subscriptionCanceled: false,
    stripeProductID: "dev-unlimited-product",
    stripeSubscriptionStatus: "active",
    stripeCustomerID: "cus_dev_bypass",
    stripeSubscriptionID: "sub_dev_bypass",
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem("user", JSON.stringify(fakeUser));
  localStorage.setItem("company", JSON.stringify(fakeCompany));
  localStorage.setItem("accessToken", "dev-bypass-access-token");
  localStorage.setItem(BYPASS_MARKER, BYPASS_VERSION);
}
