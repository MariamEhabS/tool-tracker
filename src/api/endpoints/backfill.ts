import { axiosInstance } from "..";
import {
  logApiError,
  logJobError,
  rollbar,
  ErrorCategories,
} from "@/utils/rollbar";

/**
 * Describes a single backfill operation
 */
export interface BackfillOperation {
  id: string;
  name: string;
  description: string;
  supportsCompanyId: boolean;
  supportsDryRun: boolean;
}

/**
 * Result data from a backfill operation
 */
export interface BackfillResultData {
  checked: number;
  updated?: number;
  missing?: number;
  backfilled?: number;
  created?: number;
  wouldCreate?: number;
  skipped?: number; // Companies skipped (e.g., no business domains found)
  flaggedForReview?: number; // Companies flagged for multi-domain review
  failed: Array<{ id: string; error: string }>;
}

/**
 * Full result from executing a backfill
 */
export interface BackfillExecutionResult {
  operation: string;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result: BackfillResultData;
  status?: "success" | "error";
  error?: string;
}

/**
 * Response for listing available operations
 */
export interface ListOperationsResponse {
  success_message: string;
  data: {
    operations: BackfillOperation[];
  };
}

/**
 * Response for executing a single backfill
 */
export interface ExecuteBackfillResponse {
  success_message: string;
  data: BackfillExecutionResult;
}

/**
 * Response for executing all backfills
 */
export interface ExecuteAllBackfillsResponse {
  success_message: string;
  data: {
    results: BackfillExecutionResult[];
  };
}

/**
 * Request options for backfill execution
 */
export interface ExecuteBackfillOptions {
  dryRun?: boolean;
  companyId?: string;
  excludeCompanyIds?: string[];
}

/**
 * List all available backfill operations
 */
export const listBackfillOperations =
  async (): Promise<ListOperationsResponse> => {
    try {
      const response = await axiosInstance.get<ListOperationsResponse>(
        "/admin/backfill/operations",
      );
      return response.data;
    } catch (error) {
      logApiError(error, "backfill-list-operations-failed");
      throw error;
    }
  };

/**
 * Execute a specific backfill operation (sync - use for dry runs)
 * @param operationId - The operation to execute
 * @param options - Optional configuration (dryRun, companyId)
 */
export const executeBackfill = async (
  operationId: string,
  options: ExecuteBackfillOptions = {},
): Promise<ExecuteBackfillResponse> => {
  try {
    const response = await axiosInstance.post<ExecuteBackfillResponse>(
      `/admin/backfill/execute/${operationId}`,
      options,
      { timeout: 300000 }, // 5 minute timeout
    );
    return response.data;
  } catch (error) {
    logJobError(error, "backfill-execute-failed", undefined, {
      operationId,
      dryRun: options.dryRun,
    });
    throw error;
  }
};

/**
 * Execute a specific backfill operation asynchronously (returns job ID immediately)
 * Use this for actual execution to avoid timeouts on long-running operations.
 * @param operationId - The operation to execute
 * @param options - Optional configuration (dryRun, companyId)
 */
export const executeBackfillAsync = async (
  operationId: string,
  options: ExecuteBackfillOptions = {},
): Promise<{ jobId: string; message: string }> => {
  try {
    const response = await axiosInstance.post<{
      jobId: string;
      message: string;
    }>(
      `/admin/backfill/execute/${operationId}/async`,
      options,
      { timeout: 30000 }, // 30 second timeout - just creates the job
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "backfill-execute-async-failed",
      metadata: { operationId, dryRun: options.dryRun },
    });
    throw error;
  }
};

/**
 * Execute all backfill operations in sequence (synchronous)
 * @param options - Optional configuration (dryRun, companyId)
 */
export const executeAllBackfills = async (
  options: ExecuteBackfillOptions = {},
): Promise<ExecuteAllBackfillsResponse> => {
  try {
    const response = await axiosInstance.post<ExecuteAllBackfillsResponse>(
      "/admin/backfill/execute-all",
      options,
      { timeout: 600000 }, // 10 minute timeout for all operations
    );
    return response.data;
  } catch (error) {
    logJobError(error, "backfill-execute-all-failed", undefined, {
      dryRun: options.dryRun,
    });
    throw error;
  }
};

