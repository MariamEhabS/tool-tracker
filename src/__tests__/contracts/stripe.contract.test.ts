/**
 * Contract Test: Stripe API
 *
 * Validates that the frontend Stripe API client aligns with the backend
 * specification defined in backend-contracts.ts. These tests catch drift
 * between frontend types/calls and backend DTOs/routes without requiring
 * a running backend.
 *
 * Covers all 6 frontend-facing Stripe endpoints:
 *   GET  /stripe/products
 *   GET  /stripe/products/:productId
 *   POST /stripe/checkout/sessions
 *   POST /stripe/checkout/storage-extension
 *   POST /stripe/billing-portal/sessions
 *   POST /stripe/checkout/verify
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  BackendCreateCheckoutSessionDto,
  BackendCreateBillingPortalSessionDto,
  BackendStorageExtensionDto,
  BackendVerifyCheckoutDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ============================================================
// Mocks
// ============================================================

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    defaults: { baseURL: "http://test" },
  },
}));

import {
  fetchStripeProducts,
  fetchSingleStripeProduct,
  createCheckoutSession,
  createBillingPortalSession,
  manageCompanyStorage,
  verifyCheckoutSession,
  type CreateCheckoutSessionRequest,
  type CreateBillingPortalSessionRequest,
  type StorageCheckoutRequest,
} from "@api/endpoints/stripe";

// ============================================================
// Contract Tests
// ============================================================

describe("Contract: Stripe API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { data: [{ id: "prod_123", name: "Pro Plan" }] },
    });
    mockPost.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/session_123" },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------
  // 1. fetchStripeProducts hits GET /stripe/products
  // ----------------------------------------------------------
  it("fetchStripeProducts GETs from /stripe/products", async () => {
    await fetchStripeProducts();

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe("/stripe/products");
  });

  it("fetchStripeProducts route matches BACKEND_ROUTES", async () => {
    await fetchStripeProducts();

    const route = BACKEND_ROUTES["stripe.list-products"];
    expect(route.method).toBe("GET");
    expect(mockGet.mock.calls[0][0]).toBe(route.path);
  });

  // ----------------------------------------------------------
  // 2. fetchSingleStripeProduct hits GET /stripe/products/:productId
  // ----------------------------------------------------------
  it("fetchSingleStripeProduct GETs from /stripe/products/:productId", async () => {
    const productId = "prod_ABC123";

    await fetchSingleStripeProduct(productId);

    expect(mockGet).toHaveBeenCalledTimes(1);

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe(`/stripe/products/${productId}`);
  });

  it("fetchSingleStripeProduct route matches BACKEND_ROUTES pattern", async () => {
    const productId = "prod_XYZ789";

    await fetchSingleStripeProduct(productId);

    const route = BACKEND_ROUTES["stripe.get-product"];
    expect(route.method).toBe("GET");
    const expectedPath = route.path.replace(":productId", productId);
    expect(mockGet.mock.calls[0][0]).toBe(expectedPath);
  });

  // ----------------------------------------------------------
  // 3. createCheckoutSession sends body matching BackendCreateCheckoutSessionDto
  // ----------------------------------------------------------
  it("createCheckoutSession POSTs to /stripe/checkout/sessions with correct body", async () => {
    const payload: CreateCheckoutSessionRequest = {
      priceId: "price_123",
      quantity: 1,
      successUrl: "https://app.taliho.com/success",
      cancelUrl: "https://app.taliho.com/cancel",
      customerId: "cus_ABC",
      companyId: "6601abc123def456789abcd1",
    };

    await createCheckoutSession(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/stripe/checkout/sessions");

    // Every key the frontend sends must be a valid BackendCreateCheckoutSessionDto field
    const backendFields: (keyof BackendCreateCheckoutSessionDto)[] = [
      "priceId",
      "quantity",
      "successUrl",
      "cancelUrl",
      "customerId",
      "companyId",
    ];
    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    // Required fields per backend DTO must be present
    expect(body).toHaveProperty("priceId", payload.priceId);
    expect(body).toHaveProperty("successUrl", payload.successUrl);
    expect(body).toHaveProperty("cancelUrl", payload.cancelUrl);
  });

  it("createCheckoutSession route matches BACKEND_ROUTES", async () => {
    await createCheckoutSession({
      priceId: "price_123",
      successUrl: "https://app.taliho.com/success",
      cancelUrl: "https://app.taliho.com/cancel",
    });

    const route = BACKEND_ROUTES["stripe.create-checkout-session"];
    expect(route.method).toBe("POST");
    expect(mockPost.mock.calls[0][0]).toBe(route.path);

    // Verify route-level required fields are present in the body
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    for (const field of route.requiredFields ?? []) {
      expect(body).toHaveProperty(field);
    }
  });

  // ----------------------------------------------------------
  // 4. manageCompanyStorage sends body matching BackendStorageExtensionDto
  // ----------------------------------------------------------
  it("manageCompanyStorage POSTs to /stripe/checkout/storage-extension with correct body", async () => {
    const payload: StorageCheckoutRequest = {
      customer: "cus_ABC",
      priceId: "price_storage_1gb",
      quantity: 5,
      success_url: "https://app.taliho.com/success",
      cancel_url: "https://app.taliho.com/cancel",
    };

    await manageCompanyStorage(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/stripe/checkout/storage-extension");

    // Every key the frontend sends must be a valid BackendStorageExtensionDto field
    const backendFields: (keyof BackendStorageExtensionDto)[] = [
      "customer",
      "priceId",
      "quantity",
      "success_url",
      "cancel_url",
    ];
    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }
  });

  it("manageCompanyStorage route matches BACKEND_ROUTES", async () => {
    await manageCompanyStorage({ quantity: 1 });

    const route = BACKEND_ROUTES["stripe.storage-extension"];
    expect(route.method).toBe("POST");
    expect(mockPost.mock.calls[0][0]).toBe(route.path);
  });

  // ----------------------------------------------------------
  // 5. createBillingPortalSession sends body matching BackendCreateBillingPortalSessionDto
  // ----------------------------------------------------------
  it("createBillingPortalSession POSTs to /stripe/billing-portal/sessions with correct body", async () => {
    const payload: CreateBillingPortalSessionRequest = {
      customer: "cus_ABC",
      userId: "6601abc123def456789abcd1",
      return_url: "https://app.taliho.com/settings",
      success_url: "https://app.taliho.com/settings?success=true",
      mode: "payment_method_update",
    };

    await createBillingPortalSession(payload);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/stripe/billing-portal/sessions");

    // Every key the frontend sends must be a valid BackendCreateBillingPortalSessionDto field
    const backendFields: (keyof BackendCreateBillingPortalSessionDto)[] = [
      "customer",
      "userId",
      "return_url",
      "success_url",
      "mode",
    ];
    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }
  });

  it("createBillingPortalSession route matches BACKEND_ROUTES", async () => {
    await createBillingPortalSession({});

    const route = BACKEND_ROUTES["stripe.create-billing-portal"];
    expect(route.method).toBe("POST");
    expect(mockPost.mock.calls[0][0]).toBe(route.path);
  });

  // ----------------------------------------------------------
  // 6. verifyCheckoutSession sends body matching BackendVerifyCheckoutDto
  // ----------------------------------------------------------
  it("verifyCheckoutSession POSTs to /stripe/checkout/verify with correct body", async () => {
    const sessionId = "cs_test_abc123";

    mockPost.mockResolvedValue({
      data: {
        success: true,
        message: "Checkout verified",
        companyId: "6601abc123def456789abcd1",
        customerId: "cus_ABC",
        subscriptionId: "sub_123",
        productId: "prod_123",
      },
    });

    await verifyCheckoutSession(sessionId);

    expect(mockPost).toHaveBeenCalledTimes(1);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/stripe/checkout/verify");

    // Every key the frontend sends must be a valid BackendVerifyCheckoutDto field
    const backendFields: (keyof BackendVerifyCheckoutDto)[] = ["sessionId"];
    for (const key of Object.keys(body)) {
      expect(backendFields).toContain(key);
    }

    // Required field per backend DTO
    expect(body).toHaveProperty("sessionId", sessionId);
  });

  it("verifyCheckoutSession route matches BACKEND_ROUTES", async () => {
    await verifyCheckoutSession("cs_test_abc123");

    const route = BACKEND_ROUTES["stripe.verify-checkout"];
    expect(route.method).toBe("POST");
    expect(mockPost.mock.calls[0][0]).toBe(route.path);

    // Verify route-level required fields are present in the body
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    for (const field of route.requiredFields ?? []) {
      expect(body).toHaveProperty(field);
    }
  });

  // ----------------------------------------------------------
  // 7. All Stripe routes are defined in BACKEND_ROUTES
  // ----------------------------------------------------------
  it("all Stripe routes are defined in BACKEND_ROUTES", () => {
    const requiredRoutes = [
      "stripe.list-products",
      "stripe.get-product",
      "stripe.create-checkout-session",
      "stripe.create-billing-portal",
      "stripe.storage-extension",
      "stripe.verify-checkout",
    ];

    for (const routeKey of requiredRoutes) {
      expect(BACKEND_ROUTES).toHaveProperty(routeKey);
      expect(BACKEND_ROUTES[routeKey]).toHaveProperty("method");
      expect(BACKEND_ROUTES[routeKey]).toHaveProperty("path");
    }
  });

  // ----------------------------------------------------------
  // 8. Frontend request types structurally cover backend DTOs
  // ----------------------------------------------------------
  describe("Frontend types cover backend DTO fields", () => {
    it("CreateCheckoutSessionRequest covers BackendCreateCheckoutSessionDto fields", () => {
      const frontendRequest: CreateCheckoutSessionRequest = {
        priceId: "price_123",
        quantity: 1,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        customerId: "cus_ABC",
        companyId: "comp_123",
      };

      // All backend required fields have corresponding frontend fields
      const backendRequired: (keyof BackendCreateCheckoutSessionDto)[] = [
        "priceId",
        "successUrl",
        "cancelUrl",
      ];
      for (const field of backendRequired) {
        expect(frontendRequest).toHaveProperty(field);
        expect(
          frontendRequest[field as keyof CreateCheckoutSessionRequest],
        ).toBeDefined();
      }

      // All backend optional fields have corresponding frontend fields
      const backendOptional: (keyof BackendCreateCheckoutSessionDto)[] = [
        "quantity",
        "customerId",
        "companyId",
      ];
      for (const field of backendOptional) {
        expect(frontendRequest).toHaveProperty(field);
      }
    });

    it("CreateBillingPortalSessionRequest covers BackendCreateBillingPortalSessionDto fields", () => {
      const frontendRequest: CreateBillingPortalSessionRequest = {
        customer: "cus_ABC",
        userId: "user_123",
        return_url: "https://example.com/return",
        success_url: "https://example.com/success",
        mode: "payment_method_update",
      };

      const backendFields: (keyof BackendCreateBillingPortalSessionDto)[] = [
        "customer",
        "userId",
        "return_url",
        "success_url",
        "mode",
      ];
      for (const field of backendFields) {
        expect(frontendRequest).toHaveProperty(field);
      }
    });

    it("StorageCheckoutRequest covers BackendStorageExtensionDto fields", () => {
      const frontendRequest: StorageCheckoutRequest = {
        customer: "cus_ABC",
        priceId: "price_storage",
        quantity: 5,
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      };

      const backendFields: (keyof BackendStorageExtensionDto)[] = [
        "customer",
        "priceId",
        "quantity",
        "success_url",
        "cancel_url",
      ];
      for (const field of backendFields) {
        expect(frontendRequest).toHaveProperty(field);
      }
    });
  });
});
