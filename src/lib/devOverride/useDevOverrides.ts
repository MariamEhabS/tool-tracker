/**
 * @fileoverview Hook for accessing the dev override context. Separated from
 * `DevOverrideContext.tsx` to fix React Fast Refresh warnings (this file
 * exports only the hook, while the context file exports the provider).
 */

import { useContext } from "react";
import {
  DevOverrideContext,
  type DevOverrideContextValue,
} from "./DevOverrideTypes";

/**
 * Accesses the dev override context, which allows developers to temporarily
 * override tier, permission, and customer-view settings during development.
 *
 * Returns a safe disabled-state default if used outside the
 * `DevOverrideProvider`, making it safe to call in components that may
 * render before the provider mounts.
 *
 * @returns A {@link DevOverrideContextValue} with:
 *   - `overrides` - Current tier, permission, and customerView overrides
 *   - `setTierOverride` - Set the tier override
 *   - `setPermissionOverride` - Set the permission override
 *   - `enterCustomerView` / `exitCustomerView` - Manage customer-view mode
 *   - `clearAllOverrides` - Reset all overrides
 *   - `hasActiveOverrides` - Whether any override is currently active
 *   - `isEnabled` - Whether the dev override system is enabled
 */
export function useDevOverrides(): DevOverrideContextValue {
  const context = useContext(DevOverrideContext);

  if (!context) {
    // Return disabled state if used outside provider
    return {
      overrides: { tier: null, permission: null, customerView: null },
      setTierOverride: () => {},
      setPermissionOverride: () => {},
      enterCustomerView: () => {},
      exitCustomerView: () => {},
      clearAllOverrides: () => {},
      hasActiveOverrides: false,
      isEnabled: false,
    };
  }

  return context;
}
