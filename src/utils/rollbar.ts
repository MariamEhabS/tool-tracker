import Rollbar from "rollbar";
import {
  getOrCreateAnonymousSession,
  isAnonymousSession,
  type AnonymousContext,
} from "./anonymous-session";

// Module-level Rollbar instance storage
let rollbarInstance: Rollbar | null = null;

/**
 * Set the Rollbar instance for use throughout the application
 */
export const setRollbarInstance = (instance: Rollbar): void => {
  rollbarInstance = instance;
};

/**
 * Get the current Rollbar instance
 */
export const getRollbarInstance = (): Rollbar | null => rollbarInstance;

/**
 * Error severity levels supported by Rollbar
 */
export type ErrorLevel = "critical" | "error" | "warning" | "info" | "debug";

/**
 * Context information to attach to error reports
 */
export interface ErrorContext {
  userId?: string;
  companyId?: string;
  projectId?: string;
  feature?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error category constants for consistent categorization
 */
export const ErrorCategories = {
  API: "api",
  AUTH: "authentication",
  PAYMENT: "payment",
  PROCORE: "procore-integration",
  QR_CODE: "qr-code",
  DOCUMENT: "document",
  PRINT: "print",
  NAVIGATION: "navigation",
  RENDER: "render",
  JOB: "background-job",
} as const;

export type ErrorCategory =
  (typeof ErrorCategories)[keyof typeof ErrorCategories];

/**
 * PII fields to redact (case-insensitive matching)
 *
 * NOTE: "email" is intentionally NOT included here because we need it
 * for Rollbar's person tracking feature. Email is essential for:
 * - Identifying which user experienced an error
 * - Following up with users who report issues
 * - Correlating errors in the Rollbar "People" tab
 *
 * Only actual secrets/credentials should be redacted.
 */
const PII_FIELDS = [
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "authorization",
  "creditCard",
  "cardNumber",
  "cvv",
  "ssn",
  "socialSecurity",
];

/**
 * Sanitize payload by redacting PII fields
 * Handles nested objects and arrays recursively
 */
export const sanitizePayload = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (
      PII_FIELDS.some((field) =>
        key.toLowerCase().includes(field.toLowerCase()),
      )
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Rollbar Person object for user identification
 * This integrates with Rollbar's built-in "People" feature
 */
export interface RollbarPerson {
  id: string;
  email?: string;
  username?: string;
}

/**
 * Full user context for error reporting
 */
export interface RollbarUserContext {
  person: RollbarPerson;
  custom: Record<string, unknown>;
  isAnonymous: boolean;
}

/**
 * Authenticated user data structure from localStorage
 */
interface AuthenticatedUserData {
  _id?: string;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  permission?: string;
}

/**
 * Company data structure from localStorage
 */
interface CompanyData {
  _id?: string;
  companyName?: string;
  paidAccount?: boolean;
  procoreIntegration?: boolean;
  freeTrialActive?: boolean;
}

/**
 * Get authenticated user data from localStorage
 * Returns null if user is not authenticated
 */
const getAuthenticatedUserData = (): {
  user: AuthenticatedUserData | null;
  company: CompanyData | null;
} => {
  let parsedUser: AuthenticatedUserData | null = null;
  let parsedCompany: CompanyData | null = null;

  // Use raw localStorage with silent error handling to avoid circular dependency
  // safeStorage → rollbar.error → getUserContext → safeStorage (infinite loop)
  try {
    const userStr = localStorage.getItem("user");
    parsedUser = userStr ? JSON.parse(userStr) : null;
  } catch {
    // localStorage or JSON parse error - use defaults
  }

  try {
    const companyStr = localStorage.getItem("company");
    parsedCompany = companyStr ? JSON.parse(companyStr) : null;
  } catch {
    // localStorage or JSON parse error - use defaults
  }

  return { user: parsedUser, company: parsedCompany };
};

/**
 * Build the full user context for Rollbar
 * Handles both authenticated users and anonymous QR scanners
 *
 * For authenticated users:
 * - person.id = user ID
 * - person.email = user email
 * - person.username = full name
 * - custom includes company info, permissions, subscription tier
 *
 * For anonymous users (QR scanners):
 * - person.id = "anonymous-qr-scanner" (hardcoded for grouping in Rollbar People tab)
 * - person.username = "Anonymous QR Scanner"
 * - custom.sessionId = unique session ID for correlation (anon_timestamp_random)
 * - custom includes device info, scanned QR codes, entry point
 */
export const buildUserContext = (): RollbarUserContext => {
  // Check if user is authenticated
  if (!isAnonymousSession()) {
    const { user, company } = getAuthenticatedUserData();

    if (user && (user._id || user.userId)) {
      const fullName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined;

      return {
        isAnonymous: false,
        person: {
          id: user._id || user.userId || "unknown",
          email: user.email,
          username: fullName || user.email,
        },
        custom: {
          userType: "authenticated",
          userPermission: user.permission || "unknown",
          companyId: company?._id || "unknown",
          companyName: company?.companyName || "unknown",
          subscriptionTier: company?.paidAccount
            ? "paid"
            : company?.freeTrialActive
              ? "trial"
              : "free",
          hasProcoreIntegration: company?.procoreIntegration || false,
        },
      };
    }
  }

  // Fall back to anonymous session (QR scanners)
  let anonSession: AnonymousContext;
  try {
    anonSession = getOrCreateAnonymousSession();
  } catch {
    // If anonymous session fails, return minimal context
    return {
      isAnonymous: true,
      person: {
        id: "anon_unknown",
        username: "Anonymous (unknown)",
      },
      custom: {
        userType: "anonymous",
        contextBuildError: true,
      },
    };
  }

  // Use hardcoded person ID to group all anonymous users in Rollbar's "People" tab
  // but keep the unique session ID in custom context for debugging/correlation
  return {
    isAnonymous: true,
    person: {
      id: "anonymous-qr-scanner",
      username: "Anonymous QR Scanner",
    },
    custom: {
      userType: "anonymous",
      sessionId: anonSession.sessionId, // Unique session for correlation
      deviceType: anonSession.deviceType,
      screenSize: anonSession.screenSize,
      language: anonSession.language,
      timezone: anonSession.timezone,
      entryPoint: anonSession.entryPoint || "unknown",
      scannedQrCodeIds: anonSession.scannedQrCodeIds,
      lastScannedQrCodeId:
        anonSession.scannedQrCodeIds[anonSession.scannedQrCodeIds.length - 1] ||
        undefined,
      sessionCreatedAt: anonSession.createdAt,
    },
  };
};

/**
 * Get user context from localStorage for error reports (legacy function)
 * Uses raw localStorage access to avoid circular dependency with safeStorage
 *
 * @deprecated Use buildUserContext() for full person tracking support
 */
const getUserContext = (): Record<string, string> => {
  const { user, company } = getAuthenticatedUserData();

  return {
    userId: user?._id || user?.userId || "anonymous",
    companyId: company?._id || "unknown",
    companyName: company?.companyName || "unknown",
  };
};

/**
 * Report an error to Rollbar with context and sanitization
 */
export const reportError = (
  error: Error | string,
  level: ErrorLevel = "error",
  context?: ErrorContext,
): void => {
  if (!rollbarInstance) {
    return;
  }

  const userContext = getUserContext();
  const sanitizedMetadata = sanitizePayload(context?.metadata);

  const payload = {
    level,
    custom: {
      ...userContext,
      feature: context?.feature,
      action: context?.action,
      projectId: context?.projectId,
      userId: context?.userId || userContext.userId,
      companyId: context?.companyId || userContext.companyId,
      ...(sanitizedMetadata as Record<string, unknown>),
    },
  };

  rollbarInstance[level](error, payload);
};

/**
 * Convenience object for reporting errors at different severity levels
 */
export const rollbar = {
  critical: (error: Error | string, context?: ErrorContext) =>
    reportError(error, "critical", context),
  error: (error: Error | string, context?: ErrorContext) =>
    reportError(error, "error", context),
  warning: (error: Error | string, context?: ErrorContext) =>
    reportError(error, "warning", context),
  info: (error: Error | string, context?: ErrorContext) =>
    reportError(error, "info", context),
  debug: (error: Error | string, context?: ErrorContext) =>
    reportError(error, "debug", context),
};

// =============================================================================
// Custom Error Classes for Descriptive Rollbar Titles
// =============================================================================

/**
 * Base class for domain-specific errors
 * Creates descriptive error titles in Rollbar instead of generic "AxiosError"
 */
class DomainError extends Error {
  readonly originalError?: Error;
  readonly statusCode?: number;

  constructor(
    name: string,
    message: string,
    originalError?: Error,
    statusCode?: number,
  ) {
    super(message);
    this.name = name;
    this.originalError = originalError;
    this.statusCode = statusCode;

    // Preserve original stack trace if available
    if (originalError?.stack) {
      this.stack = `${this.name}: ${this.message}\n    [Caused by] ${originalError.stack}`;
    }
  }
}

/**
 * QR Code operation errors
 * Examples: "QRCodeError: Generation failed (500)", "QRCodeError: Scan verification failed (401)"
 */
export class QRCodeError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super("QRCodeError", `${action}${statusSuffix}`, originalError, statusCode);
  }
}

