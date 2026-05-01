/**
 * Utility functions for formatting values in settings components
 */

/**
 * Formats bytes to gigabytes with 2 decimal places
 * @param bytes - Number of bytes to convert
 * @returns Formatted string in GB (e.g., "74.50")
 */
export function formatStorageGB(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return "0.00";
  if (bytes < 0) return "0.00";
  return (bytes / 1_073_741_824).toFixed(2);
}

/**
 * Format bytes to MB with 2 decimal places
 * @param bytes - The number of bytes to format
 * @returns The formatted string in MB (e.g., "150.00")
 */
export function formatStorageMB(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return "0.00";
  if (bytes < 0) return "0.00";
  return (bytes / 1_048_576).toFixed(2);
}

/**
 * Formats bytes to the most appropriate unit (MB or GB) based on size
 * Uses MB for values under 1 GB, GB for larger values
 * @param bytes - Number of bytes to convert
 * @returns Object with formatted value string and unit string
 */
export function formatStorageAdaptive(bytes: number): {
  value: string;
  unit: string;
} {
  const MB = 1_048_576; // 1024 * 1024
  const GB = 1_073_741_824; // 1024^3

  // If less than 1 GB, show in MB
  if (bytes < GB) {
    const mbValue = bytes / MB;
    return {
      value: mbValue < 10 ? mbValue.toFixed(1) : Math.round(mbValue).toString(),
      unit: "MB",
    };
  }

  // Otherwise show in GB
  return {
    value: (bytes / GB).toFixed(2),
    unit: "GB",
  };
}

/**
 * Formats bytes based on tier - always MB for Free Trial, adaptive for paid tiers
 * @param bytes - Number of bytes to convert
 * @param isFreeTrial - Whether the user is on Free Trial
 * @returns Object with formatted value string and unit string
 */
export function formatStorageForTier(
  bytes: number,
  isFreeTrial: boolean,
): { value: string; unit: string } {
  if (isFreeTrial) {
    // Always show MB for Free Trial users
    const MB = 1_048_576;
    const mbValue = bytes / MB;
    return {
      value: mbValue < 10 ? mbValue.toFixed(1) : Math.round(mbValue).toString(),
      unit: "MB",
    };
  }
  // Use adaptive formatting for paid tiers
  return formatStorageAdaptive(bytes);
}

/**
 * Formats a number with locale-specific thousand separators
 * @param count - Number to format
 * @returns Formatted string (e.g., "1,234")
 */
export function formatCount(count: number): string {
  if (count == null || isNaN(count)) return "0";
  return count.toLocaleString();
}

/**
 * Format number with thousands separator (alias for formatCount)
 * @param num - The number to format
 * @returns Formatted string with thousands separators (e.g., "1,234,567")
 */
export function formatNumber(num: number): string {
  if (num == null || isNaN(num)) return "0";
  return num.toLocaleString("en-US");
}

/**
 * Formats an activity timestamp as a relative time string
 * @param timestamp - ISO timestamp string
 * @returns Formatted relative time string (e.g., "2 hours ago", "Yesterday at 3:45 PM")
 */
