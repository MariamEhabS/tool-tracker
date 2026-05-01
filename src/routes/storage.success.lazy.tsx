import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Button from "../components/ui/Button";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { addStripeAddon } from "@/api/endpoints/company";
import { logApiError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";

type Search = {
  session_id?: string;
};

export const Route = createLazyFileRoute("/storage/success")({
  component: RouteComponent,
});

function RouteComponent() {
  const company = useSelector((state: RootState) => state.company);
  const search = Route.useSearch() as Search;
  const [saving, setSaving] = useState(false);
  const submittedRef = useRef(false);
  const sessionId = search.session_id;
  const resolvedCompanyId =
    (company &&
    typeof (company as unknown as Record<string, unknown>)._id === "string"
      ? (company as { _id: string })._id
      : undefined) || getStoredUser()?.companyId;

  useEffect(() => {
    const run = async () => {
      if (!resolvedCompanyId) {
        return;
      }

      if (!sessionId) {
        return;
      }

      if (submittedRef.current) {
        return;
      }

      try {
        setSaving(true);
        submittedRef.current = true;

        await addStripeAddon(resolvedCompanyId as string, sessionId);
      } catch (error) {
        logApiError(
          error,
          "storage-addon-activation-failed",
          { sessionId },
          { level: "critical" },
        );
        if (import.meta.env.DEV) {
          console.error("Failed to add storage extension:", error);
        }
      } finally {
        setSaving(false);
      }
    };
    void run();
  }, [resolvedCompanyId, sessionId]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 text-center space-y-3">
        <i className="bx bx-check-circle text-green-600 text-4xl"></i>
        <h1 className="text-xl font-semibold">Storage extension confirmed</h1>
        <p className="text-sm text-gray-600">
          Your storage capacity has been increased.
        </p>
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => window.location.assign("/settings")}
            disabled={saving}
          >
            {saving ? "Saving…" : "Back to Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
