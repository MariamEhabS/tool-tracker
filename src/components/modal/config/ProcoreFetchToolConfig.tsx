/**
 * Procore Tool Configuration
 *
 * This module defines the configuration for all Procore tool integrations.
 * Due to the heterogeneous nature of the configuration (each tool returns
 * a different row type), we use `any` for the generic parameter in the
 * PROCORE_TOOL_CONFIGS record. This is a deliberate design choice:
 *
 * - Each tool (documents, RFIs, forms, etc.) has its own specific row type
 * - The configuration object needs to hold all tool configs in a single record
 * - TypeScript's contravariant generic constraints make it impossible to
 *   have a heterogeneous collection with strict typing
 *
 * Type safety is maintained at the individual tool level:
 * - Each getProcoreXxxTable function returns properly typed rows
 * - Each mapRowsToSelectedItems callback casts to the specific row type
 */
import type { Column } from "@components/table/DataTable";
import {
  getProcoreCoordinationIssuesTable,
  type CoordinationIssueRow,
} from "@components/table/procore/ProcoreCoordinationIssuesTable";
import {
  getProcoreDirectoryTable,
  type DirectoryRow,
} from "@components/table/procore/ProcoreDirectoryTable";
import {
  getProcoreDocumentsTable,
  type DocumentRow,
} from "@components/table/procore/ProcoreDocumentsTable";
import {
  getProcoreDrawingsTable,
  type DrawingRow,
} from "@components/table/procore/ProcoreDrawingsTable";
import {
  getProcoreFormsTable,
  type FormRow,
} from "@components/table/procore/ProcoreFormsTable";
import {
  getProcoreIncidentsTable,
  type IncidentRow,
} from "@components/table/procore/ProcoreIncidentsTable";
import {
  getProcoreInspectionsTable,
  type InspectionRow,
} from "@components/table/procore/ProcoreInspectionsTable";
import {
  getProcoreInstructionsTable,
  type InstructionRow,
} from "@components/table/procore/ProcoreInstructionsTable";
import {
  getProcoreObservationsTable,
  type ObservationRow,
} from "@components/table/procore/ProcoreObservationsTable";
import {
  getProcorePhotosTable,
  type PhotoRow,
} from "@components/table/procore/ProcorePhotosTable";
import {
  getProcorePunchListTable,
  type PunchRow,
} from "@components/table/procore/ProcorePunchListTable";
import {
  getProcoreRFIsTable,
  type RFIRow,
} from "@components/table/procore/ProcoreRFIsTable";
import {
  getProcoreSpecificationsTable,
  type SpecificationRow,
} from "@components/table/procore/ProcoreSpecificationsTable";
import {
  getProcoreSubmittalsTable,
  type SubmittalRow,
} from "@components/table/procore/ProcoreSubmittalsTable";
import {
  getProcoreTasksTable,
  type TaskRow,
} from "@components/table/procore/ProcoreTasksTable";

export type ProcoreToolKey =
  | "coordination-issues"
  | "directory"
  | "documents"
  | "drawings"
  | "forms"
  | "incidents"
  | "inspections"
  | "instructions"
  | "observations"
  | "photos"
  | "punch-list"
  | "rfis"
  | "specifications"
  | "submittals"
  | "tasks";

export type TableBundle<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (r: Row) => string;
};

export type SelectedItemLike = {
  id: string;
  title: string;
  label: string;
  bgClass: string;
  textClass: string;
  iconClass: string;
};

export type ProcoreFetchToolConfig<Row = unknown> = {
  key: ProcoreToolKey;
  label: string;
  iconClass: string;
  bgClass: string;
  textClass: string;
  modalTitle: string;
  modalIconClass: string;
  getTable: (opts?: unknown) => TableBundle<Row>;
  mapRowsToSelectedItems: (rows: Row[]) => SelectedItemLike[];
};

/* eslint-disable @typescript-eslint/no-explicit-any --
   Heterogeneous config: each tool returns different row type.
   Type safety enforced at individual table component level. */
export const PROCORE_TOOL_CONFIGS: Record<
  ProcoreToolKey,
  ProcoreFetchToolConfig<any>
