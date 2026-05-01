import Modal from "../Modal";
import Button from "../../ui/Button";
import {
  useStripeProducts,
  StripeProduct,
  createCheckoutSession,
} from "../../../api/endpoints/stripe";
import { useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { handleModalError } from "@/utils/modalErrorHandler";
import type { RootState } from "@/store";

type Props = {
  open: boolean;
  onClose: () => void;
};

interface StripeError {
  type?: string;
  code?: string;
  message?: string;
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
}

/**
 * Helper function to get user-friendly error messages for Stripe errors
 */
function getStripeErrorMessage(error: StripeError): string {
  const errorType = error?.type || error?.error?.type;
  const errorCode = error?.code || error?.error?.code;
  const errorMessage = error?.message || error?.error?.message || "";

  // Handle Stripe-specific error codes
  switch (errorCode) {
    case "card_declined":
      return "Your card was declined. Please try a different payment method.";
    case "expired_card":
      return "Your card has expired. Please update your payment information.";
    case "insufficient_funds":
      return "Insufficient funds. Please try a different card.";
    case "incorrect_cvc":
      return "Incorrect CVC code. Please check your card details.";
    case "processing_error":
      return "Payment processing error. Please try again.";
    case "rate_limit":
      return "Too many requests. Please wait a moment and try again.";
  }

  // Handle Stripe error types
  switch (errorType) {
    case "card_error":
      return "Your payment method was declined. Please update your payment information.";
    case "invalid_request_error":
      return "Invalid subscription request. Please contact support.";
    case "rate_limit_error":
      return "Too many requests. Please wait a moment and try again.";
    case "authentication_error":
      return "Authentication failed. Please try logging in again.";
    case "api_error":
      return "Server error. Please try again later.";
  }

  // Handle network errors
  if (
    errorMessage.toLowerCase().includes("fetch") ||
    errorMessage.toLowerCase().includes("network")
  ) {
    return "Connection error. Please check your internet and try again.";
  }

  // Return original message or generic fallback
  return (
    errorMessage ||
    "An unexpected error occurred. Please try again or contact support."
  );
}

export default function ManageSubscriptionsModal({ open, onClose }: Props) {
  const companyId = useSelector((state: RootState) => state.company?._id);
  const { data, isLoading, error, refetch } = useStripeProducts();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Subscription"
      subtitle={
        <span className="inline-flex items-center gap-2 text-gray-600">
          <i className="bx bx-credit-card text-indigo-600"></i>Select a plan to
          continue to checkout.
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            leftIconClass="bx bx-refresh"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border rounded-xl p-4 bg-white shadow-sm animate-pulse"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-md bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 bg-gray-200 rounded" />
                  <div className="h-3 w-3/4 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-8 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <i className="bx bx-error-circle text-xl text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">
                Failed to load subscription plans. Please try refreshing or
                contact support if the problem persists.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <i className="bx bx-error-circle text-xl text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Checkout Failed
                  </p>
                  <p className="text-sm text-red-700 mt-1">{submitError}</p>
                </div>
                <button
                  onClick={() => setSubmitError(null)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  aria-label="Dismiss error"
                >
                  <i className="bx bx-x text-xl" />
                </button>
              </div>
            </div>
          )}
          {(data ?? []).slice(0, 3).map((prod: StripeProduct, idx: number) => {
            const defaultPrice =
              (typeof prod.default_price === "object"
                ? prod.default_price
                : undefined) || prod.prices?.[0];
            return (
              <div
                key={prod.id}
                className="relative group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-300"
              >
                {idx === 0 ? (
                  <span className="absolute -top-2 left-3 rounded-full bg-indigo-600/90 text-white text-[10px] px-2 py-0.5 shadow">
                    POPULAR
                  </span>
                ) : null}

                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center ring-1 ring-indigo-100">
                    {prod.images?.[0] ? (
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="h-6 w-6 object-contain"
                      />
                    ) : (
                      <i className="bx bx-package text-xl text-indigo-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate max-w-[24ch]">
                      {prod.name}
                    </div>
                    {prod.description ? (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {prod.description}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900">
                      {prod?.default_price_data?.unit_amount
                        ? `$${prod?.default_price_data?.unit_amount / 100}`
                        : defaultPrice?.unit_amount != null
                          ? `$${(defaultPrice.unit_amount / 100).toFixed(2)}`
                          : "–"}
                    </span>
                    {defaultPrice?.currency && (
                      <span className="text-[10px] font-medium text-gray-500 uppercase">
                        {defaultPrice.currency}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!defaultPrice?.id || submittingId === prod.id}
                    onClick={async () => {
                      if (!defaultPrice?.id) {
                        toast.error(
                          "Invalid product configuration. Please try another plan.",
                        );
                        return;
                      }
                      try {
                        setSubmitError(null);
                        setSubmittingId(prod.id);
                        toast.loading("Starting checkout session...", {
                          id: "checkout-loading",
                        });

                        const base = window.location.origin;
                        const res = await createCheckoutSession({
                          priceId: defaultPrice.id,
                          successUrl: `${base}/settings?checkout=success`,
                          cancelUrl: `${base}/settings?checkout=cancel`,
                          companyId,
                        });

                        toast.dismiss("checkout-loading");

                        if (res?.url) {
                          toast.success("Redirecting to checkout...");
                          onClose();
                          window.location.href = res.url;
                        } else {
                          const errorMsg =
                            "Unable to start checkout. Please try again.";
                          setSubmitError(errorMsg);
                          toast.error(errorMsg);
                        }
                      } catch (e: unknown) {
                        toast.dismiss("checkout-loading");

                        const err = e as {
                          response?: {
                            data?: { message?: string; error?: StripeError };
                          };
                          message?: string;
                          code?: string;
                          type?: string;
                        };

                        // Get user-friendly error message using Stripe-specific handling
                        const stripeError = err?.response?.data?.error || err;
                        const errorMessage = getStripeErrorMessage(stripeError);

                        // Log to Rollbar (for 5xx/network errors) with Stripe-specific message
                        handleModalError(e, {
                          action: "create-checkout-session-failed",
                          userMessage: errorMessage,
                        });
                        setSubmitError(errorMessage);
                      } finally {
                        setSubmittingId(null);
                      }
                    }}
                  >
                    {submittingId === prod.id ? "Redirecting…" : "Select"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
