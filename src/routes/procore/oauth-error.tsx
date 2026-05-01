import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initialize } from "@procore/procore-iframe-helpers";
import { logProcoreError } from "@/utils/rollbar";
import toast from "react-hot-toast";

// Safely initialize Procore iframe helpers - may fail outside Procore iframe context
let procoreContext: ReturnType<typeof initialize> | null = null;
try {
  procoreContext = initialize();
} catch (_e) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Procore OAuth Error] Iframe helpers not available, will use fallback",
    );
  }
}

export const Route = createFileRoute("/procore/oauth-error")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      error: search.error as string | undefined,
      message: search.message as string | undefined,
      origin: search.origin as string | undefined,
    };
  },
});

function RouteComponent() {
  const { error, message, origin } = Route.useSearch();
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Closing...");

  useEffect(() => {
    const errorMessage =
      message || "Procore authentication failed. Please try again.";
    const messageTargetOrigin =
      typeof origin === "string" && origin.length > 0
        ? origin
        : window.location.origin;

    // Log the error for debugging
    if (import.meta.env.DEV) {
      console.error("[Procore OAuth Error]:", { error, message });
    }

    // Log to Rollbar for error tracking
    logProcoreError(
      new Error(`Procore OAuth failed: ${error || "unknown"}`),
      "oauth-error-page-loaded",
      {
        error,
        message,
        userAgent: navigator.userAgent,
        hasOpener: !!window.opener,
        url: window.location.href,
      },
    );

    // Try to notify the parent window about the failure
    let notifiedParent = false;

    // 1. Try postMessage for popup flow (standalone browser)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          {
            type: "PROCORE_OAUTH_FAILURE",
            error: error || "oauth_failed",
            message: errorMessage,
          },
          messageTargetOrigin,
        );
        notifiedParent = true;
        if (import.meta.env.DEV) {
          console.log("[Procore OAuth Error] Notified parent via postMessage");
        }
        // Close this popup window after a short delay
        setTimeout(() => {
          window.close();
        }, 500);
        return;
      } catch (postMessageError) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Procore OAuth Error] postMessage to opener failed:",
            postMessageError,
          );
        }
      }
    }

    // 2. Try Procore iframe helpers (for embedded context)
    if (procoreContext?.authentication?.notifyFailure) {
      try {
        procoreContext.authentication.notifyFailure({
          error: error || "oauth_failed",
          message: errorMessage,
        });
        notifiedParent = true;
        if (import.meta.env.DEV) {
          console.log(
            "[Procore OAuth Error] Notified via Procore iframe helpers",
          );
        }
        // If notifyFailure succeeds, the popup will close automatically
        return;
      } catch (notifyError) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Procore OAuth Error] Procore notifyFailure failed:",
            notifyError,
          );
        }
      }
    }

    // 3. Handle fallback when we couldn't notify parent
    if (!notifiedParent) {
      // Check if we're likely in a popup context
      // We check window.name (set when opening popup), window features, or small window size
      const isLikelyPopup =
        window.name === "procoreOAuth" ||
        window.outerWidth < 800 ||
        window.outerHeight < 800;

      if (isLikelyPopup) {
        // In popup context - don't redirect, just show error and instruction to close
        setStatusMessage("Please close this window and try again.");
        toast.error(errorMessage);
        if (import.meta.env.DEV) {
          console.log(
            "[Procore OAuth Error] In popup context, showing error without redirect",
          );
        }
      } else {
        // Direct navigation (not popup) - redirect to login page
        setStatusMessage("Redirecting to login...");
        toast.error(errorMessage);
        setTimeout(() => {
          router.navigate({ to: "/" });
        }, 1500);
      }
    }
  }, [error, message, origin, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center flex-col gap-4">
      <i className="bx bx-error-circle text-red-500 text-4xl"></i>
      <p className="text-gray-700">
        {message || "Procore authentication failed."}
      </p>
      <p className="text-gray-500 text-sm">{statusMessage}</p>
    </div>
  );
}
