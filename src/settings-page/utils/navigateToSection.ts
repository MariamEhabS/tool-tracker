/**
 * Utility for navigating to specific settings sections with hash-based URLs.
 *
 * Usage:
 * - Import and call `navigateToSettingsSection("subscription")` to navigate to /settings#subscription
 * - The settings page will automatically expand and scroll to that section
 *
 * Valid section IDs:
 * - user-settings, security, subscription, company, users, qr-design,
 *   integrations, storage, activity, notifications
 */

/** Valid settings section IDs */
export const SETTINGS_SECTION_IDS = [
  "user-settings",
  "security",
  "subscription",
  "company",
  "categories",
  "users",
  "qr-design",
  "integrations",
  "storage",
  "activity",
  "notifications",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

/**
 * Check if a string is a valid settings section ID.
 */
export function isValidSettingsSectionId(id: string): id is SettingsSectionId {
  return SETTINGS_SECTION_IDS.includes(id as SettingsSectionId);
}

/**
 * Navigate to a specific settings section.
 * Updates the URL hash and triggers the scroll-to-section behavior.
 *
 * @param sectionId - The section ID to navigate to
 * @param options - Navigation options
 * @param options.replace - If true, replaces the current history entry instead of pushing
 *
 * @example
 * // Navigate to subscription settings
 * navigateToSettingsSection("subscription");
 *
 * // Navigate and replace history (won't add to back button history)
 * navigateToSettingsSection("storage", { replace: true });
 */
export function navigateToSettingsSection(
  sectionId: SettingsSectionId,
  options: { replace?: boolean } = {},
): void {
  const targetUrl = `/settings#${sectionId}`;

  if (options.replace) {
    window.history.replaceState(null, "", targetUrl);
  } else {
    window.history.pushState(null, "", targetUrl);
  }

  // Dispatch a hashchange event so the settings page can react
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * Get a URL string for a settings section (for use with Link components or href).
 *
 * @param sectionId - The section ID
 * @returns The full path with hash (e.g., "/settings#subscription")
 *
 * @example
 * // Use in a Link component
 * <Link to={getSettingsSectionUrl("subscription")}>Manage Subscription</Link>
 *
 * // Use as href
 * <a href={getSettingsSectionUrl("storage")}>Storage Settings</a>
 */
export function getSettingsSectionUrl(sectionId: SettingsSectionId): string {
  return `/settings#${sectionId}`;
}

/**
 * Navigate to settings page and scroll to a section.
 * Use this when you're not already on the settings page.
 *
 * This function uses window.location for navigation, which works with any router.
 *
 * @param sectionId - The section ID to navigate to
 *
 * @example
 * // From dashboard, navigate to subscription settings
 * goToSettingsSection("subscription");
 */
export function goToSettingsSection(sectionId: SettingsSectionId): void {
  window.location.href = `/settings#${sectionId}`;
}
