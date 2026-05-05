import type {
  SampleToolRecord,
  SampleToolStatus,
} from "@/data/seed/toolTrackerSeed";
import type { ToolRow } from "./types";

const STATUS_LABELS: Record<SampleToolStatus, string> = {
  available: "Available",
  out: "Checked out",
  overdue: "Overdue",
  retired: "Retired",
};

export function statusLabel(status: SampleToolStatus): string {
  return STATUS_LABELS[status];
}

export function toRow(
  record: SampleToolRecord,
  projectsById: Record<string, string>,
): ToolRow {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    manufacturer: record.manufacturer,
    model: record.model,
    serial: record.serial,
    homeLocation: record.homeLocation,
    assignedTo: record.assignedTo,
    projectId: record.projectId,
    projectName: projectsById[record.projectId] ?? "—",
    status: record.status,
    statusLabel: STATUS_LABELS[record.status],
    lastScanAt: record.lastScanAt,
    dueBackAt: record.dueBackAt,
    createdAt: record.createdAt,
    purchaseDate: record.purchaseDate,
    warrantyDate: record.warrantyDate,
    record,
  };
}

const RELATIVE_THRESHOLDS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  if (abs < 60 * 1000) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const { unit, ms } of RELATIVE_THRESHOLDS) {
    if (abs >= ms) {
      const value = Math.round(diffMs / ms);
      return rtf.format(value, unit);
    }
  }
  return "just now";
}

export function formatShortDate(iso: string): string {
  if (!iso) return "—";
  // Accept either YYYY-MM-DD or full ISO timestamps.
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? (() => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
