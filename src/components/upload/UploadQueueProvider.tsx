import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import axios, { type CancelTokenSource, type AxiosProgressEvent } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { addCustomLinkToQRCode, QrKeys } from "@/api/endpoints/qr-codes";
import { QrKeys as ScannedQrKeys } from "@/api/endpoints/scanned-qr";
import {
  uploadDocumentsMultiple,
  initMultipartUpload,
  getMultipartPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@/api/endpoints/document";
import { logDocumentError } from "@/utils/rollbar";

/**
 * Ensures a URL has a protocol. Prepends https:// if missing.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Lifecycle status of a queued upload task. */
export type UploadTaskStatus =
  | "queued"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

/** Represents a single upload task tracked by the UploadQueueProvider with progress and metadata. */
export type UploadTask = {
  /** Unique identifier for this task */
  id: string;
  /** Whether this task uploads files or adds URL links */
  kind: "files" | "urls";
  /** Human-readable description shown in the upload tray */
  label: string;
  /** Current lifecycle status */
  status: UploadTaskStatus;
  /** Error message when status is "error" */
  error?: string;
  /** Total byte size for file uploads (used for progress calculation) */
  totalBytes?: number;
  /** Bytes uploaded so far */
  uploadedBytes?: number;
  /** Total number of items for URL batch operations */
  totalItems?: number;
  /** Number of items completed so far */
  completedItems?: number;
  /** Function to cancel an in-progress upload */
  cancel?: () => void;
  /** Contextual metadata linking this task to a company, project, and QR code */
  meta: {
    companyId: string;
    projectId?: string;
    qrcodeId: string;
    folderId?: string;
  };
};

/** Parameters for enqueuing a group of file uploads to a QR code. */
type FileGroupParams = {
  companyId: string;
  projectId: string;
  qrcodeId: string;
  /** Target folder within the QR code; omit for root-level uploads */
  folderId?: string;
  /** Upload context: "file-qrcode" for direct file QR codes, "folder-qrcode" for folder-based QR codes */
  documentPurpose: "file-qrcode" | "folder-qrcode";
  /** Array of File objects to upload */
  files: File[];
  /** Optional custom display names for each file (parallel to files array) */
  documentNames?: string[];
  /** Optional page numbers to open PDF files to (parallel to files array) */
  openToPages?: Array<number | undefined>;
};

/** A single URL item to add as a custom link to a QR code. */
type UrlItem = {
  /** Display name for the link */
  displayName: string;
  /** URL to add (will be normalized with https:// if protocol is missing) */
  url: string;
  /** Optional target folder for the link */
  folderId?: string;
};

/** Parameters for enqueuing a batch of URL link additions to a QR code. */
type UrlBatchParams = {
  companyId: string;
  projectId?: string;
  qrcodeId: string;
  /** Array of URL items to add */
  items: UrlItem[];
};

/** Context value provided by UploadQueueProvider, exposing task state and enqueue methods. */
type UploadQueueContextType = {
  /** All tracked upload tasks (active and completed) */
  tasks: UploadTask[];
  /** Enqueue a group of files for upload via the server-side multi-upload endpoint. Returns the task ID. */
  enqueueFileGroupUpload: (p: FileGroupParams) => string;
  /** Smart enqueue: routes large files (>100MB) through direct-to-S3 multipart upload, small files through server. Returns array of task IDs. */
  enqueueFileGroupUploadSmart: (p: FileGroupParams) => string[];
  /** Enqueue a batch of URL link additions. Returns the task ID. */
  enqueueUrlAdds: (p: UrlBatchParams) => string;
  /** Returns a promise that resolves when all tasks with the given IDs have finished (success, error, or canceled). */
  waitForAll: (ids: string[]) => Promise<void>;
  /** Remove a completed/failed/canceled task from the list */
  removeTask: (id: string) => void;
};

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useUploadQueue(): UploadQueueContextType {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error("useUploadQueue must be used within UploadQueueProvider");
  }
  return ctx;
}

