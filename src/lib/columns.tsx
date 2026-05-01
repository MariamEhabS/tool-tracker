/**
 * @fileoverview Column definition helpers for DataTable. Each helper returns
 * a partial Column object that can be spread into a full column definition,
 * keeping column config files concise and type-safe.
 */

import type { ReactNode } from "react";
import type { Column } from "../components/table/DataTable";
import Badge from "../components/ui/Badge";
import type { BadgeVariant } from "../types/Badge.types";
import { formatDate } from "../lib/format";

/**
 * Identity helper that narrows the type of a column definition.
 * Use this to get autocompletion without casting.
 */
export function col<Row>(c: Column<Row>): Column<Row> {
  return c;
}

/** Creates column props for a primary (bold, left-aligned) cell. */
export function primaryCell<Row>(
  render: (row: Row) => ReactNode,
): Pick<Column<Row>, "columnType" | "render"> {
  return { columnType: "primary", render };
}

/** Creates column props for a secondary (muted) cell. */
export function secondaryCell<Row>(
  render: (row: Row) => ReactNode,
): Pick<Column<Row>, "columnType" | "render"> {
  return { columnType: "secondary", render };
}

/**
 * Creates column props for a status badge cell. Accepts either a plain
 * string (rendered as a gray chip) or an object with label, variant, and className.
 */
export function statusBadgeCell<Row>(
  get: (
    row: Row,
  ) => { label: string; variant?: BadgeVariant; className?: string } | string,
): Pick<Column<Row>, "columnType" | "className" | "render"> {
  return {
    columnType: "status",
    className: "text-gray-500",
    render: (row: Row) => {
      const v = get(row);
      if (typeof v === "string") {
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
            {v}
          </span>
        );
      }
      if (v.variant) {
        return (
          <Badge variant={v.variant} shape="md">
            {v.label}
          </Badge>
        );
      }
      return (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${v.className ?? "bg-gray-100 text-gray-700"}`}
        >
          {v.label}
        </span>
      );
    },
  };
}

/** Creates column props for a formatted date cell (e.g., "Jan 15, 2025"). */
export function dateCell<Row>(
  get: (row: Row) => unknown,
): Pick<Column<Row>, "columnType" | "className" | "render"> {
  return {
    columnType: "date",
    className: "text-gray-500",
    render: (row: Row) => {
      const val = get(row) as unknown;
      return formatDate(val as string | number | Date | null | undefined);
    },
  };
}

/** Creates column props for a numeric cell rendered as a string. */
export function numberCell<Row>(
  get: (row: Row) => number | string,
): Pick<Column<Row>, "columnType" | "className" | "render"> {
  return {
    columnType: "number",
    className: "text-gray-500",
    render: (row: Row) => String(get(row)),
  };
}

/** Creates column props for a right-aligned actions cell (e.g., dropdown menus). */
export function actionsCell<Row>(
  render: (row: Row) => ReactNode,
): Pick<Column<Row>, "className" | "render"> {
  return { className: "text-right", render };
}
