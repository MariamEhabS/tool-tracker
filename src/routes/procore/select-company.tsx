import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { initialize } from "@procore/procore-iframe-helpers";
import { selectProcoreCompany } from "@/api/endpoints/authentication";
import { logProcoreError } from "@/utils/rollbar";
import toast from "react-hot-toast";

// Safely initialize Procore iframe helpers - may fail outside Procore iframe context
let procoreContext: ReturnType<typeof initialize> | null = null;
try {
  procoreContext = initialize();
} catch (_e) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Procore Select Company] Iframe helpers not available, will use fallback",
    );
  }
}

/**
 * Check if we're actually inside a Procore iframe context.
 * The Procore iframe helpers only work properly when the app is embedded
 * within Procore's iframe. In standalone browser, we should use direct redirect.
 */
function isInProcoreIframeContext(): boolean {
  try {
    // Check if we're in an iframe (window.top !== window means we're embedded)
    const isInIframe = window.top !== window;
    if (!isInIframe) {
      return false;
    }
    // If we're in an iframe and procoreContext initialized, assume Procore context
    return procoreContext?.authentication?.notifySuccess !== undefined;
  } catch {
    // Cross-origin iframe access may throw - assume Procore context in this case
    return true;
  }
}

type TokenPayload = {
  procoreCompanies: Array<{
    id: number;
    name: string;
    is_active: boolean;
  }>;
};

export const Route = createFileRoute("/procore/select-company")({
  component: SelectCompanyPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: search.token as string,
      origin: search.origin as string | undefined,
    };
  },
});

