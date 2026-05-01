/**
 * Shared error handler for modal form submissions
 * Logs system errors (5xx, network) to Rollbar and shows user-friendly toasts
 */
import { logApiError, logAuthError } from "@/utils/rollbar";
import toast from "react-hot-toast";

interface ModalErrorOptions {
  /** Action name for Rollbar (e.g., 'create-project-failed') */
  action: string;
  /** Optional custom user message (defaults to error message from response) */
  userMessage?: string;
  /** Toast duration in ms (default: 4000) */
  toastDuration?: number;
}

/**
 * Handle modal submission errors with Rollbar logging and toast notifications
 * Only logs 5xx and network errors to Rollbar (user errors like validation are skipped)
 */
export const handleModalError = (
  error: unknown,
  options: ModalErrorOptions,
): void => {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };

  // Report to Rollbar using the helper (automatically handles error conversion,
  // 4xx skipping, and log levels)
  logApiError(error, options.action);

  // Show user-friendly message
  const message =
    options.userMessage ||
    err?.response?.data?.message ||
    err?.message ||
    "An error occurred";

  toast.error(message, { duration: options.toastDuration ?? 4000 });
};

/**
 * Check if error is a permission error (403) and show appropriate message
 * Returns true if it was a permission error, false otherwise
 */
export const handlePermissionError = (
  error: unknown,
  permissionMessage: string = "You don't have permission to perform this action",
): boolean => {
  const err = error as { response?: { status?: number } };
  if (err?.response?.status === 403) {
    // Log permission denied - may indicate misconfiguration or unauthorized access attempt
    logAuthError(error, "permission-denied", {
      pathname: window.location.pathname,
    });
    toast.error(permissionMessage, { duration: 5000 });
    return true;
  }
  return false;
};

/**
 * Combined handler that checks for permission errors first, then handles other errors
 * Useful for operations that may fail due to permissions
 */
export const handleModalErrorWithPermissionCheck = (
  error: unknown,
  options: ModalErrorOptions & { permissionMessage?: string },
): void => {
  if (handlePermissionError(error, options.permissionMessage)) {
    return;
  }
  handleModalError(error, options);
};
