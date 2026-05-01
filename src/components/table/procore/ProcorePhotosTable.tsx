import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asDateLike } from "@lib/coerce";

export type PhotoRow = {
  title: string;
  id: string;
  procoreId?: string;
  status: { label: string; cls: string };
  priority: { label: string; icon: string; textCls: string };
  type: { label: string; cls: string };
  due: string;
};

export function getProcorePhotosTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: PhotoRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<PhotoRow>[];
  rows: PhotoRow[];
  getRowId: (r: PhotoRow) => string;
  renderActions?: (row: PhotoRow) => ReactNode;
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

  const mapToRow = (p: Record<string, unknown>): PhotoRow => {
    const title = asString(p.filename ?? p.description, "Photo");
    const id = asString(p.id, "");
    const procoreId = asString(p.id, "");
    const status = {
      label: p.starred ? "Published" : "Draft",
      cls: p.starred
        ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-700",
    };
    const priority = {
      label: "Medium",
      icon: "bx bx-image-alt",
      textCls: "text-gray-600",
    };
    const typeLabel = asString(p.image_category_name, "Site Photo");
    const typeCls =
      "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10 rounded-md";
    const dueIso = asDateLike(p.taken_at ?? p.created_at ?? p.updated_at);
    const due = dueIso ? formatDate(dueIso) : "—";
    return {
      title,
      id,
      procoreId,
      status,
      priority,
      type: { label: typeLabel, cls: typeCls },
      due,
    };
  };

  // Prefer real data via opts.data; fallback to empty
  const rows: PhotoRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((p) => mapToRow(p))
    : [];

  // Default sort: by date (descending - latest to oldest)
  rows.sort((a, b) => {
    const dateA = Date.parse(a.due) || 0;
    const dateB = Date.parse(b.due) || 0;
    return dateB - dateA;
  });

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<PhotoRow>[] = [
    col<PhotoRow>({
      key: "title",
      header: "Title",
      sortable: true,
      ...secondaryCell<PhotoRow>((row) => {
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
                <i className="bx bx-image text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    // col<PhotoRow>({ key: 'id', header: '#', sortable: true, className: 'text-gray-500', columnType: 'short' }),
    col<PhotoRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell<PhotoRow>((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    // col<PhotoRow>({ key: 'priority', header: 'Priority', sortable: true, className: 'text-gray-500', columnType: 'status', render: (row: PhotoRow) => {
    //   const icon = row.priority?.icon ?? 'bx bx-info-circle'
    //   const textCls = row.priority?.textCls ?? 'text-gray-600'
    //   const label = row.priority?.label ?? 'Unknown'
    //   return (<span className={`inline-flex items-center ${textCls}`}><i className={`${icon} mr-1`}></i>{label}</span>)
    // } }),
    col<PhotoRow>({
      key: "type",
      header: "Type",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell<PhotoRow>((row) => ({
        label: row.type?.label ?? "Unknown",
        className: row.type?.cls ?? "bg-gray-50 text-gray-700 ring-gray-500/10",
      })),
    }),
    col<PhotoRow>({
      key: "due",
      header: "Date",
      sortable: true,
      columnType: "date",
      ...dateCell<PhotoRow>((row) => row.due),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: PhotoRow) => {
          const isHiddenLocal = hiddenFromOpts.has(
            normalize(row.procoreId ?? row.id),
          );
          const options: ItemComboBoxOption[] = [];
          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.id, "show");
                return opts?.onShow?.(row.id);
              },
            });
          } else if (!isHiddenLocal && (opts?.onRemove || opts?.onAction)) {
            const useRemove = opts?.actionMode === "remove";
            options.push({
              label: useRemove ? "Remove" : "Hide",
              value: useRemove ? "remove" : "hide",
              iconClass: useRemove ? "bx bx-x" : "bx bx-hide",
              onSelect: () => {
                if (opts?.onAction)
                  return opts.onAction(row.id, useRemove ? "remove" : "hide");
                return opts?.onRemove?.(row.id);
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

  return { columns, rows, getRowId: (r: PhotoRow) => r.id, renderActions };
}

// Helper used by bulk actions to determine if a photo row is location-based (Hide/Show only)
export function isPhotoLocationMatch(
  _qrId: string | undefined,
  _row: PhotoRow,
): boolean {
  return false;
}
