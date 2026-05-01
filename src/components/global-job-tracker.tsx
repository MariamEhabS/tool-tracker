import { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { logJobError } from "@/utils/rollbar";
import {
  getActiveJobs,
  cleanupCompletedJobs,
  getActiveJobCount,
  updateJob,
  removeJob,
  getJob,
  type StoredJob,
} from "@/utils/localStorage-jobs";
import {
  connectJobStream,
  getJobStatus,
  cancelJob,
  type JobStreamEvent,
  type JobStatus,
} from "@/api/endpoints/qr-codes";
import { companyKeys } from "@/api/endpoints/company";
import { getStoredUser } from "@/utils/getStoredUser";

/**
 * Format estimated remaining time for display
 */
function formatEta(estimatedRemainingMs: number | null | undefined): string {
  if (!estimatedRemainingMs || estimatedRemainingMs < 0) return "";
  const minutes = Math.ceil(estimatedRemainingMs / 60000);
  if (minutes < 1) return "Completing soon...";
  if (minutes === 1) return "~1 minute remaining";
  return `~${minutes} minutes remaining`;
}

/**
 * Get appropriate toast messages based on job type
 */
function getJobMessages(
  jobId: string,
  total: number,
  failedCount = 0,
  successCount = Math.max(0, total - failedCount),
) {
  const job = getJob(jobId);
  const jobType = job?.type ?? "";
  const hasPartialFailures = failedCount > 0;

  // Delete job messages
  if (jobType === "bulk-qr-delete") {
    return {
      success: hasPartialFailures
        ? `Deleted ${successCount}/${total} QR code${total === 1 ? "" : "s"}. ${failedCount} failed.`
        : `Deleted ${total} QR code${total === 1 ? "" : "s"} successfully!`,
      failure: "QR code deletion failed",
      isPartial: hasPartialFailures,
    };
  }
  if (jobType === "bulk-group-delete") {
    return {
      success:
        hasPartialFailures
          ? `Deleted ${successCount}/${total} group${total === 1 ? "" : "s"}. ${failedCount} failed.`
          : total === 1
          ? "Group deleted successfully!"
          : `Deleted ${total} groups successfully!`,
      failure: "Group deletion failed",
      isPartial: hasPartialFailures,
    };
  }
  if (jobType === "bulk-project-delete") {
    return {
      success:
        hasPartialFailures
          ? `Deleted ${successCount}/${total} project${total === 1 ? "" : "s"}. ${failedCount} failed.`
          : total === 1
          ? "Project deleted successfully!"
          : `Deleted ${total} projects successfully!`,
      failure: "Project deletion failed",
      isPartial: hasPartialFailures,
    };
  }
  if (jobType === "bulk-procore-inspections-create") {
    return {
      success: hasPartialFailures
        ? `Processed ${successCount}/${total} Procore inspection${total === 1 ? "" : "s"}. ${failedCount} failed.`
        : `Processed ${total} Procore inspection${total === 1 ? "" : "s"} successfully!`,
      failure: "Procore inspection creation failed",
      isPartial: hasPartialFailures,
    };
  }

  // Creation job messages
  const isRegenerate = jobType === "bulk-qr-regenerate";
  return {
    success: hasPartialFailures
      ? isRegenerate
        ? `Regenerated ${successCount}/${total} QR codes. ${failedCount} failed.`
        : `Created ${successCount}/${total} QR codes. ${failedCount} failed.`
      : isRegenerate
        ? `Regenerated ${total} QR codes successfully!`
        : `Created ${total} QR codes successfully!`,
    failure: isRegenerate
      ? "QR code redesign failed"
      : "QR code creation failed",
    isPartial: hasPartialFailures,
  };
}

/**
 * Invalidate relevant caches when a delete job completes
 */
function invalidateDeleteCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  jobType: string,
) {
  if (jobType.includes("delete")) {
    void queryClient.invalidateQueries({ queryKey: ["Qrs"] });
    void queryClient.invalidateQueries({ queryKey: ["Groups"] });
    void queryClient.invalidateQueries({ queryKey: ["Projects"] });
    void queryClient.invalidateQueries({
      queryKey: ["Aggregation"],
    });
    try {
      const userStr = localStorage.getItem("user");
      const companyId = userStr ? JSON.parse(userStr)?.companyId : null;
      if (companyId) {
        void queryClient.invalidateQueries({
          queryKey: companyKeys.dashboardStats(companyId),
        });
      }
    } catch {
      /* ignore parse errors */
    }
  }

  if (jobType === "bulk-procore-inspections-create") {
    void queryClient.invalidateQueries({ queryKey: ["Qrs"] });
    void queryClient.invalidateQueries({ queryKey: ["procore"] });
  }
}

