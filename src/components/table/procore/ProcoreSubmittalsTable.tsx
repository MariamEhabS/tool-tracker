import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike, getFirstRecord } from "@lib/coerce";

export type SubmittalRow = {
  title: string;
  sub: string;
  number: string;
  procoreId?: string;
  status: { label: string; cls: string };
  ball: string;
  type: string;
  received: string;
  due: { label: string; cls?: string };
  /** Whether this row has a valid Procore ID and is eligible for delete operations */
  canDelete: boolean;
};

export function getProcoreSubmittalsTable(opts?: {
  qrId?: string;
  data?: unknown[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: SubmittalRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<SubmittalRow>[];
  rows: SubmittalRow[];
  getRowId: (r: SubmittalRow) => string;
  renderActions?: (row: SubmittalRow) => ReactNode;
} {
  // Normalize to row
  const mapToRow = (s: Record<string, unknown>): SubmittalRow => {
    const title = asString(s.title ?? s.description, "Submittal");
    const specSection = asRecord(s.specification_section);
    const sub = specSection
      ? `${asString(specSection.number, "")} ${asString(specSection.description, "")}`.trim()
      : "";
    const number = asString(s.formatted_number ?? s.number ?? s.id, "");
    const procoreId = asString(s.id ?? s.number, "");
    const statusRec = asRecord(s.status);
    const statusName = asString(statusRec?.name, "Unknown");
    const statusOpen = asString(statusRec?.status, "").toLowerCase() === "open";
    const statusCls = statusOpen
      ? "bg-brand-50 text-brand-700"
      : statusName.toLowerCase().includes("approved")
        ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-700";
    const firstBall = getFirstRecord(s, "ball_in_court");
    const ball = asString(firstBall?.name, "—");
    const typeRec = asRecord(s.type);
    const type = asString(typeRec?.name, "—");
    const receivedIso = asDateLike(s.received_date);
    const received = receivedIso ? formatDate(receivedIso) : "—";
    const dueIso = asDateLike(s.due_date);
    const dueLabel = dueIso ? formatDate(dueIso) : "—";
    const updatedAtStr = asString(s.updated_at, "");
    const dueStr = asString(s.due_date, "");
    const dueCls =
      dueStr && updatedAtStr && Date.parse(updatedAtStr) > Date.parse(dueStr)
        ? "text-red-600"
        : "text-gray-500";
    return {
      title,
      sub,
      number,
      procoreId,
      status: { label: statusName, cls: statusCls },
      ball,
      type,
      received,
      due: { label: dueLabel, cls: dueCls },
      canDelete: procoreId.trim().length > 0,
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

  // const normalize = (value: unknown): string => {
  // 	const s = String(value ?? '');
  // 	const digits = s.match(/[0-9]+/g)?.join('') ?? '';
  // 	if (digits.length > 0) return String(Number(digits));
  // 	return s.trim();
  // };

  // Prefer real data via opts.data; fallback to empty
  const rows: SubmittalRow[] = Array.isArray(opts?.data)
    ? (opts!.data as Record<string, unknown>[]).map((s) => mapToRow(s))
    : [];

  // Default sort: by # (ascending - alphanumeric natural sort)
  rows.sort((a, b) => {
    return new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    }).compare(a.number, b.number);
  });

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<SubmittalRow>[] = [
    col<SubmittalRow>({
      key: "title",
      header: "Title / Spec Section",
      sortable: true,
      ...secondaryCell((row: SubmittalRow) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          hiddenFromOpts.has(String(row.procoreId ?? row.number));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bx-file text-gray-600 text-xl"></i>
              )}
            </div>
            <div>
              <div className="text-gray-900 font-medium">{row.title}</div>
              <div className="text-gray-500 text-xs mt-0.5">{row.sub}</div>
            </div>
          </div>
        );
      }),
    }),
    col<SubmittalRow>({
      key: "number",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<SubmittalRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<SubmittalRow>({
      key: "type",
      header: "Type",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<SubmittalRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      columnType: "date",
      render: (row: SubmittalRow) => {
        const cls = row.due?.cls ?? "text-gray-500";
        const label = row.due?.label ?? "Unknown";
        return <span className={cls}>{label}</span>;
      },
    }),
  ];

  function getRowId(r: SubmittalRow): string {
    // Prefer raw Procore ID for API operations (hide/show/remove)
    const pid = (r.procoreId ?? "").trim();
    if (pid.length > 0) return pid;
    // Fallback: use submittal number for table row uniqueness (not valid for delete operations)
    const num = (r.number ?? "").trim();
    if (num.length > 0) return num;
    // Last resort: deterministic key from row content (not a valid Procore ID)
    const seed = `${r.title ?? ""}|${r.sub ?? ""}|${r.received ?? ""}|${r.due?.label ?? ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `__fallback_${Math.abs(hash).toString(36)}`;
  }

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: SubmittalRow) => {
          const isHiddenLocal = hiddenFromOpts.has(
            String(row.procoreId ?? row.number),
          );
          const options: ItemComboBoxOption[] = [];
          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                const actionId = row.procoreId || getRowId(row);
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
                const actionId = row.procoreId || getRowId(row);
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

// // Helper used by bulk actions to determine if a submittal row is location-based (Hide/Show only)
// export function isSubmittalLocationMatch(_qrId: string | undefined, _row: SubmittalRow): boolean { return false; }
