/**
 * Dev Override Menu Component
 *
 * Displays tier/permission overrides and customer impersonation controls
 * for internal Taliho users in the profile dropdown.
 */

import { useEffect, useMemo, useState } from "react";
import { MenuItem } from "@headlessui/react";
import toast from "react-hot-toast";
import {
  AdminImpersonationCandidate,
  getAdminCompany,
  useAdminImpersonationCandidates,
} from "@/api/endpoints/admin-customers";
import { useDevOverrides } from "@/lib/devOverride";
import { TIER_IDS, TIER_CONFIGS } from "@/lib/tiers";
import { TierId } from "@/lib/tiers/types";
import { Permission, getPermissionDisplayName } from "@/utils/permissions";

const TIERS: TierId[] = [
  TIER_IDS.FREE_TRIAL,
  TIER_IDS.STANDARD,
  TIER_IDS.PROFESSIONAL,
  TIER_IDS.BUSINESS,
  TIER_IDS.EARLY_ADOPTER,
];

const PERMISSIONS: Permission[] = ["admin", "pm", "user"];

function formatCandidateName(candidate: AdminImpersonationCandidate): string {
  const fullName =
    `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim();
  return fullName || candidate.email || candidate.userId;
}

/**
 * Menu section for dev overrides in the profile dropdown
 */
export function DevOverrideMenu() {
  const {
    overrides,
    setTierOverride,
    setPermissionOverride,
    enterCustomerView,
    exitCustomerView,
    clearAllOverrides,
    hasActiveOverrides,
    isEnabled,
  } = useDevOverrides();

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const { data: candidates = [], isLoading: candidatesLoading } =
    useAdminImpersonationCandidates(
      debouncedQuery,
      20,
      isEnabled && showCustomerModal,
    );

  const customerViewLabel = useMemo(() => {
    const target = overrides.customerView?.target;
    if (!target) return "";
    const name = `${target.firstName || ""} ${target.lastName || ""}`.trim();
    if (name) {
      return `${name} (${target.companyName || target.companyId})`;
    }
    if (target.email) {
      return `${target.email} (${target.companyName || target.companyId})`;
    }
    return target.companyName || target.companyId;
  }, [overrides.customerView]);

  if (!isEnabled) return null;

  const handleStartCustomerView = async (
    candidate: AdminImpersonationCandidate,
  ) => {
    if (!candidate.userId || !candidate.companyId) {
      toast.error("Invalid customer account selected");
      return;
    }

    try {
      setActivatingUserId(candidate.userId);
      const company = await getAdminCompany(candidate.companyId);

      enterCustomerView(
        {
          userId: candidate.userId,
          email: candidate.email,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          permission: candidate.permission,
          companyId: candidate.companyId,
          companyName: candidate.companyName,
        },
        company as unknown as Record<string, unknown>,
      );
    } catch (error) {
      console.error("Failed to start customer view:", error);
      toast.error("Failed to start customer view");
      setActivatingUserId(null);
    }
  };

  return (
    <>
      <div className="py-1">
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1.5">
            <i className="bx bx-code-alt text-sm" />
            Dev Overrides
            {hasActiveOverrides && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-purple-500" />
            )}
          </p>
        </div>

        <div className="px-4 py-2">
          <label
            htmlFor="dev-tier-select"
            className="text-xs text-gray-500 mb-1 block"
          >
            Pricing Tier
          </label>
          <select
            id="dev-tier-select"
            value={overrides.tier || ""}
            onChange={(e) =>
              setTierOverride((e.target.value as TierId) || null)
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
          >
            <option value="">-- Actual Tier --</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_CONFIGS[tier].name}
              </option>
            ))}
          </select>
        </div>

        <div className="px-4 py-2">
          <label
            htmlFor="dev-permission-select"
            className="text-xs text-gray-500 mb-1 block"
          >
            Permission Level
          </label>
          <select
            id="dev-permission-select"
            value={overrides.permission || ""}
            onChange={(e) =>
              setPermissionOverride((e.target.value as Permission) || null)
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
          >
            <option value="">-- Actual Permission --</option>
            {PERMISSIONS.map((perm) => (
              <option key={perm} value={perm}>
                {getPermissionDisplayName(perm)}
              </option>
            ))}
          </select>
        </div>

        <div className="px-4 pt-2 pb-1 border-t border-gray-100 mt-1">
          <p className="text-xs text-gray-500 mb-2">Customer View</p>
          {overrides.customerView?.target && (
            <p className="text-xs text-amber-700 mb-2">{customerViewLabel}</p>
          )}
          <button
            className="w-full text-left text-sm px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
            onClick={() => setShowCustomerModal(true)}
            type="button"
          >
            View as Customer
          </button>
        </div>

        {overrides.customerView?.target && (
          <MenuItem>
            {({ focus }) => (
              <button
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${
                  focus ? "bg-amber-50 text-amber-800" : "text-amber-700"
                }`}
                onClick={exitCustomerView}
              >
                <i className="bx bx-exit text-base" />
                <span>Exit Customer View</span>
              </button>
            )}
          </MenuItem>
        )}

        {hasActiveOverrides && (
          <MenuItem>
            {({ focus }) => (
              <button
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm ${
                  focus ? "bg-purple-50 text-purple-700" : "text-gray-700"
                }`}
                onClick={clearAllOverrides}
              >
                <i className="bx bx-reset text-base" />
                <span>Reset to Actual</span>
              </button>
            )}
          </MenuItem>
        )}
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                View as Customer
              </h3>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                onClick={() => setShowCustomerModal(false)}
                aria-label="Close customer view modal"
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user name, email, company, or ID"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              <div className="mt-3 max-h-80 overflow-auto border border-gray-200 rounded">
                {candidatesLoading && (
                  <div className="px-3 py-6 text-sm text-gray-500 text-center">
                    Searching customer accounts...
                  </div>
                )}

                {!candidatesLoading && candidates.length === 0 && (
                  <div className="px-3 py-6 text-sm text-gray-500 text-center">
                    No matching customer accounts found.
                  </div>
                )}

                {!candidatesLoading &&
                  candidates.map((candidate) => {
                    const isActivating = activatingUserId === candidate.userId;
                    return (
                      <button
                        key={candidate.userId}
                        type="button"
                        onClick={() => handleStartCustomerView(candidate)}
                        disabled={isActivating}
                        className="w-full text-left px-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {formatCandidateName(candidate)}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {candidate.email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {candidate.companyName} • {candidate.companyId}
                        </p>
                        {isActivating && (
                          <p className="text-xs text-amber-700 mt-1">
                            Starting customer view...
                          </p>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Persistent banner shown when customer view is active.
 */
export function CustomerViewBanner() {
  const { overrides, exitCustomerView, isEnabled } = useDevOverrides();
  const target = overrides.customerView?.target;

  if (!isEnabled || !target) return null;

  const fullName = `${target.firstName || ""} ${target.lastName || ""}`.trim();
  const display = fullName || target.email || target.userId;
  const companyLabel = target.companyName || target.companyId;

  return (
    <div className="bg-amber-200 border-b border-amber-500 text-amber-900 px-4 py-2 flex items-center justify-between gap-4">
      <p className="text-sm font-semibold">
        Viewing as: {display} - {companyLabel}
      </p>
      <button
        type="button"
        onClick={exitCustomerView}
        className="text-sm font-semibold px-3 py-1 rounded bg-amber-900 text-amber-100 hover:bg-amber-800"
      >
        Exit
      </button>
    </div>
  );
}

/**
 * Override indicator badge component
 *
 * Shows a purple dot when overrides are active.
 * Use this on the profile avatar to indicate testing mode.
 */
export function OverrideIndicator() {
  const { hasActiveOverrides } = useDevOverrides();

  if (!hasActiveOverrides) return null;

  return (
    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-purple-500 border-2 border-white" />
  );
}
