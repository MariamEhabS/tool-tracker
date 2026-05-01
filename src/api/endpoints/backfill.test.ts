/**
 * Tests for backfill API endpoints
 * Tests admin backfill operations: list, execute, execute-all,
 * async execution, job status, job cancellation, and SSE streaming.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/utils/rollbar", () => ({
  logApiError: vi.fn(),
  logJobError: vi.fn(),
}));

import {
  listBackfillOperations,
  executeBackfill,
  executeAllBackfills,
  executeAllBackfillsAsync,
  getBackfillJobStatus,
  cancelBackfillJob,
  connectBackfillJobStream,
} from "./backfill";
import { logApiError, logJobError } from "@/utils/rollbar";

describe("Backfill API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== listBackfillOperations ====================

  describe("listBackfillOperations", () => {
    it("should fetch available backfill operations", async () => {
      const mockResponse = {
        success_message: "OK",
        data: {
          operations: [
            {
              id: "qr-images",
              name: "QR Images",
              description: "Backfill QR images",
              supportsCompanyId: true,
              supportsDryRun: true,
            },
          ],
        },
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await listBackfillOperations();

      expect(mockGet).toHaveBeenCalledWith("/admin/backfill/operations");
      expect(result).toEqual(mockResponse);
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Network Error");
      mockGet.mockRejectedValue(error);

      await expect(listBackfillOperations()).rejects.toThrow("Network Error");

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "backfill-list-operations-failed",
      );
    });

    it("should wrap non-Error values before passing to rollbar", async () => {
      mockGet.mockRejectedValue("string error");

      await expect(listBackfillOperations()).rejects.toBe("string error");

      expect(logApiError).toHaveBeenCalledWith(
        "string error",
        "backfill-list-operations-failed",
      );
    });

    it("should re-throw the original error", async () => {
      const error = {
        response: { status: 403, data: { message: "Forbidden" } },
      };
      mockGet.mockRejectedValue(error);

      await expect(listBackfillOperations()).rejects.toEqual(error);
    });
  });

  // ==================== executeBackfill ====================

  describe("executeBackfill", () => {
    it("should execute a specific backfill operation with default options", async () => {
      const mockResponse = {
        success_message: "OK",
        data: {
          operation: "qr-images",
          dryRun: false,
          startedAt: "2026-01-01T00:00:00Z",
          completedAt: "2026-01-01T00:01:00Z",
          durationMs: 60000,
          result: { checked: 100, updated: 50, failed: [] },
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await executeBackfill("qr-images");

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute/qr-images",
        {},
        { timeout: 300000 },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should pass dryRun option", async () => {
      const mockResponse = {
        success_message: "OK",
        data: {
          operation: "qr-images",
          dryRun: true,
          startedAt: "2026-01-01T00:00:00Z",
          completedAt: "2026-01-01T00:01:00Z",
          durationMs: 60000,
          result: { checked: 100, failed: [] },
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      await executeBackfill("qr-images", { dryRun: true });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute/qr-images",
        { dryRun: true },
        { timeout: 300000 },
      );
    });

    it("should pass companyId option", async () => {
      mockPost.mockResolvedValue({
        data: {
          success_message: "OK",
          data: {
            operation: "qr-images",
            dryRun: false,
            startedAt: "",
            completedAt: "",
            durationMs: 0,
            result: { checked: 0, failed: [] },
          },
        },
      });

      await executeBackfill("qr-images", { companyId: "company-456" });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute/qr-images",
        { companyId: "company-456" },
        { timeout: 300000 },
      );
    });

    it("should pass both dryRun and companyId options", async () => {
      mockPost.mockResolvedValue({
        data: {
          success_message: "OK",
          data: {
            operation: "qr-images",
            dryRun: true,
            startedAt: "",
            completedAt: "",
            durationMs: 0,
            result: { checked: 0, failed: [] },
          },
        },
      });

      await executeBackfill("qr-images", {
        dryRun: true,
        companyId: "company-456",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute/qr-images",
        { dryRun: true, companyId: "company-456" },
        { timeout: 300000 },
      );
    });

    it("should log to rollbar with metadata on error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      await expect(
        executeBackfill("qr-images", { dryRun: true }),
      ).rejects.toThrow("Server Error");

      expect(logJobError).toHaveBeenCalledWith(
        error,
        "backfill-execute-failed",
        undefined,
        {
          operationId: "qr-images",
          dryRun: true,
        },
      );
    });

    it("should re-throw the original error", async () => {
      const error = { response: { status: 500 } };
      mockPost.mockRejectedValue(error);

      await expect(executeBackfill("qr-images")).rejects.toEqual(error);
    });
  });

  // ==================== executeAllBackfills ====================

  describe("executeAllBackfills", () => {
    it("should execute all backfills with default options", async () => {
      const mockResponse = {
        success_message: "OK",
        data: {
          results: [
            {
              operation: "qr-images",
              dryRun: false,
              startedAt: "",
              completedAt: "",
              durationMs: 1000,
              result: { checked: 100, failed: [] },
            },
          ],
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await executeAllBackfills();

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute-all",
        {},
        { timeout: 600000 },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should pass dryRun option", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "OK", data: { results: [] } },
      });

      await executeAllBackfills({ dryRun: true });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute-all",
        { dryRun: true },
        { timeout: 600000 },
      );
    });

    it("should use 600000ms timeout for all operations", async () => {
      mockPost.mockResolvedValue({
        data: { success_message: "OK", data: { results: [] } },
      });

      await executeAllBackfills();

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        { timeout: 600000 },
      );
    });

    it("should log to rollbar with metadata on error", async () => {
      const error = new Error("Timeout");
      mockPost.mockRejectedValue(error);

      await expect(executeAllBackfills({ dryRun: false })).rejects.toThrow(
        "Timeout",
      );

      expect(logJobError).toHaveBeenCalledWith(
        error,
        "backfill-execute-all-failed",
        undefined,
        {
          dryRun: false,
        },
      );
    });
  });

  // ==================== executeAllBackfillsAsync ====================

  describe("executeAllBackfillsAsync", () => {
    it("should create async backfill job with default options", async () => {
      const mockResponse = {
        jobId: "job-123",
        message: "Job created successfully",
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await executeAllBackfillsAsync();

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute-all-async",
        {},
        { timeout: 30000 },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should pass dryRun option", async () => {
      mockPost.mockResolvedValue({
        data: { jobId: "job-456", message: "Dry run job created" },
      });

      await executeAllBackfillsAsync({ dryRun: true });

      expect(mockPost).toHaveBeenCalledWith(
        "/admin/backfill/execute-all-async",
        { dryRun: true },
        { timeout: 30000 },
      );
    });

    it("should use 30000ms timeout (just creates the job)", async () => {
      mockPost.mockResolvedValue({
        data: { jobId: "job-789", message: "OK" },
      });

      await executeAllBackfillsAsync();

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        { timeout: 30000 },
      );
    });

    it("should log to rollbar on error", async () => {
      const error = new Error("Server Error");
      mockPost.mockRejectedValue(error);

      await expect(executeAllBackfillsAsync()).rejects.toThrow("Server Error");

      expect(logJobError).toHaveBeenCalledWith(
        error,
        "backfill-execute-all-async-failed",
        undefined,
        {
          dryRun: undefined,
        },
      );
    });
  });

  // ==================== getBackfillJobStatus ====================

  describe("getBackfillJobStatus", () => {
    it("should fetch job status", async () => {
      const mockJobStatus = {
        jobId: "job-123",
        status: "processing",
        progress: 50,
        total: 100,
        currentOperation: "qr-images",
      };
      mockGet.mockResolvedValue({
        data: { success_message: "OK", data: mockJobStatus },
      });

      const result = await getBackfillJobStatus("job-123");

      expect(mockGet).toHaveBeenCalledWith("/admin/backfill/jobs/job-123");
      expect(result).toEqual(mockJobStatus);
    });

    it("should return nested data field from response", async () => {
      const mockJobStatus = {
        jobId: "job-456",
        status: "completed",
        progress: 100,
        total: 100,
      };
      mockGet.mockResolvedValue({
        data: { success_message: "OK", data: mockJobStatus },
      });

      const result = await getBackfillJobStatus("job-456");

      expect(result).toEqual(mockJobStatus);
    });

    it("should log to rollbar with metadata on error", async () => {
      const error = new Error("Not Found");
      mockGet.mockRejectedValue(error);

      await expect(getBackfillJobStatus("job-missing")).rejects.toThrow(
        "Not Found",
      );

      expect(logJobError).toHaveBeenCalledWith(
        error,
        "backfill-get-job-status-failed",
        "job-missing",
      );
    });

    it("should re-throw the original error", async () => {
      const error = { response: { status: 404 } };
      mockGet.mockRejectedValue(error);

      await expect(getBackfillJobStatus("job-missing")).rejects.toEqual(error);
    });
  });

  // ==================== cancelBackfillJob ====================

  describe("cancelBackfillJob", () => {
    it("should cancel a running backfill job", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await cancelBackfillJob("job-123");

      expect(mockDelete).toHaveBeenCalledWith("/admin/backfill/jobs/job-123");
    });

    it("should return void on success", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      const result = await cancelBackfillJob("job-123");

      expect(result).toBeUndefined();
    });

    it("should log to rollbar with metadata on error", async () => {
      const error = new Error("Cancel failed");
      mockDelete.mockRejectedValue(error);

      await expect(cancelBackfillJob("job-123")).rejects.toThrow(
        "Cancel failed",
      );

      expect(logJobError).toHaveBeenCalledWith(
        error,
        "backfill-cancel-job-failed",
        "job-123",
      );
    });

    it("should re-throw the original error", async () => {
      const error = { response: { status: 404 } };
      mockDelete.mockRejectedValue(error);

      await expect(cancelBackfillJob("job-123")).rejects.toEqual(error);
    });
  });

  // ==================== connectBackfillJobStream ====================

  describe("connectBackfillJobStream", () => {
    let mockEventSource: {
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: ((event: Event) => void) | null;
      close: ReturnType<typeof vi.fn>;
      readyState: number;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let MockEventSourceConstructor: any;

    beforeEach(() => {
      mockEventSource = {
        onmessage: null,
        onerror: null,
        close: vi.fn(),
        readyState: 0,
      };

      // Use a regular function (not arrow) so it can be called with `new`
      MockEventSourceConstructor = vi.fn(function () {
        return mockEventSource;
      });

      vi.stubGlobal("EventSource", MockEventSourceConstructor);

      // Reset localStorage for token tests
      localStorage.clear();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should create EventSource with correct URL", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(MockEventSourceConstructor).toHaveBeenCalledWith(
        "http://localhost:3000/admin/backfill/jobs/job-123/stream",
      );
    });

    it("should include token as query param when accessToken exists", () => {
      localStorage.setItem("accessToken", "test-token-123");
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(MockEventSourceConstructor).toHaveBeenCalledWith(
        "http://localhost:3000/admin/backfill/jobs/job-123/stream?token=test-token-123",
      );
    });

    it("should include token as query param when legacy token exists", () => {
      localStorage.setItem("token", "legacy-token-456");
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(MockEventSourceConstructor).toHaveBeenCalledWith(
        "http://localhost:3000/admin/backfill/jobs/job-123/stream?token=legacy-token-456",
      );
    });

    it("should prefer accessToken over legacy token", () => {
      localStorage.setItem("accessToken", "access-token");
      localStorage.setItem("token", "legacy-token");
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(MockEventSourceConstructor).toHaveBeenCalledWith(
        "http://localhost:3000/admin/backfill/jobs/job-123/stream?token=access-token",
      );
    });

    it("should encode token in URL", () => {
      localStorage.setItem("accessToken", "token with spaces&special=chars");
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(MockEventSourceConstructor).toHaveBeenCalledWith(
        expect.stringContaining(
          "token=" + encodeURIComponent("token with spaces&special=chars"),
        ),
      );
    });

    it("should return the EventSource instance", () => {
      const onMessage = vi.fn();

      const result = connectBackfillJobStream("job-123", onMessage);

      expect(result).toBe(mockEventSource);
    });

    it("should call onMessage with parsed data", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      const eventData = {
        jobId: "job-123",
        status: "processing",
        progress: 50,
        total: 100,
      };

      mockEventSource.onmessage?.({
        data: JSON.stringify(eventData),
      } as MessageEvent);

      expect(onMessage).toHaveBeenCalledWith(eventData);
    });

    it("should auto-close when status is completed", () => {
      const onMessage = vi.fn();
      const onComplete = vi.fn();

      connectBackfillJobStream("job-123", onMessage, undefined, onComplete);

      mockEventSource.onmessage?.({
        data: JSON.stringify({
          jobId: "job-123",
          status: "completed",
          progress: 100,
          total: 100,
        }),
      } as MessageEvent);

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it("should auto-close when status is failed", () => {
      const onMessage = vi.fn();
      const onComplete = vi.fn();

      connectBackfillJobStream("job-123", onMessage, undefined, onComplete);

      mockEventSource.onmessage?.({
        data: JSON.stringify({
          jobId: "job-123",
          status: "failed",
          progress: 50,
          total: 100,
          error: "Something went wrong",
        }),
      } as MessageEvent);

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it("should auto-close when status is cancelled", () => {
      const onMessage = vi.fn();
      const onComplete = vi.fn();

      connectBackfillJobStream("job-123", onMessage, undefined, onComplete);

      mockEventSource.onmessage?.({
        data: JSON.stringify({
          jobId: "job-123",
          status: "cancelled",
          progress: 30,
          total: 100,
        }),
      } as MessageEvent);

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it("should NOT auto-close when status is processing", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      mockEventSource.onmessage?.({
        data: JSON.stringify({
          jobId: "job-123",
          status: "processing",
          progress: 50,
          total: 100,
        }),
      } as MessageEvent);

      expect(mockEventSource.close).not.toHaveBeenCalled();
    });

    it("should log to rollbar on JSON parse error", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      mockEventSource.onmessage?.({
        data: "invalid-json",
      } as MessageEvent);

      expect(logJobError).toHaveBeenCalledWith(
        expect.any(Error),
        "sse-parse-error",
        "job-123",
      );
    });

    it("should close connection and call onError on SSE error", () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      connectBackfillJobStream("job-123", onMessage, onError);

      const errorEvent = new Event("error");
      mockEventSource.onerror?.(errorEvent);

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(errorEvent);
    });

    it("should log SSE connection error to rollbar", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      mockEventSource.onerror?.(new Event("error"));

      expect(logJobError).toHaveBeenCalledWith(
        expect.any(Error),
        "sse-connection-error",
        "job-123",
      );
    });

    it("should handle missing onError callback gracefully", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(() => {
        mockEventSource.onerror?.(new Event("error"));
      }).not.toThrow();
    });

    it("should handle missing onComplete callback gracefully", () => {
      const onMessage = vi.fn();

      connectBackfillJobStream("job-123", onMessage);

      expect(() => {
        mockEventSource.onmessage?.({
          data: JSON.stringify({
            jobId: "job-123",
            status: "completed",
            progress: 100,
            total: 100,
          }),
        } as MessageEvent);
      }).not.toThrow();
    });
  });
});
