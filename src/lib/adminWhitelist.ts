/**
 * Admin whitelist for Taliho employees.
 * This list should match the backend AdminGuard (admin.guard.ts).
 */
export const ADMIN_EMAILS = [
  "jpmitra.swe@gmail.com",
  "jpmitra@taliho.com",
  "mariam.shennawe@gmail.com",
  "todd@taliho.com",
  "mstanton@taliho.com",
  "thesnor222@gmail.com",
];

/**
 * Check if the given email belongs to an admin user.
 * @param email - The email address to check
 * @returns true if the email is in the admin whitelist
 */
export const isAdminUser = (email?: string): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
