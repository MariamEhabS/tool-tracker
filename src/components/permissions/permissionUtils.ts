import { type User } from "@/utils/permissions";

/**
 * Get user from localStorage
 */
export function getUserFromLocalStorage(): User | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Hook to get the current user from localStorage
 * Use this with PermissionGate when you don't have user in props
 */
export function useCurrentUser(): User | null {
  return getUserFromLocalStorage();
}