// ============================================================
// Async (Job-based) API Functions
// ============================================================

/**
 * Step result from a multi-step backfill job
 */
export interface BackfillJobStepResult {
  operation: string;
  status: "success" | "error";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result?: BackfillResultData;
  error?: string;
}

/**
 * Status of a background backfill job
 */
export interface BackfillJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  total: number;
  currentOperation?: string;
  stepResults?: BackfillJobStepResult[];
  result?: {
    totalOperations: number;
    successCount: number;
    errorCount: number;
    dryRun: boolean;
  };
  error?: string;
  dryRun?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * SSE event data for job progress
 */
export interface BackfillJobStreamEvent {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  total: number;
  currentOperation?: string;
  stepResults?: BackfillJobStepResult[];
  result?: {
    totalOperations: number;
    successCount: number;
    errorCount: number;
    dryRun: boolean;
  };
  error?: string;
  dryRun?: boolean;
}

/**
 * Execute all backfills asynchronously (returns job ID immediately)
 * @param options - Optional configuration (dryRun, companyId)
 */
export const executeAllBackfillsAsync = async (
  options: ExecuteBackfillOptions = {},
): Promise<{ jobId: string; message: string }> => {
  try {
    const response = await axiosInstance.post<{
      jobId: string;
      message: string;
    }>(
      "/admin/backfill/execute-all-async",
      options,
      { timeout: 30000 }, // 30 second timeout - just creates the job
    );
    return response.data;
  } catch (error) {
    logJobError(error, "backfill-execute-all-async-failed", undefined, {
      dryRun: options.dryRun,
    });
    throw error;
  }
};

/**
 * Get backfill job status via REST (polling)
 * @param jobId - The job ID to check
 */
export const getBackfillJobStatus = async (
  jobId: string,
): Promise<BackfillJobStatus> => {
  try {
    const response = await axiosInstance.get<{
      success_message: string;
      data: BackfillJobStatus;
    }>(`/admin/backfill/jobs/${jobId}`);
    return response.data.data;
  } catch (error) {
    logJobError(error, "backfill-get-job-status-failed", jobId);
    throw error;
  }
};

/**
 * Cancel a running backfill job
 * @param jobId - The job ID to cancel
 */
export const cancelBackfillJob = async (jobId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`/admin/backfill/jobs/${jobId}`);
  } catch (error) {
    logJobError(error, "backfill-cancel-job-failed", jobId);
    throw error;
  }
};

/**
 * Connect to SSE stream for real-time backfill job updates
 * @param jobId - The job ID to track
 * @param onMessage - Callback for progress updates
 * @param onError - Optional error callback
 * @param onComplete - Optional callback when job finishes
 * @returns EventSource instance (call .close() to disconnect)
 */
export const connectBackfillJobStream = (
  jobId: string,
  onMessage: (event: BackfillJobStreamEvent) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void,
): EventSource => {
  const baseURL = axiosInstance.defaults.baseURL || "";
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");

  // Pass token as query param since SSE doesn't support custom headers
  const url = token
    ? `${baseURL}/admin/backfill/jobs/${jobId}/stream?token=${encodeURIComponent(token)}`
    : `${baseURL}/admin/backfill/jobs/${jobId}/stream`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as BackfillJobStreamEvent;
      onMessage(data);

      // Auto-close when job finishes
      if (
        data.status === "completed" ||
        data.status === "failed" ||
        data.status === "cancelled"
      ) {
        eventSource.close();
        onComplete?.();
      }
    } catch (error) {
      logJobError(error, "sse-parse-error", jobId);
    }
  };

  eventSource.onerror = (error) => {
    logJobError(
      new Error("SSE connection error"),
      "sse-connection-error",
      jobId,
    );
    eventSource.close();
    onError?.(error);
  };

  return eventSource;
};
