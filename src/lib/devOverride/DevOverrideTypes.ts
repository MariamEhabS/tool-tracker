/**
 * Dev Override Types and Context
 *
 * Separated from DevOverrideContext.tsx to fix Fast Refresh warning.
 * This file contains the context definition and types.
 */

import { createContext } from "react";
import { TierId } from "@/lib/tiers/types";
import { Permission } from "@/utils/permissions";
import {
  CustomerViewSession,
  CustomerViewTarget,
} from "./impersonationStorage";

export interface DevOverrides {
  tier: TierId | null;
  permission: Permission | null;
  customerView: CustomerViewSession | null;
}

export interface DevOverrideContextValue {
  /** Current override state */
  overrides: DevOverrides;
  /** Set tier override (null to clear) */
  setTierOverride: (tier: TierId | null) => void;
  /** Set permission override (null to clear) */
  setPermissionOverride: (permission: Permission | null) => void;
  /** Start viewing the app as a selected customer user */
  enterCustomerView: (
    target: CustomerViewTarget,
    company: Record<string, unknown> | null,
  ) => void;
  /** Exit customer view and restore admin session */
  exitCustomerView: () => void;
  /** Clear all overrides */
  clearAllOverrides: () => void;
  /** Whether any override is currently active */
  hasActiveOverrides: boolean;
  /** Whether the override system is enabled (Taliho employee) */
  isEnabled: boolean;
}

export const DevOverrideContext = createContext<DevOverrideContextValue | null>(
  null,
);
