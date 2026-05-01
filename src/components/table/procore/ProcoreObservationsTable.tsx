import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";

export type ObservationRow = {
  title: string;
  id: string;
  procoreId: string;
  status: { label: string; cls: string };
  priority: { label: string; icon: string; textCls: string };
  type: { label: string; cls: string };
  due: string;
};

export function getProcoreObservationsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: ObservationRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<ObservationRow>[];
  rows: ObservationRow[];
  getRowId: (r: ObservationRow) => string;
  renderActions?: (row: ObservationRow) => ReactNode;
} {
  const mapToRow = (e: Record<string, unknown>): ObservationRow => {
    const title = asString(e.name, "");
    // Use number for display (user-friendly), fallback to id (internal Procore ID)
    const id = asString(e.number ?? e.id, "");
    const statusLower = asString(e.status).toLowerCase();
    const statusCls =
      statusLower === "open"
        ? "bg-brand-50 text-brand-700"
        : statusLower === "closed"
          ? "bg-green-100 text-green-700"
          : statusLower.includes("initiated")
            ? "bg-gray-100 text-gray-700"
            : "bg-blue-100 text-blue-700";
    const prioLower = asString(e.priority).toLowerCase();
    const priority =
      prioLower === "high"
        ? {
            label: "High",
            icon: "bx bx-error-circle text-red-600",
            textCls: "text-red-600",
          }
        : prioLower === "medium"
          ? {
              label: "Medium",
              icon: "bx bx-info-circle text-brand-700",
              textCls: "text-brand-700",
            }
          : {
              label: "Low",
              icon: "bx bx-low-vision text-gray-600",
              textCls: "text-gray-600",
            };
    const typeRec = asRecord(e.type);
    const typeLabel = asString(typeRec?.name, "Unknown");
    const typeCls = typeLabel.toLowerCase().includes("quality")
      ? "bg-blue-50 text-blue-700 ring-blue-700/10"
      : typeLabel.toLowerCase().includes("commission")
        ? "bg-purple-50 text-purple-700 ring-purple-700/10"
        : "bg-red-50 text-red-700 ring-red-600/20";
    const dueIso = asDateLike(e.due_date);
    const due = dueIso ? formatDate(dueIso) : "—";
    return {
      title,
      id,
      procoreId: asString(e.id, ""),
      status: { label: asString(e.status, "Unknown"), cls: statusCls },
      priority,
      type: { label: typeLabel, cls: typeCls },
      due,
    };
  };

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

  // Prefer real data via opts.data; fallback to empty
  const rows: ObservationRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((o) => mapToRow(o))
    : [];

  // Default sort: by # (descending - newest first)
  rows.sort((a, b) => {
    const numA = parseInt(a.id, 10) || 0;
    const numB = parseInt(b.id, 10) || 0;
    return numB - numA;
  });

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<ObservationRow>[] = [
    col<ObservationRow>({
      key: "title",
      header: "Title",
      sortable: true,
      ...secondaryCell((row: ObservationRow) => {
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
                <i className="bx bx-search-alt text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<ObservationRow>({
      key: "id",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<ObservationRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<ObservationRow>({
      key: "priority",
      header: "Priority",
      sortable: true,
      columnType: "status",
      className: "text-gray-500",
      render: (row: ObservationRow) => {
        const icon = row.priority?.icon ?? "bx bx-info-circle";
        const textCls = row.priority?.textCls ?? "text-gray-600";
        const label = row.priority?.label ?? "Unknown";
        return (
          <span className={`inline-flex items-center ${textCls}`}>
            <i className={`${icon} mr-1`}></i>
            {label}
          </span>
        );
      },
    }),
    col<ObservationRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.due),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: ObservationRow) => {
          const options: ItemComboBoxOption[] = [];
          const isHidden = hiddenFromOpts.has(
            normalize(row.procoreId ?? row.id),
          );
          if (isHidden && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.procoreId, "show");
                return opts?.onShow?.(row.procoreId);
              },
            });
          } else if (!isHidden && (opts?.onRemove || opts?.onAction)) {
            const useRemove = opts?.actionMode === "remove";
            options.push({
              label: useRemove ? "Remove" : "Hide",
              value: useRemove ? "remove" : "hide",
              iconClass: useRemove ? "bx bx-x" : "bx bx-hide",
              onSelect: () => {
                if (opts?.onAction)
                  return opts.onAction(
                    row.procoreId,
                    useRemove ? "remove" : "hide",
                  );
                return opts?.onRemove?.(row.procoreId);
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

  return {
    columns,
    rows,
    getRowId: (r: ObservationRow) => r.procoreId,
    renderActions,
  };
}

// Helper used by bulk actions to determine if an observation row is location-based (Hide/Show only)
export function isObservationLocationMatch(
  _qrId: string | undefined,
  _row: ObservationRow,
): boolean {
  return false;
}
