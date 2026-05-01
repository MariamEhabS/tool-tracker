import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createCheckoutSession } from "@/api/endpoints/stripe";
import { logApiError } from "@/utils/rollbar";
import {
  getStripePriceIdForPlan,
  parseSubscriptionIntent,
} from "@/lib/subscriptionIntent";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createFileRoute("/logged")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const completeRedirect = async () => {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(
          { type: "procore-auth-success" },
          window.location.origin,
        );
        window.close();
        return;
      }

      const subscriptionIntent = parseSubscriptionIntent(
        window.location.search,
      );
      if (!subscriptionIntent) {
        navigate({ to: "/dashboard" });
        return;
      }

      const priceId = getStripePriceIdForPlan(subscriptionIntent.plan);
      if (!priceId) {
        toast.error(
          "Subscription plan is not configured. Please contact support.",
        );
        navigate({ to: "/settings" });
        return;
      }

      try {
        setMessage("Redirecting to Stripe checkout...");

        const storedUser = getStoredUser();
        const companyId =
          typeof storedUser?.companyId === "string"
            ? storedUser.companyId
            : undefined;

        const base = window.location.origin;
        const response = await createCheckoutSession({
          priceId,
          successUrl: `${base}/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${base}/settings?subscription=canceled`,
          companyId,
        });

        if (response?.url) {
          window.location.href = response.url;
          return;
        }

        toast.error("Unable to start checkout. Please try again.");
        navigate({ to: "/settings" });
      } catch (error) {
        logApiError(error, "post-auth-subscription-checkout-failed", {
          plan: subscriptionIntent.plan,
          priceId,
        });
        toast.error("Failed to start checkout. Please try again.");
        navigate({ to: "/settings" });
      }
    };

    void completeRedirect();
  }, [navigate]);

  return <div>{message}</div>;
}