export function UploadQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const taskResolvers = useRef<Map<string, () => void>>(new Map());
  const queryClient = useQueryClient();
  const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
  const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10MB

  const resolveTask = useCallback((id: string) => {
    const r = taskResolvers.current.get(id);
    if (r) {
      r();
      taskResolvers.current.delete(id);
    }
  }, []);

  const createTask = useCallback((base: Omit<UploadTask, "status">) => {
    const task: UploadTask = { ...base, status: "queued" };
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, partial: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    );
  }, []);

  const finishTask = useCallback(
    async (
      id: string,
      status: UploadTaskStatus,
      opts?: { error?: string; invalidate?: { qrcodeId: string } },
    ) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status, error: opts?.error } : t,
        ),
      );
      // Invalidate both QR caches on success so the document table and QR card refresh
      if (status === "success" && opts?.invalidate?.qrcodeId) {
        const qrcodeId = opts.invalidate.qrcodeId;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: QrKeys.single(qrcodeId),
          }),
          queryClient.invalidateQueries({
            queryKey: ScannedQrKeys.detail(qrcodeId),
          }),
        ]);
      }
      resolveTask(id);
    },
    [queryClient, resolveTask],
  );

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const waitForAll = useCallback((ids: string[]) => {
    return new Promise<void>((resolve) => {
      if (ids.length === 0) return resolve();
      const remaining = new Set(ids);
      const check = () => {
        setTasks((prev) => {
          const done = prev.filter(
            (t) =>
              remaining.has(t.id) &&
              (t.status === "success" ||
                t.status === "error" ||
                t.status === "canceled"),
          );
          for (const d of done) remaining.delete(d.id);
          if (remaining.size === 0) resolve();
          return prev;
        });
      };
      // Create resolvers for each id to notify completion
      ids.forEach((id) => {
        taskResolvers.current.set(id, check);
      });
      // Immediate check in case already completed
      check();
    });
  }, []);

  const enqueueFileGroupUpload = useCallback(
    (p: FileGroupParams) => {
      const totalBytes = p.files.reduce((sum, f) => sum + (f?.size || 0), 0);
      const id = `file-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const source: CancelTokenSource = axios.CancelToken.source();
      const task = createTask({
        id,
        kind: "files",
        label: p.folderId
          ? `Uploading ${p.files.length} files to folder`
          : `Uploading ${p.files.length} files`,
        totalBytes,
        uploadedBytes: 0,
        meta: {
          companyId: p.companyId,
          projectId: p.projectId,
          qrcodeId: p.qrcodeId,
          folderId: p.folderId,
        },
      });
      updateTask(id, {
        status: "uploading",
        cancel: () => source.cancel("Canceled by user"),
      });
      // Use existing backend multi-upload with progress
      // Note: evt.total from axios includes form metadata overhead, so we use our calculated totalBytes
      // and scale progress proportionally when evt.total is available
      void uploadDocumentsMultiple(
        {
          companyId: p.companyId,
          projectId: p.projectId,
          qrcodeId: p.qrcodeId,
          folderId: p.folderId,
          documentPurpose: p.documentPurpose,
          files: p.files,
          documentNames: p.documentNames,
          openToPages: p.openToPages?.filter(
            (page): page is number => page !== undefined,
          ),
        },
        {
          onUploadProgress: (evt: AxiosProgressEvent) => {
            if (typeof evt.loaded === "number" && totalBytes > 0) {
              // If axios provides total, calculate percentage and apply to our totalBytes
              // This accounts for form metadata overhead in the request
              if (typeof evt.total === "number" && evt.total > 0) {
                const percentage = evt.loaded / evt.total;
                const next = Math.min(
                  totalBytes,
                  Math.floor(totalBytes * percentage),
                );
                updateTask(id, { uploadedBytes: next });
              } else {
                // Fallback: use loaded directly, capped at totalBytes
                const next = Math.min(totalBytes, evt.loaded);
                updateTask(id, { uploadedBytes: next });
              }
            }
          },
          cancelToken: source.token,
        },
      )
        .then(() => {
          // Ensure progress shows 100% on completion
          updateTask(id, { uploadedBytes: totalBytes });
          finishTask(id, "success", { invalidate: { qrcodeId: p.qrcodeId } });
        })
        .catch((err) => {
          if (axios.isCancel(err)) {
            finishTask(id, "canceled");
          } else {
            logDocumentError(err, "document-upload-failed", {
              fileCount: p.files.length,
              totalBytes,
              stage: "upload",
            });
            finishTask(id, "error", { error: err?.message || "Upload failed" });
          }
        });
      return task.id;
    },
    [createTask, finishTask, updateTask],
  );

  // Single-file direct-to-S3 multipart upload as a task
  const enqueueSingleFileDirect = useCallback(
    (params: {
      companyId: string;
      projectId: string;
      qrcodeId: string;
      folderId?: string;
      documentPurpose: "file-qrcode" | "folder-qrcode";
      file: File;
      documentName?: string;
      openToPage?: number;
    }) => {
      const totalBytes = params.file.size || 0;
      const id = `file-direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const task = createTask({
        id,
        kind: "files",
        label: `Uploading ${params.documentName || params.file.name}`,
        totalBytes,
        uploadedBytes: 0,
        meta: {
          companyId: params.companyId,
          projectId: params.projectId,
          qrcodeId: params.qrcodeId,
          folderId: params.folderId,
        },
      });
      updateTask(id, { status: "uploading" });
      (async () => {
        let uploadId = "";
        let s3Key = "";
        try {
          // 1) Init
          const init = await initMultipartUpload({
            companyId: params.companyId,
            projectId: params.projectId,
            qrcodeId: params.qrcodeId,
            folderId: params.folderId,
            documentName: params.documentName || params.file.name,
            documentPurpose: params.documentPurpose,
            contentType: params.file.type || "application/octet-stream",
            openToPage: params.openToPage,
          });
          uploadId = init.uploadId;
          s3Key = init.s3Key;
          const bucket = init.bucket;
          const parts: Array<{ ETag: string; PartNumber: number }> = [];
          // 2) Upload parts
          const size = params.file.size;
          const partSize = MULTIPART_PART_SIZE;
          let offsetBase = 0;
          const totalParts = Math.ceil(size / partSize);
          for (let part = 1; part <= totalParts; part += 1) {
            const start = (part - 1) * partSize;
            const end = Math.min(start + partSize, size);
            const blob = params.file.slice(start, end);
            const { url } = await getMultipartPartUrl({
              bucket,
              s3Key,
              uploadId,
              partNumber: part,
              contentType: params.file.type || "application/octet-stream",
            });
            // Upload this part

            const resp = await axios.put(url, blob, {
              headers: {
                "Content-Type": "application/octet-stream",
              },
              onUploadProgress: (e) => {
                const loaded = offsetBase + (e.loaded || 0);
                updateTask(id, { uploadedBytes: Math.min(totalBytes, loaded) });
              },
              // Do not send cookies to S3
              withCredentials: false,
            });
            const etag = (resp.headers?.etag as string) || "";
            parts.push({ ETag: etag, PartNumber: part });
            offsetBase = end;
            updateTask(id, { uploadedBytes: Math.min(totalBytes, offsetBase) });
          }
          // 3) Complete
          await completeMultipartUpload({
            s3Key,
            uploadId,
            parts,
            companyId: params.companyId,
            projectId: params.projectId,
            qrcodeId: params.qrcodeId,
            folderId: params.folderId,
            documentName: params.documentName || params.file.name,
            documentPurpose: params.documentPurpose,
            openToPage: params.openToPage,
          });
          // Ensure progress shows 100% on completion
          updateTask(id, { uploadedBytes: totalBytes });
          finishTask(id, "success", {
            invalidate: { qrcodeId: params.qrcodeId },
          });
        } catch (err: unknown) {
          logDocumentError(err, "multipart-upload-failed", {
            fileName: params.file.name,
            fileSize: params.file.size,
            fileType: params.file.type,
          });

          // Best-effort abort
          try {
            if (uploadId && s3Key) {
              await abortMultipartUpload({ s3Key, uploadId });
            }
          } catch {
            // ignore
          }
          finishTask(id, "error", {
            error: (err as { message?: string })?.message || "Upload failed",
          });
        }
      })();
      return task.id;
    },
    [MULTIPART_PART_SIZE, createTask, finishTask, updateTask],
  );

  const enqueueFileGroupUploadSmart = useCallback(
    (p: FileGroupParams) => {
      const heavy: File[] = [];
      const heavyNames: string[] = [];
      const heavyOpenToPages: Array<number | undefined> = [];
      const small: File[] = [];
      const smallNames: string[] = [];
      const smallOpenToPages: Array<number | undefined> = [];
      p.files.forEach((f, idx) => {
        const name = p.documentNames?.[idx] || f.name;
        const openToPage = p.openToPages?.[idx];
        if ((f.size || 0) >= MULTIPART_THRESHOLD) {
          heavy.push(f);
          heavyNames.push(name);
          heavyOpenToPages.push(openToPage);
        } else {
          small.push(f);
          smallNames.push(name);
          smallOpenToPages.push(openToPage);
        }
      });
      const ids: string[] = [];
      if (small.length > 0) {
        ids.push(
          enqueueFileGroupUpload({
            ...p,
            files: small,
            documentNames: smallNames,
            openToPages: smallOpenToPages,
          }),
        );
      }
      if (heavy.length > 0) {
        for (let i = 0; i < heavy.length; i += 1) {
          ids.push(
            enqueueSingleFileDirect({
              companyId: p.companyId,
              projectId: p.projectId,
              qrcodeId: p.qrcodeId,
              folderId: p.folderId,
              documentPurpose: p.documentPurpose,
              file: heavy[i],
              documentName: heavyNames[i],
              openToPage: heavyOpenToPages[i],
            }),
          );
        }
      }
      return ids;
    },
    [MULTIPART_THRESHOLD, enqueueFileGroupUpload, enqueueSingleFileDirect],
  );

  const enqueueUrlAdds = useCallback(
    (p: UrlBatchParams) => {
      const id = `url-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const totalItems = p.items.length;
      const task = createTask({
        id,
        kind: "urls",
        label: `Adding ${totalItems} link${totalItems !== 1 ? "s" : ""}`,
        totalItems,
        completedItems: 0,
        meta: {
          companyId: p.companyId,
          projectId: p.projectId,
          qrcodeId: p.qrcodeId,
          folderId: undefined,
        },
      });
      updateTask(id, { status: "uploading" });
      (async () => {
        try {
          for (let i = 0; i < p.items.length; i += 1) {
            const it = p.items[i];
            const rawUrl = (it.url || "").trim();
            if (!rawUrl) {
              updateTask(id, { completedItems: i + 1 });
              // skip blank
              continue;
            }
            // Normalize URL to ensure it has a protocol
            const url = normalizeUrl(rawUrl);
            // Add link
            await addCustomLinkToQRCode(p.qrcodeId, {
              companyId: p.companyId,
              ...(p.projectId && { projectId: p.projectId }),
              documentName: it.displayName || rawUrl,
              referenceLink: url,
              folderId: it.folderId,
            });
            updateTask(id, { completedItems: i + 1 });
          }
          finishTask(id, "success", { invalidate: { qrcodeId: p.qrcodeId } });
        } catch (err: unknown) {
          logDocumentError(err, "url-batch-upload-failed", {
            qrcodeId: p.qrcodeId,
            urlCount: p.items.length,
          });
          finishTask(id, "error", {
            error: (err as { message?: string })?.message || "Add link failed",
          });
        }
      })();
      return task.id;
    },
    [createTask, finishTask, updateTask],
  );

  const value = useMemo(() => {
    return {
      tasks,
      enqueueFileGroupUpload,
      enqueueFileGroupUploadSmart,
      enqueueUrlAdds,
      waitForAll,
      removeTask,
    };
  }, [
    tasks,
    enqueueFileGroupUpload,
    enqueueFileGroupUploadSmart,
    enqueueUrlAdds,
    waitForAll,
    removeTask,
  ]);

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
}
