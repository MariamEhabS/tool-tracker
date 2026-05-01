import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate } from "@lib/format";
import { asString, asRecord, asDateLike } from "@lib/coerce";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreDrawingsMockData } from '@/api/mockdata/procoreData'
import { icons } from "@/lib/icons";

export type DrawingRow = {
  number: string;
  title: string;
  revision: string;
  area: string;
  discipline: string;
  date: string;
  procoreItemID: string; // Actual Procore drawing ID used for hide/show logic
  /** PDF URL for the drawing from Procore's current_revision.pdf_url */
  pdfUrl?: string;
};

type DrawingRowWithKey = DrawingRow & { __rowId: string };

/**
 * Natural alphanumeric comparison for sorting drawing numbers and text.
 * Handles mixed alphanumeric strings like "A-101", "A-102", "B-001" correctly.
 */
const naturalCompare = (a: string, b: string): number => {
  return new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  }).compare(a, b);
};

export function getProcoreDrawingsTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: DrawingRowWithKey) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<DrawingRowWithKey>[];
  rows: DrawingRowWithKey[];
  getRowId: (r: DrawingRowWithKey) => string;
  renderActions?: (row: DrawingRowWithKey) => ReactNode;
} {
  // Use a stable key for drawings that preserves alphanumeric drawing numbers
  // const idKey = (v: unknown): string => String(v ?? '').trim();

  // const mapToRow = (d: (typeof ProcoreDrawingsMockData)[number]): DrawingRowWithKey => {
  const mapToRow = (d: Record<string, unknown>): DrawingRowWithKey => {
    const number = asString(d.number, `D-${asString(d.id, "").trim()}`);
    const title = asString(d.title, "Drawing");
    const currentRevision = asRecord(d.current_revision);
    const revision = asString(currentRevision?.revision_number, "0");
    const area = asString(d.drawing_area_name, "—");
    const discipline = asString(d.discipline, "—");
    const dateIso = asDateLike(currentRevision?.updated_at);
    const date = dateIso ? formatDate(dateIso) : "—";
    const procoreItemID = asString(d.id, ""); // Actual Procore drawing ID
    const pdfUrl = asString(currentRevision?.pdf_url, ""); // PDF URL for opening the drawing
    const __rowId = `${number}|${revision}`; // Display key (number + revision)
    return {
      number,
      title,
      revision,
      area,
      discipline,
      date,
      procoreItemID,
      pdfUrl,
      __rowId,
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

  // console.log()
  // Prefer real data via opts.data; fallback to mock mapping
  const rows: DrawingRowWithKey[] = Array.isArray(opts?.data)
    ? opts!.data.map((d) => mapToRow(d))
    : [];

  // Default sort: by drawing number (ascending - alphanumeric natural sort)
  rows.sort((a, b) => naturalCompare(a.number, b.number));

  // Legacy mock-based QR filtering retained as comments
  // if (opts?.qrId) { ... }

  // const isProcoreDrawingCodeQR = ((QRCodesMockData.find(q => q.id === opts?.qrId)?.type || '').toLowerCase() === 'procore-drawing-code')
  const isProcoreDrawingCodeQR = false;

  const columns: Column<DrawingRowWithKey>[] = [
    col<DrawingRowWithKey>({
      key: "title",
      header: "Drawing",
      sortable: true,
      // Sort by sheet number (e.g., "A-101") instead of sheet name/title
      getSortValue: (row) => row.number,
      ...secondaryCell<DrawingRowWithKey>((row) => {
        const isHidden =
          opts?.actionMode !== "remove" &&
          hiddenFromOpts.has(row.procoreItemID);
        const containerBg = isHidden ? "bg-red-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                <i className={`${icons.pdf} text-red-600 text-xl`}></i>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900">
                {row.number} — {row.title}
              </p>
              <p className="text-xs text-gray-500 truncate">
                Revision {row.revision}
              </p>
            </div>
          </div>
        );
      }),
    }),
    col<DrawingRowWithKey>({
      key: "area",
      header: "Area",
      sortable: true,
      className: "text-gray-500",
      columnType: "group",
      // Multi-level sort: area → discipline → drawing number
      sortComparator: (a, b) => {
        const areaCompare = naturalCompare(a.area, b.area);
        if (areaCompare !== 0) return areaCompare;
        const disciplineCompare = naturalCompare(a.discipline, b.discipline);
        if (disciplineCompare !== 0) return disciplineCompare;
        return naturalCompare(a.number, b.number);
      },
    }),
    col<DrawingRowWithKey>({
      key: "discipline",
      header: "Discipline",
      sortable: true,
      className: "text-gray-500",
      columnType: "group",
      // Multi-level sort: discipline → area → drawing number
      sortComparator: (a, b) => {
        const disciplineCompare = naturalCompare(a.discipline, b.discipline);
        if (disciplineCompare !== 0) return disciplineCompare;
        const areaCompare = naturalCompare(a.area, b.area);
        if (areaCompare !== 0) return areaCompare;
        return naturalCompare(a.number, b.number);
      },
    }),
    col<DrawingRowWithKey>({
      key: "date",
      header: "Drawing Date",
      sortable: true,
      columnType: "date",
      ...dateCell<DrawingRowWithKey>((r) => r.date),
    }),
  ];

  const renderActions =
    !isProcoreDrawingCodeQR &&
    (opts?.onRemove || opts?.onShow || opts?.onAction)
      ? (row: DrawingRowWithKey) => {
          const isHiddenLocal = hiddenFromOpts.has(row.procoreItemID);
          const options: ItemComboBoxOption[] = [];

          // const qrType = (QRCodesMockData.find(q => q.id === opts?.qrId)?.type || '').toLowerCase()
          // const proItem = ProcoreItemsMockData.find(i => (
          //   i.qrcode === opts?.qrId && i.procoreToolName === 'Drawings' && idKey((i as any).procoreItemID ?? (i as any).originalItem?.number) === idKey(row.number)
          // )) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.__rowId) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride

          // if ((qrType === 'folder' || qrType === 'procore-location') && proItem) {
          //   if (proHidden) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'show')
          //       if (opts?.onShow) return opts.onShow(row.__rowId)
          //     } })
          //   } else {
          //     options.push({ label: 'Remove', value: 'remove', iconClass: 'bx bx-x', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'remove')
          //       if (opts?.onRemove) return opts.onRemove(row.__rowId)
          //     } })
          //   }
          // } else if (qrType === 'procore-tool' && proItem) {
          //   if (proHidden) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'show')
          //       if (opts?.onShow) return opts.onShow(row.__rowId)
          //     } })
          //   } else {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'hide')
          //       if (opts?.onRemove) return opts.onRemove(row.__rowId)
          //     } })
          //   }
          // } else {
          //   if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'show')
          //       return opts?.onShow?.(row.__rowId)
          //     } })
          //   } else if (!isHiddenLocal && (opts?.onRemove || opts?.onAction)) {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.__rowId, 'hide')
          //       return opts?.onRemove?.(row.__rowId)
          //     } })
          //   }
          // }

          if (isHiddenLocal && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction)
                  return opts.onAction(row.procoreItemID, "show");
                return opts?.onShow?.(row.procoreItemID);
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
                    row.procoreItemID,
                    useRemove ? "remove" : "hide",
                  );
                return opts?.onRemove?.(row.procoreItemID);
              },
            });
          }
          if (options.length === 0) return null;
          return (
            <div
              className="relative inline-block text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* <ItemComboBox options={options} sourceId={`drawings-actions-${row.__rowId}`} /> */}
              <ItemComboBox options={options} />
            </div>
          );
        }
      : undefined;

  return {
    columns,
    rows,
    getRowId: (r: DrawingRowWithKey) => r.procoreItemID || r.__rowId,
    renderActions,
  };
}
