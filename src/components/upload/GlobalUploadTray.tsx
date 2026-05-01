import { useMemo, useState } from "react";
import { useUploadQueue } from "./UploadQueueProvider";

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = n;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function GlobalUploadTray() {
  const { tasks, removeTask } = useUploadQueue();
  const [open, setOpen] = useState<boolean>(false);

  const active = tasks.filter(
    (t) => t.status === "uploading" || t.status === "queued",
  );
  const completed = tasks.filter(
    (t) => t.status !== "uploading" && t.status !== "queued",
  );

  const aggregate = useMemo(() => {
    const total = active.reduce((sum, t) => sum + (t.totalBytes || 0), 0);
    const loaded = active.reduce((sum, t) => sum + (t.uploadedBytes || 0), 0);
    const pct = total > 0 ? Math.floor((loaded / total) * 100) : 0;
    return { total, loaded, pct };
  }, [active]);

  const countUploading = active.length;

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-800"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        title="Upload manager"
      >
        <i className="bx bx-cloud-upload text-lg" />
        <span className="text-sm">
          {countUploading > 0
            ? `${countUploading} in progress`
            : `${completed.length} completed`}
        </span>
        {aggregate.total > 0 ? (
          <span className="text-xs bg-white/20 rounded px-2 py-0.5">
            {aggregate.pct}%
          </span>
        ) : null}
        <i
          className={`bx ${open ? "bx-chevron-down" : "bx-chevron-up"} text-lg`}
        />
      </button>
      {open ? (
        <div className="mt-2 w-[340px] max-h-[360px] overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Uploads</span>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {tasks.map((t) => {
              const pct =
                t.kind === "files" && t.totalBytes && t.totalBytes > 0
                  ? Math.floor(((t.uploadedBytes || 0) / t.totalBytes) * 100)
                  : t.kind === "urls" && t.totalItems && t.totalItems > 0
                    ? Math.floor(((t.completedItems || 0) / t.totalItems) * 100)
                    : 0;
              const statusColor =
                t.status === "success"
                  ? "text-green-600"
                  : t.status === "error"
                    ? "text-red-600"
                    : t.status === "canceled"
                      ? "text-gray-500"
                      : "text-blue-600";
              return (
                <li key={t.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {t.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t.kind === "files"
                          ? `${formatBytes(t.uploadedBytes)} / ${formatBytes(t.totalBytes)}`
                          : `${t.completedItems || 0} / ${t.totalItems || 0}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${statusColor}`}>
                        {t.status}
                      </span>
                      {t.status === "uploading" && t.cancel ? (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          onClick={t.cancel}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {t.status !== "uploading" ? (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          onClick={() => removeTask(t.id)}
                        >
                          Dismiss
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded">
                    <div
                      className="h-1.5 bg-blue-600 rounded"
                      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                    />
                  </div>
                  {t.error ? (
                    <div className="mt-1 text-xs text-red-600">{t.error}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
