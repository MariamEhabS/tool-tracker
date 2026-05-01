/**
 * OAuth Redirect Route - /oauth/procore/login
 *
 * This route catches requests that accidentally hit the frontend
 * (e.g., when VITE_BACKEND_URL is missing or the popup URL is relative)
 * and redirects them to the actual backend OAuth endpoint.
 *
 * This ensures users can complete Procore OAuth even if there's a
 * misconfiguration in the frontend environment variables.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/oauth/procore/login")({
  component: RedirectToBackendOAuth,
});

function RedirectToBackendOAuth() {
  useEffect(() => {
    // Use VITE_BACKEND_URL if available, otherwise fall back to production URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const queryString = window.location.search || "";

    if (import.meta.env.DEV) {
      console.log(
        "[OAuth Redirect] Redirecting to backend:",
        `${backendUrl}/oauth/procore/login${queryString}`,
      );
    }

    // Redirect immediately to backend OAuth endpoint
    window.location.replace(`${backendUrl}/oauth/procore/login${queryString}`);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <i className="bx bx-loader-alt bx-spin text-4xl text-brand-500"></i>
        </div>
        <p className="text-gray-600">Redirecting to Procore...</p>
      </div>
    </div>
  );
}
