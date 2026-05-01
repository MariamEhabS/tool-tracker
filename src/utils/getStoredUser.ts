import { safeLocalStorage } from "./safeStorage";

export interface StoredUser {
  _id?: string;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  permission?: "admin" | "pm" | "user";
  isVerified?: boolean;
  company?: string;
  companyId?: string;
  isTalihoEmployee?: boolean;
  accessToken?: string;
}

/**
 * Read and parse the "user" object from localStorage.
 * Uses safeLocalStorage for error handling and Rollbar logging.
 *
 * @returns The parsed user object, or empty object if absent / unparseable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getStoredUser(): any {
  return safeLocalStorage.getJSON<StoredUser>("user") ?? {};
}
