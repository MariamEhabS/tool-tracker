import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../../api";
import { logApiError } from "@/utils/rollbar";

export type StorageCheckoutRequest = {
  customer?: string;
  priceId?: string;
  quantity?: number;
  success_url?: string;
  cancel_url?: string;
};

export type StorageCheckoutResponse = {
  url?: string;
  id?: string;
};

export type StripePrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: {
    interval: "day" | "week" | "month" | "year";
    interval_count?: number;
  };
};

export type StripeProduct = {
  id: string;
  name: string;
  description?: string | null;
  images?: string[];
  default_price?: string | StripePrice;
  prices?: StripePrice[];
  default_price_data?: {
    unit_amount: number | null;
    currency: string;
    recurring?: {
      interval: "day" | "week" | "month" | "year";
      interval_count?: number;
    };
  };
};

export type CreateCheckoutSessionRequest = {
  priceId: string;
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  /** Company ID to link Stripe customer with Taliho company */
  companyId?: string;
};

export type CreateCheckoutSessionResponse = {
  url: string;
};

export type CreateBillingPortalSessionRequest = {
  customer?: string;
  userId?: string;
  return_url?: string;
  success_url?: string;
  mode?: string;
};

export type CreateBillingPortalSessionResponse = {
  url: string;
};
export async function fetchStripeProducts(): Promise<StripeProduct[]> {
  try {
    const res = await axiosInstance.get("/stripe/products");
    return res.data?.data ?? res.data ?? [];
  } catch (error) {
    logApiError(error, "stripe-fetch-products");
    throw error;
  }
}

export async function fetchSingleStripeProduct(
  productId: string,
): Promise<StripeProduct[]> {
  try {
    const res = await axiosInstance.get(`/stripe/products/${productId}`);
    return res.data?.data ?? res.data ?? [];
  } catch (error) {
    logApiError(error, "stripe-fetch-single-product", { productId });
    throw error;
  }
}

export function useStripeProducts() {
  return useQuery({
    queryKey: ["stripe", "products"],
    queryFn: fetchStripeProducts,
  });
}

export async function createCheckoutSession(
  body: CreateCheckoutSessionRequest,
): Promise<CreateCheckoutSessionResponse> {
  try {
    const res = await axiosInstance.post("/stripe/checkout/sessions", body);
    return res.data;
  } catch (error) {
    logApiError(error, "stripe-checkout-failed", { priceId: body.priceId });
    throw error;
  }
}

export async function createBillingPortalSession(
  body: CreateBillingPortalSessionRequest,
): Promise<CreateBillingPortalSessionResponse> {
  try {
    const res = await axiosInstance.post(
      "/stripe/billing-portal/sessions",
      body,
    );
    return res.data;
  } catch (error) {
    logApiError(error, "stripe-portal-failed");
    throw error;
  }
}

export const manageCompanyStorage = async (
  payload: StorageCheckoutRequest,
): Promise<StorageCheckoutResponse> => {
  try {
    const { data } = await axiosInstance.post(
      `/stripe/checkout/storage-extension`,
      payload,
    );
    return data;
  } catch (error) {
    logApiError(error, "stripe-storage-extension-failed", {
      quantity: payload.quantity,
    });
    throw error;
  }
};

export type VerifyCheckoutResponse = {
  success: boolean;
  message: string;
  companyId?: string;
  customerId?: string;
  subscriptionId?: string;
  productId?: string;
  priceId?: string;
};

/**
 * Verify a completed checkout session and update the company.
 * This is a fallback for when webhooks don't work (e.g., local development).
 */
export async function verifyCheckoutSession(
  sessionId: string,
): Promise<VerifyCheckoutResponse> {
  try {
    const res = await axiosInstance.post("/stripe/checkout/verify", {
      sessionId,
    });
    return res.data;
  } catch (error) {
    logApiError(error, "stripe-verify-checkout-failed", { sessionId });
    throw error;
  }
}
