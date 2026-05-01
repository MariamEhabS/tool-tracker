import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  createCheckoutSession,
  fetchSingleStripeProduct,
  type StripeProduct,
} from "@/api/endpoints/stripe";
import { logApiError } from "@/utils/rollbar";
import type { RootState } from "@/store";

export const Route = createLazyFileRoute("/checkout")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const companyId = useSelector((state: RootState) => state.company?._id);
  const search = Route.useSearch() as {
    productId?: string;
    priceId?: string;
    checkout?: string;
  };

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<StripeProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

  // Show checkout success/cancel messages
  useEffect(() => {
    if (search.checkout === "success") {
      toast.success("Payment successful! Your subscription is now active.");
      // Remove the query param to avoid showing the message again
      navigate({
        to: "/checkout",
        search: { productId: search.productId, priceId: search.priceId },
        replace: true,
      });
    } else if (search.checkout === "cancel") {
      toast.error("Payment cancelled. You can try again when you're ready.");
      // Remove the query param
      navigate({
        to: "/checkout",
        search: { productId: search.productId, priceId: search.priceId },
        replace: true,
      });
    }
  }, [search.checkout, search.productId, search.priceId, navigate]);

  // Fetch product details if productId is provided
  useEffect(() => {
    if (search.productId) {
      setLoadingProduct(true);
      fetchSingleStripeProduct(search.productId)
        .then((products) => {
          if (products && products.length > 0) {
            setProduct(products[0]);
          } else {
            setError("Product not found");
          }
        })
        .catch((err) => {
          logApiError(err, "checkout-fetch-product-failed", {
            productId: search.productId,
          });
          if (import.meta.env.DEV) {
            console.error("Failed to fetch product:", err);
          }
          setError("Failed to load product details");
        })
        .finally(() => {
          setLoadingProduct(false);
        });
    } else {
      // No product ID provided - use default
      setProduct({
        id: "prod_default",
        name: "Pro Plan",
        description:
          "Unlimited QR Codes, priority support, advanced analytics.",
        default_price_data: {
          unit_amount: 2900,
          currency: "USD",
          recurring: {
            interval: "month",
          },
        },
      });
      setLoadingProduct(false);
    }
  }, [search.productId]);

  const handleCheckout = async () => {
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Get the price ID
    let priceId = search.priceId;
    if (!priceId && product) {
      // Try to get price ID from product
      if (typeof product.default_price === "string") {
        priceId = product.default_price;
      } else if (
        typeof product.default_price === "object" &&
        product.default_price?.id
      ) {
        priceId = product.default_price.id;
      } else if (product.prices && product.prices.length > 0) {
        priceId = product.prices[0].id;
      }
    }

    if (!priceId) {
      toast.error("No price information available. Please contact support.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const base = window.location.origin;
      const res = await createCheckoutSession({
        priceId,
        successUrl: `${base}/checkout?productId=${product?.id || ""}&priceId=${priceId}&checkout=success`,
        cancelUrl: `${base}/checkout?productId=${product?.id || ""}&priceId=${priceId}&checkout=cancel`,
        companyId,
      });

      if (res?.url) {
        // Redirect to Stripe Checkout
        window.location.href = res.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      logApiError(err, "checkout-session-failed", {
        priceId,
        productId: product?.id,
      });
      if (import.meta.env.DEV) {
        console.error("Checkout failed:", err);
      }
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to start checkout";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (cents: number | null | undefined, currency = "USD") => {
    if (cents == null) return "–";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  // Get product details for display
  const defaultPrice =
    (typeof product?.default_price === "object"
      ? product?.default_price
      : undefined) || product?.prices?.[0];
  const priceAmount =
    product?.default_price_data?.unit_amount ?? defaultPrice?.unit_amount;
  const priceCurrency =
    product?.default_price_data?.currency ?? defaultPrice?.currency ?? "USD";
  const priceInterval =
    product?.default_price_data?.recurring?.interval ??
    defaultPrice?.recurring?.interval ??
    "month";

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center">
            <i className="bx bx-credit-card text-indigo-600 text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>
            <p className="text-sm text-gray-600">
              Secure payment powered by Stripe
            </p>
          </div>
        </div>

        {loadingProduct ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : error && !product ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <i className="bx bx-error-circle text-3xl text-red-600 mb-2"></i>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => navigate({ to: "/settings" })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
            >
              <i className="bx bx-left-arrow-alt" /> Back to Settings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white rounded-xl shadow p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  Contact information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-xs text-gray-600">
                    Full name
                    <input
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Email address
                    <input
                      type="email"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      placeholder="jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Payment
                  </h2>
                  <span className="text-xs text-gray-500">
                    Powered by Stripe
                  </span>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-4">
                  <p className="text-sm text-indigo-900 mb-1">
                    <i className="bx bx-lock-alt mr-1"></i>
                    Secure Checkout
                  </p>
                  <p className="text-xs text-indigo-700">
                    You'll be redirected to Stripe's secure checkout page to
                    complete your payment.
                  </p>
                </div>
                {error ? (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                    <i className="bx bx-error-circle mr-2"></i>
                    {error}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleCheckout}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bx bx-credit-card"></i>
                        Continue to Payment
                      </>
                    )}
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 active:scale-95"
                    onClick={() => navigate({ to: "/settings" })}
                  >
                    <i className="bx bx-left-arrow-alt" /> Cancel
                  </button>
                </div>
              </section>
            </div>

            <aside className="bg-white rounded-xl shadow p-6 sticky top-6 h-max">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Order summary
              </h2>
              <div className="flex items-start gap-3 mb-4">
                <div className="h-12 w-12 rounded-md bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center">
                  {product?.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <i className="bx bx-package text-indigo-600 text-xl" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-[22ch]">
                    {product?.name || "Loading..."}
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-2">
                    {product?.description || ""}
                  </div>
                </div>
              </div>
              <dl className="text-sm text-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <dt>Price</dt>
                  <dd className="font-medium">
                    {formatMoney(priceAmount, priceCurrency)} / {priceInterval}
                  </dd>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-semibold">
                    {formatMoney(priceAmount, priceCurrency)}
                  </dd>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Tax will be calculated at checkout
                </div>
              </dl>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
