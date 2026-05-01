import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreInstructionsMockData, type ProcoreInstructionEntity } from '@/api/mockdata/procoreData'
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";

export type InstructionRow = {
  title: string;
  number: string;
  procoreId: string;
  status: { label: string; cls: string };
  assignee: string;
  due: string;
};

export function getProcoreInstructionsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: InstructionRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<InstructionRow>[];
  rows: InstructionRow[];
  getRowId: (r: InstructionRow) => string;
  renderActions?: (row: InstructionRow) => ReactNode;
} {
  // Normalize JSON-shaped mock data to table row shape
  const mapToRow = (e: Record<string, unknown>): InstructionRow => {
    const title = asString(e.title, "");
    // Use number for display (user-friendly "#" column)
    const number = asString(e.number, "");
    // Use id for unique identification (Procore's internal ID)
    const procoreId = asString(e.id, "");
    const statusLower = asString(e.status).toLowerCase();
    const statusCls = statusLower.includes("draft")
      ? "bg-gray-100 text-gray-700"
      : statusLower.includes("ready")
        ? "bg-blue-100 text-blue-700"
        : statusLower.includes("initiated")
          ? "bg-brand-50 text-brand-700"
          : statusLower.includes("completed")
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-700";
    const createdBy = asRecord(e.created_by);
    const assignee = asString(createdBy?.name, "—");
    const dueIso = asDateLike(e.date_issued ?? e.created_at);
    const due = dueIso ? formatDate(dueIso) : "—";
    return {
      title,
      number,
      procoreId,
      status: { label: asString(e.status, "Unknown"), cls: statusCls },
      assignee,
      due,
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
  const rows: InstructionRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((e) => mapToRow(e))
    : [];

  // Default sort: by # (ascending - numeric)
  rows.sort((a, b) => {
    const numA = parseInt(a.number, 10) || 0;
    const numB = parseInt(b.number, 10) || 0;
    return numA - numB;
  });

  // Legacy/mock fallback (commented):
  // let rows: InstructionRow[] = Array.isArray(opts?.data)
  //   ? (opts!.data as any[]).map((e) => mapToRow(e as any))
  //   : ProcoreInstructionsMockData.map(mapToRow)

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<InstructionRow>[] = [
    col<InstructionRow>({
      key: "title",
      header: "Title",
      sortable: true,
      ...secondaryCell((row: InstructionRow) => {
        const isHidden =
          opts?.actionMode !== "remove" && hiddenFromOpts.has(row.procoreId);
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bx-directions text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<InstructionRow>({
      key: "number",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<InstructionRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<InstructionRow>({
      key: "assignee",
      header: "Assignee",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<InstructionRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.due),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: InstructionRow) => {
          const isHiddenLocal = hiddenFromOpts.has(row.procoreId);
          const options: ItemComboBoxOption[] = [];
          // Legacy actions logic (commented):
          // const qrType = (QRCodesMockData.find(q => q.id === opts?.qrId)?.type || '').toLowerCase()
          // const proItem = ProcoreItemsMockData.find(i => i.qrcode === opts?.qrId && i.procoreToolName === 'Instructions' && normalize(i.procoreItemID) === normalize(row.procoreId)) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.procoreId) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride
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
    getRowId: (r: InstructionRow) => r.procoreId,
    renderActions,
  };
}