> = {
  "coordination-issues": {
    key: "coordination-issues",
    label: "Coordination Issues",
    iconClass: "bx bx-git-branch",
    bgClass: "bg-blue-100",
    textClass: "text-blue-600",
    modalTitle: "Select Coordination Issues",
    modalIconClass: "bx bx-git-branch text-blue-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreCoordinationIssuesTable(
        opts as Parameters<typeof getProcoreCoordinationIssuesTable>[0],
      ),
    mapRowsToSelectedItems: (rows: CoordinationIssueRow[]) =>
      rows.map((r) => ({
        id: `ci-${r.id}`,
        title: r.title,
        label: "Type: Coordination Issue",
        bgClass: "bg-blue-100",
        textClass: "text-blue-600",
        iconClass: "bx bx-git-branch",
      })),
  },
  directory: {
    key: "directory",
    label: "Directory",
    iconClass: "bx bx-user-circle",
    bgClass: "bg-green-100",
    textClass: "text-green-600",
    modalTitle: "Select Directory Contacts",
    modalIconClass: "bx bx-user-circle text-green-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreDirectoryTable(
        opts as Parameters<typeof getProcoreDirectoryTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: DirectoryRow[]) =>
      rows.map((r) => ({
        id: `dir-${r.id}`,
        title: r.name,
        label: "Directory • Contact",
        bgClass: "bg-green-100",
        textClass: "text-green-600",
        iconClass: "bx bx-user-circle",
      })),
  },
  documents: {
    key: "documents",
    label: "Documents",
    iconClass: "bx bx-file",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-600",
    modalTitle: "Select Documents",
    modalIconClass: "bx bx-file text-yellow-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreDocumentsTable(
        opts as Parameters<typeof getProcoreDocumentsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: DocumentRow[]) =>
      rows.map((r) => ({
        id: `doc-${r.id}`,
        title: r.name,
        label:
          r.kind === "folder"
            ? "Documents • Folder"
            : `Documents • ${r.typeLabel}`,
        bgClass: "bg-yellow-100",
        textClass: "text-yellow-600",
        iconClass: "bx bx-file",
      })),
  },
  drawings: {
    key: "drawings",
    label: "Drawings",
    iconClass: "bx bx-map",
    bgClass: "bg-orange-100",
    textClass: "text-orange-600",
    modalTitle: "Select Drawings",
    modalIconClass: "bx bx-map text-orange-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreDrawingsTable(
        opts as Parameters<typeof getProcoreDrawingsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: DrawingRow[]) =>
      rows.map((r) => ({
        id: `drw-${r.procoreItemID}`,
        title: `${r.number} — ${r.title}`,
        label: "Drawings • File",
        bgClass: "bg-orange-100",
        textClass: "text-orange-600",
        iconClass: "bx bx-map",
      })),
  },
  forms: {
    key: "forms",
    label: "Forms",
    iconClass: "bx bx-list-check",
    bgClass: "bg-purple-100",
    textClass: "text-purple-600",
    modalTitle: "Select Forms",
    modalIconClass: "bx bx-list-check text-purple-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreFormsTable(opts as Parameters<typeof getProcoreFormsTable>[0]),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: FormRow[]) =>
      rows.map((r) => ({
        id: `frm-${r.id}`,
        title: r.title,
        label: "Forms • Item",
        bgClass: "bg-purple-100",
        textClass: "text-purple-600",
        iconClass: "bx bx-list-check",
      })),
  },
  incidents: {
    key: "incidents",
    label: "Incidents",
    iconClass: "bx bx-error-alt",
    bgClass: "bg-red-100",
    textClass: "text-red-600",
    modalTitle: "Select Incidents",
    modalIconClass: "bx bx-error-alt text-red-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreIncidentsTable(
        opts as Parameters<typeof getProcoreIncidentsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: IncidentRow[]) =>
      rows.map((r) => ({
        id: `inc-${r.id}`,
        title: r.title,
        label: "Incidents • Item",
        bgClass: "bg-red-100",
        textClass: "text-red-600",
        iconClass: "bx bx-error-alt",
      })),
  },
  inspections: {
    key: "inspections",
    label: "Inspections",
    iconClass: "bx bx-check-shield",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-600",
    modalTitle: "Select Inspections",
    modalIconClass: "bx bx-check-shield text-yellow-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreInspectionsTable(
        opts as Parameters<typeof getProcoreInspectionsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: InspectionRow[]) =>
      rows.map((r) => ({
        id: `insp-${r.id}`,
        title: r.title,
        label: "Inspections • Item",
        bgClass: "bg-yellow-100",
        textClass: "text-yellow-600",
        iconClass: "bx bx-check-shield",
      })),
  },
  instructions: {
    key: "instructions",
    label: "Instructions",
    iconClass: "bx bx-book-open",
    bgClass: "bg-blue-100",
    textClass: "text-blue-600",
    modalTitle: "Select Instructions",
    modalIconClass: "bx bx-book-open text-blue-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreInstructionsTable(
        opts as Parameters<typeof getProcoreInstructionsTable>[0],
      ),
    // Use Procore's unique procoreId field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: InstructionRow[]) =>
      rows.map((r) => ({
        id: `inst-${r.procoreId}`,
        title: r.title,
        label: "Instructions • Item",
        bgClass: "bg-blue-100",
        textClass: "text-blue-600",
        iconClass: "bx bx-book-open",
      })),
  },
  observations: {
    key: "observations",
    label: "Observations",
    iconClass: "bx bx-search-alt",
    bgClass: "bg-green-100",
    textClass: "text-green-600",
    modalTitle: "Select Observations",
    modalIconClass: "bx bx-search-alt text-green-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreObservationsTable(
        opts as Parameters<typeof getProcoreObservationsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: ObservationRow[]) =>
      rows.map((r) => ({
        id: `obs-${r.id}`,
        title: r.title,
        label: "Observations • Item",
        bgClass: "bg-green-100",
        textClass: "text-green-600",
        iconClass: "bx bx-search-alt",
      })),
  },
  photos: {
    key: "photos",
    label: "Photos",
    iconClass: "bx bx-image",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-600",
    modalTitle: "Select Photos",
    modalIconClass: "bx bx-image text-yellow-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcorePhotosTable(
        opts as Parameters<typeof getProcorePhotosTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: PhotoRow[]) =>
      rows.map((r) => ({
        id: `pho-${r.id}`,
        title: r.title || "Photo",
        label: "Photos • Item",
        bgClass: "bg-yellow-100",
        textClass: "text-yellow-600",
        iconClass: "bx bx-image",
      })),
  },
  "punch-list": {
    key: "punch-list",
    label: "Punch List",
    iconClass: "bx bx-task",
    bgClass: "bg-teal-100",
    textClass: "text-teal-600",
    modalTitle: "Select Punch List Items",
    modalIconClass: "bx bx-task text-teal-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcorePunchListTable(
        opts as Parameters<typeof getProcorePunchListTable>[0],
      ),
    // Use Procore's unique procoreId field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: PunchRow[]) =>
      rows.map((r) => ({
        id: `pl-${r.procoreId || r.position}`,
        title: r.title,
        label: "Punch List • Item",
        bgClass: "bg-teal-100",
        textClass: "text-teal-600",
        iconClass: "bx bx-task",
      })),
  },
  rfis: {
    key: "rfis",
    label: "RFIs",
    iconClass: "bx bx-question-mark",
    bgClass: "bg-orange-100",
    textClass: "text-orange-600",
    modalTitle: "Select RFIs",
    modalIconClass: "bx bx-question-mark text-orange-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreRFIsTable(opts as Parameters<typeof getProcoreRFIsTable>[0]),
    // Use Procore's numeric id (procoreId) to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: RFIRow[]) =>
      rows.map((r) => ({
        id: `rfi-${r.procoreId ?? r.rfi}`,
        title: r.subject,
        label: "RFIs • Item",
        bgClass: "bg-orange-100",
        textClass: "text-orange-600",
        iconClass: "bx bx-question-mark",
      })),
  },
  specifications: {
    key: "specifications",
    label: "Specifications",
    iconClass: "bx bx-detail",
    bgClass: "bg-purple-100",
    textClass: "text-purple-600",
    modalTitle: "Select Specifications",
    modalIconClass: "bx bx-detail text-purple-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreSpecificationsTable(
        opts as Parameters<typeof getProcoreSpecificationsTable>[0],
      ),
    // Use Procore's numeric id (procoreId) to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: SpecificationRow[]) =>
      rows.map((r) => ({
        id: `spec-${r.procoreId ?? r.number}`,
        title: r.title,
        label: "Specifications • Item",
        bgClass: "bg-purple-100",
        textClass: "text-purple-600",
        iconClass: "bx bx-detail",
      })),
  },
  submittals: {
    key: "submittals",
    label: "Submittals",
    iconClass: "bx bx-file-find",
    bgClass: "bg-red-100",
    textClass: "text-red-600",
    modalTitle: "Select Submittals",
    modalIconClass: "bx bx-file-find text-red-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreSubmittalsTable(
        opts as Parameters<typeof getProcoreSubmittalsTable>[0],
      ),
    // Use Procore's numeric id field to ensure unique IDs across all items
    mapRowsToSelectedItems: (rows: SubmittalRow[]) =>
      rows.map((r) => ({
        id: `sub-${r.procoreId ?? r.number}`,
        title: r.title,
        label: "Submittals • Item",
        bgClass: "bg-red-100",
        textClass: "text-red-600",
        iconClass: "bx bx-file-find",
      })),
  },
  tasks: {
    key: "tasks",
    label: "Tasks",
    iconClass: "bx bx-check-square",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-600",
    modalTitle: "Select Tasks",
    modalIconClass: "bx bx-check-square text-yellow-600 text-xl",
    getTable: (opts?: unknown) =>
      getProcoreTasksTable(opts as Parameters<typeof getProcoreTasksTable>[0]),
    mapRowsToSelectedItems: (rows: TaskRow[]) =>
      rows.map((r) => ({
        id: `tsk-${String(r.id ?? "")}`,
        title: String(r.title ?? ""),
        label: "Tasks • Item",
        bgClass: "bg-yellow-100",
        textClass: "text-yellow-600",
        iconClass: "bx bx-check-square",
      })),
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROCORE_TOOL_LIST: ProcoreFetchToolConfig<any>[] =
  Object.values(PROCORE_TOOL_CONFIGS);
