/**
 * OAuth Callback Redirect Route - /oauth/procore/callback
 *
 * This route catches OAuth callback requests that accidentally hit the frontend
 * (e.g., if Procore redirects to the wrong URL or there's a misconfiguration)
 * and redirects them to the actual backend callback endpoint.
 *
 * This preserves the authorization code and state parameters so the backend
 * can complete the OAuth flow.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/oauth/procore/callback")({
  component: RedirectToBackendCallback,
});

function RedirectToBackendCallback() {
  useEffect(() => {
    // Use VITE_BACKEND_URL if available, otherwise fall back to production URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    // Preserve the query string (contains code and state parameters)
    const queryString = window.location.search || "";

    if (import.meta.env.DEV) {
      console.log(
        "[OAuth Callback Redirect] Redirecting to backend:",
        `${backendUrl}/oauth/procore/callback${queryString}`,
      );
    }

    // Redirect immediately to backend callback endpoint
    window.location.replace(
      `${backendUrl}/oauth/procore/callback${queryString}`,
    );
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <i className="bx bx-loader-alt bx-spin text-4xl text-brand-500"></i>
        </div>
        <p className="text-gray-600">Processing Procore authentication...</p>
      </div>
    </div>
  );
}