/**
 * Authentication errors
 * Examples: "AuthError: Login failed (401)", "AuthError: Token refresh failed (500)"
 */
export class AuthError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super("AuthError", `${action}${statusSuffix}`, originalError, statusCode);
  }
}

/**
 * Procore integration errors
 * Examples: "ProcoreError: Fetch inspections failed (500)", "ProcoreError: Token expired (401)"
 */
export class ProcoreError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super(
      "ProcoreError",
      `${action}${statusSuffix}`,
      originalError,
      statusCode,
    );
  }
}

/**
 * Document/file operation errors
 * Examples: "DocumentError: Upload failed (500)", "DocumentError: Download failed (404)"
 */
export class DocumentError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super(
      "DocumentError",
      `${action}${statusSuffix}`,
      originalError,
      statusCode,
    );
  }
}

/**
 * Background job errors
 * Examples: "JobError: Polling failed (500)", "JobError: Job start failed (503)"
 */
export class JobError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super("JobError", `${action}${statusSuffix}`, originalError, statusCode);
  }
}

/**
 * UI/Render errors
 * Examples: "RenderError: Component crashed - QRCodeList", "RenderError: Hydration mismatch"
 */
export class RenderError extends DomainError {
  constructor(
    componentOrAction: string,
    originalError?: Error,
    statusCode?: number,
  ) {
    super("RenderError", componentOrAction, originalError, statusCode);
  }
}

