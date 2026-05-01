import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcorePunchListMockData, type ProcorePunchEntity } from '@/api/mockdata/procoreData'
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike, getFirstRecord } from "@lib/coerce";

export type PunchRow = {
  title: string;
  position: string; // Display position/number (for UI)
  procoreId: string; // Procore's unique item ID (for identification)
  status: { label: string; cls: string };
  location: string;
  assignee: string;
  due: string;
};

export function getProcorePunchListTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: PunchRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<PunchRow>[];
  rows: PunchRow[];
  getRowId: (r: PunchRow) => string;
  renderActions?: (row: PunchRow) => ReactNode;
} {
  const mapToRow = (e: Record<string, unknown>): PunchRow => {
    const title = asString(e?.name ?? e?.title, "Punch Item");
    // Procore Punch List uses 'position' for display, fallback to 'number'
    const position = asString(e?.position ?? e?.number, "");
    // Procore's unique item ID - must be used for selection/identification
    const procoreId = asString(e?.id, "");
    const statusLower = asString(e?.status).toLowerCase();
    const statusCls =
      statusLower === "open"
        ? "bg-brand-50 text-brand-700"
        : statusLower === "closed"
          ? "bg-green-100 text-green-700"
          : "bg-blue-100 text-blue-700";
    const locationRec = asRecord(e?.location);
    const location = asString(locationRec?.name ?? locationRec?.node_name, "—");
    const firstAssignee = getFirstRecord(e, "assignees");
    const firstBallInCourt = getFirstRecord(e, "ball_in_court");
    const assignee = asString(
      firstAssignee?.name ?? firstBallInCourt?.name,
      "—",
    );
    const dueIso = asDateLike(e?.due_date);
    const due = dueIso ? formatDate(dueIso) : "—";
    return {
      title,
      position,
      procoreId,
      status: { label: asString(e?.status, "Unknown"), cls: statusCls },
      location,
      assignee,
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
  const rows: PunchRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((e) => mapToRow(e))
    : [];

  // Default sort: by # (descending - newest first)
  rows.sort((a, b) => {
    const numA = parseInt(a.position, 10) || 0;
    const numB = parseInt(b.position, 10) || 0;
    return numB - numA;
  });

  const columns: Column<PunchRow>[] = [
    col<PunchRow>({
      key: "title",
      header: "Title",
      sortable: true,
      ...secondaryCell((row: PunchRow) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          hiddenFromOpts.has(normalize(row.procoreId));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bx-list-check text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<PunchRow>({
      key: "position",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<PunchRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<PunchRow>({
      key: "assignee",
      header: "Assignee",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<PunchRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.due),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: PunchRow) => {
          const isHiddenLocal = hiddenFromOpts.has(normalize(row.procoreId));
          const options: ItemComboBoxOption[] = [];
          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.procoreId, "show");
                return opts?.onShow?.(row.procoreId);
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
    getRowId: (r: PunchRow) => r.procoreId || r.position,
    renderActions,
  };
}
