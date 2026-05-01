/**
 * @fileoverview localStorage persistence for customer-view impersonation sessions.
 * Stores the impersonation target, the original actor's snapshot, and provides
 * functions to read/write/clear each.
 */

export const CUSTOMER_VIEW_SESSION_KEY = "taliho-dev-customer-view-session";
export const CUSTOMER_VIEW_ACTOR_KEY = "taliho-dev-customer-view-actor";

export interface CustomerViewTarget {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permission: string;
  companyId: string;
  companyName: string;
}

export interface CustomerViewSession {
  target: CustomerViewTarget;
  actorUserId: string;
  actorEmail: string;
  startedAt: string;
}

export interface CustomerViewActorSnapshot {
  user: Record<string, unknown>;
  company: Record<string, unknown> | null;
}

/** Safely parse a JSON string, returning null on failure. */
function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Reads the active customer-view session from localStorage, or null if none. */
export function getCustomerViewSession(): CustomerViewSession | null {
  const parsed = safeParse<CustomerViewSession>(
    localStorage.getItem(CUSTOMER_VIEW_SESSION_KEY),
  );
  if (!parsed?.target?.userId || !parsed?.target?.companyId) {
    return null;
  }
  return parsed;
}

/** Persists a customer-view session to localStorage. */
export function setCustomerViewSession(session: CustomerViewSession): void {
  localStorage.setItem(CUSTOMER_VIEW_SESSION_KEY, JSON.stringify(session));
}

/** Removes the customer-view session from localStorage. */
export function clearCustomerViewSession(): void {
  localStorage.removeItem(CUSTOMER_VIEW_SESSION_KEY);
}

/** Reads the saved actor (admin) snapshot used to restore state on exit. */
export function getCustomerViewActorSnapshot(): CustomerViewActorSnapshot | null {
  return safeParse<CustomerViewActorSnapshot>(
    localStorage.getItem(CUSTOMER_VIEW_ACTOR_KEY),
  );
}

/** Saves the current admin user and company data so it can be restored when exiting customer view. */
export function setCustomerViewActorSnapshot(
  snapshot: CustomerViewActorSnapshot,
): void {
  localStorage.setItem(CUSTOMER_VIEW_ACTOR_KEY, JSON.stringify(snapshot));
}

/** Removes the actor snapshot from localStorage. */
export function clearCustomerViewActorSnapshot(): void {
  localStorage.removeItem(CUSTOMER_VIEW_ACTOR_KEY);
}

/** Returns true if a customer-view impersonation session is currently active. */
export function isCustomerViewActive(): boolean {
  return getCustomerViewSession() !== null;
}
