/**
 * Safe localStorage wrapper with error handling and Rollbar logging
 *
 * localStorage operations can fail in several scenarios:
 * - Private/incognito browsing mode
 * - Storage quota exceeded
 * - Browser settings disabling storage
 * - SecurityError in some contexts
 *
 * This utility wraps all operations with try/catch and logs failures to Rollbar.
 */
import { reportError, toError, ErrorCategories } from "./rollbar";

/**
 * Safe localStorage wrapper object
 * Provides methods for localStorage operations with error handling and Rollbar logging
 */
export const safeLocalStorage = {
  /**
   * Get an item from localStorage
   * @returns The stored value or null if not found or on error
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      reportError(toError(error), "error", {
        feature: ErrorCategories.AUTH,
        action: "localStorage-read-failed",
        metadata: { key },
      });
      return null;
    }
  },

  /**
   * Set an item in localStorage
   * @returns true on success, false on error
   */
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      // Critical because data loss occurs when write fails
      reportError(toError(error), "critical", {
        feature: ErrorCategories.AUTH,
        action: "localStorage-write-failed",
        metadata: { key, valueLength: value.length },
      });
      return false;
    }
  },

  /**
   * Remove an item from localStorage
   * @returns true on success, false on error
   */
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      reportError(toError(error), "warning", {
        feature: ErrorCategories.AUTH,
        action: "localStorage-remove-failed",
        metadata: { key },
      });
      return false;
    }
  },

  /**
   * Get and parse a JSON value from localStorage
   * @returns The parsed value or null if not found, invalid JSON, or on error
   */
  getJSON<T>(key: string): T | null {
    const value = this.getItem(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      reportError(toError(error), "warning", {
        feature: ErrorCategories.AUTH,
        action: "localStorage-parse-failed",
        metadata: { key },
      });
      return null;
    }
  },

  /**
   * Stringify and set a JSON value in localStorage
   * @returns true on success, false on error
   */
  setJSON(key: string, value: unknown): boolean {
    try {
      const stringified = JSON.stringify(value);
      return this.setItem(key, stringified);
    } catch (error) {
      reportError(toError(error), "error", {
        feature: ErrorCategories.AUTH,
        action: "localStorage-stringify-failed",
        metadata: { key },
      });
      return false;
    }
  },
};

// Legacy exports for backwards compatibility
// TODO: Migrate consumers to use safeLocalStorage object

/**
 * @deprecated Use safeLocalStorage.getItem() or safeLocalStorage.getJSON() instead
 */
export const safeLocalStorageGet = <T = string>(
  key: string,
  parse: boolean = false,
): T | string | null => {
  if (parse) {
    return safeLocalStorage.getJSON<T>(key);
  }
  return safeLocalStorage.getItem(key);
};

/**
 * @deprecated Use safeLocalStorage.setItem() or safeLocalStorage.setJSON() instead
 */
export const safeLocalStorageSet = (
  key: string,
  value: string | object,
): boolean => {
  if (typeof value === "string") {
    return safeLocalStorage.setItem(key, value);
  }
  return safeLocalStorage.setJSON(key, value);
};

/**
 * @deprecated Use safeLocalStorage.removeItem() instead
 */
export const safeLocalStorageRemove = (key: string): boolean => {
  return safeLocalStorage.removeItem(key);
};

/**
 * Safely clear all localStorage
 * @returns true on success, false on failure
 */
export const safeLocalStorageClear = (): boolean => {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    reportError(toError(error), "warning", {
      feature: ErrorCategories.AUTH,
      action: "localStorage-clear-failed",
    });
    return false;
  }
};
