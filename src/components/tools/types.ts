import type {
  SampleToolRecord,
  SampleToolStatus,
} from "@/data/seed/toolTrackerSeed";

/**
 * Flat view-model the Tools list page renders. Decouples the table column
 * definitions from the underlying record so we can add display fields
 * (project name resolved from id, status badge tone, formatted dates)
 * without leaking display concerns into the seed.
 */
export interface ToolRow {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial: string;
  homeLocation: string;
  assignedTo: string;
  projectId: string;
  projectName: string;
  status: SampleToolStatus;
  statusLabel: string;
  /** ISO timestamp. */
  lastScanAt: string;
  /** ISO date (YYYY-MM-DD) the tool is due back; only present when
   * status is "out" or "overdue". */
  dueBackAt?: string;
  /** ISO timestamp. */
  createdAt: string;
  purchaseDate: string;
  warrantyDate: string;
  /** Original record kept attached so per-row actions (Retire, etc.) can
   * reach data not surfaced in the visible columns. */
  record: SampleToolRecord;
}
