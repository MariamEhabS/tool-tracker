import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike, getFirstRecord } from "@lib/coerce";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreTasksMockData } from '@/api/mockdata/procoreData'

export type TaskRow = {
  title: string;
  id: string;
  procoreId?: string;
  status: { label: string; cls: string };
  assignee: string;
  location: string;
  due: string;
  /** Whether this row has a valid Procore ID and is eligible for delete operations */
  canDelete: boolean;
};

export function getProcoreTasksTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: TaskRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<TaskRow>[];
  rows: TaskRow[];
  getRowId: (r: TaskRow) => string;
  renderActions?: (row: TaskRow) => ReactNode;
} {
  const normalize = (value: unknown): string => {
    const s = String(value ?? "");
    const digits = s.match(/[0-9]+/g)?.join("") ?? "";
    if (digits.length > 0) return String(Number(digits));
    return s.trim();
  };

  const hiddenFromOpts: Set<string> = (() => {
    if (!opts?.hiddenIds) return new Set<string>();
    if (opts.hiddenIds instanceof Set)
      return new Set<string>(Array.from(opts.hiddenIds));
    return new Set<string>(
      (opts.hiddenIds as Array<string | number>).map((v) => String(v)),
    );
  })();

  const mapToRow = (t: Record<string, unknown>): TaskRow => {
    const title = asString(t.title ?? t.description, "Task");
    const id = asString(t.number ?? t.id, "");
    const procoreId = asString(t.id, "");
    const statusLabel = asString(t.status, "Unknown");
    const statusCls = (() => {
      const s = statusLabel.toLowerCase();
      if (s.includes("open")) return "bg-green-100 text-green-700";
      if (s.includes("closed")) return "bg-gray-100 text-gray-700";
      if (
        s.includes("initiated") ||
        s.includes("in progress") ||
        s.includes("pending")
      )
        return "bg-yellow-100 text-yellow-700";
      return "bg-gray-100 text-gray-700";
    })();
    const assigneeRec = asRecord(t.assignee);
    const firstAssignee = getFirstRecord(t, "assignees");
    const assignee = asString(assigneeRec?.name ?? firstAssignee?.name, "—");
    const location = "—";
    const dueIso = asDateLike(t.due_date);
    const due = dueIso ? formatDate(dueIso) : "—";
    return {
      title,
      id,
      procoreId,
      status: { label: statusLabel, cls: statusCls },
      assignee,
      location,
      due,
      canDelete: procoreId.trim().length > 0,
    };
  };

  // Prefer real data via opts.data; fallback to empty
  const rows: TaskRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((t) => mapToRow(t))
    : [];

  // Default sort: by # (descending - newest first)
  rows.sort((a, b) => {
    const numA = parseInt(a.id, 10) || 0;
    const numB = parseInt(b.id, 10) || 0;
    return numB - numA;
  });

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<TaskRow>[] = [
    col<TaskRow>({
      key: "title",
      header: "Title",
      sortable: true,
      ...secondaryCell<TaskRow>((row) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          hiddenFromOpts.has(normalize(row.procoreId ?? row.id));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bx-task text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<TaskRow>({
      key: "id",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<TaskRow>({
      key: "status",
      header: "Status",
      sortable: true,
      ...statusBadgeCell<TaskRow>((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
      columnType: "status",
    }),
    col<TaskRow>({
      key: "assignee",
      header: "Assignee",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<TaskRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      ...dateCell<TaskRow>((row) => row.due),
      columnType: "date",
    }),
  ];

  function getRowId(r: TaskRow): string {
    // Prefer raw Procore ID for API operations (hide/show/remove)
    const pid = (r.procoreId ?? "").trim();
    if (pid.length > 0) return pid;
    // Fallback: use task number/id for table row uniqueness (not valid for delete operations)
    const id = (r.id ?? "").trim();
    if (id.length > 0) return id;
    // Last resort: deterministic key from row content (not a valid Procore ID)
    const seed = `${r.title ?? ""}|${r.assignee ?? ""}|${r.due ?? ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `__fallback_${Math.abs(hash).toString(36)}`;
  }

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: TaskRow) => {
          const rowId = getRowId(row);
          const options: ItemComboBoxOption[] = [];
          const isHiddenLocal = hiddenFromOpts.has(
            normalize(row.procoreId ?? row.id),
          );
          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                const actionId = row.procoreId || rowId;
                if (opts?.onAction) return opts.onAction(actionId, "show");
                return opts?.onShow?.(actionId);
              },
            });
          } else if (!isHiddenLocal && (opts?.onRemove || opts?.onAction)) {
            const useRemove = opts?.actionMode === "remove";
            options.push({
              label: useRemove ? "Remove" : "Hide",
              value: useRemove ? "remove" : "hide",
              iconClass: useRemove ? "bx bx-x" : "bx bx-hide",
              onSelect: () => {
                const actionId = row.procoreId || rowId;
                if (opts?.onAction)
                  return opts.onAction(actionId, useRemove ? "remove" : "hide");
                return opts?.onRemove?.(actionId);
              },
            });
          }
          if (options.length === 0) return null;
          return (
            <div
              className="relative inline-block text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <ItemComboBox options={options} />
            </div>
          );
        }
      : undefined;

  return { columns, rows, getRowId, renderActions };
}