function SelectCompanyPage() {
  const { token, origin } = Route.useSearch();
  const router = useRouter();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageTargetOrigin =
    typeof origin === "string" && origin.length > 0
      ? origin
      : window.location.origin;

  // Decode the JWT token to get the companies list (client-side decode only)
  const companies = useMemo(() => {
    if (!token) return [];
    try {
      // JWT tokens are base64 encoded with 3 parts: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        setError("Session expired, please try again.");
        return [];
      }
      const payload = JSON.parse(atob(parts[1])) as TokenPayload;
      return payload.procoreCompanies || [];
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Failed to decode JWT token:", e);
      }
      setError("Session expired, please try again.");
      return [];
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError("Invalid session. Please try logging in again.");
    }
  }, [token]);

  const handleSelectCompany = async () => {
    if (!selectedCompanyId || !token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await selectProcoreCompany(token, selectedCompanyId);

      if (response.redirectUrl) {
        // Extract userId from the redirect URL
        const url = new URL(response.redirectUrl);
        const userId = url.searchParams.get("userId");

        // Check if we're in a Procore iframe context
        const inProcoreContext = isInProcoreIframeContext();

        if (
          inProcoreContext &&
          userId &&
          procoreContext?.authentication?.notifySuccess
        ) {
          // Use Procore iframe helpers (embedded context only)
          try {
            if (import.meta.env.DEV) {
              console.log(
                "[Procore Select Company] Using iframe helpers (in Procore context)",
              );
            }
            procoreContext.authentication.notifySuccess({
              message: "Procore authentication successful",
              userId: userId,
            });
            return; // Procore helpers will handle the rest
          } catch (notifyError) {
            if (import.meta.env.DEV) {
              console.warn(
                "[Procore Select Company] notifySuccess failed:",
                notifyError,
              );
            }
            // Fall through to other methods
          }
        }

        // Standalone browser: try postMessage to parent window (for popup flow)
        if (window.opener && !window.opener.closed && userId) {
          try {
            if (import.meta.env.DEV) {
              console.log(
                "[Procore Select Company] Sending postMessage to parent",
              );
            }
            window.opener.postMessage(
              { type: "PROCORE_OAUTH_SUCCESS", userId },
              messageTargetOrigin,
            );
            // Close this popup window after a short delay
            setTimeout(() => {
              window.close();
            }, 500);
            return;
          } catch (postMessageError) {
            if (import.meta.env.DEV) {
              console.warn(
                "[Procore Select Company] postMessage failed:",
                postMessageError,
              );
            }
            // Fall through to direct redirect
          }
        }

        // Final fallback: direct redirect to oauth-success page
        if (import.meta.env.DEV) {
          console.log(
            "[Procore Select Company] Using direct redirect:",
            response.redirectUrl,
          );
        }
        window.location.href = response.redirectUrl;
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message =
        error?.response?.data?.message ||
        "Failed to select company. Please try again.";
      setError(message);
      toast.error(message);
      logProcoreError(err, "select-company-failed", { selectedCompanyId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Check if we're in a Procore iframe context
    const inProcoreContext = isInProcoreIframeContext();

    // 1. Try Procore iframe helpers (for embedded context)
    if (inProcoreContext && procoreContext?.authentication?.notifyFailure) {
      try {
        if (import.meta.env.DEV) {
          console.log(
            "[Procore Select Company] Using notifyFailure (in Procore context)",
          );
        }
        procoreContext.authentication.notifyFailure({
          error: "user_cancelled",
          message: "User cancelled company selection",
        });
        return; // Procore helpers will handle closing the modal
      } catch (notifyError) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Procore Select Company] notifyFailure failed:",
            notifyError,
          );
        }
        // Fall through to other methods
      }
    }

    // 2. Try postMessage to parent window (for popup flow)
    if (window.opener && !window.opener.closed) {
      try {
        if (import.meta.env.DEV) {
          console.log(
            "[Procore Select Company] Sending cancel postMessage to parent",
          );
        }
        window.opener.postMessage(
          { type: "PROCORE_OAUTH_FAILURE", error: "user_cancelled" },
          messageTargetOrigin,
        );
        // Close this popup window after a short delay
        setTimeout(() => {
          window.close();
        }, 500);
        return;
      } catch (postMessageError) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Procore Select Company] postMessage failed:",
            postMessageError,
          );
        }
        // Fall through to direct redirect
      }
    }

    // 3. Final fallback: redirect to Procore app
    const procoreBaseUrl = import.meta.env.VITE_PROCORE_BASE_URL;
    if (import.meta.env.DEV) {
      console.log(
        "[Procore Select Company] Redirecting to Procore:",
        procoreBaseUrl,
      );
    }
    window.location.href = procoreBaseUrl;
  };

  if (error && companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bx bx-error-circle text-red-600 text-3xl"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Session Expired
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.navigate({ to: "/" })}
              className="inline-flex items-center px-4 py-2 bg-brand-500 text-white font-medium rounded-md hover:bg-brand-600 transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <i className="bx bxs-building text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Select Your Company
                </h1>
                <p className="text-sm text-white/80">
                  You have access to multiple Procore companies
                </p>
              </div>
            </div>
          </div>

          {/* Company List */}
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Please select the company you want to use with Taliho:
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                <i className="bx bx-error-circle mr-2"></i>
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {companies.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  No companies available in this Procore session.
                </div>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(company.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      selectedCompanyId === company.id
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedCompanyId === company.id
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <i className="bx bxs-building text-lg"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-medium ${
                          selectedCompanyId === company.id
                            ? "text-orange-700"
                            : "text-gray-900"
                        }`}
                      >
                        {company.name}
                      </p>
                      {!company.is_active && (
                        <span className="text-xs text-amber-600">Inactive</span>
                      )}
                    </div>
                    {selectedCompanyId === company.id && (
                      <i className="bx bx-check-circle text-orange-500 text-xl"></i>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSelectCompany}
                disabled={!selectedCompanyId || isSubmitting}
                className="inline-flex items-center px-4 py-2 bg-orange-500 text-white font-medium rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <i className="bx bx-loader-alt bx-spin mr-2"></i>
                    Connecting...
                  </>
                ) : (
                  <>
                    Continue
                    <i className="bx bx-right-arrow-alt ml-2"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="mt-4 text-center text-xs text-gray-500">
          This selection will be remembered for future logins.
        </p>
      </div>
    </div>
  );
}