/**
 * Generic API errors (when no specific category applies)
 * Examples: "APIError: Request failed (500)", "APIError: Network timeout"
 */
export class APIError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super("APIError", `${action}${statusSuffix}`, originalError, statusCode);
  }
}

/**
 * Payment/Stripe errors
 * Examples: "PaymentError: Checkout failed (402)", "PaymentError: Subscription update failed"
 */
export class PaymentError extends DomainError {
  constructor(action: string, originalError?: Error, statusCode?: number) {
    const statusSuffix = statusCode ? ` (${statusCode})` : "";
    super(
      "PaymentError",
      `${action}${statusSuffix}`,
      originalError,
      statusCode,
    );
  }
}

// =============================================================================
// Enhanced Error Context Helpers
// =============================================================================

/**
 * Convert any value to an Error object
 * Reduces boilerplate: `error instanceof Error ? error : new Error(String(error))`
 */
export const toError = (err: unknown): Error => {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  return new Error(String(err));
};

/**
 * Extract status code from an error (typically Axios errors)
 */
const getStatusCode = (error: unknown): number | undefined => {
  const axiosError = error as AxiosLikeError;
  return axiosError?.response?.status;
};

/**
 * Format action string to be human-readable
 * Converts "fetch-inspections" to "Fetch inspections"
 */
const formatAction = (action: string): string => {
  return action
    .split("-")
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
};

/**
 * Axios error structure for type checking
 */
interface AxiosLikeError {
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown;
    config?: {
      url?: string;
      method?: string;
    };
  };
  config?: {
    url?: string;
    method?: string;
  };
  message?: string;
  code?: string;
}

/**
 * Extract useful context from API/Axios errors
 */
export const extractApiErrorContext = (
  error: unknown,
): Record<string, unknown> => {
  const axiosError = error as AxiosLikeError;
  const context: Record<string, unknown> = {};

  if (axiosError?.response) {
    context.statusCode = axiosError.response.status;
    context.statusText = axiosError.response.statusText;
    context.url =
      axiosError.response.config?.url || axiosError.config?.url || "unknown";
    context.method = (
      axiosError.response.config?.method ||
      axiosError.config?.method ||
      "unknown"
    ).toUpperCase();

    // Extract error message from response if available
    const responseData = axiosError.response.data as Record<string, unknown>;
    if (responseData?.message) {
      context.serverMessage = responseData.message;
    }
    if (responseData?.error) {
      context.serverError = responseData.error;
    }
  }

  if (axiosError?.code) {
    context.errorCode = axiosError.code;
  }

  return context;
};