export function GlobalJobTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeJobs, setActiveJobs] = useState<StoredJob[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);

  const connectionMapRef = useRef<
    Map<
      string,
      {
        eventSource?: EventSource;
        pollingInterval?: NodeJS.Timeout;
        usePolling: boolean;
        timeoutId?: NodeJS.Timeout;
        pollingDelayMs?: number;
        pollingErrorCount?: number;
        degradedLogged?: boolean;
      }
    >
  >(new Map());
  const isMountedRef = useRef(true);
  // Track which jobs have already shown completion/failure toasts to prevent duplicates
  const toastShownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const updateActiveJobs = () => {
      const jobs = getActiveJobs();
      setActiveJobs(jobs);

      cleanupCompletedJobs();
    };

    updateActiveJobs();

    const interval = setInterval(updateActiveJobs, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const setupPolling = (jobId: string) => {
      const MAX_POLL_DELAY_MS = 60000;
      const MAX_POLL_ERRORS = 30;

      const scheduleNextPoll = (delayMs: number) => {
        const connection = connectionMapRef.current.get(jobId);
        if (!connection) return;
        if (connection.pollingInterval) {
          clearTimeout(connection.pollingInterval);
        }
        connection.pollingInterval = setTimeout(() => {
          void pollJobStatus();
        }, delayMs);
      };

      const pollJobStatus = async () => {
        try {
          const jobStatus: JobStatus = await getJobStatus(jobId);

          if (!isMountedRef.current) return;

          const connection = connectionMapRef.current.get(jobId);
          if (!connection) return;

          connection.pollingErrorCount = 0;
          connection.pollingDelayMs = 2000;
          connection.degradedLogged = false;

          updateJob(jobId, {
            status: jobStatus.status,
            progress: jobStatus.progress,
            total: jobStatus.total,
            groupId: jobStatus.groupId,
            currentOperation: jobStatus.currentOperation,
            error: jobStatus.error || undefined,
            estimatedRemainingMs: jobStatus.estimatedRemainingMs,
            deadLetterCount: jobStatus.deadLetterCount,
            result: jobStatus.result,
          });

          if (jobStatus.status === "completed") {
            if (!toastShownRef.current.has(jobId)) {
              toastShownRef.current.add(jobId);
              const failedCount =
                jobStatus.result?.failedCount ?? jobStatus.deadLetterCount ?? 0;
              const successCount =
                jobStatus.result?.count ??
                Math.max(0, jobStatus.total - failedCount);
              const messages = getJobMessages(
                jobId,
                jobStatus.total,
                failedCount,
                successCount,
              );
              if (messages.isPartial) {
                toast(messages.success);
              } else {
                toast.success(messages.success);
              }
              // Invalidate caches for delete jobs
              const job = getJob(jobId);
              if (job?.type) {
                invalidateDeleteCaches(queryClient, job.type);
              }
            }
            if (connection?.pollingInterval) {
              clearTimeout(connection.pollingInterval);
            }
            connectionMapRef.current.delete(jobId);
            const failedCount =
              jobStatus.result?.failedCount ?? jobStatus.deadLetterCount ?? 0;
            setTimeout(
              () => removeJob(jobId),
              failedCount > 0 ? 8000 : 2000,
            );
          }

          if (jobStatus.status === "failed") {
            if (!toastShownRef.current.has(jobId)) {
              toastShownRef.current.add(jobId);
              const messages = getJobMessages(jobId, 0);
              toast.error(jobStatus.error || messages.failure);
            }
            if (connection?.pollingInterval) {
              clearTimeout(connection.pollingInterval);
            }
            connectionMapRef.current.delete(jobId);
            setTimeout(() => removeJob(jobId), 5000);
            return;
          }

          if (
            jobStatus.status === "pending" ||
            jobStatus.status === "processing" ||
            jobStatus.status === "paused"
          ) {
            scheduleNextPoll(connection.pollingDelayMs ?? 2000);
          }
        } catch (error) {
          const connection = connectionMapRef.current.get(jobId);
          if (!connection) return;

          const errorStatus =
            typeof error === "object" && error !== null
              ? (error as { response?: { status?: number } }).response?.status
              : undefined;

          // Stop polling for terminal status errors - continuing would only spam the API.
          if (errorStatus === 400 || errorStatus === 404) {
            if (!toastShownRef.current.has(jobId)) {
              toastShownRef.current.add(jobId);
              toast.error("Background job not found. Removing it from tracker.");
            }
            if (connection.pollingInterval) {
              clearTimeout(connection.pollingInterval);
            }
            connectionMapRef.current.delete(jobId);
            removeJob(jobId);
            return;
          }

          // Authentication/authorization errors won't recover via retry.
          if (errorStatus === 401 || errorStatus === 403) {
            updateJob(jobId, {
              status: "failed",
              error: "Session expired. Please refresh and log in again.",
            });
            if (connection.pollingInterval) {
              clearTimeout(connection.pollingInterval);
            }
            connectionMapRef.current.delete(jobId);
            if (!toastShownRef.current.has(jobId)) {
              toastShownRef.current.add(jobId);
              toast.error("Session expired while tracking jobs.");
            }
            setTimeout(() => removeJob(jobId), 5000);
            return;
          }

          const nextErrorCount = (connection.pollingErrorCount ?? 0) + 1;
          connection.pollingErrorCount = nextErrorCount;
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          connection.pollingDelayMs = isOffline
            ? 30000
            : nextErrorCount >= 12
              ? MAX_POLL_DELAY_MS
              : nextErrorCount >= 6
                ? 30000
                : nextErrorCount >= 3
                  ? 10000
                  : 3000;

          updateJob(jobId, {
            error: "Connection interrupted. Retrying process...",
          });

          if (nextErrorCount >= MAX_POLL_ERRORS) {
            updateJob(jobId, {
              status: "failed",
              error: "Job tracking timed out after repeated connection issues.",
            });
            if (connection.pollingInterval) {
              clearTimeout(connection.pollingInterval);
            }
            connectionMapRef.current.delete(jobId);
            if (!toastShownRef.current.has(jobId)) {
              toastShownRef.current.add(jobId);
              toast.error("Stopped polling after repeated connection failures.");
            }
            setTimeout(() => removeJob(jobId), 5000);
            return;
          }

          if (nextErrorCount >= 3 && !connection.degradedLogged) {
            connection.degradedLogged = true;
            logJobError(error, "job-tracking-connection-degraded", jobId, {
              consecutiveErrors: nextErrorCount,
            });
          }

          scheduleNextPoll(connection.pollingDelayMs);
        }
      };

      const connection = connectionMapRef.current.get(jobId);
      if (connection) {
        connection.usePolling = true;
        connection.pollingDelayMs = connection.pollingDelayMs ?? 2000;
        connection.pollingErrorCount = connection.pollingErrorCount ?? 0;
      }

      void pollJobStatus();
    };

    const activeJobIds = activeJobs
      .filter(
        (job) =>
          job.status === "pending" ||
          job.status === "processing" ||
          job.status === "paused",
      )
      .map((job) => job.jobId);

    const existingJobIds = Array.from(connectionMapRef.current.keys());
    for (const jobId of existingJobIds) {
      if (!activeJobIds.includes(jobId)) {
        const connection = connectionMapRef.current.get(jobId);
        if (connection?.eventSource) {
          connection.eventSource.close();
        }
        if (connection?.pollingInterval) {
          clearTimeout(connection.pollingInterval);
        }
        if (connection?.timeoutId) {
          clearTimeout(connection.timeoutId);
        }
        connectionMapRef.current.delete(jobId);
      }
    }

    for (const jobId of activeJobIds) {
      if (connectionMapRef.current.has(jobId)) {
        continue;
      }

      if (jobId.startsWith("client-")) {
        continue;
      }

      connectionMapRef.current.set(jobId, {
        usePolling: false,
        pollingDelayMs: 2000,
        pollingErrorCount: 0,
        degradedLogged: false,
      });

      try {
        const eventSource = connectJobStream(
          jobId,
          (event: JobStreamEvent) => {
            if (!isMountedRef.current) return;

            // Clear timeout on first successful message
            const connection = connectionMapRef.current.get(jobId);
            if (connection?.timeoutId) {
              clearTimeout(connection.timeoutId);
              connection.timeoutId = undefined;
            }

            updateJob(jobId, {
              status: event.status,
              progress: event.progress,
              total: event.total,
              groupId: event.groupId,
              currentOperation: event.currentOperation,
              error: event.error,
              estimatedRemainingMs: event.estimatedRemainingMs,
              deadLetterCount: event.deadLetterCount,
              result: event.result,
            });

            if (
              event.status === "completed" &&
              !toastShownRef.current.has(jobId)
            ) {
              toastShownRef.current.add(jobId);
              const failedCount =
                event.result?.failedCount ?? event.deadLetterCount ?? 0;
              const successCount =
                event.result?.count ?? Math.max(0, event.total - failedCount);
              const messages = getJobMessages(
                jobId,
                event.total,
                failedCount,
                successCount,
              );
              if (messages.isPartial) {
                toast(messages.success);
              } else {
                toast.success(messages.success);
              }
              // Invalidate caches for delete jobs
              const job = getJob(jobId);
              if (job?.type) {
                invalidateDeleteCaches(queryClient, job.type);
              }
              setTimeout(
                () => removeJob(jobId),
                failedCount > 0 ? 8000 : 2000,
              );
            }

            if (
              event.status === "failed" &&
              !toastShownRef.current.has(jobId)
            ) {
              toastShownRef.current.add(jobId);
              const messages = getJobMessages(jobId, 0);
              toast.error(event.error || messages.failure);
              setTimeout(() => removeJob(jobId), 5000);
            }
          },
          () => {
            const connection = connectionMapRef.current.get(jobId);
            if (connection) {
              // Close EventSource to prevent auto-reconnect loop
              if (connection.eventSource) {
                connection.eventSource.close();
                connection.eventSource = undefined;
              }
              // Clear timeout if still active
              if (connection.timeoutId) {
                clearTimeout(connection.timeoutId);
                connection.timeoutId = undefined;
              }
              // Only start polling if not already polling
              if (!connection.usePolling) {
                connection.usePolling = true;
                setupPolling(jobId);
              }
            }
          },
          () => {
            // SSE connection closed
          },
        );

        const connection = connectionMapRef.current.get(jobId);
        if (connection) {
          connection.eventSource = eventSource;

          // Set timeout for SSE connection - will be cleared on first message
          connection.timeoutId = setTimeout(() => {
            const conn = connectionMapRef.current.get(jobId);
            if (conn && !conn.usePolling && conn.eventSource) {
              conn.eventSource.close();
              conn.usePolling = true;
              setupPolling(jobId);
            }
          }, 10000); // Increased to 10 seconds
        }
      } catch (error) {
        logJobError(error, "sse-connection-failed", jobId);
        const connection = connectionMapRef.current.get(jobId);
        if (connection) {
          connection.usePolling = true;
          setupPolling(jobId);
        }
      }
    }

  }, [activeJobs, queryClient]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      const currentConnectionMap = connectionMapRef.current;
      for (const [, connection] of currentConnectionMap) {
        if (connection.eventSource) {
          connection.eventSource.close();
        }
        if (connection.pollingInterval) {
          clearTimeout(connection.pollingInterval);
        }
        if (connection.timeoutId) {
          clearTimeout(connection.timeoutId);
        }
      }
      currentConnectionMap.clear();
    };
  }, []);

  const handleViewGroup = (groupId: string) => {
    navigate({ to: "/group/$groupId", params: { groupId } });
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      if (jobId.startsWith("client-")) {
        removeJob(jobId);
        toast.success("Job cancelled");
        return;
      }

      const user = getStoredUser();
      if (!user?.companyId) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      await cancelJob(jobId, user.companyId);

      updateJob(jobId, {
        status: "failed",
        error: "Job cancelled by user",
      });

      const connection = connectionMapRef.current.get(jobId);
      if (connection?.eventSource) {
        connection.eventSource.close();
      }
      if (connection?.pollingInterval) {
        clearTimeout(connection.pollingInterval);
      }
      connectionMapRef.current.delete(jobId);

      toast.success("Job cancelled");

      setTimeout(() => removeJob(jobId), 2000);
    } catch (error) {
      logJobError(error, "job-cancel", jobId);
      toast.error("Failed to cancel job");
    }
  };

  const activeJobCount = getActiveJobCount();

  // Calculate aggregate progress across all active jobs
  const aggregateProgress = useMemo(() => {
    const processingJobs = activeJobs.filter(
      (j) =>
        j.status === "pending" ||
        j.status === "processing" ||
        j.status === "paused",
    );
    if (processingJobs.length === 0) return 0;
    const totalProgress = processingJobs.reduce(
      (sum, j) => sum + j.progress,
      0,
    );
    const totalItems = processingJobs.reduce((sum, j) => sum + j.total, 0);
    return totalItems > 0 ? Math.round((totalProgress / totalItems) * 100) : 0;
  }, [activeJobs]);

  const completedCount = activeJobs.filter(
    (j) => j.status === "completed",
  ).length;
  const processingCount = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  ).length;
  const pausedCount = activeJobs.filter((j) => j.status === "paused").length;

  if (activeJobCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {/* Collapsed pill button */}
      <motion.button
        layout
        type="button"
        onClick={() => setIsMinimized(!isMinimized)}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-800"
        animate={{
          y: isMinimized ? 0 : -10,
        }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 300,
        }}
        aria-expanded={!isMinimized}
        title="Background job progress"
      >
        <div className="relative">
          {processingCount > 0 ? (
            <i className="bx bx-loader-alt bx-spin text-lg" />
          ) : pausedCount > 0 ? (
            <i className="bx bx-pause-circle text-lg" />
          ) : (
            <i className="bx bx-qr text-lg" />
          )}
        </div>
        <span className="text-sm">
          {processingCount > 0
            ? `${processingCount} running`
            : pausedCount > 0
              ? `${pausedCount} paused`
              : `${completedCount} completed`}
        </span>
        {processingCount > 0 && aggregateProgress > 0 && (
          <span className="text-xs bg-white/20 rounded px-2 py-0.5">
            {aggregateProgress}%
          </span>
        )}
        <i
          className={`bx ${isMinimized ? "bx-chevron-up" : "bx-chevron-down"} text-lg`}
        />
      </motion.button>

      {/* Expanded panel */}
      {!isMinimized && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
          }}
          className="mt-2 w-[340px] max-h-[360px] overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">
              Background Jobs
            </span>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setIsMinimized(true)}
            >
              Close
            </button>
          </div>

          {/* Job list */}
          <ul className="divide-y divide-gray-100">
            {activeJobs.map((job) => {
              const pct =
                job.total > 0
                  ? Math.round((job.progress / job.total) * 100)
                  : 0;
              const statusLabel =
                job.status === "completed"
                  ? "Completed"
                  : job.status === "failed"
                    ? "Failed"
                    : job.status === "paused"
                      ? "Paused"
                      : job.status === "pending"
                        ? "Queued"
                        : "In Progress";
              const statusColor =
                job.status === "completed"
                  ? "text-green-600"
                  : job.status === "failed"
                    ? "text-red-600"
                    : job.status === "paused"
                      ? "text-yellow-600"
                      : "text-blue-600";
              const progressBarColor =
                job.status === "completed"
                  ? "bg-green-500"
                  : job.status === "failed"
                    ? "bg-red-500"
                    : job.status === "paused"
                      ? "bg-yellow-500"
                      : "bg-blue-600";
              const etaText = formatEta(job.estimatedRemainingMs);

              return (
                <li key={job.jobId} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {job.type === "bulk-qr-delete"
                          ? "Deleting QR Codes"
                          : job.type === "bulk-group-delete"
                            ? job.total === 1
                              ? "Deleting Group"
                              : "Deleting Groups"
                            : job.type === "bulk-project-delete"
                              ? job.total === 1
                                ? "Deleting Project"
                                : "Deleting Projects"
                              : job.type === "bulk-procore-inspections-create"
                                ? "Creating Procore Inspections"
                              : job.groupName || "QR Code Batch"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {job.total > 0
                          ? `${job.progress} / ${job.total} ${job.type === "bulk-procore-inspections-create" ? "inspections" : job.type?.includes("delete") ? "items" : "codes"}`
                          : "Starting..."}
                      </div>
                      {/* ETA display */}
                      {job.status === "processing" && etaText && (
                        <div className="text-xs text-blue-500 mt-0.5">
                          {etaText}
                        </div>
                      )}
                      {/* Dead letter count */}
                      {(job.deadLetterCount ?? 0) > 0 && (
                        <div className="text-xs text-orange-600 mt-0.5">
                          {job.deadLetterCount} item
                          {job.deadLetterCount === 1 ? "" : "s"} failed
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {/* Cancel button - visible when processing, pending, or paused */}
                      {(job.status === "pending" ||
                        job.status === "processing" ||
                        job.status === "paused") && (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          onClick={() => handleCancelJob(job.jobId)}
                          title="Cancel job"
                        >
                          Cancel
                        </button>
                      )}
                      {job.status === "completed" && job.groupId && (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700"
                          onClick={() => handleViewGroup(job.groupId!)}
                        >
                          View
                        </button>
                      )}
                      {job.status === "failed" && (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          onClick={() => removeJob(job.jobId)}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.3 }}
                      className={`h-1.5 rounded ${progressBarColor}`}
                    />
                  </div>
                  {/* Paused indicator */}
                  {job.status === "paused" && (
                    <div className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                      <i className="bx bx-pause-circle" />
                      Job paused
                    </div>
                  )}
                  {/* Error message */}
                  {job.error && (
                    <div className="mt-1 text-xs text-red-600">{job.error}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
