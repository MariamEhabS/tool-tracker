/**
 * Dev Override Provider Component
 *
 * Allows Taliho employees to simulate different pricing tiers and permission
 * levels for testing purposes. State persists to localStorage.
 *
 * Context and types are defined in DevOverrideTypes.ts for Fast Refresh compatibility.
 */

import { useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { TierId } from "@/lib/tiers/types";
import { Permission } from "@/utils/permissions";
import {
  DevOverrideContext,
  DevOverrideContextValue,
  DevOverrides,
} from "./DevOverrideTypes";
import {
  CustomerViewTarget,
  clearCustomerViewActorSnapshot,
  clearCustomerViewSession,
  getCustomerViewActorSnapshot,
  getCustomerViewSession,
  setCustomerViewActorSnapshot,
  setCustomerViewSession,
} from "./impersonationStorage";

const STORAGE_KEY = "taliho-dev-overrides";

/**
 * Load overrides from localStorage
 */
function loadOverridesFromStorage(): DevOverrides {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const customerView = getCustomerViewSession();
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        tier: parsed.tier || null,
        permission: parsed.permission || null,
        customerView,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    tier: null,
    permission: null,
    customerView: getCustomerViewSession(),
  };
}

/**
 * Save overrides to localStorage
 */
function saveOverridesToStorage(overrides: DevOverrides): void {
  try {
    if (overrides.tier || overrides.permission) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tier: overrides.tier,
          permission: overrides.permission,
        }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

interface DevOverrideProviderProps {
  children: ReactNode;
  /** Whether the override system is enabled (should be true only for Taliho employees) */
  enabled: boolean;
}

/**
 * Provider component for dev override context
 */
export function DevOverrideProvider({
  children,
  enabled,
}: DevOverrideProviderProps) {
  const [overrides, setOverrides] = useState<DevOverrides>(() =>
    loadOverridesFromStorage(),
  );

  // Persist to localStorage when overrides change
  useEffect(() => {
    if (!enabled) return;
    saveOverridesToStorage(overrides);
  }, [overrides, enabled]);

  // Clear overrides when disabled
  useEffect(() => {
    if (!enabled) {
      setOverrides({ tier: null, permission: null, customerView: null });
    }
  }, [enabled]);

  const setTierOverride = useCallback((tier: TierId | null) => {
    setOverrides((prev) => ({ ...prev, tier }));
  }, []);

  const setPermissionOverride = useCallback((permission: Permission | null) => {
    setOverrides((prev) => ({ ...prev, permission }));
  }, []);

  const enterCustomerView = useCallback(
    (
      target: CustomerViewTarget,
      company: Record<string, unknown> | null,
    ): void => {
      if (!enabled) return;

      const currentUserRaw = localStorage.getItem("user");
      if (!currentUserRaw) return;

      let currentUser: Record<string, unknown> | null = null;
      let currentCompany: Record<string, unknown> | null = null;
      try {
        currentUser = JSON.parse(currentUserRaw) as Record<string, unknown>;
      } catch {
        currentUser = null;
      }

      try {
        const currentCompanyRaw = localStorage.getItem("company");
        currentCompany = currentCompanyRaw
          ? (JSON.parse(currentCompanyRaw) as Record<string, unknown>)
          : null;
      } catch {
        currentCompany = null;
      }

      if (!currentUser) return;

      const actorUserId = String(
        currentUser._id || currentUser.userId || "",
      ).trim();
      const actorEmail = String(currentUser.email || "").toLowerCase();

      setCustomerViewActorSnapshot({
        user: currentUser,
        company: currentCompany,
      });

      const session = {
        target,
        actorUserId,
        actorEmail,
        startedAt: new Date().toISOString(),
      };
      setCustomerViewSession(session);

      const impersonatedUser = {
        ...currentUser,
        _id: target.userId,
        userId: target.userId,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        permission: target.permission,
        companyId: target.companyId,
        company: target.companyName,
        isImpersonated: true,
        isTalihoEmployee: false,
      };

      localStorage.setItem("user", JSON.stringify(impersonatedUser));
      if (company) {
        localStorage.setItem("company", JSON.stringify(company));
      } else {
        localStorage.removeItem("company");
      }

      setOverrides({
        tier: null,
        permission: null,
        customerView: session,
      });
      window.location.reload();
    },
    [enabled],
  );

  const exitCustomerView = useCallback(() => {
    const actorSnapshot = getCustomerViewActorSnapshot();

    if (actorSnapshot?.user) {
      localStorage.setItem("user", JSON.stringify(actorSnapshot.user));
    } else {
      localStorage.removeItem("user");
    }

    if (actorSnapshot?.company) {
      localStorage.setItem("company", JSON.stringify(actorSnapshot.company));
    } else {
      localStorage.removeItem("company");
    }

    clearCustomerViewSession();
    clearCustomerViewActorSnapshot();
    setOverrides((prev) => ({ ...prev, customerView: null }));
    window.location.reload();
  }, []);

  const clearAllOverrides = useCallback(() => {
    const hasCustomerView = Boolean(getCustomerViewSession());
    if (hasCustomerView) {
      exitCustomerView();
      return;
    }

    setOverrides({ tier: null, permission: null, customerView: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, [exitCustomerView]);

  const hasActiveOverrides = Boolean(
    overrides.tier || overrides.permission || overrides.customerView,
  );

  const value = useMemo<DevOverrideContextValue>(
    () => ({
      overrides,
      setTierOverride,
      setPermissionOverride,
      enterCustomerView,
      exitCustomerView,
      clearAllOverrides,
      hasActiveOverrides,
      isEnabled: enabled,
    }),
    [
      overrides,
      setTierOverride,
      setPermissionOverride,
      enterCustomerView,
      exitCustomerView,
      clearAllOverrides,
      hasActiveOverrides,
      enabled,
    ],
  );

  return (
    <DevOverrideContext.Provider value={value}>
      {children}
    </DevOverrideContext.Provider>
  );
}
