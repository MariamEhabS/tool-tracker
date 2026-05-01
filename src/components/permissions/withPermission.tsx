import React from "react";
import {
  type User,
  isAdmin,
  isPM,
  isBasicUser,
  canCreateProjects,
  canManageCompany,
  canManageUsers,
  canAccessBilling,
  canManageIntegrations,
} from "@/utils/permissions";
import { getUserFromLocalStorage } from "./permissionUtils";

type PermissionCheck =
  | "isAdmin"
  | "isPM"
  | "isUser"
  | "canCreateProjects"
  | "canManageCompany"
  | "canManageUsers"
  | "canAccessBilling"
  | "canManageIntegrations";

/**
 * Check if user has the specified permission
 */
function checkPermission(
  user: User | null | undefined,
  check: PermissionCheck,
): boolean {
  switch (check) {
    case "isAdmin":
      return isAdmin(user);
    case "isPM":
      return isPM(user);
    case "isUser":
      return isBasicUser(user);
    case "canCreateProjects":
      return canCreateProjects(user);
    case "canManageCompany":
      return canManageCompany(user);
    case "canManageUsers":
      return canManageUsers(user);
    case "canAccessBilling":
      return canAccessBilling(user);
    case "canManageIntegrations":
      return canManageIntegrations(user);
    default:
      return false;
  }
}

/**
 * Higher-order component for permission-based rendering
 * Useful for wrapping entire components that require specific permissions
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  check: PermissionCheck,
  FallbackComponent?: React.ComponentType,
) {
  return function PermissionWrappedComponent(props: P) {
    const user = getUserFromLocalStorage();
    const hasPermission = checkPermission(user, check);

    if (hasPermission) {
      return <WrappedComponent {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    return null;
  };
}
