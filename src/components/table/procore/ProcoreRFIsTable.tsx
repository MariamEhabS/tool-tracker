import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreRFIsMockData, type ProcoreRFIEntity } from '@/api/mockdata/procoreData'
import { formatDate } from "@lib/format";
import { icons } from "@/lib/icons";
import { asString, asRecord, asDateLike } from "@lib/coerce";

export type RFIRow = {
  subject: string;
  rfi: string;
  procoreId?: string;
  status: { label: string; cls: string };
  assignee: string;
  received: string;
  due: string;
  dueCls?: string;
  /** Whether this row has a valid Procore ID and is eligible for delete operations */
  canDelete: boolean;
};

export function getProcoreRFIsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: RFIRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<RFIRow>[];
  rows: RFIRow[];
  getRowId: (r: RFIRow) => string;
  renderActions?: (row: RFIRow) => ReactNode;
} {
  // Normalize JSON-shaped mock data to table row shape
  const mapToRow = (e: Record<string, unknown>): RFIRow => {
    const subject = asString(e.subject ?? e.title, "RFI");
    const rfi = asString(
      e.full_number ??
        e.formatted_number ??
        (e.prefix && e.number ? `${e.prefix}-${e.number}` : e.number),
      "RFI",
    );
    const procoreId = asString(e.id ?? e.number, "");
    const statusRec = asRecord(e?.status);
    const statusRaw = asString(statusRec?.name ?? e?.status, "");
    const statusLower = statusRaw.toLowerCase();
    const statusCls = statusLower.includes("open")
      ? "bg-brand-50 text-brand-700"
      : statusLower.includes("closed")
        ? "bg-green-100 text-green-700"
        : statusLower.includes("pending") || statusLower.includes("review")
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-700";
    const ball = Array.isArray(e?.ball_in_court)
      ? (e.ball_in_court as Array<Record<string, unknown>>)
          .map((b) => asString(b?.name, ""))
          .filter(Boolean)
          .join(", ")
      : asString(asRecord(e?.ball_in_court)?.name, "");
    const assigneeRec = asRecord(e.assignee);
    const createdByRec = asRecord(e.created_by);
    const assignee =
      ball || asString(assigneeRec?.name ?? createdByRec?.name, "—");
    const receivedIso = asDateLike(
      e.received_date ?? e.created_at ?? e.submitted_at ?? e.updated_at,
    );
    const dueIso = asDateLike(
      e.due_date ??
        e.respond_by ??
        e.required_response_date ??
        e.response_due_date,
    );
    const received = receivedIso ? formatDate(receivedIso) : "—";
    const due = dueIso ? formatDate(dueIso) : "—";
    const dueCls =
      dueIso && Date.parse(String(dueIso)) < Date.now()
        ? "text-red-600"
        : undefined;
    return {
      subject,
      rfi,
      procoreId,
      status: { label: statusRaw || "Unknown", cls: statusCls },
      assignee,
      received,
      due,
      dueCls,
      canDelete: procoreId.trim().length > 0,
    };
  };

  const normalize = (value: unknown): string => {
    const s = String(value ?? "");
    const digits = s.match(/[0-9]+/g)?.join("") ?? "";
    if (digits.length > 0) return String(Number(digits));
    return s.trim();
  };

  // Compute hidden set once at factory scope (shared between columns and renderActions)
  const hiddenFromOpts: Set<string> = (() => {
    if (!opts?.hiddenIds) return new Set<string>();
    if (opts.hiddenIds instanceof Set)
      return new Set<string>(Array.from(opts.hiddenIds));
    return new Set<string>(
      (opts.hiddenIds as Array<string | number>).map((v) => String(v)),
    );
  })();

  // Prefer real data via opts.data; fallback to empty
  const rows: RFIRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((e) => mapToRow(e))
    : [];

  // Default sort: by RFI # (descending - newest first)
  rows.sort((a, b) => {
    const numA = parseInt(normalize(a.rfi), 10) || 0;
    const numB = parseInt(normalize(b.rfi), 10) || 0;
    return numB - numA;
  });

  // Legacy/mock fallback (commented):
  // let rows: RFIRow[] = Array.isArray(opts?.data)
  //   ? (opts!.data as any[]).map((e) => mapToRow(e as any))
  //   : ProcoreRFIsMockData.map(mapToRow)

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  function getRowId(r: RFIRow): string {
    // Prefer raw Procore ID for API operations (hide/show/remove)
    const pid = (r.procoreId ?? "").trim();
    if (pid.length > 0) return pid;
    // Fallback: use RFI number for table row uniqueness (not valid for delete operations)
    const id = (r.rfi ?? "").trim();
    if (id.length > 0) return id;
    // Last resort: deterministic key from row content (not a valid Procore ID)
    const seed = `${r.subject ?? ""}|${r.received ?? ""}|${r.due ?? ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return `__fallback_${Math.abs(hash).toString(36)}`;
  }

  const columns: Column<RFIRow>[] = [
    col<RFIRow>({
      key: "subject",
      header: "Subject",
      sortable: true,
      ...secondaryCell<RFIRow>((row) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          hiddenFromOpts.has(normalize(row.procoreId ?? row.rfi));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className={`${icons.help} text-gray-600 text-xl`}></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.subject}</span>
          </div>
        );
      }),
    }),
    col<RFIRow>({
      key: "rfi",
      header: "RFI #",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<RFIRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell<RFIRow>((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<RFIRow>({
      key: "assignee",
      header: "Ball in Court",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<RFIRow>({
      key: "received",
      header: "Received",
      sortable: true,
      columnType: "date",
      ...dateCell<RFIRow>((row) => row.received),
    }),
    col<RFIRow>({
      key: "due",
      header: "Due Date",
      sortable: true,
      columnType: "date",
      ...dateCell<RFIRow>((row) => row.due),
      className: "text-gray-500",
      render: (row: RFIRow) => (
        <span className={row.dueCls ? row.dueCls : "text-gray-500"}>
          {row.due}
        </span>
      ),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: RFIRow) => {
          const isHiddenLocal = hiddenFromOpts.has(
            normalize(row.procoreId ?? row.rfi),
          );
          const options: ItemComboBoxOption[] = [];

          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction)
                  return opts.onAction(row.procoreId || getRowId(row), "show");
                return opts?.onShow?.(row.procoreId || getRowId(row));
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
                    row.procoreId || getRowId(row),
                    useRemove ? "remove" : "hide",
                  );
                return opts?.onRemove?.(row.procoreId || getRowId(row));
              },
            });
          }
          // Legacy actions logic (commented):
          // const qr = QRCodesMockData.find(q => q.id === opts?.qrId)
          // const qrType = (qr?.type || '').toLowerCase()
          // const proIdNorm = normalize(row.procoreId ?? row.rfi)
          // const proItem = ProcoreItemsMockData.find(i => (
          //   i.qrcode === opts?.qrId && i.procoreToolName === 'RFIs' && (normalize((i as any).procoreItemID ?? (i as any).originalItem?.id) === proIdNorm)
          // )) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(rowId) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride
          // const targetLocId = qrType === 'procore-location' ? normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId) : ''
          // const ent = ProcoreRFIsMockData.find(e => normalize(e.id ?? e.number ?? '') === proIdNorm) as (undefined | { location?: { id?: number | string } } & { location_id?: number | string })
          // const rowLocId = normalize((ent as any)?.location?.id ?? ent?.location_id)
          // const isLocationMatch = qrType === 'procore-location' && Boolean(targetLocId) && Boolean(rowLocId) && targetLocId === rowLocId
          // if (isLocationMatch) { /* ... */ }
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

// Helper used by bulk actions to determine if an RFI row is location-based (Hide/Show only)
export function isRFILocationMatch(
  _qrId: string | undefined,
  _row: RFIRow,
): boolean {
  return false;
}
// Legacy implementation (commented):
// export function isRFILocationMatch(qrId: string | undefined, row: RFIRow): boolean {
//   const qr = QRCodesMockData.find(q => q.id === qrId)
//   if ((qr?.type || '').toLowerCase() !== 'procore-location') return false
//   const normalize = (value: unknown): string => {
//     const s = String(value ?? '')
//     const digits = s.match(/[0-9]+/g)?.join('') ?? ''
//     if (digits.length > 0) return String(Number(digits))
//     return s.trim()
//   }
//   const targetLocId = normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId)
//   const proIdNorm = normalize(row.procoreId ?? row.rfi)
//   const ent = ProcoreRFIsMockData.find(e => normalize(e.id ?? e.number ?? '') === proIdNorm) as (undefined | { location?: { id?: number | string } } & { location_id?: number | string })
//   const rowLocId = normalize((ent as any)?.location?.id ?? ent?.location_id)
//   return Boolean(targetLocId && rowLocId && targetLocId === rowLocId)
// }
