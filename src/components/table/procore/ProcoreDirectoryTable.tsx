import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, primaryCell } from "@lib/columns";
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'
// import { ProcoreDirectoryMockData, type ProcoreDirectoryContact } from '@/api/mockdata/procoreData'
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { asString, asRecord, getFirstRecord } from "@lib/coerce";

export type DirectoryRow = {
  id: string;
  initials: string;
  color: string;
  name: string;
  title: string;
  // company: string
  // trade: string
  phone: string;
  email: string;
  person: {
    initials: string;
    color: string;
    name: string;
    title: string;
    company: string;
    trade: string;
    phone: string;
    email: string;
  };
  trade: {
    name: string;
  };
  company: {
    name: string;
  };
};

export function getProcoreDirectoryTable(opts?: {
  qrId?: string;
  data?: Record<string, unknown>[];
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: DirectoryRow) => void;
  hiddenIds?: Set<string> | Array<string | number>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<DirectoryRow>[];
  rows: DirectoryRow[];
  getRowId: (r: DirectoryRow) => string;
  renderActions?: (row: DirectoryRow) => ReactNode;
} {
  // Normalize JSON-shaped mock data to table row shape
  const mapToRow = (d: Record<string, unknown>): DirectoryRow => {
    const id = String(d.id ?? "");

    //   const initials = d.person?.initials ?? '?'
    //   const color = d.person?.color ?? 'bg-gray-400'
    //   const name = d.person?.name ?? 'Unknown'
    //   const title = d.person?.title ?? '—'
    //   const company = d.company?.name ?? '—'
    //   const trade = d.trade?.name ?? '—'
    //   const phone = d.person?.phone ?? '—'
    //   const email = d.person?.email ?? ''
    //   return { id, initials, color, name, title, company, trade, phone, email }
    // }

    // const normalize = (value: unknown): string => {
    //   const s = String(value ?? '')
    //   const digits = s.match(/[0-9]+/g)?.join('') ?? ''
    //   if (digits.length > 0) return String(Number(digits))
    //   return s.trim()
    // }

    // let rows: DirectoryRow[] = ProcoreDirectoryMockData.map(mapToRow)

    // if (opts?.qrId) {
    //   const qr = QRCodesMockData.find(q => q.id === opts.qrId)
    //   const isDirQr = qr?.type === 'procore-tool' && qr?.procoreCategory === 'Directory'
    //   if (qr?.type === 'procore-location') {
    //     const targetLocId = normalize((qr as { procoreLinkedItemId?: string })?.procoreLinkedItemId)
    //     rows = ProcoreDirectoryMockData
    //       .filter(d => normalize((d as { location?: { id?: number | string } })?.location?.id) === targetLocId)
    //       .map(mapToRow)
    //   } else if (!isDirQr) {
    //     const allowed = new Set(
    //       ProcoreItemsMockData
    //         .filter(i => i.qrcode === opts.qrId && i.procoreToolName === 'Directory')
    //         .map(i => normalize(i.procoreItemID))
    //     )
    //     rows = ProcoreDirectoryMockData
    //       .filter(d => allowed.has(normalize(d.id)))
    //       .map(mapToRow)
    //   }

    //   // Ensure explicitly linked contacts are present as rows even if filtered out
    //   const linked = ProcoreItemsMockData.filter(i => i.qrcode === opts.qrId && i.procoreToolName === 'Directory')
    //   const presentNormIds = new Set(rows.map(c => normalize(c.id)))
    //   for (const li of linked) {
    //     const targetIdNorm = normalize((li as unknown as { procoreItemID?: unknown; originalItem?: { id?: unknown } }).procoreItemID ?? (li as unknown as { originalItem?: { id?: unknown } }).originalItem?.id)
    //     if (!targetIdNorm) continue
    //     if (presentNormIds.has(targetIdNorm)) continue
    //     const dir = ProcoreDirectoryMockData.find(d => normalize(d.id) === targetIdNorm)
    //     if (dir) {
    //       rows.push(mapToRow(dir))
    //       presentNormIds.add(targetIdNorm)
    //     }
    //   }
    // }
    //
    const loginInfo = asRecord(d.login_information);
    const name = asString(d.name ?? loginInfo?.name, "Unknown");
    const initials =
      name.trim().length > 0
        ? name
            .split(" ")
            .map((p: string) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "?";
    const color = "bg-gray-400";
    const title = asString(d.job_title, "—");
    const companyRec = asRecord(d.company);
    const vendorRec = asRecord(d.vendor);
    const company = asString(companyRec?.name ?? vendorRec?.name, "—");
    const firstTrade = getFirstRecord(d, "trades");
    const trade = asString(firstTrade?.name, "—");
    const phone = asString(d.business_phone ?? d.mobile_phone, "—");
    const email = asString(d.email_address, "");
    return {
      id,
      initials,
      color,
      name,
      title,
      phone,
      email,
      person: {
        initials,
        color,
        name,
        title,
        company,
        trade,
        phone,
        email,
      },
      trade: { name: trade },
      company: { name: company },
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

  const rows: DirectoryRow[] = Array.isArray(opts?.data)
    ? opts!.data.map((d) => mapToRow(d))
    : [];

  // Default sort: by name (ascending - alphabetical)
  rows.sort((a, b) => a.name.localeCompare(b.name));

  // Legacy/mock fallback and QR filtering (commented):
  // const normalize = (value: unknown): string => { /* ... */ }
  // let rows: DirectoryRow[] = ProcoreDirectoryMockData.map(mapToRow)
  // if (opts?.qrId) {
  //   const qr = QRCodesMockData.find(q => q.id === opts.qrId)
  //   const isDirQr = qr?.type === 'procore-tool' && qr?.procoreCategory === 'Directory'
  //   if (qr?.type === 'procore-location') {
  //     const targetLocId = normalize((qr as { procoreLinkedItemId?: string })?.procoreLinkedItemId)
  //     rows = ProcoreDirectoryMockData.filter(d => normalize((d as { location?: { id?: number | string } })?.location?.id) === targetLocId).map(mapToRow)
  //   } else if (!isDirQr) {
  //     const allowed = new Set(ProcoreItemsMockData.filter(i => i.qrcode === opts.qrId && i.procoreToolName === 'Directory').map(i => normalize(i.procoreItemID)))
  //     rows = ProcoreDirectoryMockData.filter(d => allowed.has(normalize(d.id))).map(mapToRow)
  //   }
  // }

  const columns: Column<DirectoryRow>[] = [
    col<DirectoryRow>({
      key: "name",
      header: "Name",
      sortable: true,
      ...primaryCell<DirectoryRow>((row) => {
        const isHidden =
          opts?.actionMode !== "remove" && hiddenFromOpts.has(row.id);
        const color = row.color ?? "bg-gray-400";
        const initials = row.initials ?? "?";
        const name = row.name ?? "Unknown";
        const title = row.title ?? "—";
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              {isHidden ? (
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <i className="bx bx-hide text-red-600 text-xl"></i>
                </span>
              ) : (
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${color}`}
                >
                  <span className="font-medium leading-none text-white">
                    {initials}
                  </span>
                </span>
              )}
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">{name}</div>
              <div className="text-sm text-gray-500">{title}</div>
            </div>
          </div>
        );
      }),
    }),
    col<DirectoryRow>({
      key: "company",
      header: "Company",
      sortable: true,
      className: "text-gray-500",
      columnType: "text",
      render: (row) => {
        const name = row.company?.name ?? "—";
        return (
          <span
            className="block truncate"
            title={name !== "—" ? name : undefined}
          >
            {name}
          </span>
        );
      },
      getSortValue: (row) => row.company?.name ?? "",
      // Secondary sort: when sorted by company, also sort alphabetically by name within each company
      sortComparator: (a, b) => {
        // Primary sort: by company name
        const companyA = (a.company?.name ?? "").toLowerCase();
        const companyB = (b.company?.name ?? "").toLowerCase();
        const companyCompare = companyA.localeCompare(companyB);
        if (companyCompare !== 0) return companyCompare;
        // Secondary sort: by person name within same company
        const nameA = (a.name ?? "").toLowerCase();
        const nameB = (b.name ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      },
    }),
    // col<DirectoryRow>({ key: 'trade', header: 'Trade', sortable: true, className: 'text-gray-500', columnType: 'text' }),
    col<DirectoryRow>({
      key: "phone",
      header: "Phone",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
    }),
    col<DirectoryRow>({
      key: "email",
      header: "Email",
      sortable: true,
      className: "text-gray-500",
      columnType: "text",
      render: (row) => (
        <span className="block truncate" title={row.email || undefined}>
          {row.email || ""}
        </span>
      ),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: DirectoryRow) => {
          const options: ItemComboBoxOption[] = [];
          const isHidden = hiddenFromOpts.has(row.id);
          if (isHidden && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.id, "show");
                return opts?.onShow?.(row.id);
              },
            });
          } else if (!isHidden && (opts?.onRemove || opts?.onAction)) {
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

          // // Determine QR type and associated Procore item for this row (match on id)
          // const qr = QRCodesMockData.find(q => q.id === opts?.qrId)
          // const qrType = (qr?.type || '').toLowerCase()
          // const rowIdNorm = normalize(row.id)
          // const proItem = ProcoreItemsMockData.find(i => (
          //   i.qrcode === opts?.qrId && i.procoreToolName === 'Directory' && (normalize((i as any).procoreItemID ?? (i as any).originalItem?.id) === rowIdNorm)
          // )) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.id) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride

          // // For location-based rows (matching procoreData location id), only allow Hide/Show (never Remove)
          // const targetLocId = qrType === 'procore-location' ? normalize((qr as unknown as { procoreLinkedItemId?: string })?.procoreLinkedItemId) : ''
          // const dir = ProcoreDirectoryMockData.find(d => normalize(d.id) === rowIdNorm) as (undefined | { location?: { id?: number | string } })
          // const rowLocId = normalize(dir?.location?.id) ?? ''
          // const isLocationMatch = qrType === 'procore-location' && Boolean(targetLocId) && Boolean(rowLocId) && targetLocId === rowLocId
          // if (isLocationMatch && rowLocId !== '') {
          //   // Use procore hidden semantics if linked; otherwise fall back to local hiddenIds
          //   const isHiddenLocal = opts?.hiddenIds?.has(row.id) ?? false
          //   const effectiveHidden = proItem ? proHidden : isHiddenLocal
          //   if (effectiveHidden) {
          //     if (opts?.onShow || opts?.onAction) options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'show')
          //       return opts?.onShow?.(rowIdNorm)
          //     } })
          //   } else {
          //     if (opts?.onRemove || opts?.onAction) options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'hide')
          //       return opts?.onRemove?.(rowIdNorm)
          //     } })
          //   }
          // } else if (proItem && proHidden) {
          //   // If the linked item is hidden, default to Show (procore-tool behavior)
          //   options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //     if (opts?.onAction) return opts.onAction(rowIdNorm, 'show')
          //     if (opts?.onShow) return opts.onShow(rowIdNorm)
          //   } })
          // } else if (proItem && !proHidden) {
          //   // Prefer Remove semantics when this row is explicitly linked to this QR via ProcoreItemsMockData
          //   options.push({ label: 'Remove', value: 'remove', iconClass: 'bx bx-x', onSelect: () => {
          //     if (opts?.onAction) return opts.onAction(rowIdNorm, 'remove')
          //     if (opts?.onRemove) return opts.onRemove(rowIdNorm)
          //   } })
          // } else if (qrType === 'procore-tool' && proItem) {
          //   // For procore-tool QRs without explicit link present (or if link is hidden), fallback to Hide/Show
          //   if (proHidden) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'show')
          //       if (opts?.onShow) return opts.onShow(rowIdNorm)
          //     } })
          //   } else {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'hide')
          //       if (opts?.onRemove) return opts.onRemove(rowIdNorm)
          //     } })
          //   }
          // } else {
          //   // Fallback to hiddenIds-driven behavior
          //   const isHidden = opts?.hiddenIds?.has(rowIdNorm) ?? false
          //   if (isHidden && opts?.onShow) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'show')
          //       return opts.onShow!(rowIdNorm)
          //     } })
          //   } else if (!isHidden && opts?.onRemove) {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(rowIdNorm, 'hide')
          //       return opts.onRemove!(rowIdNorm)
          //     } })
          //   }
          // }
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
    getRowId: (r: DirectoryRow) => r.id,
    renderActions,
  };
}
