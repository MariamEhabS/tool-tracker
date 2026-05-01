/**
 * E2E Test Utilities
 *
 * This module exports utilities for writing verified E2E tests that prevent
 * false positives and false negatives.
 */

export { RouteTracker } from "./route-tracker";

export {
  assertMockDataVisible,
  assertFieldsNotVisible,
  assertErrorStateVisible,
  assertLoadingStateVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
  assertTabActive,
  clickTab,
  assertEditButtonVisible,
  assertBackButtonVisible,
  assertObjectsMatch,
} from "./test-helpers";

export { safeRoute, isSourceFileRequest } from "./route-tracker";

export {
  getFrontendPort,
  getFrontendBaseUrl,
  getBackendUrl,
  getBackendOrigin,
  isBackendApiRequest,
  isBackendRequestUrl,
  toFrontendUrl,
  toBackendRoutePattern,
} from "./runtime-env";

export { getE2EEnv, getE2EStripeProductIds } from "./e2e-env";
