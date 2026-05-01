import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import procoreIcon from "@assets/images/procore-icon.png";
import type { BadgeVariant } from "@/types/Badge.types";
import { col, statusBadgeCell, dateCell, secondaryCell } from "@lib/columns";
import { formatDate } from "@lib/format";
import type { QRCodeAggregate } from "@/types";
import {
  toolsMap,
  toolsMapTitles,
  backendEnumToToolKey,
} from "@/utils/toolMap";

export type ToolTypeRow = {
  id: string;
  name: string;
  reference: "Procore" | "Taliho";
  type: string;
  modified: string;
};

export function getToolTypeTable(opts: {
  qrId: string;
  aggregate?: QRCodeAggregate;
  qrType?: string;
  procoreCategory?: string | null;
  onRemove?: (id: string) => void;
}): {
  columns: Column<ToolTypeRow>[];
  rows: ToolTypeRow[];
  getRowId: (r: ToolTypeRow) => string;
  renderActions?: (row: ToolTypeRow) => ReactNode;
} {
  // const { qrId } = opts;

  function latest(
    items: Array<Record<string, unknown>>,
    keys: string[],
  ): string {
    let max = 0;
    for (const it of items) {
      for (const k of keys) {
        const v = it[k];
        if (typeof v === "string") {
          const ts = Date.parse(v);
          if (!Number.isNaN(ts)) max = Math.max(max, ts);
        }
      }
    }
    return max > 0 ? formatDate(max) : "-";
  }

  const rows: ToolTypeRow[] = [];

  const docsCount =
    (opts.aggregate?.documents?.length ?? 0) +
    (opts.aggregate?.folders?.length ?? 0);
  if (docsCount > 0) {
    const items = [
      ...((opts.aggregate?.documents ?? []) as unknown as Array<
        Record<string, unknown>
      >),
      ...((opts.aggregate?.folders ?? []) as unknown as Array<
        Record<string, unknown>
      >),
    ];
    rows.push({
      id: "t-docs",
      name: "Taliho Documents",
      reference: "Taliho",
      type: "Documents",
      modified: latest(items, ["updatedAt", "createdAt", "created_at"]),
    });
  }

  const bicWorkflows = opts.aggregate?.ballInCourtWorkflows ?? [];
  if (bicWorkflows.length > 0) {
    rows.push({
      id: "t-bic",
      name: "Task Signoff",
      reference: "Taliho",
      type: "Workflow",
      modified: latest(
        bicWorkflows as unknown as Array<Record<string, unknown>>,
        ["updatedAt", "createdAt"],
      ),
    });
  }

  const procoreTools = opts.aggregate?.procoreTools as
    | { tool?: string; count?: number }[]
    | undefined;
  const seenToolKeys = new Set<string>();
  const addToolByKey = (key: string) => {
    if (!key || seenToolKeys.has(key) || !(key in toolsMap)) return;
    seenToolKeys.add(key);
    const title = toolsMap[key as keyof typeof toolsMap].title;
    rows.push({
      id: `p-${key}`,
      name: title,
      reference: "Procore",
      type: title,
      modified: "-",
    });
  };
  const toToolKey = (labelOrKey?: string | null): string | undefined => {
    if (!labelOrKey) return undefined;
    const raw = String(labelOrKey);
    // Check if it's already a tool key (e.g., 'rfi', 'coordination-issue')
    if (raw in toolsMap) return raw;
    // Check if it's a friendly title (e.g., "RFI's", "Coordination Issues")
    const fromTitle = (toolsMapTitles as Record<string, string>)[raw];
    if (fromTitle && fromTitle in toolsMap) return fromTitle;
    // Check if it's a backend enum value (e.g., 'rfis', 'coordination-issues')
    const fromEnum = (backendEnumToToolKey as Record<string, string>)[raw];
    if (fromEnum && fromEnum in toolsMap) return fromEnum;
    return undefined;
  };
  if (Array.isArray(procoreTools)) {
    for (const ent of procoreTools) {
      const key = toToolKey(ent?.tool);
      if (key) addToolByKey(key);
    }
  }

  // Ensure at least the QR's declared Procore tool appears even if no fetched items exist yet
  // If backend declares a category but no items yet, keep a placeholder row
  if (
    (opts.qrType ?? "").toLowerCase() === "procore-tool" &&
    typeof opts.procoreCategory === "string"
  ) {
    const key = toToolKey(opts.procoreCategory);
    if (key) addToolByKey(key);
  }

  // For procore-location type, show common Procore tools by default in the ToolType list
  if (
    (opts.qrType ?? opts.aggregate?.data?.type ?? "").toLowerCase() ===
    "procore-location"
  ) {
    const defaultTools = [
      "Coordination Issues",
      "Incidents",
      "Inspections",
      "Observations",
      "Photos",
      "Punch List",
      "RFIs",
      "Submittals",
    ];
    defaultTools.forEach((label) => {
      const key = toToolKey(label);
      if (key) addToolByKey(key);
    });
  }

  function referenceVariant(
    ref: ToolTypeRow["reference"] | string,
  ): BadgeVariant {
    if (ref === "Procore") return "orange";
    if (ref === "Taliho") return "yellow";
    return "gray";
  }

  // Build a unique variant map per render so no two types share a color, except 'Documents' which is fixed.
  const palette: BadgeVariant[] = [
    "slate",
    "blue",
    "indigo",
    "purple",
    "pink",
    "red",
    "orange",
    "green",
    "teal",
    "gray",
  ];
  const presentTypes = Array.from(new Set(rows.map((r) => r.type)));
  const nonDocTypes = presentTypes.filter((t) => t !== "Documents");
  const typeToVariant = new Map<string, BadgeVariant>();
  typeToVariant.set("Documents", "yellow");
  typeToVariant.set("Workflow", "blue");
  nonDocTypes.forEach((t, idx) => {
    typeToVariant.set(t, palette[idx % palette?.length]);
  });

  function typeVariant(t: string): BadgeVariant {
    return typeToVariant.get(t) ?? "gray";
  }

  const columns: Column<ToolTypeRow>[] = [
    col<ToolTypeRow>({
      key: "name",
      header: "Name",
      sortable: true,
      columnType: "secondary",
      className: "",
      ...secondaryCell<ToolTypeRow>((r) => (
        <div className="flex items-center">
          {r.id === "t-bic" ? (
            <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-yellow-100">
              <i className="bx bx-shuffle text-yellow-600 text-xl" />
            </div>
          ) : r.reference === "Procore" ? (
            <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-orange-50">
              <img src={procoreIcon} alt="Procore" className="h-6 w-6" />
            </div>
          ) : (
            <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-yellow-100">
              <i className="bx bxs-folder text-yellow-600 text-xl"></i>
            </div>
          )}
          <span className="font-medium text-gray-900">{r.name}</span>
        </div>
      )),
    }),
    col<ToolTypeRow>({
      key: "reference",
      header: "Reference",
      sortable: true,
      ...statusBadgeCell<ToolTypeRow>((r) => ({
        label: r.reference,
        variant: referenceVariant(r.reference),
      })),
    }),
    col<ToolTypeRow>({
      key: "type",
      header: "Type",
      sortable: true,
      ...statusBadgeCell<ToolTypeRow>((r) => ({
        label: r.type,
        variant: typeVariant(r.type),
      })),
    }),
    col<ToolTypeRow>({
      key: "modified",
      header: "Date Modified",
      sortable: true,
      ...dateCell<ToolTypeRow>((r) => r.modified),
    }),
  ];

  // Alphabetize rows by name, keeping 'Taliho Documents' at the top if present
  const sortedRows: ToolTypeRow[] = (() => {
    const docIdx = rows.findIndex((r) => r.id === "t-docs");
    const hasDoc = docIdx !== -1;
    const docRow = hasDoc ? rows[docIdx] : undefined;
    const rest = rows.filter((_, idx) => idx !== docIdx);
    rest.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return hasDoc ? [docRow as ToolTypeRow, ...rest] : rest;
  })();

  // When used on QRCode page, we don't need per-row actions; return undefined
  const renderActions = undefined;

  return {
    columns,
    rows: sortedRows,
    getRowId: (r: ToolTypeRow) => r.id,
    renderActions,
  };
}
