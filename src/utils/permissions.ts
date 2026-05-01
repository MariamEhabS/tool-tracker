/**
 * User Permissions Utility Functions
 *
 * Centralized permission checking logic for the Taliho application.
 * Supports three permission levels: admin, pm (project manager), and user.
 */

import { useMemo } from "react";
import { useDevOverrides } from "@/lib/devOverride";

export type Permission = "admin" | "pm" | "user";

export interface User {
  _id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  permission?: Permission;
  isVerified?: boolean;
  company?: string;
}

/**
 * Check if a user has admin permissions
 * Note: Users without a permission field default to admin (backward compatibility with v2)
 */
export const isAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return (
    user.permission === "admin" ||
    user.permission === undefined ||
    user.permission === null
  );
};

/**
 * Check if a user has project manager permissions
 */
export const isPM = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return user.permission === "pm";
};

/**
 * Check if a user has basic user permissions (non-admin, non-PM)
 */
export const isBasicUser = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return user.permission === "user";
};

/**
 * Check if a user has at least a certain permission level
 * Permission hierarchy: admin > pm > user
 */
export const hasPermissionLevel = (
  user: User | null | undefined,
  requiredLevel: Permission,
): boolean => {
  if (!user) return false;

  const permissionHierarchy: Record<Permission, number> = {
    admin: 3,
    pm: 2,
    user: 1,
  };

  const userLevel = user.permission
    ? permissionHierarchy[user.permission]
    : permissionHierarchy.admin; // Default to admin for backward compatibility

  return userLevel >= permissionHierarchy[requiredLevel];
};

/**
 * Check if user can create projects
 * Only admins and PMs can create projects
 */
export const canCreateProjects = (user: User | null | undefined): boolean => {
  return isAdmin(user) || isPM(user);
};

/**
 * Check if user can manage company settings
 * Only admins can manage company settings
 */
export const canManageCompany = (user: User | null | undefined): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can manage other users
 * Only admins can manage users
 */
export const canManageUsers = (user: User | null | undefined): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can access billing/subscription
 * Only admins can access billing
 */
export const canAccessBilling = (user: User | null | undefined): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can manage integrations (Procore, etc.)
 * Only admins can manage integrations
 */
export const canManageIntegrations = (
  user: User | null | undefined,
): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can delete QR codes, groups, or projects
 * Only admins can delete these items
 */
export const canDelete = (user: User | null | undefined): boolean => {
  return isAdmin(user);
};

/**
 * Check if user can modify QR codes, groups, or projects
 * (edit, create, set password, move, etc.)
 * Only admins and PMs can modify - basic users are view-only
 */
export const canModify = (user: User | null | undefined): boolean => {
  return isAdmin(user) || isPM(user);
};

/**
 * Check if user can delete another user
 * Only admins can delete users, and cannot delete other admins
 */
export const canDeleteUser = (
  currentUser: User | null | undefined,
  targetUser: User | null | undefined,
): boolean => {
  if (!isAdmin(currentUser) || !targetUser) return false;
  // Cannot delete another admin
  return !isAdmin(targetUser);
};

/**
 * Check if user is pending verification
 */
export const isPendingVerification = (
  user: User | null | undefined,
): boolean => {
  if (!user) return false;
  return user.isVerified === false;
};

/**
 * Get user permission display name
 */
export const getPermissionDisplayName = (
  permission?: Permission | null,
): string => {
  if (!permission) return "Admin"; // Default for backward compatibility

  const displayNames: Record<Permission, string> = {
    admin: "Admin",
    pm: "Project Manager",
    user: "User",
  };

  return displayNames[permission] || "Unknown";
};

/**
 * Get user permission description
 */
export const getPermissionDescription = (
  permission?: Permission | null,
): string => {
  if (!permission) return "Full administrative access to all features";

  const descriptions: Record<Permission, string> = {
    admin: "Full administrative access to all features",
    pm: "Can create and manage projects, but cannot access company settings",
    user: "Can view projects and documents, but cannot create or modify",
  };

  return descriptions[permission] || "Unknown permission level";
};

/**
 * Custom hook for permission checks
 * Returns an object with all permission checking functions bound to the current user
 */
export const usePermissions = (user: User | null | undefined) => {
  return {
    isAdmin: isAdmin(user),
    isPM: isPM(user),
    isUser: isBasicUser(user),
    canCreateProjects: canCreateProjects(user),
    canManageCompany: canManageCompany(user),
    canManageUsers: canManageUsers(user),
    canAccessBilling: canAccessBilling(user),
    canManageIntegrations: canManageIntegrations(user),
    canDelete: canDelete(user),
    canModify: canModify(user),
    isPending: isPendingVerification(user),
    permissionLevel: user?.permission || "admin",
    permissionName: getPermissionDisplayName(user?.permission),
    permissionDescription: getPermissionDescription(user?.permission),
  };
};

/**
 * Hook for permission checks with dev override support
 *
 * This hook wraps usePermissions but applies any active permission override
 * from the dev override context. Only Taliho employees can use overrides.
 *
 * @example
 * ```tsx
 * const { isAdmin, canManageCompany } = usePermissionsWithOverride(user);
 * // If dev override is set to "user", isAdmin will be false
 * ```
 */
export const usePermissionsWithOverride = (user: User | null | undefined) => {
  const { overrides, isEnabled } = useDevOverrides();

  // Create an effective user with potentially overridden permission
  const effectiveUser = useMemo<User | null | undefined>(() => {
    if (!user) return user;
    if (isEnabled && overrides.permission) {
      return { ...user, permission: overrides.permission };
    }
    return user;
  }, [user, overrides.permission, isEnabled]);

  return usePermissions(effectiveUser);
};
