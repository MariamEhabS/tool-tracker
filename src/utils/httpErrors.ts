import { AxiosError } from "axios";

/**
 * Standard HTTP error codes and their user-friendly messages
 */
export const HTTP_ERROR_MESSAGES: Record<
  number,
  { title: string; message: string }
> = {
  400: {
    title: "Bad Request",
    message:
      "The request could not be processed. Please check your input and try again.",
  },
  401: {
    title: "Session Expired",
    message: "Your session has expired. Please log in again to continue.",
  },
  403: {
    title: "Access Denied",
    message: "You don't have permission to access this resource.",
  },
  404: {
    title: "Not Found",
    message: "The requested resource could not be found.",
  },
  408: {
    title: "Request Timeout",
    message: "The request took too long to complete. Please try again.",
  },
  409: {
    title: "Conflict",
    message:
      "This action conflicts with another operation. Please refresh and try again.",
  },
  413: {
    title: "File Too Large",
    message: "The file you're trying to upload exceeds the size limit.",
  },
  422: {
    title: "Validation Error",
    message: "The provided data is invalid. Please check your input.",
  },
  424: {
    title: "Procore Connection Required",
    message:
      "Your Procore connection needs to be refreshed. Please reconnect to Procore in settings.",
  },
  429: {
    title: "Too Many Requests",
    message:
      "You've made too many requests. Please wait a moment and try again.",
  },
  500: {
    title: "Server Error",
    message: "Something went wrong on our end. Please try again later.",
  },
  502: {
    title: "Service Unavailable",
    message: "The service is temporarily unavailable. Please try again later.",
  },
  503: {
    title: "Service Unavailable",
    message: "The service is temporarily unavailable. Please try again later.",
  },
  504: {
    title: "Gateway Timeout",
    message: "The request took too long to complete. Please try again.",
  },
};

export interface HttpErrorResult {
  title: string;
  message: string;
  statusCode: number | null;
  isNetworkError: boolean;
  originalError: Error | AxiosError;
  /** Backend error code for specific error handling (e.g., 'PROJECT_ARCHIVED') */
  code?: string;
}

/**
 * Extract user-friendly error information from an Axios error or generic Error
 */
export function parseHttpError(error: unknown): HttpErrorResult {
  // Network error (no response received)
  if (error instanceof AxiosError && !error.response) {
    return {
      title: "Connection Error",
      message:
        "Unable to connect to the server. Please check your internet connection and try again.",
      statusCode: null,
      isNetworkError: true,
      originalError: error,
    };
  }

  // Axios error with response
  if (error instanceof AxiosError && error.response) {
    const statusCode = error.response.status;
    const serverMessage =
      error.response.data?.message || error.response.data?.error;
    const errorCode = error.response.data?.code;

    // Use server message if available, otherwise fall back to defaults
    const defaultError = HTTP_ERROR_MESSAGES[statusCode] || {
      title: "Error",
      message: "An unexpected error occurred. Please try again.",
    };

    return {
      title: defaultError.title,
      message: serverMessage || defaultError.message,
      statusCode,
      isNetworkError: false,
      originalError: error,
      code: errorCode,
    };
  }

  // Generic Error
  if (error instanceof Error) {
    return {
      title: "Error",
      message:
        error.message || "An unexpected error occurred. Please try again.",
      statusCode: null,
      isNetworkError: false,
      originalError: error,
    };
  }

  // Unknown error type
  return {
    title: "Error",
    message: "An unexpected error occurred. Please try again.",
    statusCode: null,
    isNetworkError: false,
    originalError: new Error(String(error)),
  };
}

/**
 * Check if an error is a specific HTTP status code
 */
export function isHttpStatus(error: unknown, statusCode: number): boolean {
  if (error instanceof AxiosError && error.response) {
    return error.response.status === statusCode;
  }
  return false;
}

/**
 * Check if an error is an authentication error (401)
 */
export function isAuthError(error: unknown): boolean {
  return isHttpStatus(error, 401);
}

/**
 * Check if an error is a forbidden error (403)
 */
export function isForbiddenError(error: unknown): boolean {
  return isHttpStatus(error, 403);
}

/**
 * Check if an error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpStatus(error, 404);
}

/**
 * Check if an error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    return error.response.status >= 500 && error.response.status < 600;
  }
  return false;
}

/**
 * Check if an error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response && error.code !== "ECONNABORTED";
  }
  return false;
}

/**
 * Check if an error is a PROJECT_ARCHIVED error
 */
export function isProjectArchivedError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    return error.response.data?.code === "PROJECT_ARCHIVED";
  }
  return false;
}

/**
 * Error code returned by the backend when Procore authentication is required.
 * This indicates the user's Procore OAuth token has expired and they need to reconnect.
 */
export const PROCORE_AUTH_REQUIRED = "PROCORE_AUTH_REQUIRED";

/**
 * Check if an error is a Procore authentication error (requires reconnection).
 * This is different from a Taliho session expiration - the user should NOT be logged out.
 * Instead, they should be prompted to reconnect their Procore integration.
 */
export function isProcoreAuthError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    // Check for the specific error code
    if (error.response.data?.errorCode === PROCORE_AUTH_REQUIRED) {
      return true;
    }
    // Also check for 424 Failed Dependency status (used for Procore auth issues)
    if (error.response.status === 424) {
      return true;
    }
  }
  return false;
}

/**
 * Get a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  return parseHttpError(error).message;
}

/**
 * Get a user-friendly error title from any error
 */
export function getErrorTitle(error: unknown): string {
  return parseHttpError(error).title;
}
