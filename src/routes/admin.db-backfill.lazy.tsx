import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  listBackfillOperations,
  executeBackfill,
  executeAllBackfills,
  executeAllBackfillsAsync,
  connectBackfillJobStream,
  cancelBackfillJob,
  type BackfillOperation,
  type BackfillExecutionResult,
  type BackfillJobStatus,
  type BackfillJobStepResult,
} from "@/api/endpoints/backfill";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import toast from "react-hot-toast";
import { getStoredUser } from "@/utils/getStoredUser";

type OperationStatus = "idle" | "loading" | "success" | "error";

interface OperationState {
  status: OperationStatus;
  result: BackfillExecutionResult | null;
  error: string | null;
  startedAtMs: number | null;
  elapsedSeconds: number;
}

const initialOperationState: OperationState = {
  status: "idle",
  result: null,
  error: null,
  startedAtMs: null,
  elapsedSeconds: 0,
};

export const Route = createLazyFileRoute("/admin/db-backfill")({
  component: DbBackfillAdmin,
});

function DbBackfillAdmin() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [operations, setOperations] = useState<BackfillOperation[]>([]);
  const [operationStates, setOperationStates] = useState<
    Record<string, OperationState>
  >({});
  const [runAllState, setRunAllState] = useState<OperationState>(
    initialOperationState,
  );
  const [runAllResults, setRunAllResults] = useState<
    BackfillExecutionResult[] | null
  >(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    operationId: string | "all";
    dryRun: boolean;
  } | null>(null);
  const [loadingOperations, setLoadingOperations] = useState(true);

  // Per-operation config (e.g. exclude company IDs for QR regeneration)
  const [excludeCompanyIdsInput, setExcludeCompanyIdsInput] = useState("");

  // Async mode state
  const [asyncMode, setAsyncMode] = useState(true); // Default to async mode
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);
  const [asyncJobStatus, setAsyncJobStatus] =
    useState<BackfillJobStatus | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Refs for elapsed time tracking
  const elapsedIntervalRef = useRef<number | null>(null);

  // Auth check on mount
  useEffect(() => {
    const storedUser = getStoredUser();

    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  // Load operations on mount
  useEffect(() => {
    if (!authorized) return;

    const loadOperations = async () => {
      try {
        const response = await listBackfillOperations();
        setOperations(response.data.operations);

        // Initialize states for each operation
        const initialStates: Record<string, OperationState> = {};
        response.data.operations.forEach((op) => {
          initialStates[op.id] = { ...initialOperationState };
        });
        setOperationStates(initialStates);
      } catch (error) {
        toast.error("Failed to load backfill operations");
        console.error("Failed to load operations:", error);
      } finally {
        setLoadingOperations(false);
      }
    };

    loadOperations();
  }, [authorized]);

  // Elapsed time tracking
  const startElapsedTimer = useCallback((operationId: string | "all") => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
    }

    const startTime = Date.now();
    elapsedIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (operationId === "all") {
        setRunAllState((prev) => ({ ...prev, elapsedSeconds: elapsed }));
      } else {
        setOperationStates((prev) => ({
          ...prev,
          [operationId]: { ...prev[operationId], elapsedSeconds: elapsed },
        }));
      }
    }, 1000);
  }, []);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const parseExcludeCompanyIds = useCallback((): string[] | undefined => {
    const trimmed = excludeCompanyIdsInput.trim();
    if (!trimmed) return undefined;
    const ids = trimmed
      .split(/[,\n]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  }, [excludeCompanyIdsInput]);

  const handleExecute = useCallback(
    async (operationId: string, dryRun: boolean) => {
      // Update state to loading
      setOperationStates((prev) => ({
        ...prev,
        [operationId]: {
          status: "loading",
          result: null,
          error: null,
          startedAtMs: Date.now(),
          elapsedSeconds: 0,
        },
      }));

      startElapsedTimer(operationId);

      try {
        const options: { dryRun: boolean; excludeCompanyIds?: string[] } = {
          dryRun,
        };
        if (operationId === "regenerate-qr-images") {
          options.excludeCompanyIds = parseExcludeCompanyIds();
        }
        const response = await executeBackfill(operationId, options);
        stopElapsedTimer();

        setOperationStates((prev) => ({
          ...prev,
          [operationId]: {
            ...prev[operationId],
            status: "success",
            result: response.data,
          },
        }));

        toast.success(response.success_message);
      } catch (error: unknown) {
        stopElapsedTimer();

        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMsg =
          axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Operation failed";

        setOperationStates((prev) => ({
          ...prev,
          [operationId]: {
            ...prev[operationId],
            status: "error",
            error: errorMsg,
          },
        }));

        toast.error(errorMsg);
      }
    },
    [parseExcludeCompanyIds, startElapsedTimer, stopElapsedTimer],
  );

  const handleExecuteAll = useCallback(
    async (dryRun: boolean) => {
      setRunAllState({
        status: "loading",
        result: null,
        error: null,
        startedAtMs: Date.now(),
        elapsedSeconds: 0,
      });
      setRunAllResults(null);

      startElapsedTimer("all");

      try {
        const response = await executeAllBackfills({ dryRun });
        stopElapsedTimer();

        setRunAllState((prev) => ({
          ...prev,
          status: "success",
        }));
        setRunAllResults(response.data.results);

        toast.success(response.success_message);
      } catch (error: unknown) {
        stopElapsedTimer();

        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMsg =
          axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Operation failed";

        setRunAllState((prev) => ({
          ...prev,
          status: "error",
          error: errorMsg,
        }));

        toast.error(errorMsg);
      }
    },
    [startElapsedTimer, stopElapsedTimer],
  );

  // Handle async execution with SSE progress tracking
  const handleExecuteAllAsync = useCallback(
    async (dryRun: boolean) => {
      // Reset state
      setRunAllState({
        status: "loading",
        result: null,
        error: null,
        startedAtMs: Date.now(),
        elapsedSeconds: 0,
      });
      setRunAllResults(null);
      setAsyncJobStatus(null);

      startElapsedTimer("all");

      try {
        // Start the async job
        const { jobId } = await executeAllBackfillsAsync({ dryRun });
        setAsyncJobId(jobId);

        // Connect to SSE stream for real-time updates
        const eventSource = connectBackfillJobStream(
          jobId,
          (event) => {
            setAsyncJobStatus({
              jobId: event.jobId,
              status: event.status,
              progress: event.progress,
              total: event.total,
              currentOperation: event.currentOperation,
              stepResults: event.stepResults,
              result: event.result,
              error: event.error,
              dryRun: event.dryRun,
            });

            // Handle completion
            if (
              event.status === "completed" ||
              event.status === "failed" ||
              event.status === "cancelled"
            ) {
              stopElapsedTimer();

              if (event.status === "completed") {
                setRunAllState((prev) => ({ ...prev, status: "success" }));
                // Convert step results to the format expected by runAllResults
                if (event.stepResults) {
                  const results: BackfillExecutionResult[] =
                    event.stepResults.map((step: BackfillJobStepResult) => ({
                      operation: step.operation,
                      dryRun: dryRun,
                      startedAt: step.startedAt,
                      completedAt: step.completedAt,
                      durationMs: step.durationMs,
                      result: step.result || { checked: 0, failed: [] },
                      status: step.status,
                      error: step.error,
                    }));
                  setRunAllResults(results);
                }
                toast.success(
                  dryRun
                    ? "All backfills dry run completed"
                    : "All backfills completed",
                );
              } else if (event.status === "failed") {
                setRunAllState((prev) => ({
                  ...prev,
                  status: "error",
                  error: event.error || "Job failed",
                }));
                toast.error(event.error || "Job failed");
              } else if (event.status === "cancelled") {
                setRunAllState((prev) => ({
                  ...prev,
                  status: "error",
                  error: "Job was cancelled",
                }));
                toast.error("Job was cancelled");
              }
            }
          },
          (error) => {
            console.error("SSE error:", error);
            stopElapsedTimer();
            setRunAllState((prev) => ({
              ...prev,
              status: "error",
              error: "Connection to server lost",
            }));
            toast.error("Connection to server lost");
          },
        );

        eventSourceRef.current = eventSource;
      } catch (error: unknown) {
        stopElapsedTimer();

        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMsg =
          axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Failed to start job";

        setRunAllState((prev) => ({
          ...prev,
          status: "error",
          error: errorMsg,
        }));

        toast.error(errorMsg);
      }
    },
    [startElapsedTimer, stopElapsedTimer],
  );

  // Handle cancelling an async job
  const handleCancelJob = useCallback(async () => {
    if (!asyncJobId) return;

    try {
      await cancelBackfillJob(asyncJobId);
      toast.success("Job cancellation requested");
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        axiosError?.response?.data?.message || "Failed to cancel job",
      );
    }
  }, [asyncJobId]);

  const formatElapsed = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Render loading state
  if (authorized === null) {
    return (
      <div className="flex flex-col flex-1 min-h-0 -m-8 p-8 bg-gray-50 items-center justify-center">
        <div className="text-gray-600">Checking authorization...</div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Will redirect
  }

  if (loadingOperations) {
    return (
      <div className="flex flex-col flex-1 min-h-0 -m-8 p-8 bg-gray-50 items-center justify-center">
        <div className="text-gray-600">Loading operations...</div>
      </div>
    );
  }

  return (
    // Root layout uses overflow-y-hidden + padding, so this page needs its own scroll container.
    // Use negative margins to "bleed" into the parent padding so the scrollbar sits flush-right.
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-8 bg-gray-50">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Database Backfill Operations
        </h1>
        <p className="mt-2 text-gray-600">
          Administrative tools for running data migration and healing
          operations. Use dry run to preview changes before applying them.
        </p>
      </div>

      {/* Run All Section */}
      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-amber-900">
              Run All Backfills
            </h2>
            <p className="mt-1 text-sm text-amber-700">
              Execute all backfill operations in sequence. This may take several
              minutes depending on the amount of data.
            </p>
          </div>
          {/* Async Mode Toggle */}
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={asyncMode}
              onChange={(e) => setAsyncMode(e.target.checked)}
              disabled={runAllState.status === "loading"}
              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Async Mode</span>
            <span className="text-xs text-amber-600">(recommended)</span>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              asyncMode ? handleExecuteAllAsync(true) : handleExecuteAll(true)
            }
            disabled={runAllState.status === "loading"}
          >
            {runAllState.status === "loading" ? (
              <>
                <i className="bx bx-loader-alt animate-spin mr-1.5" />
                Running Dry Run...
              </>
            ) : (
              "Dry Run All"
            )}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              setPendingConfirm({ operationId: "all", dryRun: false })
            }
            disabled={runAllState.status === "loading"}
          >
            Execute All
          </Button>
          {/* Cancel button for async mode */}
          {asyncMode && runAllState.status === "loading" && asyncJobId && (
            <Button variant="secondary" onClick={handleCancelJob}>
              Cancel
            </Button>
          )}
        </div>

        {/* Run All Status */}
        {runAllState.status === "loading" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-amber-700">
              <i className="bx bx-loader-alt animate-spin" />
              <span>
                Running all backfills... (
                {formatElapsed(runAllState.elapsedSeconds)})
              </span>
            </div>
            {/* Async progress details */}
            {asyncMode && asyncJobStatus && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="font-medium">Progress:</span>
                  <span>
                    {asyncJobStatus.progress} / {asyncJobStatus.total}{" "}
                    operations
                  </span>
                  {asyncJobStatus.currentOperation && (
                    <span className="text-amber-600">
                      (running: {asyncJobStatus.currentOperation})
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{
                      width: `${(asyncJobStatus.progress / asyncJobStatus.total) * 100}%`,
                    }}
                  />
                </div>
                {/* Step results so far */}
                {asyncJobStatus.stepResults &&
                  asyncJobStatus.stepResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {asyncJobStatus.stepResults.map((step) => (
                        <div
                          key={step.operation}
                          className={`text-xs flex items-center gap-2 ${
                            step.status === "success"
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          <i
                            className={`bx ${step.status === "success" ? "bx-check-circle" : "bx-x-circle"}`}
                          />
                          <span>{step.operation}</span>
                          <span className="text-gray-500">
                            ({formatDuration(step.durationMs)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {runAllState.status === "error" && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <strong>Error:</strong> {runAllState.error}
          </div>
        )}

        {/* Run All Results */}
        {runAllState.status === "success" && runAllResults && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium text-amber-900">
              All Operations Complete
            </div>
            <div className="space-y-2">
              {runAllResults.map((r) => (
                <div
                  key={r.operation}
                  className={`rounded-md p-3 text-sm ${
                    r.status === "error"
                      ? "bg-red-50 border border-red-200"
                      : "bg-green-50 border border-green-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${r.status === "error" ? "text-red-800" : "text-green-800"}`}
                    >
                      {r.operation}
                    </span>
                    <span
                      className={`text-xs ${r.status === "error" ? "text-red-600" : "text-green-600"}`}
                    >
                      {r.status === "error"
                        ? "Failed"
                        : formatDuration(r.durationMs)}
                    </span>
                  </div>
                  {r.status === "error" ? (
                    <div className="mt-1 text-red-700">{r.error}</div>
                  ) : (
                    <div className="mt-1 text-green-700">
                      Checked: {r.result.checked}
                      {r.result.updated !== undefined &&
                        ` | Updated: ${r.result.updated}`}
                      {r.result.backfilled !== undefined &&
                        ` | Backfilled: ${r.result.backfilled}`}
                      {r.result.created !== undefined &&
                        ` | Created: ${r.result.created}`}
                      {r.result.failed.length > 0 && (
                        <span className="text-red-600">
                          {" "}
                          | Failed: {r.result.failed.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Operations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {operations.map((op) => (
          <OperationCard
            key={op.id}
            operation={op}
            state={operationStates[op.id] || initialOperationState}
            onDryRun={() => handleExecute(op.id, true)}
            onExecute={() =>
              setPendingConfirm({ operationId: op.id, dryRun: false })
            }
            formatElapsed={formatElapsed}
            formatDuration={formatDuration}
            excludeCompanyIdsInput={
              op.id === "regenerate-qr-images"
                ? excludeCompanyIdsInput
                : undefined
            }
            onExcludeCompanyIdsChange={
              op.id === "regenerate-qr-images"
                ? setExcludeCompanyIdsInput
                : undefined
            }
          />
        ))}
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={!!pendingConfirm && !pendingConfirm.dryRun}
        onClose={() => setPendingConfirm(null)}
        title="Confirm Execution"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingConfirm?.operationId === "all") {
                  if (asyncMode) {
                    handleExecuteAllAsync(false);
                  } else {
                    handleExecuteAll(false);
                  }
                } else if (pendingConfirm) {
                  handleExecute(pendingConfirm.operationId, false);
                }
                setPendingConfirm(null);
              }}
            >
              Execute
            </Button>
          </>
        }
      >
        <div className="text-gray-600">
          <p>
            Are you sure you want to execute{" "}
            <strong>
              {pendingConfirm?.operationId === "all"
                ? "all backfill operations"
                : `the "${pendingConfirm?.operationId}" operation`}
            </strong>
            ?
          </p>
          <p className="mt-2 text-amber-600">
            <i className="bx bx-error mr-1" />
            This will modify the database. Consider running a dry run first to
            preview changes.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// Operation Card Component
function OperationCard({
  operation,
  state,
  onDryRun,
  onExecute,
  formatElapsed,
  formatDuration,
  excludeCompanyIdsInput,
  onExcludeCompanyIdsChange,
}: {
  operation: BackfillOperation;
  state: OperationState;
  onDryRun: () => void;
  onExecute: () => void;
  formatElapsed: (seconds: number) => string;
  formatDuration: (ms: number) => string;
  excludeCompanyIdsInput?: string;
  onExcludeCompanyIdsChange?: (value: string) => void;
}) {
  const isLoading = state.status === "loading";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{operation.name}</h3>
      <p className="mt-1 text-sm text-gray-600">{operation.description}</p>

      {/* Exclude companies input (for QR regeneration) */}
      {excludeCompanyIdsInput !== undefined && onExcludeCompanyIdsChange && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Exclude Company IDs (comma or newline separated)
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows={3}
            placeholder="507f1f77bcf86cd799439011, 507f1f77bcf86cd799439012"
            value={excludeCompanyIdsInput}
            onChange={(e) => onExcludeCompanyIdsChange(e.target.value)}
            disabled={isLoading}
          />
          {excludeCompanyIdsInput.trim() && (
            <p className="mt-1 text-xs text-gray-500">
              {
                excludeCompanyIdsInput
                  .split(/[,\n]+/)
                  .map((id) => id.trim())
                  .filter(Boolean).length
              }{" "}
              company IDs will be excluded
            </p>
          )}
        </div>
      )}

      {/* Feature badges */}
      <div className="mt-2 flex gap-2">
        {operation.supportsDryRun && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            Dry Run
          </span>
        )}
        {operation.supportsCompanyId && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
            Per-Company
          </span>
        )}
      </div>

      {/* Status indicator */}
      {state.status === "loading" && (
        <div className="mt-4 flex items-center gap-2 text-blue-600">
          <i className="bx bx-loader-alt animate-spin" />
          <span>Running... ({formatElapsed(state.elapsedSeconds)})</span>
        </div>
      )}

      {state.status === "success" && state.result && (
        <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm">
          <div className="font-medium text-green-800">
            {state.result.dryRun ? "Dry Run Complete" : "Completed"}
          </div>
          <div className="mt-1 text-green-700">
            <span>Checked: {state.result.result.checked}</span>
            {state.result.result.updated !== undefined && (
              <span> | Updated: {state.result.result.updated}</span>
            )}
            {state.result.result.backfilled !== undefined && (
              <span> | Backfilled: {state.result.result.backfilled}</span>
            )}
            {state.result.result.missing !== undefined && (
              <span> | Missing: {state.result.result.missing}</span>
            )}
            {state.result.result.created !== undefined && (
              <span> | Created: {state.result.result.created}</span>
            )}
            {state.result.result.wouldCreate !== undefined && (
              <span> | Would Create: {state.result.result.wouldCreate}</span>
            )}
            {state.result.result.failed.length > 0 && (
              <span className="text-red-600">
                {" "}
                | Failed: {state.result.result.failed.length}
              </span>
            )}
          </div>
          <div className="text-green-600 text-xs mt-1">
            Duration: {formatDuration(state.result.durationMs)}
          </div>

          {/* Failed records details */}
          {state.result.result.failed.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-600 text-xs">
                View failed records ({state.result.result.failed.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs text-red-700 bg-red-50 rounded p-2">
                {state.result.result.failed.slice(0, 10).map((f, i) => (
                  <div key={i} className="truncate">
                    {f.id}: {f.error}
                  </div>
                ))}
                {state.result.result.failed.length > 10 && (
                  <div className="italic">
                    ... and {state.result.result.failed.length - 10} more
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onDryRun} disabled={isLoading}>
          {isLoading ? (
            <>
              <i className="bx bx-loader-alt animate-spin mr-1" />
              Running...
            </>
          ) : (
            "Dry Run"
          )}
        </Button>
        <Button variant="primary" onClick={onExecute} disabled={isLoading}>
          Execute
        </Button>
      </div>
    </div>
  );
}
