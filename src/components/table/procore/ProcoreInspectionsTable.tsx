import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreInspectionsMockData, type ProcoreInspectionEntity } from '@/api/mockdata/procoreData'
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";

export type InspectionRow = {
  title: string;
  id: string;
  procoreId: string; // Raw Procore numeric ID for hiddenIds comparison
  status: { label: string; cls: string };
  type: { label: string; cls: string };
  location: string;
  inspector: string;
  date: string;
};

export function getProcoreInspectionsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: InspectionRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<InspectionRow>[];
  rows: InspectionRow[];
  getRowId: (r: InspectionRow) => string;
  renderActions?: (row: InspectionRow) => ReactNode;
} {
  // Normalize JSON-shaped mock data to table row shape
  const mapToRow = (e: Record<string, unknown>): InspectionRow => {
    const title = asString(e.name, "");
    // Procore Inspections use 'identifier' for display, fallback to 'number', then 'id'
    const id = asString(e.identifier ?? e.number ?? e.id, "");
    // Store raw Procore ID separately for hiddenIds comparison
    const procoreId = asString(e.id, "");
    const statusLower = asString(e.status).toLowerCase();
    const statusCls =
      statusLower === "closed"
        ? "bg-green-100 text-green-700"
        : statusLower === "open"
          ? "bg-brand-50 text-brand-700"
          : statusLower.includes("progress")
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-700";
    const inspectionType = asRecord(e.inspection_type);
    const typeLabel = asString(
      inspectionType?.name ?? e.list_template_name,
      "Unknown",
    );
    const typeCls = typeLabel.toLowerCase().includes("safety")
      ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 rounded-md"
      : typeLabel.toLowerCase().includes("quality")
        ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10 rounded-md"
        : typeLabel.toLowerCase().includes("environment")
          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 rounded-md"
          : "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-500/10 rounded-md";
    const locationRec = asRecord(e.location);
    const location = asString(locationRec?.name ?? locationRec?.node_name, "—");
    const createdBy = asRecord(e.created_by);
    const inspector = asString(createdBy?.name, "—");
    const dateIso = asDateLike(e.closed_at ?? e.updated_at ?? e.created_at);
    const date = dateIso ? formatDate(dateIso) : "—";
    return {
      title,
      id,
      procoreId,
      status: { label: asString(e.status, "Unknown"), cls: statusCls },
      type: { label: typeLabel, cls: typeCls },
      location,
      inspector,
      date,
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
  const rows: InspectionRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((e) => mapToRow(e))
    : [];

  // Default sort: by # identifier (alphabetical - alphanumeric natural sort)
  rows.sort((a, b) => {
    return new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    }).compare(a.id, b.id);
  });

  // Legacy/mock fallback (commented):
  // let rows: InspectionRow[] = Array.isArray(opts?.data)
  //   ? (opts!.data as any[]).map((e) => mapToRow(e as any))
  //   : ProcoreInspectionsMockData.map(mapToRow)

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  const columns: Column<InspectionRow>[] = [
    col<InspectionRow>({
      key: "title",
      header: "Title / Inspection Name",
      sortable: true,
      ...secondaryCell((row: InspectionRow) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          (hiddenFromOpts.has(row.procoreId) || hiddenFromOpts.has(row.id));
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className="bx bx-check-shield text-gray-600 text-xl"></i>
              )}
            </div>
            <span className="font-medium text-gray-900">{row.title}</span>
          </div>
        );
      }),
    }),
    col<InspectionRow>({
      key: "id",
      header: "#",
      sortable: true,
      className: "text-gray-500",
      columnType: "id",
    }),
    col<InspectionRow>({
      key: "status",
      header: "Status",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.status?.label ?? "Unknown",
        className: row.status?.cls ?? "bg-gray-100 text-gray-700",
      })),
    }),
    col<InspectionRow>({
      key: "type",
      header: "Type",
      sortable: true,
      columnType: "status",
      ...statusBadgeCell((row) => ({
        label: row.type?.label ?? "Unknown",
        className: row.type?.cls ?? "bg-gray-50 text-gray-700",
      })),
    }),
    col<InspectionRow>({
      key: "date",
      header: "Inspection Date",
      sortable: true,
      columnType: "date",
      ...dateCell((row) => row.date),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: InspectionRow) => {
          const isHiddenLocal =
            hiddenFromOpts.has(row.procoreId) || hiddenFromOpts.has(row.id);
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
          // Legacy actions logic (commented):
          // const qr = QRCodesMockData.find(q => q.id === opts?.qrId)
          // const qrType = (qr?.type || '').toLowerCase()
          // const normalize = (value: unknown): string => { /* ... */ }
          // const rowIdNorm = normalize(row.id)
          // const proItem = ProcoreItemsMockData.find(i => (
          //   i.qrcode === opts?.qrId && i.procoreToolName === 'Inspections' && (normalize((i as any).procoreItemID ?? (i as any).originalItem?.id) === rowIdNorm)
          // )) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.id) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride
          // const targetLocId = qrType === 'procore-location' ? normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId) : ''
          // const insp = ProcoreInspectionsMockData.find(ci => normalize(ci.id) === rowIdNorm) as (undefined | { location?: { id?: number | string } })
          // const rowLocId = normalize(insp?.location?.id)
          // const isLocationMatch = qrType === 'procore-location' && Boolean(targetLocId) && Boolean(rowLocId) && targetLocId === rowLocId
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
    getRowId: (r: InspectionRow) => r.procoreId,
    renderActions,
  };
}

// Helper used by bulk actions to determine if an inspection row is location-based (Hide/Show only)
export function isInspectionLocationMatch(
  _qrId: string | undefined,
  _row: InspectionRow,
): boolean {
  return false;
}
// Legacy implementation (commented):
// export function isInspectionLocationMatch(qrId: string | undefined, row: InspectionRow): boolean {
//   const qr = QRCodesMockData.find(q => q.id === qrId)
//   if ((qr?.type || '').toLowerCase() !== 'procore-location') return false
//   const normalize = (value: unknown): string => { /* ... */ }
//   const targetLocId = normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId)
//   const rowIdNorm = normalize(row.id)
//   const ent = ProcoreInspectionsMockData.find(ci => normalize(ci.id) === rowIdNorm) as (undefined | { location?: { id?: number | string } })
//   const rowLocId = normalize(ent?.location?.id)
//   return Boolean(targetLocId && rowLocId && targetLocId === rowLocId)
// }
