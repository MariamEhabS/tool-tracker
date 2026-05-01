import { ReactNode } from "react";
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

type PermissionCheck =
  | "isAdmin"
  | "isPM"
  | "isUser"
  | "canCreateProjects"
  | "canManageCompany"
  | "canManageUsers"
  | "canAccessBilling"
  | "canManageIntegrations";

interface PermissionGateProps {
  /** The user object to check permissions against */
  user: User | null | undefined;
  /** The permission check to perform */
  check: PermissionCheck;
  /** Content to render if permission check passes */
  children: ReactNode;
  /** Optional content to render if permission check fails (defaults to null) */
  fallback?: ReactNode;
}

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
 * PermissionGate component for conditional rendering based on user permissions.
 *
 * @example
 * // Only show for admins
 * <PermissionGate user={user} check="isAdmin">
 *   <AdminOnlyContent />
 * </PermissionGate>
 *
 * @example
 * // Show for users who can create projects, with fallback
 * <PermissionGate
 *   user={user}
 *   check="canCreateProjects"
 *   fallback={<p>You don't have permission to create projects.</p>}
 * >
 *   <CreateProjectButton />
 * </PermissionGate>
 */
export function PermissionGate({
  user,
  check,
  children,
  fallback = null,
}: PermissionGateProps) {
  const hasPermission = checkPermission(user, check);

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

export default PermissionGate;
