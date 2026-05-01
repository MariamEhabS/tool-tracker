import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  backfillGhlCounts,
  getGhlMigrationJobStatus,
  getDevGhlSampleSelection,
  getGhlFieldsDiagnostics,
  getRawGhlOpportunityFieldsDiagnostics,
  migrateAllToGhlAsync,
  migrateDevSampleToGhl,
  migrateProductionSampleToGhl,
  previewGhlOpportunity,
  repairSingleGhlOpportunity,
  startRepairLinksAsync,
  startRepairCompanyInfoAsync,
  startRepairContactFieldsAsync,
  startRepairOpportunitiesAsync,
  updateGhlCountsDiagnostics,
  type DevGhlSampleSelectionResponse,
  type GhlBulkMigrationResult,
  type GhlMigrationJobStatusResponse,
  type MigrationErrorItem,
  type MigrateAllToGhlResponse,
  type GhlFieldsDiagnosticsResponse,
  type GhlRawOpportunityFieldsDiagnosticsResponse,
  type GhlBackfillCountsResponse,
  type GhlRepairLinksResponse,
  type GhlRepairCompanyInfoResponse,
  type GhlRepairContactFieldsResponse,
  type GhlRepairOpportunitiesResponse,
  type GhlPreviewOpportunityResponse,
  type GhlRepairSingleOpportunityResponse,
  type GhlUpdateCountsDiagnosticsResponse,
} from "@/api/endpoints/ghl";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import toast from "react-hot-toast";
import { getStoredUser, type StoredUser } from "@/utils/getStoredUser";

type MigrationStatus = "idle" | "loading" | "success" | "error";
type MigrationStep = "preparing" | "businesses" | "contacts" | "finalizing";
type MigrationAction = "sample" | "all";
type RequestErrorInfo = {
  status?: number;
  backendMessage?: string;
  backendError?: string;
  message?: string;
};

const GHL_JOB_POLL_INTERVAL_MS = 2000;
const GHL_JOB_POLL_TIMEOUT_MS = 30 * 60 * 1000;

const isMigrationErrorItem = (value: unknown): value is MigrationErrorItem => {
  if (typeof value === "string") return true;
  if (!value || typeof value !== "object") return false;
  const v = value as { message?: unknown; entity?: unknown };
  const hasMessage = typeof v.message === "string";
  const hasEntity = typeof v.entity === "string";
  if (v.message !== undefined && !hasMessage) return false;
  if (v.entity !== undefined && !hasEntity) return false;
  return hasMessage || hasEntity;
};

const isMigrationErrorItemArray = (
  value: unknown,
): value is MigrationErrorItem[] =>
  Array.isArray(value) && value.every(isMigrationErrorItem);

export const Route = createLazyFileRoute("/admin/ghl")({
  component: GhlMigrationAdmin,
});

