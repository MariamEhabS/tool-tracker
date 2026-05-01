import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreFormsMockData, type ProcoreFormEntity } from '@/api/mockdata/procoreData'

export type FormRow = {
  id: string;
  title: string;
  template: string;
  status: { label: string; cls: string };
  assignedTo: string;
  modified: string;
};

// export function getProcoreFormsTable(opts?: { qrId?: string; onAction?: (id: string, action: 'hide' | 'remove' | 'show') => void; onRemove?: (id: string) => void; onShow?: (id: string) => void; onPreview?: (row: FormRow) => void; hiddenIds?: Set<string>; shownIds?: Set<string> }): {
export function getProcoreFormsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: FormRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<FormRow>[];
  rows: FormRow[];
  getRowId: (r: FormRow) => string;
  renderActions?: (row: FormRow) => ReactNode;
} {
  // Normalize to rows
  // const mapToRow = (f: ProcoreFormEntity): FormRow => ({
  const mapToRow = (f: Record<string, unknown>): FormRow => {
    const createdBy = asRecord(f.created_by);
    const modifiedIso = asDateLike(f.updated_at);
    return {
      id: asString(f.id, ""),
      title: asString(f.name, ""),
      template: asString(f.form_template_name, "—"),
      status: {
        label: f.viewable ? "Viewable" : "Not Viewable",
        cls: f.viewable
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-700",
      },
      assignedTo: asString(createdBy?.name, "—"),
      modified: modifiedIso ? formatDate(modifiedIso) : "—",
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

  const rows: FormRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((f) => mapToRow(f))
    : [];

  // Default sort: by title (ascending - alphabetical)
  rows.sort((a, b) => a.title.localeCompare(b.title));

  // Legacy/mock fallback and QR filtering (commented):
  // let rows: FormRow[] = ProcoreFormsMockData.map(mapToRow)
  // if (opts?.qrId) {
  //   const qr = QRCodesMockData.find(q => q.id === opts.qrId)
  //   const isFormsProcoreTool = qr?.type === 'procore-tool' && qr?.procoreCategory === 'Forms'
  //   if (!isFormsProcoreTool && (qr?.type === 'folder' || qr?.type === 'procore-location')) {
  //     const allowed = new Set(
  //       ProcoreItemsMockData
  //         .filter(i => i.qrcode === opts.qrId && i.procoreToolName === 'Forms')
  //         .map(i => normalize(i.procoreItemID))
  //     )
  //     rows = ProcoreFormsMockData.filter(f => allowed.has(normalize(f.id))).map(mapToRow)
  //   }
  // }

  const columns: Column<FormRow>[] = [
    col<FormRow>({
      key: "title",
      header: "Name / Title",
      sortable: true,
      ...secondaryCell<FormRow>((row) => {
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
                <i className="bx bx-spreadsheet text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<FormRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell<FormRow>((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<FormRow>({
      key: "assignedTo",
      header: "Assigned To",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<FormRow>({
      key: "modified",
      header: "Date Modified",
      sortable: true,
      columnType: "date",
      ...dateCell<FormRow>((row) => row.modified),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: FormRow) => {
          const isHiddenLocal = hiddenFromOpts.has(row.id);
          const options: ItemComboBoxOption[] = [];
          // Legacy actions logic (commented):
          // const qrType = (QRCodesMockData.find(q => q.id === opts?.qrId)?.type || '').toLowerCase()
          // const proItem = ProcoreItemsMockData.find(i => i.qrcode === opts?.qrId && i.procoreToolName === 'Forms' && normalize(i.procoreItemID) === normalize(row.id)) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.id) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride
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

  return { columns, rows, getRowId: (r: FormRow) => r.id, renderActions };
}
