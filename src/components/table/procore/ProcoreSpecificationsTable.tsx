import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asDateLike } from "@lib/coerce";

export type SpecificationRow = {
  procoreId: string;
  number: string;
  title: string;
  set: string;
  revision: string;
  issued: string;
  /** Whether this row has a valid Procore ID and is eligible for delete operations */
  canDelete: boolean;
};

export function getProcoreSpecificationsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: SpecificationRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<SpecificationRow>[];
  rows: SpecificationRow[];
  getRowId: (r: SpecificationRow) => string;
  renderActions?: (row: SpecificationRow) => ReactNode;
} {
  // Normalize to rows
  const mapToRow = (s: Record<string, unknown>): SpecificationRow => {
    const issuedIso = asDateLike(s.issued_date);
    const procoreId = asString(s.id, "");
    return {
      procoreId,
      number: asString(s.number ?? s.id, "—"),
      title: asString(s.description, "—"),
      set:
        (s.specification_set as { name?: string } | undefined)?.name ||
        (s.specification_set_id ? `Set ${s.specification_set_id}` : "—"),
      revision: asString(s.revision, "—"),
      issued: issuedIso ? formatDate(issuedIso) : "—",
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
  const rows: SpecificationRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((s) => mapToRow(s))
    : [];

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<SpecificationRow>[] = [
    col<SpecificationRow>({
      key: "number",
      header: "Number",
      sortable: true,
      ...secondaryCell((row: SpecificationRow) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          (hiddenFromOpts.has(row.procoreId) ||
            hiddenFromOpts.has(getRowId(row)));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bxs-file-doc text-blue-600 text-xl"></i>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-medium text-gray-900">{`${row.number} - ${row.title}`}</span>
              <p className="text-xs text-gray-500 truncate">
                Revision {row.revision}
              </p>
            </div>
          </div>
        );
      }),
    }),
    col<SpecificationRow>({
      key: "set",
      header: "Set",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<SpecificationRow>({
      key: "issued",
      header: "Issued Date",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.issued),
    }),
  ];

  function getRowId(r: SpecificationRow): string {
    // Prefer raw Procore ID for API operations (hide/show/remove)
    const pid = (r.procoreId ?? "").trim();
    if (pid.length > 0) return pid;
    // Fallback: use spec number for table row uniqueness (not valid for delete operations)
    const num = (r.number ?? "").trim();
    if (num.length > 0) return num;
    // Last resort: deterministic key from row content (not a valid Procore ID)
    const seed = `${r.title ?? ""}|${r.set ?? ""}|${r.revision ?? ""}|${r.issued ?? ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `__fallback_${Math.abs(hash).toString(36)}`;
  }

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: SpecificationRow) => {
          const rowId = getRowId(row);
          const isHiddenLocal =
            hiddenFromOpts.has(row.procoreId) || hiddenFromOpts.has(rowId);
          const options: ItemComboBoxOption[] = [];
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