export function formatActivityTimestamp(timestamp: string): string {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1)
    return (
      "Yesterday at " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns the icon class for an activity action
 * @param action - Activity action string
 * @returns BoxIcons class name (e.g., "bx-user-plus")
 */
export function getActivityIcon(action: string): string {
  if (!action) return "bx-info-circle";

  const iconMap: Record<string, string> = {
    // User management
    user_invited: "bx-user-plus",
    user_added: "bx-user-plus",
    user_removed: "bx-user-minus",
    user_activated: "bx-user-check",
    user_deactivated: "bx-user-x",
    role_changed: "bx-user-circle",
    // Settings
    settings_updated: "bx-cog",
    logo_changed: "bx-image",
    company_info_updated: "bx-buildings",
    company_updated: "bx-buildings",
    // Security
    password_changed: "bx-lock-alt",
    email_changed: "bx-envelope",
    two_factor_enabled: "bx-shield-quarter",
    two_factor_disabled: "bx-shield-x",
    login_success: "bx-log-in",
    login_failed: "bx-error",
    logout: "bx-log-out",
    // Integrations
    procore_connected: "bx-link",
    procore_disconnected: "bx-unlink",
    procore_sync_started: "bx-sync",
    procore_sync_completed: "bx-check-circle",
    stripe_subscription_created: "bx-credit-card",
    stripe_subscription_updated: "bx-credit-card-alt",
    stripe_subscription_cancelled: "bx-credit-card-front",
    integration_connected: "bx-link",
    integration_disconnected: "bx-unlink",
    // Storage & Subscription
    storage_addon: "bx-package",
    subscription_changed: "bx-credit-card",
    qr_batch_regenerate: "bx-refresh",
  };
  return iconMap[action] || "bx-info-circle";
}

/**
 * Returns the icon background color classes for an activity action
 * @param action - Activity action string
 * @returns Tailwind CSS classes for icon container background and text color
 */
export function getActivityIconColor(action: string): string {
  if (!action) return "bg-gray-100 text-gray-600";

  const colorMap: Record<string, string> = {
    // User management
    user_invited: "bg-green-100 text-green-600",
    user_added: "bg-green-100 text-green-600",
    user_removed: "bg-red-100 text-red-600",
    user_activated: "bg-green-100 text-green-600",
    user_deactivated: "bg-orange-100 text-orange-600",
    role_changed: "bg-blue-100 text-blue-600",
    // Settings
    settings_updated: "bg-purple-100 text-purple-600",
    logo_changed: "bg-purple-100 text-purple-600",
    company_info_updated: "bg-purple-100 text-purple-600",
    company_updated: "bg-purple-100 text-purple-600",
    // Security
    password_changed: "bg-amber-100 text-amber-600",
    email_changed: "bg-amber-100 text-amber-600",
    two_factor_enabled: "bg-green-100 text-green-600",
    two_factor_disabled: "bg-red-100 text-red-600",
    login_success: "bg-teal-100 text-teal-600",
    login_failed: "bg-red-100 text-red-600",
    logout: "bg-gray-200 text-gray-600",
    // Integrations
    procore_connected: "bg-teal-100 text-teal-600",
    procore_disconnected: "bg-orange-100 text-orange-600",
    procore_sync_started: "bg-blue-100 text-blue-600",
    procore_sync_completed: "bg-green-100 text-green-600",
    stripe_subscription_created: "bg-indigo-100 text-indigo-600",
    stripe_subscription_updated: "bg-indigo-100 text-indigo-600",
    stripe_subscription_cancelled: "bg-red-100 text-red-600",
    integration_connected: "bg-teal-100 text-teal-600",
    integration_disconnected: "bg-orange-100 text-orange-600",
    // Storage & Subscription
    storage_addon: "bg-indigo-100 text-indigo-600",
    subscription_changed: "bg-indigo-100 text-indigo-600",
    qr_batch_regenerate: "bg-blue-100 text-blue-600",
  };
  return colorMap[action] || "bg-gray-100 text-gray-600";
}

/**
 * Get human-readable label for activity type
 * @param type - The activity type identifier
 * @returns Human-readable label for the activity type
 */
export function getActivityTypeLabel(type: string): string {
  if (!type) return "Unknown";

  const labelMap: Record<string, string> = {
    user_added: "User Added",
    user_invited: "User Invited",
    user_removed: "User Removed",
    user_activated: "User Activated",
    user_deactivated: "User Deactivated",
    role_changed: "Role Changed",
    company_updated: "Company Updated",
    company_info_updated: "Company Updated",
    integration_connected: "Integration Connected",
    integration_disconnected: "Integration Disconnected",
    storage_addon: "Storage Add-on",
    subscription_changed: "Subscription Changed",
    qr_batch_regenerate: "QR Batch Regenerate",
  };
  return labelMap[type] || "Unknown";
}