function GhlMigrationAdmin() {
  const navigate = useNavigate();
  const isProdUi = import.meta.env.VITE_ENVIRONMENT === "production";
  const isDevUi = !isProdUi;
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [pendingAction, setPendingAction] = useState<MigrationAction | null>(
    null,
  );
  const [status, setStatus] = useState<MigrationStatus>("idle");
  const [currentStep, setCurrentStep] = useState<MigrationStep>("preparing");
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<MigrateAllToGhlResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestErrorInfo, setRequestErrorInfo] =
    useState<RequestErrorInfo | null>(null);
  const [failedAtStep, setFailedAtStep] = useState<MigrationStep | null>(null);
  const [failedElapsedSeconds, setFailedElapsedSeconds] = useState<
    number | null
  >(null);

  // Keep "live" values for async failure handlers (avoid stale closures).
  const currentStepRef = useRef<MigrationStep>(currentStep);
  const elapsedSecondsRef = useRef(elapsedSeconds);

  const resultsCardRef = useRef<HTMLDivElement | null>(null);
  const [scrollToResultsRequestId, setScrollToResultsRequestId] = useState(0);
  const lastHandledScrollRequestIdRef = useRef(0);

  const [devSelection, setDevSelection] = useState<
    DevGhlSampleSelectionResponse["data"] | null
  >(null);
  const [devSelectionError, setDevSelectionError] = useState<string | null>(
    null,
  );
  const [devSelectionLoading, setDevSelectionLoading] = useState(false);

  // Diagnostics (admin-only tools)
  const [fieldsStatus, setFieldsStatus] = useState<MigrationStatus>("idle");
  const [fieldsResult, setFieldsResult] =
    useState<GhlFieldsDiagnosticsResponse | null>(null);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [rawOppFieldsStatus, setRawOppFieldsStatus] =
    useState<MigrationStatus>("idle");
  const [rawOppFieldsResult, setRawOppFieldsResult] =
    useState<GhlRawOpportunityFieldsDiagnosticsResponse | null>(null);
  const [rawOppFieldsError, setRawOppFieldsError] = useState<string | null>(
    null,
  );

  const [diagnosticsCompanyId, setDiagnosticsCompanyId] = useState<string>("");
  const [updateCountsStatus, setUpdateCountsStatus] =
    useState<MigrationStatus>("idle");
  const [updateCountsResult, setUpdateCountsResult] =
    useState<GhlUpdateCountsDiagnosticsResponse | null>(null);
  const [updateCountsError, setUpdateCountsError] = useState<string | null>(
    null,
  );

  const [backfillCompanyIdsText, setBackfillCompanyIdsText] =
    useState<string>("");
  const [backfillLimit, setBackfillLimit] = useState<string>("");
  const [backfillCreateMissing, setBackfillCreateMissing] = useState(false);
  const [backfillConfirm, setBackfillConfirm] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<MigrationStatus>("idle");
  const [backfillResult, setBackfillResult] =
    useState<GhlBackfillCountsResponse | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  // Repair links state
  const [repairLimit, setRepairLimit] = useState<string>("");
  const [repairConfirm, setRepairConfirm] = useState(false);
  const [repairStatus, setRepairStatus] = useState<MigrationStatus>("idle");
  const [repairResult, setRepairResult] =
    useState<GhlRepairLinksResponse | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  // Repair company info state
  const [companyInfoLimit, setCompanyInfoLimit] = useState<string>("");
  const [companyInfoConfirm, setCompanyInfoConfirm] = useState(false);
  const [companyInfoStatus, setCompanyInfoStatus] =
    useState<MigrationStatus>("idle");
  const [companyInfoResult, setCompanyInfoResult] =
    useState<GhlRepairCompanyInfoResponse | null>(null);
  const [companyInfoError, setCompanyInfoError] = useState<string | null>(null);

  // Repair contact fields state
  const [contactFieldsLimit, setContactFieldsLimit] = useState<string>("");
  const [contactFieldsConfirm, setContactFieldsConfirm] = useState(false);
  const [contactFieldsStatus, setContactFieldsStatus] =
    useState<MigrationStatus>("idle");
  const [contactFieldsResult, setContactFieldsResult] =
    useState<GhlRepairContactFieldsResponse | null>(null);
  const [contactFieldsError, setContactFieldsError] = useState<string | null>(
    null,
  );

  // Repair opportunities state
  const [oppRepairLimit, setOppRepairLimit] = useState<string>("");
  const [oppRepairConfirm, setOppRepairConfirm] = useState(false);
  const [oppRepairStatus, setOppRepairStatus] =
    useState<MigrationStatus>("idle");
  const [oppRepairResult, setOppRepairResult] =
    useState<GhlRepairOpportunitiesResponse | null>(null);
  const [oppRepairError, setOppRepairError] = useState<string | null>(null);

  const [oppSingleCompanyId, setOppSingleCompanyId] = useState("");
  const [oppPreviewStatus, setOppPreviewStatus] =
    useState<MigrationStatus>("idle");
  const [oppPreviewResult, setOppPreviewResult] =
    useState<GhlPreviewOpportunityResponse | null>(null);
  const [oppPreviewError, setOppPreviewError] = useState<string | null>(null);
  const [oppSingleRepairConfirm, setOppSingleRepairConfirm] = useState(false);
  const [oppSingleRepairStatus, setOppSingleRepairStatus] =
    useState<MigrationStatus>("idle");
  const [oppSingleRepairResult, setOppSingleRepairResult] =
    useState<GhlRepairSingleOpportunityResponse | null>(null);
  const [oppSingleRepairError, setOppSingleRepairError] = useState<
    string | null
  >(null);

  const candidateCompanyIds: string[] = Array.from(
    new Set(
      (result?.data?.selectedCompanies ?? devSelection?.selectedCompanies ?? [])
        .map((c) => c.companyId)
        .filter(Boolean),
    ),
  );

  const migrationSteps: Array<{
    id: MigrationStep;
    title: string;
    description: string;
  }> = [
    {
      id: "preparing",
      title: "Preparing migration",
      description: "Requesting the backend to start the GHL migration job.",
    },
    {
      id: "businesses",
      title: "Syncing Businesses (Companies)",
      description:
        "Upserting companies into Go High Level as Businesses (+ Opportunities).",
    },
    {
      id: "contacts",
      title: "Syncing Contacts (Users)",
      description:
        "Upserting users into Go High Level as Contacts and linking to Businesses.",
    },
    {
      id: "finalizing",
      title: "Finalizing",
      description: "Collecting results and error details from the backend.",
    },
  ];

  const currentStepIndex = Math.max(
    0,
    migrationSteps.findIndex((s) => s.id === currentStep),
  );

  const formatElapsed = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    // Primary path: Clipboard API
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy fallback
    }

    // Fallback: execCommand
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyCompanyIds = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids ?? []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      toast.error("No company IDs to copy yet.");
      return;
    }

    const text = uniqueIds.join("\n");
    const ok = await copyTextToClipboard(text);
    if (ok) {
      toast.success(
        `Copied ${uniqueIds.length} company ID${uniqueIds.length === 1 ? "" : "s"} to clipboard.`,
      );
      return;
    }

    // Last-resort fallback: show a prompt so the user can manually copy.
    // (Some browsers block clipboard access on non-HTTPS origins.)
    try {
      window.prompt("Copy company IDs:", text);
    } catch {
      // ignore
    }
    toast("Company IDs ready to copy.");
  };

  const inferStepFromErrorMessage = (message: string): MigrationStep => {
    const msg = message.toLowerCase();
    if (msg.includes("user") || msg.includes("contact")) return "contacts";
    if (msg.includes("company") || msg.includes("business"))
      return "businesses";
    return "finalizing";
  };

  const normalizeError = (
    err: MigrationErrorItem,
  ): { message: string; entity?: string; step: MigrationStep } => {
    if (typeof err === "string") {
      return { message: err, step: inferStepFromErrorMessage(err) };
    }
    const message =
      typeof err?.message === "string" && err.message.trim()
        ? err.message
        : "Unknown migration error";
    return {
      message,
      entity: typeof err?.entity === "string" ? err.entity : undefined,
      step: inferStepFromErrorMessage(message),
    };
  };

  const getStepMeta = (step: MigrationStep) =>
    migrationSteps.find((s) => s.id === step) ?? migrationSteps[0];

  const getFriendlyFailureHint = (step: MigrationStep): string => {
    switch (step) {
      case "businesses":
        return "The sync hit a problem while creating/updating GHL Businesses (Companies).";
      case "contacts":
        return "The sync hit a problem while creating/updating GHL Contacts (Users).";
      case "preparing":
        return "The migration request failed before the sync could begin.";
      case "finalizing":
      default:
        return "The sync hit a problem while wrapping up and collecting results.";
    }
  };

  const inferStepFromJobOperation = (
    operation?: string,
    fallback: MigrationStep = "businesses",
  ): MigrationStep => {
    const op = String(operation || "").toLowerCase();
    if (!op) return fallback;
    if (
      op.includes("contact") ||
      op.includes("user") ||
      op.includes("champion")
    ) {
      return "contacts";
    }
    if (
      op.includes("final") ||
      op.includes("completed") ||
      op.includes("complete")
    ) {
      return "finalizing";
    }
    if (op.includes("start") || op.includes("prepar")) {
      return "preparing";
    }
    return "businesses";
  };

  const toMigrateAllResponse = (
    jobResult: GhlBulkMigrationResult,
  ): MigrateAllToGhlResponse => {
    const errors = Array.isArray(jobResult.errors) ? jobResult.errors : [];
    return {
      success: !!jobResult.success,
      message: jobResult.success
        ? "Migration completed successfully"
        : "Migration completed with errors",
      data: {
        businessesMigrated: jobResult.businessesMigrated ?? 0,
        contactsMigrated: jobResult.contactsMigrated ?? 0,
        opportunitiesUpserted: jobResult.opportunitiesUpserted ?? 0,
        errorsCount: errors.length,
        errors,
        ...(jobResult.selectedCompanies
          ? { selectedCompanies: jobResult.selectedCompanies }
          : {}),
        ...(jobResult.description
          ? { description: jobResult.description }
          : {}),
      },
    };
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const waitForGhlRepairJob = async (jobId: string): Promise<unknown> => {
    const startedAt = Date.now();
    while (true) {
      if (Date.now() - startedAt > GHL_JOB_POLL_TIMEOUT_MS) {
        throw new Error("Repair job polling timed out");
      }
      const statusResp = await getGhlMigrationJobStatus(jobId);
      const job = statusResp?.data;
      const state = String(job?.status || "").toLowerCase();
      if (state === "completed") return job?.result ?? {};
      if (state === "failed" || state === "cancelled") {
        throw new Error(job?.error || `Repair job ${state}`);
      }
      await sleep(GHL_JOB_POLL_INTERVAL_MS);
    }
  };

  const waitForGhlMigrationJob = async (
    jobId: string,
  ): Promise<MigrateAllToGhlResponse> => {
    const startedAt = Date.now();

    while (true) {
      if (Date.now() - startedAt > GHL_JOB_POLL_TIMEOUT_MS) {
        throw new Error("Migration job polling timed out");
      }

      const statusResp: GhlMigrationJobStatusResponse =
        await getGhlMigrationJobStatus(jobId);
      const job = statusResp?.data;
      const state = String(job?.status || "").toLowerCase();

      const inferredStep = inferStepFromJobOperation(job?.currentOperation);
      setCurrentStep((prev) => {
        const next = prev === inferredStep ? prev : inferredStep;
        currentStepRef.current = next;
        return next;
      });

      if (state === "completed") {
        if (job?.result) return toMigrateAllResponse(job.result);
        return {
          success: true,
          message: "Migration completed successfully",
          data: {
            businessesMigrated: 0,
            contactsMigrated: 0,
            opportunitiesUpserted: 0,
            errorsCount: 0,
            errors: [],
          },
        };
      }

      if (state === "failed" || state === "cancelled") {
        throw new Error(job?.error || `Migration job ${state}`);
      }

      await sleep(GHL_JOB_POLL_INTERVAL_MS);
    }
  };

  const rawErrors: MigrationErrorItem[] = (() => {
    const errors: unknown = result?.data?.errors;

    if (isMigrationErrorItemArray(errors)) return errors;

    // If the backend returns an errors payload but it doesn't match our expected
    // schema, warn so we don't silently drop potentially useful diagnostics.
    const hasNonEmptyMalformedPayload = (() => {
      if (errors == null) return false;
      if (Array.isArray(errors)) return errors.length > 0;
      if (typeof errors === "string") return errors.trim().length > 0;
      if (typeof errors === "object") {
        return Object.keys(errors as Record<string, unknown>).length > 0;
      }
      return true;
    })();

    if (hasNonEmptyMalformedPayload) {
      if (import.meta.env.DEV) {
        console.warn(
          "[ghl-migration] Invalid `result.data.errors` payload; expected MigrationErrorItem[]",
          errors,
        );
      }
    }

    return [];
  })();
  const normalizedErrors = rawErrors.map(normalizeError);
  const errorCountsByStep = normalizedErrors.reduce(
    (acc, e) => {
      acc[e.step] += 1;
      return acc;
    },
    { preparing: 0, businesses: 0, contacts: 0, finalizing: 0 } as Record<
      MigrationStep,
      number
    >,
  );

  const likelyFailureStep: MigrationStep =
    status === "error" && result
      ? (Object.entries(errorCountsByStep).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] as MigrationStep | undefined) || "finalizing"
      : failedAtStep || currentStep;

  const likelyFailureMeta = getStepMeta(likelyFailureStep);

  // Check authorization on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);

    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      // Redirect unauthorized users to dashboard
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  const loadDevSelection = useCallback(async () => {
    if (!isDevUi) return;
    setDevSelectionLoading(true);
    setDevSelectionError(null);
    try {
      const resp = await getDevGhlSampleSelection();
      setDevSelection(resp.data);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      setDevSelectionError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to load dev sample selection",
      );
      setDevSelection(null);
    } finally {
      setDevSelectionLoading(false);
    }
  }, [isDevUi]);

  useEffect(() => {
    if (!authorized) return;
    if (!isDevUi) return;
    void loadDevSelection();
  }, [authorized, isDevUi, loadDevSelection]);

  // While migration is running, show a step indicator for better UX.
  // Note: the backend currently returns a single response at the end (no streaming),
  // so step updates are best-effort based on elapsed time + request lifecycle.
  useEffect(() => {
    if (status !== "loading" || !startedAtMs) return;

    const intervalId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      elapsedSecondsRef.current = elapsed;
      setElapsedSeconds(elapsed);

      // Best-effort "phase" estimation:
      // - short prepare window
      // - then businesses
      // - then contacts for the remainder (businesses/contacts interleave per company)
      const nextStep: MigrationStep =
        elapsed < 2 ? "preparing" : elapsed < 20 ? "businesses" : "contacts";

      setCurrentStep((prev) => {
        const next = prev === nextStep ? prev : nextStep;
        currentStepRef.current = next;
        return next;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [status, startedAtMs]);

  useEffect(() => {
    if (scrollToResultsRequestId === 0) return;
    if (lastHandledScrollRequestIdRef.current === scrollToResultsRequestId)
      return;
    if (status === "idle") return;
    const el = resultsCardRef.current;
    if (!el) return;

    lastHandledScrollRequestIdRef.current = scrollToResultsRequestId;

    // Wait a frame so the modal close + results card paint happen before scrolling.
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [scrollToResultsRequestId, status]);

  const handleStartMigration = async (action: MigrationAction) => {
    // Keep the selected action while the request runs so the UI can show which
    // migration is in progress (sample vs full).
    setPendingAction(action);
    setStatus("loading");
    setResult(null);
    setErrorMessage(null);
    setRequestErrorInfo(null);
    setFailedAtStep(null);
    setFailedElapsedSeconds(null);
    setScrollToResultsRequestId((prev) => prev + 1);
    const startedAt = Date.now();
    setStartedAtMs(startedAt);
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    currentStepRef.current = "preparing";
    setCurrentStep("preparing");

    try {
      const response =
        action === "all" && !isDevUi
          ? await (async () => {
              const kickoff = await migrateAllToGhlAsync();
              const jobId = String(kickoff?.data?.jobId || "").trim();
              if (!jobId) {
                throw new Error("Migration job did not return a valid jobId");
              }
              return waitForGhlMigrationJob(jobId);
            })()
          : isDevUi
            ? await migrateDevSampleToGhl()
            : await migrateProductionSampleToGhl();
      currentStepRef.current = "finalizing";
      setCurrentStep("finalizing");
      setResult(response);
      setStatus(response.success ? "success" : "error");
    } catch (err: unknown) {
      const error = err as {
        response?: {
          status?: number;
          data?: { message?: string; error?: string };
        };
        message?: string;
      };
      setFailedAtStep(currentStepRef.current);
      setFailedElapsedSeconds(elapsedSecondsRef.current);
      setRequestErrorInfo({
        status: error?.response?.status,
        backendMessage: error?.response?.data?.message,
        backendError: error?.response?.data?.error,
        message: error?.message,
      });
      setErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "An unexpected error occurred",
      );
      setStatus("error");
    } finally {
      setStartedAtMs(null);
      setPendingAction(null);
    }
  };

  const runFieldsDiagnostics = async () => {
    setFieldsStatus("loading");
    setFieldsResult(null);
    setFieldsError(null);
    try {
      const resp = await getGhlFieldsDiagnostics();
      setFieldsResult(resp);
      setFieldsStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Fetched GHL field diagnostics.");
      } else {
        toast.error(resp.message || "Failed to fetch GHL field diagnostics.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to fetch GHL field diagnostics";
      setFieldsError(msg);
      setFieldsStatus("error");
      toast.error(msg);
    }
  };

  const runRawOpportunityFieldsDiagnostics = async () => {
    setRawOppFieldsStatus("loading");
    setRawOppFieldsResult(null);
    setRawOppFieldsError(null);
    try {
      const resp = await getRawGhlOpportunityFieldsDiagnostics();
      setRawOppFieldsResult(resp);
      setRawOppFieldsStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Fetched raw opportunity field diagnostics.");
      } else {
        toast.error(
          resp.message || "Failed to fetch raw opportunity field diagnostics.",
        );
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to fetch raw opportunity field diagnostics";
      setRawOppFieldsError(msg);
      setRawOppFieldsStatus("error");
      toast.error(msg);
    }
  };

  const runUpdateCountsDiagnostics = async (companyId: string) => {
    const id = String(companyId || "").trim();
    if (!id) {
      toast.error("Company ID is required.");
      return;
    }

    setUpdateCountsStatus("loading");
    setUpdateCountsResult(null);
    setUpdateCountsError(null);

    try {
      const resp = await updateGhlCountsDiagnostics(id);
      setUpdateCountsResult(resp);
      setUpdateCountsStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Counts diagnostics completed.");
      } else {
        toast.error(resp.message || "Counts diagnostics returned an error.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Counts diagnostics failed";
      setUpdateCountsError(msg);
      setUpdateCountsStatus("error");
      toast.error(msg);
    }
  };

  const runPreviewOpportunity = async (companyId: string) => {
    const id = String(companyId || "").trim();
    if (!id) {
      toast.error("Company ID is required.");
      return;
    }

    setOppPreviewStatus("loading");
    setOppPreviewResult(null);
    setOppPreviewError(null);

    try {
      const resp = await previewGhlOpportunity(id);
      setOppPreviewResult(resp);
      setOppPreviewStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Loaded opportunity preview.");
      } else {
        toast.error(resp.message || "Opportunity preview returned an error.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to preview opportunity sync";
      setOppPreviewError(msg);
      setOppPreviewStatus("error");
      toast.error(msg);
    }
  };

  const runSafeRepairOpportunity = async (companyId: string) => {
    const id = String(companyId || "").trim();
    if (!id) {
      toast.error("Company ID is required.");
      return;
    }
    if (!oppSingleRepairConfirm) {
      toast.error("Please confirm the safe repair before running it.");
      return;
    }

    setOppSingleRepairStatus("loading");
    setOppSingleRepairResult(null);
    setOppSingleRepairError(null);

    try {
      const resp = await repairSingleGhlOpportunity({
        companyId: id,
        confirm: true,
      });
      setOppSingleRepairResult(resp);
      setOppSingleRepairStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success(resp.message || "Safe opportunity repair completed.");
      } else {
        toast.error(resp.message || "Safe opportunity repair returned an error.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Safe opportunity repair failed";
      setOppSingleRepairError(msg);
      setOppSingleRepairStatus("error");
      toast.error(msg);
    }
  };

  const parseCompanyIdsInput = (text: string): string[] => {
    const raw = String(text || "");
    const parts = raw
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  };

  const companyIds = parseCompanyIdsInput(backfillCompanyIdsText);
  const limitRaw = String(backfillLimit || "").trim();
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const hasLimit =
    typeof parsedLimit === "number" &&
    Number.isFinite(parsedLimit) &&
    parsedLimit > 0;
  const limit = hasLimit ? parsedLimit : undefined;

  const runBackfillCounts = async () => {
    if (limitRaw && !hasLimit) {
      toast.error("Invalid limit: please enter a positive number");
      return;
    }

    if (!backfillConfirm) {
      toast.error("Please confirm backfill before running.");
      return;
    }

    if (companyIds.length === 0 && !hasLimit) {
      toast.error("Provide company IDs or a positive limit.");
      return;
    }

    setBackfillStatus("loading");
    setBackfillResult(null);
    setBackfillError(null);
    try {
      const resp = await backfillGhlCounts({
        confirm: true,
        companyIds: companyIds.length ? companyIds : undefined,
        limit: hasLimit ? limit : undefined,
        createMissing: backfillCreateMissing ? true : undefined,
      });
      setBackfillResult(resp);
      setBackfillStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Backfill completed.");
      } else {
        toast.error(resp.message || "Backfill completed with errors.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Backfill failed";
      setBackfillError(msg);
      setBackfillStatus("error");
      toast.error(msg);
    }
  };

  const runRepairLinks = async () => {
    if (!repairConfirm) {
      toast.error("Please confirm repair before running.");
      return;
    }

    const repairLimitRaw = String(repairLimit || "").trim();
    const parsedRepairLimit = repairLimitRaw ? Number(repairLimitRaw) : undefined;
    const hasRepairLimit =
      typeof parsedRepairLimit === "number" &&
      Number.isFinite(parsedRepairLimit) &&
      parsedRepairLimit > 0;

    if (repairLimitRaw && !hasRepairLimit) {
      toast.error("Invalid limit: please enter a positive number");
      return;
    }

    setRepairStatus("loading");
    setRepairResult(null);
    setRepairError(null);
    try {
      const start = await startRepairLinksAsync({
        confirm: true,
        limit: hasRepairLimit ? parsedRepairLimit : undefined,
      });
      const resp = (await waitForGhlRepairJob(
        start.data.jobId,
      )) as GhlRepairLinksResponse;
      setRepairResult(resp);
      setRepairStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Repair completed.");
      } else {
        toast.error(resp.message || "Repair completed with errors.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Repair failed";
      setRepairError(msg);
      setRepairStatus("error");
      toast.error(msg);
    }
  };

  const runRepairCompanyInfo = async () => {
    if (!companyInfoConfirm) {
      toast.error("Please confirm repair before running.");
      return;
    }

    const limitRaw = String(companyInfoLimit || "").trim();
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const hasLimit =
      typeof parsedLimit === "number" &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0;

    if (limitRaw && !hasLimit) {
      toast.error("Invalid limit: please enter a positive number");
      return;
    }

    setCompanyInfoStatus("loading");
    setCompanyInfoResult(null);
    setCompanyInfoError(null);
    try {
      const start = await startRepairCompanyInfoAsync({
        confirm: true,
        limit: hasLimit ? parsedLimit : undefined,
      });
      const resp = (await waitForGhlRepairJob(
        start.data.jobId,
      )) as GhlRepairCompanyInfoResponse;
      setCompanyInfoResult(resp);
      setCompanyInfoStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Company info repair completed.");
      } else {
        toast.error(
          resp.message || "Company info repair completed with errors.",
        );
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Company info repair failed";
      setCompanyInfoError(msg);
      setCompanyInfoStatus("error");
      toast.error(msg);
    }
  };

  const runRepairContactFields = async () => {
    if (!contactFieldsConfirm) {
      toast.error("Please confirm repair before running.");
      return;
    }

    const limitRaw = String(contactFieldsLimit || "").trim();
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const hasLimit =
      typeof parsedLimit === "number" &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0;

    if (limitRaw && !hasLimit) {
      toast.error("Invalid limit: please enter a positive number");
      return;
    }

    setContactFieldsStatus("loading");
    setContactFieldsResult(null);
    setContactFieldsError(null);
    try {
      const start = await startRepairContactFieldsAsync({
        confirm: true,
        limit: hasLimit ? parsedLimit : undefined,
      });
      const resp = (await waitForGhlRepairJob(
        start.data.jobId,
      )) as GhlRepairContactFieldsResponse;
      setContactFieldsResult(resp);
      setContactFieldsStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Contact fields repair completed.");
      } else {
        toast.error(
          resp.message || "Contact fields repair completed with errors.",
        );
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Contact fields repair failed";
      setContactFieldsError(msg);
      setContactFieldsStatus("error");
      toast.error(msg);
    }
  };

  const runRepairOpportunities = async () => {
    if (!oppRepairConfirm) {
      toast.error("Please confirm repair before running.");
      return;
    }

    const limitRaw = String(oppRepairLimit || "").trim();
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const hasLimit =
      typeof parsedLimit === "number" &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0;

    if (limitRaw && !hasLimit) {
      toast.error("Invalid limit: please enter a positive number");
      return;
    }

    setOppRepairStatus("loading");
    setOppRepairResult(null);
    setOppRepairError(null);
    try {
      const start = await startRepairOpportunitiesAsync({
        confirm: true,
        limit: hasLimit ? parsedLimit : undefined,
      });
      const resp = (await waitForGhlRepairJob(
        start.data.jobId,
      )) as GhlRepairOpportunitiesResponse;
      setOppRepairResult(resp);
      setOppRepairStatus(resp.success ? "success" : "error");
      if (resp.success) {
        toast.success("Opportunities repair completed.");
      } else {
        toast.error(
          resp.message || "Opportunities repair completed with errors.",
        );
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Opportunities repair failed";
      setOppRepairError(msg);
      setOppRepairStatus("error");
      toast.error(msg);
    }
  };

  // Show loading while checking auth
  if (authorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // Don't render if not authorized (redirect will happen)
  if (!authorized) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-screen p-8">
          <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                  <i className="bx bx-cloud-upload text-emerald-600 mr-2"></i>
                  Go High Level CRM Migration
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Bulk migrate all companies and users to Go High Level CRM.
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                <i className="bx bx-shield mr-1"></i>
                Admin Only
              </span>
            </div>

            {/* Info Card */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <i className="bx bx-info-circle text-emerald-600 text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    What this migration does
                  </h2>
                  <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <i className="bx bx-check text-emerald-500"></i>
                      Syncs all companies as <strong>Businesses</strong> in Go
                      High Level
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="bx bx-check text-emerald-500"></i>
                      Syncs all users as <strong>Contacts</strong> in Go High
                      Level
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="bx bx-check text-emerald-500"></i>
                      Creates a related <strong>Opportunity</strong> for each
                      Business
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="bx bx-check text-emerald-500"></i>
                      Links Contacts to their respective Businesses
                    </li>
                  </ul>

                  {isDevUi && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <i className="bx bx-test-tube text-amber-700 text-lg"></i>
                        <div className="text-sm text-amber-900">
                          <div className="font-semibold">
                            Development test mode
                          </div>
                          <div className="mt-1">
                            This page will only migrate{" "}
                            <strong>3 companies</strong> (auto-selected as the
                            "richest" records) and all users of those companies,
                            to avoid cluttering Go High Level.
                          </div>
                          <div className="mt-2 text-xs text-amber-800">
                            Records will be tagged with:
                            <span className="ml-1 font-mono">
                              {devSelection?.description ||
                                "FOR DEVELOPMENT PURPOSES ONLY. DELETE AFTER TESTING IS COMPLETE."}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="bx bx-user text-gray-400"></i>
                  Logged in as:{" "}
                  <span className="font-medium">{user?.email}</span>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Start Migration
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isDevUi
                      ? "This process may take several minutes depending on the amount of data."
                      : "Run a 3-company sample first, then run the full migration when ready."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isDevUi ? (
                    <Button
                      type="button"
                      variant="primary"
                      leftIconClass={
                        status === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-play"
                      }
                      disabled={status === "loading"}
                      onClick={() => setPendingAction("sample")}
                    >
                      {status === "loading"
                        ? "Migrating..."
                        : "Run DEV Sample Migration"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        leftIconClass={
                          status === "loading" && pendingAction === "sample"
                            ? "bx bx-loader-alt animate-spin"
                            : "bx bx-test-tube"
                        }
                        disabled={status === "loading"}
                        onClick={() => setPendingAction("sample")}
                      >
                        {status === "loading" && pendingAction === "sample"
                          ? "Running sample..."
                          : "Run sample (3 companies)"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        leftIconClass={
                          status === "loading" && pendingAction === "all"
                            ? "bx bx-loader-alt animate-spin"
                            : "bx bx-cloud-upload"
                        }
                        disabled={status === "loading"}
                        onClick={() => setPendingAction("all")}
                      >
                        {status === "loading" && pendingAction === "all"
                          ? "Running full migration..."
                          : "Run full migration"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isDevUi && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Selected companies (preview)
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Auto-selected as the 3 companies with the most available
                        data.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        leftIconClass="bx bx-copy"
                        className="text-xs px-2 py-1"
                        disabled={
                          status === "loading" ||
                          devSelectionLoading ||
                          !devSelection?.selectedCompanies?.length
                        }
                        onClick={() =>
                          void handleCopyCompanyIds(
                            devSelection?.selectedCompanies?.map(
                              (c) => c.companyId,
                            ) ?? [],
                          )
                        }
                      >
                        Copy company IDs
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        leftIconClass={
                          devSelectionLoading
                            ? "bx bx-loader-alt animate-spin"
                            : "bx bx-refresh"
                        }
                        disabled={devSelectionLoading || status === "loading"}
                        onClick={() => void loadDevSelection()}
                      >
                        {devSelectionLoading ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>
                  </div>

                  {devSelectionError && (
                    <div className="mt-3 text-sm text-red-700">
                      {devSelectionError}
                    </div>
                  )}

                  {!devSelectionError && devSelection?.selectedCompanies && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <ul className="divide-y divide-gray-200">
                        {devSelection.selectedCompanies.map((c) => (
                          <li key={c.companyId} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {c.companyName}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {c.companyId}
                                </div>
                              </div>
                              <div className="flex gap-2 text-xs text-gray-600 tabular-nums">
                                <span className="px-2 py-1 rounded-full bg-white border border-gray-200">
                                  Users: {c.usersCount}
                                </span>
                                <span className="px-2 py-1 rounded-full bg-white border border-gray-200">
                                  Score: {c.score}
                                </span>
                              </div>
                            </div>
                            {c.hasGhlBusinessId && (
                              <div className="mt-2 text-xs text-amber-700">
                                Note: this company already has a stored GHL
                                Business ID and will be updated (upsert), not
                                created.
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Diagnostics Card */}
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Diagnostics
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Admin-only tools to verify GHL field mappings and push count
                  updates.
                </p>
              </div>

              {/* GHL fields diagnostics */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      GHL field diagnostics
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Calls{" "}
                      <span className="font-mono">
                        GET /ghl/diagnostics/fields
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass={
                      fieldsStatus === "loading"
                        ? "bx bx-loader-alt animate-spin"
                        : "bx bx-list-check"
                    }
                    disabled={
                      status === "loading" || fieldsStatus === "loading"
                    }
                    onClick={() => void runFieldsDiagnostics()}
                  >
                    {fieldsStatus === "loading"
                      ? "Fetching..."
                      : "Fetch fields"}
                  </Button>
                </div>

                {(fieldsError || fieldsResult) && (
                  <div className="mt-3">
                    {fieldsError && (
                      <div className="text-sm text-red-700">{fieldsError}</div>
                    )}
                    {fieldsResult?.data?.expectedFields?.length ? (
                      <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200">
                          Expected fields
                        </div>
                        <ul className="divide-y divide-gray-100">
                          {fieldsResult.data.expectedFields.map((f, index) => {
                            const fieldName =
                              (
                                f as unknown as {
                                  apiName?: string;
                                  key?: string;
                                  fieldKey?: string;
                                  id?: string;
                                }
                              ).apiName ||
                              (
                                f as unknown as {
                                  apiName?: string;
                                  key?: string;
                                  fieldKey?: string;
                                  id?: string;
                                }
                              ).key ||
                              (
                                f as unknown as {
                                  apiName?: string;
                                  key?: string;
                                  fieldKey?: string;
                                  id?: string;
                                }
                              ).fieldKey ||
                              (
                                f as unknown as {
                                  apiName?: string;
                                  key?: string;
                                  fieldKey?: string;
                                  id?: string;
                                }
                              ).id ||
                              `field-${index}`;

                            return (
                              <li
                                key={fieldName}
                                className="px-4 py-2 text-sm flex items-center justify-between gap-3"
                              >
                                <span className="font-mono text-gray-800">
                                  {fieldName}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full border ${
                                    f.exists
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                                  }`}
                                >
                                  {f.exists ? "exists" : "missing"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        <details className="px-4 py-3 border-t border-gray-200">
                          <summary className="cursor-pointer text-xs text-gray-600">
                            View QR-related GHL fields
                          </summary>
                          <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(
                              fieldsResult.data.qrRelatedFields,
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border border-sky-200 rounded-lg p-4 bg-sky-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-sky-900">
                      Raw opportunity field diagnostics
                    </div>
                    <div className="text-xs text-sky-800 mt-1">
                      Fetch the exact opportunity field sources the backend
                      resolver is using and see whether each expected
                      opportunity field resolves to a real GHL UUID or a
                      fallback key.
                      <br />
                      Calls{" "}
                      <span className="font-mono">
                        GET /ghl/diagnostics/opportunity-fields-raw
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass={
                      rawOppFieldsStatus === "loading"
                        ? "bx bx-loader-alt animate-spin"
                        : "bx bx-code-block"
                    }
                    disabled={
                      status === "loading" || rawOppFieldsStatus === "loading"
                    }
                    onClick={() => void runRawOpportunityFieldsDiagnostics()}
                  >
                    {rawOppFieldsStatus === "loading"
                      ? "Fetching..."
                      : "Fetch raw opportunity fields"}
                  </Button>
                </div>

                {(rawOppFieldsError || rawOppFieldsResult?.data) && (
                  <div className="mt-3 space-y-3">
                    {rawOppFieldsError && (
                      <div className="text-sm text-red-700">
                        {rawOppFieldsError}
                      </div>
                    )}

                    {rawOppFieldsResult?.data && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white rounded p-2 border border-sky-100">
                            <div className="text-gray-500">Expected fields</div>
                            <div className="font-semibold">
                              {rawOppFieldsResult.data.expectedFieldKeys.length}
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border border-sky-100">
                            <div className="text-gray-500">Resolved UUIDs</div>
                            <div className="font-semibold text-emerald-700">
                              {
                                rawOppFieldsResult.data.resolvedFields.filter(
                                  (field) => !field.usesFallbackId,
                                ).length
                              }
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border border-sky-100">
                            <div className="text-gray-500">Fallback IDs</div>
                            <div className="font-semibold text-red-700">
                              {
                                rawOppFieldsResult.data.resolvedFields.filter(
                                  (field) => field.usesFallbackId,
                                ).length
                              }
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border border-sky-100">
                            <div className="text-gray-500">
                              Opportunity source rows
                            </div>
                            <div className="font-semibold">
                              {rawOppFieldsResult.data.opportunityObjectFields.length}
                            </div>
                          </div>
                        </div>

                        <details className="bg-white border border-sky-200 rounded-lg p-3">
                          <summary className="cursor-pointer text-sm font-medium text-sky-900">
                            View raw opportunity field diagnostics
                          </summary>
                          <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
                            {JSON.stringify(rawOppFieldsResult.data, null, 2)}
                          </pre>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Update-counts diagnostics */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Update counts diagnostics (single company)
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/diagnostics/update-counts/:companyId
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass={
                        updateCountsStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-refresh"
                      }
                      disabled={
                        status === "loading" ||
                        updateCountsStatus === "loading" ||
                        !String(diagnosticsCompanyId || "").trim()
                      }
                      onClick={() =>
                        void runUpdateCountsDiagnostics(diagnosticsCompanyId)
                      }
                    >
                      {updateCountsStatus === "loading"
                        ? "Running..."
                        : "Run diagnostics"}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label
                        htmlFor="ghl-diagnostics-company-id"
                        className="block text-xs font-semibold text-gray-700 mb-1"
                      >
                        Company ID (Mongo ObjectId)
                      </label>
                      <input
                        id="ghl-diagnostics-company-id"
                        value={diagnosticsCompanyId}
                        onChange={(e) =>
                          setDiagnosticsCompanyId(e.target.value)
                        }
                        placeholder="Company ID (Mongo ObjectId)"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    {candidateCompanyIds.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        leftIconClass="bx bx-copy"
                        disabled={
                          status === "loading" ||
                          updateCountsStatus === "loading"
                        }
                        onClick={() =>
                          setDiagnosticsCompanyId(candidateCompanyIds[0] || "")
                        }
                      >
                        Use sample company
                      </Button>
                    )}
                  </div>

                  {updateCountsError && (
                    <div className="text-sm text-red-700">
                      {updateCountsError}
                    </div>
                  )}

                  {updateCountsResult?.data && (
                    <details className="bg-white border border-gray-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700">
                        View diagnostics response
                      </summary>
                      <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(updateCountsResult, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Backfill counts */}
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        Backfill count fields (danger)
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/backfill-counts
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass={
                        backfillStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-play"
                      }
                      disabled={
                        status === "loading" ||
                        backfillStatus === "loading" ||
                        !backfillConfirm ||
                        (companyIds.length === 0 && !limit)
                      }
                      onClick={() => void runBackfillCounts()}
                    >
                      {backfillStatus === "loading"
                        ? "Backfilling..."
                        : "Run backfill"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="ghl-backfill-company-ids"
                        className="block text-xs font-semibold text-amber-900 mb-1"
                      >
                        Company IDs (optional)
                      </label>
                      <textarea
                        id="ghl-backfill-company-ids"
                        value={backfillCompanyIdsText}
                        onChange={(e) =>
                          setBackfillCompanyIdsText(e.target.value)
                        }
                        placeholder="One companyId per line (optional)"
                        className="w-full min-h-[90px] rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                      />
                      {candidateCompanyIds.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            leftIconClass="bx bx-paste"
                            disabled={
                              status === "loading" ||
                              backfillStatus === "loading"
                            }
                            onClick={() =>
                              setBackfillCompanyIdsText(
                                candidateCompanyIds.join("\n"),
                              )
                            }
                          >
                            Use sample IDs
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            leftIconClass="bx bx-x"
                            disabled={
                              status === "loading" ||
                              backfillStatus === "loading"
                            }
                            onClick={() => setBackfillCompanyIdsText("")}
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="ghl-backfill-limit"
                          className="block text-xs font-semibold text-amber-900 mb-1"
                        >
                          Limit (optional)
                        </label>
                        <input
                          id="ghl-backfill-limit"
                          value={backfillLimit}
                          onChange={(e) => setBackfillLimit(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                        />
                        <div className="mt-1 text-xs text-amber-800">
                          Provide either Company IDs or a positive limit.
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm text-amber-900">
                        <input
                          type="checkbox"
                          checked={backfillCreateMissing}
                          onChange={(e) =>
                            setBackfillCreateMissing(e.target.checked)
                          }
                        />
                        Create missing GHL Businesses (may create new records)
                      </label>

                      <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <input
                          type="checkbox"
                          checked={backfillConfirm}
                          onChange={(e) => setBackfillConfirm(e.target.checked)}
                        />
                        I understand this will write to Go High Level CRM
                      </label>
                    </div>
                  </div>

                  {backfillError && (
                    <div className="text-sm text-red-700">{backfillError}</div>
                  )}

                  {backfillResult?.data && (
                    <details className="bg-white border border-amber-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-amber-900">
                        View backfill response
                      </summary>
                      <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(backfillResult, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Repair contact-business links */}
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        Repair contact-business links
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Writes{" "}
                        <span className="font-mono">taliho_id</span> custom
                        fields to GHL Businesses &amp; Contacts, then links
                        contacts to their company&apos;s business.
                        <br />
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/repair-links
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass={
                        repairStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-link"
                      }
                      disabled={
                        status === "loading" ||
                        repairStatus === "loading" ||
                        !repairConfirm
                      }
                      onClick={() => void runRepairLinks()}
                    >
                      {repairStatus === "loading"
                        ? "Repairing..."
                        : "Run repair"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="ghl-repair-limit"
                        className="block text-xs font-semibold text-amber-900 mb-1"
                      >
                        Limit (optional)
                      </label>
                      <input
                        id="ghl-repair-limit"
                        value={repairLimit}
                        onChange={(e) => setRepairLimit(e.target.value)}
                        placeholder="e.g. 10 (leave empty to process all)"
                        className="w-full rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                      />
                      <div className="mt-1 text-xs text-amber-800">
                        Max companies/users to process per phase. Leave empty
                        to repair all.
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={repairConfirm}
                        onChange={(e) => setRepairConfirm(e.target.checked)}
                      />
                      I understand this will write to Go High Level CRM
                    </label>
                  </div>

                  {repairError && (
                    <div className="text-sm text-red-700">{repairError}</div>
                  )}

                  {repairResult?.data && (
                    <details className="bg-white border border-amber-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-amber-900">
                        View repair response
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Businesses</div>
                            <div className="font-semibold">
                              {repairResult.data.businessesProcessed} processed
                            </div>
                            <div className="text-emerald-700">
                              {repairResult.data.businessTalihoIdsRepaired}{" "}
                              IDs repaired
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Contacts</div>
                            <div className="font-semibold">
                              {repairResult.data.contactsProcessed} processed
                            </div>
                            <div className="text-emerald-700">
                              {repairResult.data.contactTalihoIdsRepaired}{" "}
                              IDs repaired
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Links repaired</div>
                            <div className="font-semibold text-emerald-700">
                              {repairResult.data.contactBusinessLinksRepaired}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">
                              Skipped / Errors
                            </div>
                            <div className="font-semibold">
                              {repairResult.data.skipped} /{" "}
                              {repairResult.data.errors?.length ?? 0}
                            </div>
                          </div>
                        </div>
                        {repairResult.data.errors?.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-700 font-medium">
                              {repairResult.data.errors.length} error(s)
                            </summary>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(
                                repairResult.data.errors,
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Repair company info on contacts */}
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        Repair contact company info
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Pushes company address, city, state, postal code,
                        country, and website onto each GHL Contact record so the
                        Business Info section is populated.
                        <br />
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/repair-company-info
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass={
                        companyInfoStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-building"
                      }
                      disabled={
                        status === "loading" ||
                        companyInfoStatus === "loading" ||
                        !companyInfoConfirm
                      }
                      onClick={() => void runRepairCompanyInfo()}
                    >
                      {companyInfoStatus === "loading"
                        ? "Repairing..."
                        : "Run repair"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="ghl-company-info-limit"
                        className="block text-xs font-semibold text-amber-900 mb-1"
                      >
                        Limit (optional)
                      </label>
                      <input
                        id="ghl-company-info-limit"
                        value={companyInfoLimit}
                        onChange={(e) => setCompanyInfoLimit(e.target.value)}
                        placeholder="e.g. 10 (leave empty to process all)"
                        className="w-full rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                      />
                      <div className="mt-1 text-xs text-amber-800">
                        Max contacts to process. Leave empty to repair all.
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={companyInfoConfirm}
                        onChange={(e) =>
                          setCompanyInfoConfirm(e.target.checked)
                        }
                      />
                      I understand this will write to Go High Level CRM
                    </label>
                  </div>

                  {companyInfoError && (
                    <div className="text-sm text-red-700">
                      {companyInfoError}
                    </div>
                  )}

                  {companyInfoResult?.data && (
                    <details className="bg-white border border-amber-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-amber-900">
                        View repair response
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Processed</div>
                            <div className="font-semibold">
                              {companyInfoResult.data.contactsProcessed}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Updated</div>
                            <div className="font-semibold text-emerald-700">
                              {companyInfoResult.data.contactsUpdated}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Skipped</div>
                            <div className="font-semibold">
                              {companyInfoResult.data.skipped}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Errors</div>
                            <div className="font-semibold">
                              {companyInfoResult.data.errors?.length ?? 0}
                            </div>
                          </div>
                        </div>
                        {companyInfoResult.data.errors?.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-700 font-medium">
                              {companyInfoResult.data.errors.length} error(s)
                            </summary>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(
                                companyInfoResult.data.errors,
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Repair contact custom fields (taliho_id + account_permission) */}
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        Repair contact custom fields
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Writes{" "}
                        <span className="font-mono">taliho_id</span>,{" "}
                        <span className="font-mono">account_permission</span>{" "}
                        (Admin / PM / User),{" "}
                        <span className="font-mono">first_user_login</span>,{" "}
                        <span className="font-mono">last_user_login</span>, and{" "}
                        <span className="font-mono">number_of_logins</span>{" "}
                        custom fields to each GHL Contact.
                        <br />
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/repair-contact-fields
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass={
                        contactFieldsStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-user"
                      }
                      disabled={
                        status === "loading" ||
                        contactFieldsStatus === "loading" ||
                        !contactFieldsConfirm
                      }
                      onClick={() => void runRepairContactFields()}
                    >
                      {contactFieldsStatus === "loading"
                        ? "Repairing..."
                        : "Run repair"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="ghl-contact-fields-limit"
                        className="block text-xs font-semibold text-amber-900 mb-1"
                      >
                        Limit (optional)
                      </label>
                      <input
                        id="ghl-contact-fields-limit"
                        value={contactFieldsLimit}
                        onChange={(e) => setContactFieldsLimit(e.target.value)}
                        placeholder="e.g. 10 (leave empty to process all)"
                        className="w-full rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                      />
                      <div className="mt-1 text-xs text-amber-800">
                        Max contacts to process. Leave empty to repair all.
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={contactFieldsConfirm}
                        onChange={(e) =>
                          setContactFieldsConfirm(e.target.checked)
                        }
                      />
                      I understand this will write to Go High Level CRM
                    </label>
                  </div>

                  {contactFieldsError && (
                    <div className="text-sm text-red-700">
                      {contactFieldsError}
                    </div>
                  )}

                  {contactFieldsResult?.data && (
                    <details className="bg-white border border-amber-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-amber-900">
                        View repair response
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Processed</div>
                            <div className="font-semibold">
                              {contactFieldsResult.data.contactsProcessed}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Updated</div>
                            <div className="font-semibold text-emerald-700">
                              {contactFieldsResult.data.contactsUpdated}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Skipped</div>
                            <div className="font-semibold">
                              {contactFieldsResult.data.skipped}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Errors</div>
                            <div className="font-semibold">
                              {contactFieldsResult.data.errors?.length ?? 0}
                            </div>
                          </div>
                        </div>
                        {contactFieldsResult.data.errors?.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-700 font-medium">
                              {contactFieldsResult.data.errors.length} error(s)
                            </summary>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(
                                contactFieldsResult.data.errors,
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Single-company opportunity preview / safe repair */}
              <div className="border border-sky-200 rounded-lg p-4 bg-sky-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-sky-900">
                        Single-company opportunity preview / safe repair
                      </div>
                      <div className="text-xs text-sky-800 mt-1">
                        Preview the exact opportunity target, match logic, and
                        payload for one company before writing anything.
                        <br />
                        Safe repair updates an existing opportunity only and
                        will never create a new one in another pipeline.
                        <br />
                        Calls{" "}
                        <span className="font-mono">
                          GET /ghl/preview-opportunity/:companyId
                        </span>{" "}
                        and{" "}
                        <span className="font-mono">
                          POST /ghl/repair-opportunity/:companyId
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        leftIconClass={
                          oppPreviewStatus === "loading"
                            ? "bx bx-loader-alt animate-spin"
                            : "bx bx-search-alt"
                        }
                        disabled={
                          status === "loading" || oppPreviewStatus === "loading"
                        }
                        onClick={() => void runPreviewOpportunity(oppSingleCompanyId)}
                      >
                        {oppPreviewStatus === "loading"
                          ? "Previewing..."
                          : "Preview"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        leftIconClass={
                          oppSingleRepairStatus === "loading"
                            ? "bx bx-loader-alt animate-spin"
                            : "bx bx-wrench"
                        }
                        disabled={
                          status === "loading" ||
                          oppSingleRepairStatus === "loading" ||
                          !oppSingleRepairConfirm
                        }
                        onClick={() =>
                          void runSafeRepairOpportunity(oppSingleCompanyId)
                        }
                      >
                        {oppSingleRepairStatus === "loading"
                          ? "Updating..."
                          : "Safe repair"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="ghl-opp-single-company-id"
                        className="block text-xs font-semibold text-sky-900 mb-1"
                      >
                        Company ID
                      </label>
                      <input
                        id="ghl-opp-single-company-id"
                        value={oppSingleCompanyId}
                        onChange={(e) => setOppSingleCompanyId(e.target.value)}
                        placeholder="Mongo companyId"
                        className="w-full rounded-md border border-sky-200 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                      <input
                        type="checkbox"
                        checked={oppSingleRepairConfirm}
                        onChange={(e) =>
                          setOppSingleRepairConfirm(e.target.checked)
                        }
                      />
                      I understand safe repair will write only to an already
                      matched GHL Opportunity
                    </label>
                  </div>

                  {oppPreviewError && (
                    <div className="text-sm text-red-700">{oppPreviewError}</div>
                  )}
                  {oppSingleRepairError && (
                    <div className="text-sm text-red-700">
                      {oppSingleRepairError}
                    </div>
                  )}

                  {oppPreviewResult?.data && (
                    <details className="bg-white border border-sky-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-sky-900">
                        View opportunity preview
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Match source</div>
                            <div className="font-semibold">
                              {oppPreviewResult.data.existingOpportunityMatchSource}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Existing opp</div>
                            <div className="font-semibold">
                              {oppPreviewResult.data.existingOpportunityId ||
                                "None"}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Contact</div>
                            <div className="font-semibold">
                              {oppPreviewResult.data.opportunityContactIdResolved ||
                                "None"}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Safe repair</div>
                            <div className="font-semibold">
                              {oppPreviewResult.data.safeRepairWouldSkip
                                ? "Would skip"
                                : "Would update"}
                            </div>
                          </div>
                        </div>
                        <pre className="mt-1 text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
                          {JSON.stringify(oppPreviewResult.data, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}

                  {oppSingleRepairResult?.data && (
                    <details className="bg-white border border-sky-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-sky-900">
                        View safe repair response
                      </summary>
                      <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-80">
                        {JSON.stringify(oppSingleRepairResult.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Repair opportunity custom fields */}
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        Repair opportunity custom fields
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Backfills lifecycle fields like{" "}
                        <span className="font-mono">account_status</span>,{" "}
                        <span className="font-mono">free_trial_status</span>,{" "}
                        <span className="font-mono">days_in_free_trial</span>,{" "}
                        <span className="font-mono">paid_account</span>,{" "}
                        <span className="font-mono">subscription_plan</span>,{" "}
                        <span className="font-mono">billing_period</span>,{" "}
                        <span className="font-mono">subscription_status</span>,{" "}
                        <span className="font-mono">
                          recurring_payment_amount
                        </span>
                        , and{" "}
                        <span className="font-mono">billing_frequency</span>{" "}
                        onto GHL Opportunities for all companies with a GHL
                        Business record.
                        <br />
                        Use the single-company preview / safe repair above first
                        before running this broad repair again.
                        <br />
                        Calls{" "}
                        <span className="font-mono">
                          POST /ghl/repair-opportunities
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass={
                        oppRepairStatus === "loading"
                          ? "bx bx-loader-alt animate-spin"
                          : "bx bx-dollar-circle"
                      }
                      disabled={
                        status === "loading" ||
                        oppRepairStatus === "loading" ||
                        !oppRepairConfirm
                      }
                      onClick={() => void runRepairOpportunities()}
                    >
                      {oppRepairStatus === "loading"
                        ? "Repairing..."
                        : "Run repair"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="ghl-opp-repair-limit"
                        className="block text-xs font-semibold text-amber-900 mb-1"
                      >
                        Limit (optional)
                      </label>
                      <input
                        id="ghl-opp-repair-limit"
                        value={oppRepairLimit}
                        onChange={(e) => setOppRepairLimit(e.target.value)}
                        placeholder="e.g. 10 (leave empty to process all)"
                        className="w-full rounded-md border border-amber-200 px-3 py-2 text-sm bg-white"
                      />
                      <div className="mt-1 text-xs text-amber-800">
                        Max companies to process. Leave empty to repair all.
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={oppRepairConfirm}
                        onChange={(e) => setOppRepairConfirm(e.target.checked)}
                      />
                      I understand this will write to Go High Level CRM
                    </label>
                  </div>

                  {oppRepairError && (
                    <div className="text-sm text-red-700">{oppRepairError}</div>
                  )}

                  {oppRepairResult?.data && (
                    <details className="bg-white border border-amber-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-medium text-amber-900">
                        View repair response
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Processed</div>
                            <div className="font-semibold">
                              {oppRepairResult.data.companiesProcessed}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Updated</div>
                            <div className="font-semibold text-emerald-700">
                              {oppRepairResult.data.opportunitiesUpdated}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Skipped</div>
                            <div className="font-semibold">
                              {oppRepairResult.data.skipped}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Errors</div>
                            <div className="font-semibold">
                              {oppRepairResult.data.errorsCount ??
                                oppRepairResult.data.errors?.length ??
                                0}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">
                              Missing Champion
                            </div>
                            <div className="font-semibold">
                              {oppRepairResult.data.skipBreakdown
                                ?.missingChampionContact ?? 0}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">
                              Missing Existing Opp
                            </div>
                            <div className="font-semibold text-amber-700">
                              {oppRepairResult.data.errorBreakdown
                                ?.missingExistingOpportunity ?? 0}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">
                              Opp Update Failed
                            </div>
                            <div className="font-semibold text-red-700">
                              {oppRepairResult.data.errorBreakdown
                                ?.opportunityUpdateFailed ?? 0}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">
                              Business Contact Failed
                            </div>
                            <div className="font-semibold text-red-700">
                              {oppRepairResult.data.errorBreakdown
                                ?.businessPrimaryContactFailed ?? 0}
                            </div>
                          </div>
                        </div>
                        {(oppRepairResult.data.companyIdsByCategory ||
                          oppRepairResult.data.skipBreakdown ||
                          oppRepairResult.data.errorBreakdown) && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-amber-800 font-medium">
                              View repair breakdown
                            </summary>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(
                                {
                                  errorsCount:
                                    oppRepairResult.data.errorsCount ??
                                    oppRepairResult.data.errors?.length ??
                                    0,
                                  skipBreakdown:
                                    oppRepairResult.data.skipBreakdown,
                                  errorBreakdown:
                                    oppRepairResult.data.errorBreakdown,
                                  companyIdsByCategory:
                                    oppRepairResult.data.companyIdsByCategory,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                        {oppRepairResult.data.errors?.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-700 font-medium">
                              {oppRepairResult.data.errorsCount ??
                                oppRepairResult.data.errors.length}{" "}
                              total error(s)
                            </summary>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(
                                oppRepairResult.data.errors,
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>

            {/* Results Card */}
            {status !== "idle" && (
              <div
                ref={resultsCardRef}
                className={`rounded-lg shadow p-6 ${
                  status === "success"
                    ? "bg-emerald-50 border border-emerald-200"
                    : status === "error"
                      ? "bg-red-50 border border-red-200"
                      : "bg-gray-50 border border-gray-200"
                }`}
              >
                {status === "loading" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                      <span className="text-gray-700">
                        Migration in progress... This may take a few minutes.
                      </span>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Current phase (best-effort)
                          </div>
                          <div className="mt-1 text-sm font-medium text-gray-900">
                            {migrationSteps[currentStepIndex]?.title ||
                              "Migration in progress"}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {migrationSteps[currentStepIndex]?.description ||
                              "Working on GHL migration tasks..."}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          Elapsed: {formatElapsed(elapsedSeconds)}
                        </div>
                      </div>

                      <ol className="mt-4 space-y-2">
                        {migrationSteps.map((step, idx) => {
                          const isDone = idx < currentStepIndex;
                          const isActive = idx === currentStepIndex;
                          return (
                            <li
                              key={step.id}
                              className="flex items-start gap-3"
                            >
                              <span
                                className={`mt-0.5 text-base ${
                                  isDone
                                    ? "text-emerald-600"
                                    : isActive
                                      ? "text-brand-600"
                                      : "text-gray-300"
                                }`}
                                aria-hidden="true"
                              >
                                {isDone ? (
                                  <i className="bx bx-check-circle"></i>
                                ) : isActive ? (
                                  <i className="bx bx-loader-alt animate-spin"></i>
                                ) : (
                                  <i className="bx bx-circle"></i>
                                )}
                              </span>
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-medium ${
                                    isActive
                                      ? "text-gray-900"
                                      : isDone
                                        ? "text-gray-700"
                                        : "text-gray-400"
                                  }`}
                                >
                                  {step.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {step.description}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>

                      <div className="mt-3 text-xs text-gray-500">
                        Detailed progress isn't currently streamed from the
                        backend; results will appear here when the migration
                        completes.
                      </div>
                    </div>
                  </div>
                )}

                {status === "success" && result && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <i className="bx bx-check-circle text-emerald-600 text-2xl"></i>
                      <span className="text-lg font-medium text-emerald-800">
                        {result.message}
                      </span>
                    </div>
                    <div
                      className={`grid grid-cols-1 ${
                        typeof result.data.opportunitiesUpserted === "number"
                          ? "sm:grid-cols-4"
                          : "sm:grid-cols-3"
                      } gap-4`}
                    >
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-2xl font-bold text-emerald-600">
                          {result.data.businessesMigrated}
                        </div>
                        <div className="text-sm text-gray-600">
                          Businesses Migrated
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-2xl font-bold text-emerald-600">
                          {result.data.contactsMigrated}
                        </div>
                        <div className="text-sm text-gray-600">
                          Contacts Migrated
                        </div>
                      </div>
                      {typeof result.data.opportunitiesUpserted ===
                        "number" && (
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-2xl font-bold text-emerald-600">
                            {result.data.opportunitiesUpserted}
                          </div>
                          <div className="text-sm text-gray-600">
                            Opportunities Upserted
                          </div>
                        </div>
                      )}
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div
                          className={`text-2xl font-bold ${result.data.errorsCount > 0 ? "text-amber-600" : "text-gray-400"}`}
                        >
                          {result.data.errorsCount}
                        </div>
                        <div className="text-sm text-gray-600">Errors</div>
                      </div>
                    </div>

                    {result.data.selectedCompanies &&
                      result.data.selectedCompanies.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900">
                              Companies included in this run
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              leftIconClass="bx bx-copy"
                              className="text-xs px-2 py-1"
                              disabled={!result.data.selectedCompanies?.length}
                              onClick={() =>
                                void handleCopyCompanyIds(
                                  result.data.selectedCompanies?.map(
                                    (c) => c.companyId,
                                  ) ?? [],
                                )
                              }
                            >
                              Copy company IDs
                            </Button>
                          </div>
                          <ul className="mt-2 text-sm text-gray-700 space-y-1">
                            {result.data.selectedCompanies.map((c) => (
                              <li
                                key={c.companyId}
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="truncate">
                                  {c.companyName}
                                </span>
                                <span className="text-xs text-gray-500 tabular-nums">
                                  Users: {c.usersCount}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {result.data.description && (
                            <div className="mt-3 text-xs text-gray-500">
                              Tagged with Description:
                              <span className="ml-1 font-mono">
                                {result.data.description}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                    {rawErrors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Error Details (showing first {rawErrors.length}):
                        </h4>
                        <div className="bg-white rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                          <ul className="divide-y divide-gray-100">
                            {rawErrors.map((error, index) => {
                              const e = normalizeError(error);
                              return (
                                <li key={index} className="px-4 py-2 text-sm">
                                  <span className="text-red-600">
                                    {e.message}
                                  </span>
                                  {e.entity && (
                                    <span className="text-gray-500 ml-2">
                                      ({e.entity})
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {status === "error" && !result && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <i className="bx bx-error-circle text-red-600 text-2xl"></i>
                      <span className="text-lg font-medium text-red-800">
                        Migration failed
                      </span>
                    </div>

                    <div className="bg-white rounded-lg border border-red-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Where it failed
                          </div>
                          <div className="mt-1 text-sm font-medium text-gray-900">
                            {likelyFailureMeta?.title}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {getFriendlyFailureHint(likelyFailureStep)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          Elapsed:{" "}
                          {formatElapsed(
                            typeof failedElapsedSeconds === "number"
                              ? failedElapsedSeconds
                              : elapsedSeconds,
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-red-800">
                        {errorMessage || "Migration failed. Please try again."}
                      </div>

                      {requestErrorInfo && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-gray-500">
                            Technical details
                          </summary>
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            {typeof requestErrorInfo.status === "number" && (
                              <div>Status: {requestErrorInfo.status}</div>
                            )}
                            {requestErrorInfo.backendMessage && (
                              <div>
                                Message: {requestErrorInfo.backendMessage}
                              </div>
                            )}
                            {requestErrorInfo.backendError && (
                              <div>Error: {requestErrorInfo.backendError}</div>
                            )}
                            {requestErrorInfo.message && (
                              <div>Client: {requestErrorInfo.message}</div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}

                {status === "error" && result && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <i className="bx bx-error-circle text-red-600 text-2xl"></i>
                      <span className="text-lg font-medium text-red-800">
                        {result.message}
                      </span>
                    </div>

                    <div className="bg-white rounded-lg border border-red-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Where it failed (based on returned errors)
                          </div>
                          <div className="mt-1 text-sm font-medium text-gray-900">
                            {likelyFailureMeta?.title}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {getFriendlyFailureHint(likelyFailureStep)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          Elapsed: {formatElapsed(elapsedSeconds)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {errorCountsByStep.businesses > 0 && (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            Businesses: {errorCountsByStep.businesses}
                          </span>
                        )}
                        {errorCountsByStep.contacts > 0 && (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            Contacts: {errorCountsByStep.contacts}
                          </span>
                        )}
                        {errorCountsByStep.finalizing > 0 && (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            Other: {errorCountsByStep.finalizing}
                          </span>
                        )}
                      </div>
                    </div>

                    {result.data && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-2xl font-bold text-gray-600">
                            {result.data.businessesMigrated}
                          </div>
                          <div className="text-sm text-gray-600">
                            Businesses Migrated
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-2xl font-bold text-gray-600">
                            {result.data.contactsMigrated}
                          </div>
                          <div className="text-sm text-gray-600">
                            Contacts Migrated
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="text-2xl font-bold text-red-600">
                            {result.data.errorsCount}
                          </div>
                          <div className="text-sm text-gray-600">Errors</div>
                        </div>
                      </div>
                    )}

                    {result.data.selectedCompanies &&
                      result.data.selectedCompanies.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900">
                              Companies included in this run
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              leftIconClass="bx bx-copy"
                              className="text-xs px-2 py-1"
                              disabled={!result.data.selectedCompanies?.length}
                              onClick={() =>
                                void handleCopyCompanyIds(
                                  result.data.selectedCompanies?.map(
                                    (c) => c.companyId,
                                  ) ?? [],
                                )
                              }
                            >
                              Copy company IDs
                            </Button>
                          </div>
                          <ul className="mt-2 text-sm text-gray-700 space-y-1">
                            {result.data.selectedCompanies.map((c) => (
                              <li
                                key={c.companyId}
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="truncate">
                                  {c.companyName}
                                </span>
                                <span className="text-xs text-gray-500 tabular-nums">
                                  Users: {c.usersCount}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {result.data.description && (
                            <div className="mt-3 text-xs text-gray-500">
                              Tagged with Description:
                              <span className="ml-1 font-mono">
                                {result.data.description}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                    {rawErrors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700">
                          View error details (showing first {rawErrors.length})
                        </summary>
                        <div className="mt-2 bg-white rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                          <ul className="divide-y divide-gray-100">
                            {rawErrors.map((error, index) => {
                              const e = normalizeError(error);
                              const stepLabel = getStepMeta(e.step)?.title;
                              return (
                                <li key={index} className="px-4 py-2 text-sm">
                                  <div className="text-xs text-gray-500 mb-0.5">
                                    {stepLabel}
                                  </div>
                                  <div className="text-red-700">
                                    {e.message}
                                  </div>
                                  {e.entity && (
                                    <div className="text-xs text-gray-500">
                                      {e.entity}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={pendingAction !== null && status !== "loading"}
        onClose={() => setPendingAction(null)}
        title={
          isDevUi
            ? "Confirm DEV Sample Migration"
            : pendingAction === "all"
              ? "Confirm Full Migration"
              : "Confirm Sample Migration"
        }
        subtitle={
          isDevUi
            ? "You are about to start the DEV sample GHL CRM migration (3 companies only)."
            : pendingAction === "all"
              ? "You are about to start the full GHL CRM migration (all companies)."
              : "You are about to start the production sample GHL CRM migration (3 companies only)."
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={pendingAction === "all" ? "danger" : "primary"}
              leftIconClass={
                pendingAction === "all"
                  ? "bx bx-cloud-upload"
                  : "bx bx-test-tube"
              }
              onClick={() => {
                if (!pendingAction) return;
                void handleStartMigration(pendingAction);
              }}
            >
              {isDevUi
                ? "Start DEV Sample Migration"
                : pendingAction === "all"
                  ? "Start Full Migration"
                  : "Start Sample Migration"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {pendingAction === "all"
              ? "This will migrate all companies and users from the database to Go High Level CRM. Existing records will be updated (upsert operation)."
              : isDevUi
                ? "This will migrate ONLY 3 auto-selected companies (with the most available data) and all users of those companies to Go High Level CRM. Existing records will be updated (upsert operation)."
                : "This will migrate ONLY 3 auto-selected companies (with the most available data) and all users of those companies to Go High Level CRM. Existing records will be updated (upsert operation)."}
          </p>
          {isDevUi && devSelection?.selectedCompanies?.length ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Included companies
              </div>
              <ul className="mt-2 text-sm text-gray-700 space-y-1">
                {devSelection.selectedCompanies.map((c) => (
                  <li
                    key={c.companyId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate">{c.companyName}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      Users: {c.usersCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="bx bx-error text-amber-600 text-lg"></i>
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This process may take several minutes. Do
                not close this page until the migration is complete.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
