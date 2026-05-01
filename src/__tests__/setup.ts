/**
 * Test setup file for Vitest
 * Configures testing environment and global utilities
 */

import { expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Global mock for @/utils/rollbar - provides all exported functions
vi.mock("@/utils/rollbar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/rollbar")>();
  return {
    ...actual,
    rollbar: {
      error: vi.fn(),
      warning: vi.fn(),
      critical: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
    reportError: vi.fn(),
    logApiError: vi.fn(),
    logQRError: vi.fn(),
    logProcoreError: vi.fn(),
    logAuthError: vi.fn(),
    logDocumentError: vi.fn(),
    logJobError: vi.fn(),
    logRenderError: vi.fn(),
    logPaymentError: vi.fn(),
    setRollbarInstance: vi.fn(),
    getRollbarInstance: vi.fn(() => ({
      error: vi.fn(),
      warning: vi.fn(),
      critical: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

// Suppress recharts ResponsiveContainer dimension warnings in jsdom
// (recharts uses console.warn internally via its LogUtils module)
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const message = typeof args[0] === "string" ? args[0] : "";
    if (
      message.includes("The width") &&
      message.includes("of chart should be greater than 0")
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalConsoleWarn;
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

// Mock window.matchMedia (used by some UI components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (used by some UI components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;
