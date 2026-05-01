import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { Fragment, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import {
  executeBackfill,
  executeBackfillAsync,
  getBackfillJobStatus,
  type BackfillExecutionResult,
  type BackfillJobStatus,
} from "@/api/endpoints/backfill";
import { adminCustomersKeys } from "@/api/endpoints/admin-customers";
import toast from "react-hot-toast";

interface BackfillAction {
  id: string;
  name: string;
  description: string;
}

const BACKFILL_ACTIONS: BackfillAction[] = [
  {
    id: "plan-tier",
    name: "Backfill Plan Tiers",
    description: "Populate planTier for companies with Stripe product ID",
  },
  {
    id: "storage-history",
    name: "Backfill Storage History",
    description: "Create storage history snapshots (30 days)",
  },
  {
    id: "email-domains",
    name: "Backfill Email Domains",
    description: "Extract email domains from company users",
  },
  {
    id: "heal-company-cache",
    name: "Heal Company Cache",
    description: "Recalculate cached counts and storage metrics",
  },
];

export default function BackfillActionsDropdown() {
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<BackfillAction | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<BackfillExecutionResult | null>(null);

  // Async job tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BackfillJobStatus | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for job status when we have an active job
  useEffect(() => {
    if (!activeJobId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const pollJobStatus = async () => {
      try {
        const status = await getBackfillJobStatus(activeJobId);
        setJobStatus(status);

        // Check if job is complete
        if (
          status.status === "completed" ||
          status.status === "failed" ||
          status.status === "cancelled"
        ) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsExecuting(false);

          if (status.status === "completed") {
            // Convert job result to BackfillExecutionResult format
            const stepResult = status.stepResults?.[0];
            if (stepResult) {
              setResult({
                operation: stepResult.operation,
                dryRun: status.dryRun ?? false,
                startedAt: stepResult.startedAt,
                completedAt: stepResult.completedAt,
                durationMs: stepResult.durationMs,
                result: stepResult.result ?? { checked: 0, failed: [] },
                status: "success",
              });
            }
            toast.success("Backfill completed successfully");
            // Invalidate company queries
            queryClient.invalidateQueries({
              queryKey: adminCustomersKeys.all,
            });
          } else if (status.status === "failed") {
            toast.error(status.error || "Backfill job failed");
          } else if (status.status === "cancelled") {
            toast.error("Backfill job was cancelled");
          }

          setActiveJobId(null);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    };

    // Poll immediately, then every 2 seconds
    pollJobStatus();
    pollIntervalRef.current = setInterval(pollJobStatus, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeJobId, queryClient]);

  const handleSelectAction = (action: BackfillAction) => {
    setSelectedAction(action);
    setDryRun(true);
    setResult(null);
    setJobStatus(null);
    setActiveJobId(null);
    setConfirmOpen(true);
  };

  // Dry run uses sync endpoint (fast, immediate feedback)
  const handleExecute = async () => {
    if (!selectedAction) return;
    setIsExecuting(true);
    setResult(null);
    try {
      const response = await executeBackfill(selectedAction.id, { dryRun });
      setResult(response.data);
      toast.success(response.success_message);

      // Auto-invalidate company queries after successful execution (not dry run)
      if (!dryRun) {
        queryClient.invalidateQueries({
          queryKey: adminCustomersKeys.all,
        });
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errorMsg =
        err?.response?.data?.message || err?.message || "Operation failed";
      toast.error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    if (!isExecuting) {
      setConfirmOpen(false);
      setResult(null);
      setJobStatus(null);
      setActiveJobId(null);
    }
  };

  // Actual execution uses async endpoint to avoid timeouts
  const handleExecuteAfterDryRun = async () => {
    if (!selectedAction) return;
    setIsExecuting(true);
    setResult(null);
    setJobStatus(null);
    try {
      const response = await executeBackfillAsync(selectedAction.id, {
        dryRun: false,
      });
      // Start polling for job status
      setActiveJobId(response.jobId);
      toast.success("Backfill job started...");
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errorMsg =
        err?.response?.data?.message || err?.message || "Failed to start job";
      toast.error(errorMsg);
      setIsExecuting(false);
    }
  };

  return (
    <>
      <Menu as="div" className="relative">
        <MenuButton as={Fragment}>
          <Button variant="secondary">
            <i className="bx bx-data mr-1.5" />
            Actions
            <i className="bx bx-chevron-down ml-1" />
          </Button>
        </MenuButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <MenuItems className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black/10 z-50 py-1">
            {BACKFILL_ACTIONS.map((action) => (
              <MenuItem key={action.id}>
                {({ focus }) => (
                  <button
                    onClick={() => handleSelectAction(action)}
                    className={`w-full text-left px-4 py-2.5 ${focus ? "bg-gray-50" : ""}`}
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {action.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {action.description}
                    </div>
                  </button>
                )}
              </MenuItem>
            ))}
          </MenuItems>
        </Transition>
      </Menu>

      <Modal
        open={confirmOpen}
        onClose={handleClose}
        title={selectedAction?.name || "Backfill Action"}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isExecuting}
            >
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button
                variant={dryRun ? "primary" : "danger"}
                onClick={handleExecute}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <>
                    <i className="bx bx-loader-alt animate-spin mr-1.5" />
                    Running...
                  </>
                ) : dryRun ? (
                  "Run Dry Run"
                ) : (
                  "Execute"
                )}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">{selectedAction?.description}</p>

          {!result && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={isExecuting}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Dry Run Mode (preview changes without applying)
                </span>
              </label>

              {!dryRun && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  <i className="bx bx-error mr-1.5" />
                  <strong>Warning:</strong> This will modify database records.
                </div>
              )}
            </>
          )}

          {/* Async job progress */}
          {activeJobId && jobStatus && !result && (
            <div className="rounded-md p-4 bg-blue-50 border border-blue-200">
              <div className="font-medium mb-2 text-blue-800">
                <i className="bx bx-loader-alt animate-spin mr-1.5" />
                Executing...
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <div>Status: {jobStatus.status}</div>
                {jobStatus.currentOperation && (
                  <div>Operation: {jobStatus.currentOperation}</div>
                )}
                <div>
                  Progress: {jobStatus.progress}/{jobStatus.total}
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`rounded-md p-4 ${
                result.status === "error"
                  ? "bg-red-50 border border-red-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <div
                className={`font-medium mb-2 ${
                  result.status === "error" ? "text-red-800" : "text-green-800"
                }`}
              >
                {result.status === "error"
                  ? "Error"
                  : result.dryRun
                    ? "Dry Run Complete"
                    : "Execution Complete"}
              </div>
              {result.status !== "error" && (
                <div className="text-sm text-green-700 space-y-1">
                  <div>Checked: {result.result.checked}</div>
                  {result.result.updated !== undefined && (
                    <div>Updated: {result.result.updated}</div>
                  )}
                  {result.result.created !== undefined && (
                    <div>Created: {result.result.created}</div>
                  )}
                  {result.result.skipped !== undefined &&
                    result.result.skipped > 0 && (
                      <div className="text-gray-600">
                        Skipped (no business domains): {result.result.skipped}
                      </div>
                    )}
                  {result.result.flaggedForReview !== undefined &&
                    result.result.flaggedForReview > 0 && (
                      <div className="text-amber-600">
                        <i className="bx bx-flag mr-1" />
                        Flagged for review (multi-domain):{" "}
                        {result.result.flaggedForReview}
                      </div>
                    )}
                  {(result.result.failed?.length ?? 0) > 0 && (
                    <div className="text-red-600">
                      Failed: {result.result.failed?.length}
                    </div>
                  )}
                  <div className="text-xs text-green-600 mt-2">
                    Duration: {(result.durationMs / 1000).toFixed(1)}s
                  </div>
                  {result.dryRun &&
                    (result.result.failed?.length ?? 0) === 0 && (
                      <div className="mt-4 pt-3 border-t border-green-200">
                        <Button
                          variant="danger"
                          onClick={handleExecuteAfterDryRun}
                          disabled={isExecuting}
                          className="w-full"
                        >
                          {isExecuting ? (
                            <>
                              <i className="bx bx-loader-alt animate-spin mr-1.5" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <i className="bx bx-play mr-1.5" />
                              Execute Now
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                </div>
              )}
              {result.error && (
                <div className="text-sm text-red-700">{result.error}</div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
