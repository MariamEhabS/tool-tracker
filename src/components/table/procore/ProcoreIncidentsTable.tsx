import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreIncidentsMockData, type ProcoreIncidentEntity } from '@/api/mockdata/procoreData'

export type IncidentRow = {
  id: string;
  title: string;
  recordable: string;
  status: { label: string; cls: string };
  location: string;
  occurred: string;
  icon: ReactNode;
};

export function getProcoreIncidentsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: IncidentRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<IncidentRow>[];
  rows: IncidentRow[];
  getRowId: (r: IncidentRow) => string;
  renderActions?: (row: IncidentRow) => ReactNode;
} {
  // Normalize JSON-shaped mock data to table row shape
  const mapToRow = (e: Record<string, unknown>): IncidentRow => {
    const title = asString(e.title ?? e.name ?? e.description, "Incident");
    const recordable =
      e.recordable === true ? "Yes" : e.recordable === false ? "No" : "—";
    const statusLower = asString(e.status).toLowerCase();
    const statusCls =
      statusLower === "open"
        ? "bg-red-100 text-red-700"
        : statusLower === "closed"
          ? "bg-green-100 text-green-700"
          : statusLower === "initiated"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-gray-100 text-gray-700";
    const locationRec = asRecord(e.location);
    const location = asString(locationRec?.name ?? locationRec?.node_name, "—");
    const occurredIso = asDateLike(
      e.event_date ?? e.created_at ?? e.updated_at,
    );
    const occurred = occurredIso ? formatDate(occurredIso) : "—";
    const icon = <i className="bx bx-error-alt text-gray-600 text-xl"></i>;
    const id = asString(e.id ?? e.number ?? e.uid, "");
    return {
      id,
      title,
      recordable,
      status: { label: asString(e.status, "Unknown"), cls: statusCls },
      location,
      occurred,
      icon,
    };
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
  const rows: IncidentRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((e) => mapToRow(e))
    : [];

  // Default sort: by title (ascending - alphabetical)
  rows.sort((a, b) => a.title.localeCompare(b.title));

  // Legacy/mock fallback and QR filtering (commented):
  // let rows: IncidentRow[] = ProcoreIncidentsMockData.map(mapToRow)
  // if (opts?.qrId) { /* legacy QR-based filtering logic retained in comments */ }

  const columns: Column<IncidentRow>[] = [
    col<IncidentRow>({
      key: "title",
      header: "Title / Event",
      sortable: true,
      ...secondaryCell((row: IncidentRow) => {
        const isHidden =
          opts?.actionMode !== "remove" && hiddenFromOpts.has(row.id);
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                row.icon
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<IncidentRow>({
      key: "recordable",
      header: "Recordable",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.recordable ?? "—",
        className:
          row.recordable === "Yes"
            ? "bg-green-100 text-green-700"
            : row.recordable === "No"
              ? "bg-gray-100 text-gray-700"
              : "bg-yellow-50 text-yellow-700",
      })),
    }),
    col<IncidentRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<IncidentRow>({
      key: "location",
      header: "Location",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<IncidentRow>({
      key: "occurred",
      header: "Date Occurred",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.occurred),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: IncidentRow) => {
          const isHiddenLocal = hiddenFromOpts.has(row.id);
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
          // Legacy actions logic (commented) retained above
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
    getRowId: (r: IncidentRow) => r.id,
    renderActions,
  };
}

// Helper used by bulk actions to determine if an incident row is location-based (Hide/Show only)
// export function isIncidentLocationMatch(_qrId: string | undefined, _row: IncidentRow): boolean { return false; }
// Legacy implementation (commented):
// export function isIncidentLocationMatch(qrId: string | undefined, row: IncidentRow): boolean { /* ... */ }
