import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData';
// import { ProcoreCoordinationIssuesMockData, type ProcoreCoordinationIssue } from '@/api/mockdata/procoreData';
import { formatDate } from "@lib/format";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
// import { ProcoreToolData } from '@/types';

export type CoordinationIssueRow = {
  id: string;
  procoreId?: string;
  title: string;
  status: string;
  statusClass: string;
  modified: string;
  issueNumber: string;
};
interface CoordinationIssueData {
  issue_number?: string;
  status?: string;
  updated_at?: string;
  id?: string;
  title?: string;
  procoreItemID?: string;
}

export function getProcoreCoordinationIssuesTable(opts?: {
  qrId?: string;
  data?: unknown;
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: CoordinationIssueRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<CoordinationIssueRow>[];
  rows: CoordinationIssueRow[];
  getRowId: (r: CoordinationIssueRow) => string;
  renderActions?: (row: CoordinationIssueRow) => ReactNode;
} {
  // Normalize JSON-shaped data to table row shape

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

  const mapToRow = (ci: CoordinationIssueData): CoordinationIssueRow => {
    const idStr = String(ci?.id ?? "");
    const issueNumber = String(ci?.issue_number ?? "");
    const status = String(ci?.status ?? "unknown");
    const statusLower = status.toLowerCase();
    const statusClass =
      statusLower === "open"
        ? "bg-red-100 text-red-700"
        : statusLower.includes("review")
          ? "bg-blue-100 text-blue-700"
          : statusLower === "closed"
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-700";
    const modified = ci?.updated_at ? formatDate(ci.updated_at) : "—";
    return {
      id: idStr || "CI",
      issueNumber: issueNumber || "CI",
      procoreId: String(ci?.procoreItemID ?? ""),
      title: String(ci?.title ?? "Coordination Issue"),
      status: status.charAt(0).toUpperCase() + status.slice(1),
      statusClass,
      modified,
    };
  };

  // Prefer real data passed in via opts.data; fallback to empty
  const rows: CoordinationIssueRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((ci) => mapToRow(ci as unknown as CoordinationIssueData))
    : [];

  // Default sort: by issue number (descending - newest first)
  rows.sort((a, b) => {
    const numA = parseInt(a.issueNumber, 10) || 0;
    const numB = parseInt(b.issueNumber, 10) || 0;
    return numB - numA;
  });

  const columns: Column<CoordinationIssueRow>[] = [
    col<CoordinationIssueRow>({
      key: "title",
      header: "Name",
      sortable: true,
      columnType: "secondary",
      ...secondaryCell((row: CoordinationIssueRow) => {
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
                <i className="bx bx-git-compare text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<CoordinationIssueRow>({
      key: "issueNumber",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<CoordinationIssueRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status,
        className: row.statusClass,
      })),
    }),
    col<CoordinationIssueRow>({
      key: "modified",
      header: "Date Modified",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.modified),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: CoordinationIssueRow) => {
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
                if (opts?.onAction) return opts.onAction(row.id, "hide");
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

  return {
    columns,
    rows,
    getRowId: (r: CoordinationIssueRow) => r.id,
    renderActions,
  };
}

// export function isCoordinationIssueLocationMatch(qrId: string | undefined, row: CoordinationIssueRow): boolean {
// 	const qr = QRCodesMockData.find(q => q.id === qrId);
// 	if ((qr?.type || '').toLowerCase() !== 'procore-location') return false;
// 	const normalize = (value: unknown): string => {
// 		const s = String(value ?? '');
// 		const digits = s.match(/[0-9]+/g)?.join('') ?? '';
// 		if (digits.length > 0) return String(Number(digits));
// 		return s.trim();
// 	};
// 	const targetLocId = normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId);
// 	const rowIdNorm = normalize(row.id);
// 	const ent = ProcoreCoordinationIssuesMockData.find(ci => normalize(ci.id) === rowIdNorm) as (undefined | { location?: { id?: number | string } });
// 	const rowLocId = normalize(ent?.location?.id);
// 	return Boolean(targetLocId && rowLocId && targetLocId === rowLocId);
// }
