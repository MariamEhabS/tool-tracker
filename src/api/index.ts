import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { logger } from "@/utils/logger";
import {
  logApiError,
  logApiErrorByDomain,
  logAuthError,
} from "@/utils/rollbar";
import { safeLocalStorage } from "@/utils/safeStorage";
import {
  CUSTOMER_VIEW_ACTOR_KEY,
  CUSTOMER_VIEW_SESSION_KEY,
  getCustomerViewSession,
} from "@/lib/devOverride/impersonationStorage";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import { staticAxiosAdapter } from "./mockdata/staticApi";

// Extended config type to include custom _retry flag used for token refresh
interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Extended error type for API error handling
interface ApiError extends AxiosError<{ code?: string; message?: string }> {
  config?: RetryableAxiosRequestConfig;
}

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  ...(STATIC_APP_MODE ? { adapter: staticAxiosAdapter } : {}),
  headers: {
    "Content-Type": "application/json",
  },
  // Required so the refreshToken HttpOnly cookie can be set/sent cross-origin (5173 -> backend port).
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    config.headers["x-api-key"] = import.meta.env.VITE_TALIHO_API_KEY;
    // Prefer the current "accessToken" key; fall back to the legacy "token" key
    // for users who haven't re-authenticated since the V2 → V3 migration.
    const token =
      safeLocalStorage.getItem("accessToken") ||
      safeLocalStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const customerViewSession = getCustomerViewSession();
    if (customerViewSession?.target?.userId) {
      config.headers["x-impersonate-user-id"] =
        customerViewSession.target.userId;
      config.headers["x-impersonation-mode"] = "customer-view";
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    } else {
      reject(new Error("Token refresh failed"));
    }
  });

  failedQueue = [];
};

/**
 * Check if error should be reported to Rollbar
 * Selective 4xx filtering: Skip expected user errors, keep API contract/permission issues
 */
const shouldSkipReporting = (error: ApiError): boolean => {
  // Skip cancelled requests
  if (error.code === "ERR_CANCELED") return true;

  // Skip Procore auth errors (expected during token refresh)
  if (error.response?.data?.code === "PROCORE_AUTH_REQUIRED") return true;

  // Skip 401s that will trigger refresh (before retry)
  if (error.response?.status === 401 && !error.config?._retry) return true;

  const status = error.response?.status;
  if (status) {
    // Skip expected client errors (user errors, not bugs)
    const skipStatuses = [
      404, // Not Found - expected for missing resources
      410, // Gone - expected for deleted resources
    ];
    if (skipStatuses.includes(status)) return true;

    // Keep important 4xx errors that indicate issues:
    // - 400 Bad Request: API contract issues
    // - 403 Forbidden: Permission problems
    // - 422 Unprocessable Entity: Validation bugs
    // - 429 Too Many Requests: Rate limiting
  }

  return false;
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Report significant errors to Rollbar using domain-specific helper
    // logApiErrorByDomain routes to QRCodeError, ProcoreError, etc. based on URL
    if (!shouldSkipReporting(error)) {
      logApiErrorByDomain(error, originalRequest?.url || "unknown-endpoint", {
        method: originalRequest?.method?.toUpperCase(),
        errorCode: error.response?.data?.code,
        errorMessage: error.response?.data?.message,
      });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Allow certain requests to handle 401s manually (e.g., procore retries)
      const cfg = error?.config || {};
      const skipReload =
        cfg?.headers &&
        (cfg.headers as Record<string, unknown>)["x-skip-401-reload"];

      if (skipReload) {
        return Promise.reject(error);
      }

      const requestUrl = String(originalRequest?.url ?? "");
      const isAuthRequest =
        requestUrl.startsWith("/auth/login") ||
        requestUrl.startsWith("/auth/signup") ||
        requestUrl.startsWith("/auth/verify-otp") ||
        requestUrl.startsWith("/auth/resend-otp") ||
        requestUrl.startsWith("/auth/forgot-password/") ||
        requestUrl.startsWith("/auth/verify-email-token") ||
        requestUrl.startsWith("/auth/complete-signup") ||
        requestUrl.startsWith("/auth/complete-invited-signup");

      const hasAccessToken = Boolean(
        safeLocalStorage.getItem("accessToken") ||
          safeLocalStorage.getItem("token"),
      );

      // Don't try to refresh (or hard-redirect) during login/signup flows, or when we
      // have no access token yet. Let the caller handle the 401.
      if (isAuthRequest || !hasAccessToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If refresh is already in progress, queue this request
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => {
            // If queued request fails, just reject - don't reload
            throw err;
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const refreshResponse = await axiosInstance.post(
          "/auth/refresh",
          {},
          {
            headers: { "x-skip-401-reload": "true" },
          },
        );

        const newAccessToken = refreshResponse.data.accessToken;

        // Store the new access token and remove stale legacy key so the
        // request interceptor always reads the freshly-issued value.
        safeLocalStorage.setItem("accessToken", newAccessToken);
        safeLocalStorage.removeItem("token");

        // Update the authorization header for the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Process queued requests
        processQueue(null, newAccessToken);

        // Retry the original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        logAuthError(refreshError, "token-refresh-failed", {
          url: originalRequest?.url,
        });
        logger.error("Token refresh failed:", refreshError);
        safeLocalStorage.removeItem("token");
        safeLocalStorage.removeItem("accessToken");
        safeLocalStorage.removeItem("user");
        safeLocalStorage.removeItem("company");
        safeLocalStorage.removeItem(CUSTOMER_VIEW_SESSION_KEY);
        safeLocalStorage.removeItem(CUSTOMER_VIEW_ACTOR_KEY);

        processQueue(refreshError, null);

        // Redirect to login instead of reload to avoid infinite loops
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors (bad request, not found, forbidden, etc.)
        const axiosError = error as { response?: { status?: number } };
        const status = axiosError?.response?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        // Retry once for server errors and network issues
        return failureCount < 1;
      },
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // Skip if already reported by axios interceptor
        // Axios errors have either config.url or isAxiosError flag
        const axiosError = error as ApiError;
        const isAxiosError =
          axiosError?.config?.url || axiosError?.isAxiosError;

        if (!isAxiosError) {
          // Only log non-axios errors (e.g., React Query client-side errors)
          // logApiError automatically handles 4xx skipping and log levels
          logApiError(error, "tanstack-mutation-failed");
        }
      },
    },
  },
});
