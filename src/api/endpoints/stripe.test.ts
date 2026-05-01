/**
 * Tests for Stripe API endpoints
 * Tests all Stripe-related API functions including product fetching,
 * checkout session creation, billing portal, storage management,
 * and checkout verification with rollbar error logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// Mock the axios instance
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../api", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  fetchStripeProducts,
  fetchSingleStripeProduct,
  useStripeProducts,
  createCheckoutSession,
  createBillingPortalSession,
  manageCompanyStorage,
  verifyCheckoutSession,
} from "./stripe";
import { logApiError } from "@/utils/rollbar";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("Stripe API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== fetchStripeProducts ====================

  describe("fetchStripeProducts", () => {
    it("should fetch and return products from data.data", async () => {
      const mockProducts = [
        { id: "prod_1", name: "Basic Plan" },
        { id: "prod_2", name: "Pro Plan" },
      ];
      mockGet.mockResolvedValue({ data: { data: mockProducts } });

      const result = await fetchStripeProducts();

      expect(mockGet).toHaveBeenCalledWith("/stripe/products");
      expect(result).toEqual(mockProducts);
    });

    it("should fall back to data when data.data is missing", async () => {
      const mockProducts = [{ id: "prod_1", name: "Basic Plan" }];
      mockGet.mockResolvedValue({ data: mockProducts });

      const result = await fetchStripeProducts();

      expect(result).toEqual(mockProducts);
    });

    it("should return empty array when data is nullish", async () => {
      mockGet.mockResolvedValue({ data: null });

      const result = await fetchStripeProducts();

      expect(result).toEqual([]);
    });

    it("should log error to rollbar and rethrow on failure", async () => {
      const error = new Error("Network Error");
      mockGet.mockRejectedValue(error);

      await expect(fetchStripeProducts()).rejects.toThrow("Network Error");

      expect(logApiError).toHaveBeenCalledWith(error, "stripe-fetch-products");
    });

    it("should wrap non-Error values before logging to rollbar", async () => {
      const error = "string error";
      mockGet.mockRejectedValue(error);

      await expect(fetchStripeProducts()).rejects.toBe(error);

      expect(logApiError).toHaveBeenCalledWith(error, "stripe-fetch-products");
    });
  });

  // ==================== fetchSingleStripeProduct ====================

  describe("fetchSingleStripeProduct", () => {
    it("should fetch a single product by ID", async () => {
      const mockProduct = [{ id: "prod_1", name: "Basic Plan" }];
      mockGet.mockResolvedValue({ data: { data: mockProduct } });

      const result = await fetchSingleStripeProduct("prod_1");

      expect(mockGet).toHaveBeenCalledWith("/stripe/products/prod_1");
      expect(result).toEqual(mockProduct);
    });

    it("should fall back to data when data.data is missing", async () => {
      const mockProduct = [{ id: "prod_1", name: "Basic Plan" }];
      mockGet.mockResolvedValue({ data: mockProduct });

      const result = await fetchSingleStripeProduct("prod_1");

      expect(result).toEqual(mockProduct);
    });

    it("should return empty array when data is nullish", async () => {
      mockGet.mockResolvedValue({ data: null });

      const result = await fetchSingleStripeProduct("prod_1");

      expect(result).toEqual([]);
    });

    it("should log error to rollbar with productId and rethrow on failure", async () => {
      const error = new Error("Not found");
      mockGet.mockRejectedValue(error);

      await expect(fetchSingleStripeProduct("prod_1")).rejects.toThrow(
        "Not found",
      );

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "stripe-fetch-single-product",
        { productId: "prod_1" },
      );
    });
  });

  // ==================== useStripeProducts ====================

  describe("useStripeProducts", () => {
    it("should fetch products using the hook", async () => {
      const mockProducts = [{ id: "prod_1", name: "Basic Plan" }];
      mockGet.mockResolvedValue({ data: { data: mockProducts } });

      const { result } = renderHook(() => useStripeProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGet).toHaveBeenCalledWith("/stripe/products");
      expect(result.current.data).toEqual(mockProducts);
    });

    it("should return error state on network failure", async () => {
      mockGet.mockRejectedValue(new Error("Network Error"));

      const { result } = renderHook(() => useStripeProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ==================== createCheckoutSession ====================

  describe("createCheckoutSession", () => {
    it("should create a checkout session with correct payload", async () => {
      const mockResponse = { url: "https://checkout.stripe.com/session-123" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        priceId: "price_123",
        successUrl: "https://app.taliho.com/success",
        cancelUrl: "https://app.taliho.com/cancel",
      };

      const result = await createCheckoutSession(body);

      expect(mockPost).toHaveBeenCalledWith("/stripe/checkout/sessions", body);
      expect(result).toEqual(mockResponse);
    });

    it("should include optional fields in payload", async () => {
      const mockResponse = { url: "https://checkout.stripe.com/session-456" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        priceId: "price_123",
        quantity: 3,
        successUrl: "https://app.taliho.com/success",
        cancelUrl: "https://app.taliho.com/cancel",
        customerId: "cus_123",
        companyId: "company-456",
      };

      await createCheckoutSession(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/stripe/checkout/sessions",
        expect.objectContaining({
          quantity: 3,
          customerId: "cus_123",
          companyId: "company-456",
        }),
      );
    });

    it("should log critical error to rollbar with priceId and rethrow", async () => {
      const error = new Error("Checkout failed");
      mockPost.mockRejectedValue(error);

      await expect(
        createCheckoutSession({
          priceId: "price_123",
          successUrl: "https://app.taliho.com/success",
          cancelUrl: "https://app.taliho.com/cancel",
        }),
      ).rejects.toThrow("Checkout failed");

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "stripe-checkout-failed",
        { priceId: "price_123" },
      );
    });

    it("should throw on 500 Server Error", async () => {
      const error = {
        response: { status: 500, data: { message: "Internal Server Error" } },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        createCheckoutSession({
          priceId: "price_123",
          successUrl: "https://app.taliho.com/success",
          cancelUrl: "https://app.taliho.com/cancel",
        }),
      ).rejects.toEqual(error);
    });
  });

  // ==================== createBillingPortalSession ====================

  describe("createBillingPortalSession", () => {
    it("should create a billing portal session with correct payload", async () => {
      const mockResponse = {
        url: "https://billing.stripe.com/portal-123",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        customer: "cus_123",
        return_url: "https://app.taliho.com/settings",
      };

      const result = await createBillingPortalSession(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/stripe/billing-portal/sessions",
        body,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should include optional userId and mode", async () => {
      const mockResponse = { url: "https://billing.stripe.com/portal-456" };
      mockPost.mockResolvedValue({ data: mockResponse });

      const body = {
        userId: "user-123",
        mode: "subscription",
        return_url: "https://app.taliho.com/settings",
      };

      await createBillingPortalSession(body);

      expect(mockPost).toHaveBeenCalledWith(
        "/stripe/billing-portal/sessions",
        expect.objectContaining({ userId: "user-123", mode: "subscription" }),
      );
    });

    it("should log error to rollbar and rethrow on failure", async () => {
      const error = new Error("Portal creation failed");
      mockPost.mockRejectedValue(error);

      await expect(
        createBillingPortalSession({ customer: "cus_123" }),
      ).rejects.toThrow("Portal creation failed");

      expect(logApiError).toHaveBeenCalledWith(error, "stripe-portal-failed");
    });
  });

  // ==================== manageCompanyStorage ====================

  describe("manageCompanyStorage", () => {
    it("should create storage extension checkout with correct payload", async () => {
      const mockResponse = {
        url: "https://checkout.stripe.com/storage-123",
        id: "cs_123",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const payload = {
        customer: "cus_123",
        priceId: "price_storage",
        quantity: 5,
        success_url: "https://app.taliho.com/success",
        cancel_url: "https://app.taliho.com/cancel",
      };

      const result = await manageCompanyStorage(payload);

      expect(mockPost).toHaveBeenCalledWith(
        "/stripe/checkout/storage-extension",
        payload,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should log critical error to rollbar with quantity and rethrow", async () => {
      const error = new Error("Storage checkout failed");
      mockPost.mockRejectedValue(error);

      const payload = { quantity: 10 };

      await expect(manageCompanyStorage(payload)).rejects.toThrow(
        "Storage checkout failed",
      );

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "stripe-storage-extension-failed",
        { quantity: 10 },
      );
    });

    it("should throw on network failure", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      await expect(manageCompanyStorage({})).rejects.toThrow("Network Error");
    });
  });

  // ==================== verifyCheckoutSession ====================

  describe("verifyCheckoutSession", () => {
    it("should verify a checkout session with sessionId", async () => {
      const mockResponse = {
        success: true,
        message: "Checkout verified",
        companyId: "company-456",
        customerId: "cus_123",
        subscriptionId: "sub_123",
        productId: "prod_1",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await verifyCheckoutSession("cs_session_123");

      expect(mockPost).toHaveBeenCalledWith("/stripe/checkout/verify", {
        sessionId: "cs_session_123",
      });
      expect(result).toEqual(mockResponse);
    });

    it("should return success false on failed verification", async () => {
      const mockResponse = {
        success: false,
        message: "Session not found or already processed",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await verifyCheckoutSession("cs_invalid");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Session not found or already processed");
    });

    it("should log error to rollbar with sessionId and rethrow", async () => {
      const error = new Error("Verification failed");
      mockPost.mockRejectedValue(error);

      await expect(verifyCheckoutSession("cs_session_123")).rejects.toThrow(
        "Verification failed",
      );

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "stripe-verify-checkout-failed",
        { sessionId: "cs_session_123" },
      );
    });

    it("should throw on 500 Server Error", async () => {
      const error = {
        response: { status: 500, data: { message: "Internal Server Error" } },
      };
      mockPost.mockRejectedValue(error);

      await expect(verifyCheckoutSession("cs_session_123")).rejects.toEqual(
        error,
      );
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    describe("Timeout scenarios", () => {
      it("fetchStripeProducts should throw on timeout", async () => {
        mockGet.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(fetchStripeProducts()).rejects.toMatchObject({
          code: "ECONNABORTED",
        });
      });

      it("createCheckoutSession should throw on timeout", async () => {
        mockPost.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          createCheckoutSession({
            priceId: "price_123",
            successUrl: "https://app.taliho.com/success",
            cancelUrl: "https://app.taliho.com/cancel",
          }),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });

      it("verifyCheckoutSession should throw on timeout", async () => {
        mockPost.mockRejectedValue({
          code: "ECONNABORTED",
          message: "timeout of 30000ms exceeded",
        });

        await expect(
          verifyCheckoutSession("cs_session_123"),
        ).rejects.toMatchObject({ code: "ECONNABORTED" });
      });
    });

    describe("useStripeProducts - HTTP errors", () => {
      it("should surface 403 Forbidden error", async () => {
        mockGet.mockRejectedValue({
          response: {
            status: 403,
            data: { message: "Forbidden" },
          },
        });

        const { result } = renderHook(() => useStripeProducts(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });
  });
});
