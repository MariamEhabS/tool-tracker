import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { initialize } from "@procore/procore-iframe-helpers";
import { logProcoreError, rollbar, ErrorCategories } from "@/utils/rollbar";
import { procoreOauthSuccess } from "@/api/endpoints/authentication";
import { setFirstName, setCompanyName } from "@/store/slices/userSlice";
import { setAuthenticated } from "@/store/slices/appSlice";

// Safely initialize Procore iframe helpers - may fail outside Procore iframe context
let procoreContext: ReturnType<typeof initialize> | null = null;
try {
  procoreContext = initialize();
} catch (_e) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Procore OAuth Success] Iframe helpers not available, will use fallback",
    );
  }
}

export const Route = createFileRoute("/procore/oauth-success")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      userId: search.userId,
      origin: search.origin,
    };
  },
});

function RouteComponent() {
  const { userId, origin } = Route.useSearch();
  const router = useRouter();
  const dispatch = useDispatch();
  const [redirectMessage, setRedirectMessage] = useState("Redirecting...");
  const [isCompleting, setIsCompleting] = useState(false);
  const directLoginStartedRef = useRef(false);

  useEffect(() => {
    if (typeof userId !== "string") {
      logProcoreError(
        new Error("Procore OAuth success page - invalid userId"),
        "oauth-success-invalid-userid",
        {
          userId,
          userIdType: typeof userId,
          url: window.location.href,
        },
      );
      router.navigate({ to: "/" });
      return;
    }

    let notifiedParent = false;

    const normalizeOrigin = (value: unknown): string | undefined => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const decoded = (() => {
        try {
          return decodeURIComponent(trimmed);
        } catch {
          return trimmed;
        }
      })();
      try {
        return new URL(decoded).origin;
      } catch {
        return undefined;
      }
    };

    const messageTargetOrigin =
      normalizeOrigin(origin) || window.location.origin;

    // Try to notify parent window via postMessage (for popup flow)
    const notifyParentViaPostMessage = () => {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            { type: "PROCORE_OAUTH_SUCCESS", userId },
            messageTargetOrigin,
          );
          notifiedParent = true;
          if (import.meta.env.DEV) {
            console.log(
              "[Procore OAuth Success] Notified parent via postMessage",
            );
          }
          // Close this popup window after a short delay
          setTimeout(() => {
            window.close();
          }, 500);
          return true;
        } catch (error) {
          logProcoreError(error, "oauth-success-postmessage-failed", {
            userId,
          });
        }
      }
      return false;
    };

    const forceCompleteInOpener = () => {
      if (!window.opener || window.opener.closed) return false;
      const completionUrl = `${messageTargetOrigin}/procore/oauth-success?userId=${encodeURIComponent(
        userId,
      )}&origin=${encodeURIComponent(messageTargetOrigin)}`;
      try {
        window.opener.location.href = completionUrl;
        notifiedParent = true;
        if (import.meta.env.DEV) {
          console.log(
            "[Procore OAuth Success] Forced opener completion via navigation",
          );
        }
        setTimeout(() => {
          window.close();
        }, 250);
        return true;
      } catch (error) {
        logProcoreError(error, "oauth-success-opener-force-redirect-failed", {
          userId,
          messageTargetOrigin,
        });
      }
      return false;
    };

    // Try to notify via Procore iframe helpers (for embedded flow)
    const notifyViaProcoreHelpers = () => {
      if (procoreContext?.authentication?.notifySuccess) {
        try {
          procoreContext.authentication.notifySuccess({
            message: "Procore authentication successful",
            userId: userId,
          });
          notifiedParent = true;
          if (import.meta.env.DEV) {
            console.log(
              "[Procore OAuth Success] Notified via Procore iframe helpers",
            );
          }
          return true;
        } catch (error) {
          logProcoreError(error, "oauth-success-procore-helpers-failed", {
            userId,
          });
        }
      }
      return false;
    };

    // Fallback: Complete login directly on this page
    const completeLoginDirectly = async () => {
      if (directLoginStartedRef.current) return;
      directLoginStartedRef.current = true;
      setIsCompleting(true);
      setRedirectMessage("Completing login...");

      try {
        const userData = await procoreOauthSuccess(userId);
        if (userData?.accessToken) {
          localStorage.setItem("accessToken", userData.accessToken);
          localStorage.removeItem("token"); // Clear stale V2 key
          dispatch(setFirstName(userData.firstName));
          dispatch(setCompanyName(userData.company));
          dispatch(setAuthenticated(true));
          // Normalize user data
          const normalizedUserData = {
            ...userData,
            _id: userData.userId || userData._id,
            companyId: userData.companyId || userData.company,
          };
          localStorage.setItem("user", JSON.stringify(normalizedUserData));

          if (import.meta.env.DEV) {
            console.log(
              "[Procore OAuth Success] Login completed directly, redirecting to dashboard",
            );
          }
          router.navigate({ to: "/dashboard" });
        } else {
          throw new Error("No access token received");
        }
      } catch (error) {
        logProcoreError(error, "oauth-direct-login-failed", { userId });
        if (import.meta.env.DEV) {
          console.error("[Procore OAuth Success] Direct login failed:", error);
        }
        // Redirect to login page with error
        router.navigate({ to: "/", search: { error: "invalid_code" } });
      }
    };

    // Notify parent via BOTH methods — different parent pages listen for different message types:
    // - ProcoreCard (settings page) uses authenticate() which expects "authentication.success"
    // - Login page (index) has its own postMessage listener expecting "PROCORE_OAUTH_SUCCESS"
    notifyViaProcoreHelpers();
    notifyParentViaPostMessage();

    // 3. Set a timeout for fallback direct login
    // If parent communication fails but opener is still active, retry signaling and keep popup flow.
    // Only complete directly when there is no opener context.
    const timeout = setTimeout(() => {
    if (!notifiedParent || (window.opener && window.opener.closed)) {
        rollbar.info("Procore OAuth success - falling back to direct login", {
          feature: ErrorCategories.PROCORE,
          action: "oauth-success-fallback-direct-login",
          metadata: {
            userId,
            notifiedParent,
            messageTargetOrigin,
            openerClosed: window.opener ? window.opener.closed : "no-opener",
            userAgent: navigator.userAgent,
          },
        });

        if (window.opener && !window.opener.closed) {
          setRedirectMessage("Finalizing sign in in your original tab...");
          const notified = notifyParentViaPostMessage();
          if (!notified) {
            const forced = forceCompleteInOpener();
            if (!forced) {
              setRedirectMessage(
                "Please return to your original tab to continue sign in.",
              );
            }
          }
          return;
        }

        completeLoginDirectly();
      }
    }, 3000);

    // Cleanup timeout on unmount
    return () => clearTimeout(timeout);
  }, [userId, origin, router, dispatch]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center flex-col gap-4">
      <i className="bx bx-check-circle text-green-600 text-4xl"></i>
      <p className="text-gray-700">Procore Login Success! {redirectMessage}</p>
      {isCompleting && (
        <p className="text-gray-500 text-sm">
          <i className="bx bx-loader-alt bx-spin mr-1"></i>
          Please wait...
        </p>
      )}
    </div>
  );
}