/**
 * Check if an error is a client error (4xx) that shouldn't be logged to Rollbar
 * 4xx errors are expected and usually indicate user error, not system issues
 */
export const isClientError = (error: unknown): boolean => {
  const axiosError = error as AxiosLikeError;
  const status = axiosError?.response?.status;
  return status !== undefined && status >= 400 && status < 500;
};

/**
 * Check if an error is a server error (5xx) that should always be logged
 */
export const isServerError = (error: unknown): boolean => {
  const axiosError = error as AxiosLikeError;
  const status = axiosError?.response?.status;
  return status !== undefined && status >= 500;
};

/**
 * Log an API error with automatic context extraction
 * Only logs server errors (5xx) and network errors by default
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "fetch-user", "create-project")
 * @param metadata - Additional context
 * @param options - Options for logging behavior
 */
export const logApiError = (
  error: unknown,
  action: string,
  metadata?: Record<string, unknown>,
  options?: { logClientErrors?: boolean; level?: ErrorLevel },
): void => {
  // Skip 4xx errors unless explicitly requested
  if (!options?.logClientErrors && isClientError(error)) {
    return;
  }

  const apiContext = extractApiErrorContext(error);
  const level = options?.level || (isServerError(error) ? "error" : "warning");
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "APIError: Fetch user failed (500)"
  const descriptiveError = new APIError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, level, {
    feature: ErrorCategories.API,
    action,
    metadata: {
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a QR code related error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "scan-failed", "regenerate-failed")
 * @param qrcodeId - The QR code ID involved
 * @param metadata - Additional context
 */
export const logQRError = (
  error: unknown,
  action: string,
  qrcodeId?: string,
  metadata?: Record<string, unknown>,
): void => {
  // Skip 4xx errors for QR operations
  if (isClientError(error)) {
    return;
  }

  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "QRCodeError: Generation failed (500)"
  const descriptiveError = new QRCodeError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, isServerError(error) ? "error" : "warning", {
    feature: ErrorCategories.QR_CODE,
    action,
    metadata: {
      qrcodeId,
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a Procore integration error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "fetch-inspections", "create-form")
 * @param metadata - Additional context (projectId, companyId, etc.)
 */
export const logProcoreError = (
  error: unknown,
  action: string,
  metadata?: Record<string, unknown>,
): void => {
  // Skip 4xx errors for Procore operations
  if (isClientError(error)) {
    return;
  }

  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "ProcoreError: Fetch inspections failed (500)"
  const descriptiveError = new ProcoreError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, isServerError(error) ? "error" : "warning", {
    feature: ErrorCategories.PROCORE,
    action,
    metadata: {
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log an authentication error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "login-failed", "token-refresh-failed")
 * @param metadata - Additional context
 */
export const logAuthError = (
  error: unknown,
  action: string,
  metadata?: Record<string, unknown>,
): void => {
  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Auth errors are usually important, log at error level for server errors
  const level = isServerError(error) ? "error" : "warning";

  // Create descriptive error: "AuthError: Login failed (401)"
  const descriptiveError = new AuthError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, level, {
    feature: ErrorCategories.AUTH,
    action,
    metadata: {
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a document/file operation error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "upload-failed", "download-failed")
 * @param metadata - Additional context (documentId, folderId, etc.)
 */
export const logDocumentError = (
  error: unknown,
  action: string,
  metadata?: Record<string, unknown>,
): void => {
  // Skip 4xx errors
  if (isClientError(error)) {
    return;
  }

  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "DocumentError: Upload failed (500)"
  const descriptiveError = new DocumentError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, isServerError(error) ? "error" : "warning", {
    feature: ErrorCategories.DOCUMENT,
    action,
    metadata: {
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a background job error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "job-polling-failed", "job-start-failed")
 * @param jobId - The job ID involved
 * @param metadata - Additional context
 */
export const logJobError = (
  error: unknown,
  action: string,
  jobId?: string,
  metadata?: Record<string, unknown>,
): void => {
  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "JobError: Polling failed (500)"
  const descriptiveError = new JobError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, "error", {
    feature: ErrorCategories.JOB,
    action,
    metadata: {
      jobId,
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a render/UI error (typically from error boundaries)
 *
 * @param error - The error to log
 * @param componentName - Name of the component that failed
 * @param metadata - Additional context
 */
export const logRenderError = (
  error: unknown,
  componentName: string,
  metadata?: Record<string, unknown>,
): void => {
  const originalError = toError(error);

  // Create descriptive error: "RenderError: Component crashed - QRCodeList"
  const descriptiveError = new RenderError(
    `Component crashed - ${componentName}`,
    originalError,
  );

  reportError(descriptiveError, "error", {
    feature: ErrorCategories.RENDER,
    action: "component-error",
    metadata: {
      componentName,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

/**
 * Log a payment/Stripe error
 *
 * @param error - The error to log
 * @param action - Action name (e.g., "checkout-failed", "subscription-update-failed")
 * @param metadata - Additional context
 */
export const logPaymentError = (
  error: unknown,
  action: string,
  metadata?: Record<string, unknown>,
): void => {
  const apiContext = extractApiErrorContext(error);
  const statusCode = getStatusCode(error);
  const originalError = toError(error);

  // Create descriptive error: "PaymentError: Checkout failed (402)"
  const descriptiveError = new PaymentError(
    formatAction(action) + " failed",
    originalError,
    statusCode,
  );

  reportError(descriptiveError, "error", {
    feature: ErrorCategories.PAYMENT,
    action,
    metadata: {
      ...apiContext,
      ...metadata,
      originalErrorName: originalError.name,
      originalErrorMessage: originalError.message,
    },
  });
};

// =============================================================================
// URL-to-Domain Routing for Axios Interceptor
// =============================================================================

/**
 * Extract human-readable action from QR code URLs
 * /qr-code/bulk-async → "bulk-create"
 * /qr-code/123/regenerate → "regenerate"
 * /qr-code/scanned/123 → "scan-verification"
 */
const extractQRAction = (url: string, method?: string): string => {
  if (url.includes("bulk-async") || url.includes("/bulk")) return "bulk-create";
  if (url.includes("regenerate")) return "regenerate";
  if (url.includes("scanned")) return "scan-verification";
  if (url.includes("style")) return "style-update";

  // Infer from HTTP method
  const upperMethod = method?.toUpperCase();
  if (upperMethod === "POST") return "create";
  if (upperMethod === "PATCH" || upperMethod === "PUT") return "update";
  if (upperMethod === "DELETE") return "delete";
  return "fetch";
};

/**
 * Extract human-readable action from Procore URLs
 * /procore/inspections → "fetch-inspections"
 * /procore/forms → "fetch-forms"
 * /procore/oauth/... → "oauth"
 */
const extractProcoreAction = (url: string): string => {
  if (url.includes("oauth")) return "oauth";
  if (url.includes("webhook")) return "webhook";

  // Extract tool name: /procore/inspections, /procore/punch-list, etc.
  const toolMatch = url.match(/\/procore\/([a-z-]+)/);
  if (toolMatch) {
    const tool = toolMatch[1];
    // Common tools get nicer names
    if (tool === "punch-list") return "fetch-punch-items";
    if (tool === "rfi") return "fetch-rfis";
    return `fetch-${tool}`;
  }
  return "procore-request";
};

/**
 * Extract human-readable action from auth URLs
 * /auth/login → "login"
 * /auth/refresh → "token-refresh"
 */
const extractAuthAction = (url: string): string => {
  if (url.includes("login")) return "login";
  if (url.includes("refresh")) return "token-refresh";
  if (url.includes("signup") || url.includes("complete-signup"))
    return "signup";
  if (url.includes("verify-otp")) return "otp-verification";
  if (url.includes("verify-email")) return "email-verification";
  if (url.includes("forgot-password")) return "password-reset-request";
  if (url.includes("reset-password")) return "password-reset";
  if (url.includes("logout")) return "logout";
  if (url.includes("resend-otp")) return "resend-otp";
  return "auth-request";
};

/**
 * Extract human-readable action from document/folder URLs
 */
const extractDocumentAction = (url: string, method?: string): string => {
  const isFolder = url.includes("/folder");
  const prefix = isFolder ? "folder" : "document";

  const upperMethod = method?.toUpperCase();
  if (upperMethod === "POST") return `${prefix}-upload`;
  if (upperMethod === "DELETE") return `${prefix}-delete`;
  if (url.includes("download")) return `${prefix}-download`;
  return `${prefix}-fetch`;
};

/**
 * Extract human-readable action from Stripe/payment URLs
 */
const extractPaymentAction = (url: string): string => {
  if (url.includes("checkout")) return "checkout";
  if (url.includes("portal")) return "billing-portal";
  if (url.includes("subscription")) return "subscription-update";
  if (url.includes("webhook")) return "payment-webhook";
  return "payment-request";
};

/**
 * Generic action extractor for unknown domains
 * /company/123 → "company-fetch"
 * /project/456/groups → "project-groups-fetch"
 */
const extractGenericAction = (url: string, method?: string): string => {
  // Remove IDs and extract path segments
  const cleanPath = url
    .replace(/\/[a-f0-9]{24}/g, "") // Remove MongoDB ObjectIds
    .replace(/\/\d+/g, "") // Remove numeric IDs
    .replace(/^\//, "") // Remove leading slash
    .replace(/\/$/, ""); // Remove trailing slash

  if (!cleanPath) return "api-request";

  const segments = cleanPath.split("/").filter(Boolean);
  const baseName = segments.slice(0, 2).join("-"); // Take first 2 segments

  // Add method-based suffix
  const upperMethod = method?.toUpperCase();
  if (upperMethod === "POST") return `${baseName}-create`;
  if (upperMethod === "PATCH" || upperMethod === "PUT")
    return `${baseName}-update`;
  if (upperMethod === "DELETE") return `${baseName}-delete`;
  return `${baseName}-fetch`;
};

/**
 * Domain type for URL routing
 */
type ErrorDomain =
  | "qr"
  | "procore"
  | "auth"
  | "document"
  | "payment"
  | "job"
  | "api";

/**
 * URL pattern to domain mapping configuration
 */
const URL_DOMAIN_PATTERNS: Array<{
  pattern: RegExp;
  domain: ErrorDomain;
}> = [
  { pattern: /^\/qr-code/, domain: "qr" },
  { pattern: /^\/procore/, domain: "procore" },
  { pattern: /^\/auth/, domain: "auth" },
  { pattern: /^\/document/, domain: "document" },
  { pattern: /^\/folder/, domain: "document" },
  { pattern: /^\/stripe/, domain: "payment" },
  { pattern: /^\/job/, domain: "job" },
];

/**
 * Detect domain from URL pattern
 */
const detectDomainFromUrl = (url: string): ErrorDomain => {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  for (const { pattern, domain } of URL_DOMAIN_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return domain;
    }
  }

  return "api";
};

/**
 * Extract action based on domain and URL
 */
const extractActionForDomain = (
  domain: ErrorDomain,
  url: string,
  method?: string,
): string => {
  switch (domain) {
    case "qr":
      return extractQRAction(url, method);
    case "procore":
      return extractProcoreAction(url);
    case "auth":
      return extractAuthAction(url);
    case "document":
      return extractDocumentAction(url, method);
    case "payment":
      return extractPaymentAction(url);
    case "job":
      return "job-request";
    default:
      return extractGenericAction(url, method);
  }
};

/**
 * Route API errors to domain-specific loggers based on URL pattern.
 * This function is designed for use in the axios interceptor to provide
 * descriptive error titles in Rollbar instead of generic "AxiosError".
 *
 * Examples:
 * - /qr-code/bulk-async (POST) → "QRCodeError: Bulk create failed (500)"
 * - /procore/inspections (GET) → "ProcoreError: Fetch inspections failed (500)"
 * - /auth/login (POST) → "AuthError: Login failed (401)"
 *
 * @param error - The error to log
 * @param url - The request URL
 * @param metadata - Additional context (method, errorCode, etc.)
 */
export const logApiErrorByDomain = (
  error: unknown,
  url: string,
  metadata?: Record<string, unknown>,
): void => {
  // Skip 4xx client errors (handled by isClientError in individual loggers)
  if (isClientError(error)) {
    return;
  }

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const method = metadata?.method as string | undefined;
  const domain = detectDomainFromUrl(normalizedUrl);
  const action = extractActionForDomain(domain, normalizedUrl, method);

  switch (domain) {
    case "qr":
      logQRError(error, action, undefined, metadata);
      break;
    case "procore":
      logProcoreError(error, action, metadata);
      break;
    case "auth":
      logAuthError(error, action, metadata);
      break;
    case "document":
      logDocumentError(error, action, metadata);
      break;
    case "payment":
      logPaymentError(error, action, metadata);
      break;
    case "job":
      logJobError(error, action, undefined, metadata);
      break;
    default:
      logApiError(error, action, metadata);
  }
};
