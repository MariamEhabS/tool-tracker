import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import type { Column } from "@/components/table/DataTable";
import type { SampleGang } from "@/data/seed/toolTrackerSeed";
import type { ToolRow } from "./types";

/**
 * One unified table that renders gangs + standalone tools. Replaces the
 * earlier split (indigo gang cards above + standalone DataTable below)
 * which felt visually disconnected. Columns + headers are shared. Each
 * gang appears as a full-width banner row that interrupts the table; its
 * member rows are indented one column-width and show a left accent.
 *
 * Sort is handled locally — clicking a column header sorts WITHIN each
 * gang and within standalones, preserving the gang grouping.
 */

export interface GangGroup {
  gang: SampleGang;
  members: ToolRow[];
}

interface GroupedToolsTableProps {
  columns: Column<ToolRow>[];
  gangs: GangGroup[];
  standaloneRows: ToolRow[];
  selectedIds: Set<string>;
  onToggleRow: (row: ToolRow) => void;
  onRowClick: (row: ToolRow) => void;
  rowClassName: (row: ToolRow) => string;
  buildRowActions: (row: ToolRow) => ItemComboBoxOption[];
  buildGangActions: (gang: SampleGang) => ItemComboBoxOption[];
  collapsedGangIds: Set<string>;
  onToggleGangCollapsed: (gangId: string) => void;
}

type SortDir = "asc" | "desc";

function defaultSortValue(row: ToolRow, key: string): string | number | Date {
  const fromColumn = (row as unknown as Record<string, unknown>)[key];
  if (typeof fromColumn === "string") return fromColumn.toLowerCase();
  if (typeof fromColumn === "number") return fromColumn;
  if (fromColumn instanceof Date) return fromColumn;
  return String(fromColumn ?? "");
}

function compare(
  a: string | number | Date,
  b: string | number | Date,
): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function sortRows(
  rows: ToolRow[],
  sortKey: string | null,
  sortDir: SortDir,
  columns: Column<ToolRow>[],
): ToolRow[] {
  if (!sortKey) return rows;
  const col = columns.find((c) => c.key === sortKey);
  const accessor = col?.getSortValue ?? ((r: ToolRow) => defaultSortValue(r, sortKey));
  const out = rows.slice().sort((a, b) => {
    const av = accessor(a) ?? "";
    const bv = accessor(b) ?? "";
    const cmp = compare(av as string | number | Date, bv as string | number | Date);
    return sortDir === "asc" ? cmp : -cmp;
  });
  return out;
}

export default function GroupedToolsTable(props: GroupedToolsTableProps) {
  const {
    columns,
    gangs,
    standaloneRows,
    selectedIds,
    onToggleRow,
    onRowClick,
    rowClassName,
    buildRowActions,
    buildGangActions,
    collapsedGangIds,
    onToggleGangCollapsed,
  } = props;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSortClick = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedGangs = useMemo(
    () =>
      gangs.map((g) => ({
        ...g,
        members: sortRows(g.members, sortKey, sortDir, columns),
      })),
    [gangs, sortKey, sortDir, columns],
  );
  const sortedStandalone = useMemo(
    () => sortRows(standaloneRows, sortKey, sortDir, columns),
    [standaloneRows, sortKey, sortDir, columns],
  );

  // 1 (checkbox) + columns + 1 (actions)
  const totalCols = columns.length + 2;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table
        className="w-full text-sm border-collapse"
        data-testid="grouped-tools-table"
      >
        <colgroup>
          <col style={{ width: "44px" }} />
          {columns.map((c) => (
            <col key={c.key} />
          ))}
          <col style={{ width: "44px" }} />
        </colgroup>
        <thead className="bg-gray-50 text-gray-600">
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2.5 text-left font-medium" />
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSortClick(col.key)}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                    data-testid={`grouped-sort-${col.key}`}
                  >
                    {col.header}
                    <SortIndicator
                      active={sortKey === col.key}
                      direction={sortDir}
                    />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {sortedGangs.map(({ gang, members }) => {
            const collapsed = collapsedGangIds.has(gang.id);
            return (
              <GangSection
                key={gang.id}
                gang={gang}
                members={members}
                collapsed={collapsed}
                totalCols={totalCols}
                columns={columns}
                selectedIds={selectedIds}
                onToggleRow={onToggleRow}
                onRowClick={onRowClick}
                rowClassName={rowClassName}
                buildRowActions={buildRowActions}
                buildGangActions={buildGangActions}
                onToggleCollapsed={() => onToggleGangCollapsed(gang.id)}
              />
            );
          })}

          {sortedGangs.length > 0 && sortedStandalone.length > 0 && (
            <tr>
              <td
                colSpan={totalCols}
                className="px-4 py-2 bg-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-y border-gray-200"
                data-testid="grouped-standalone-divider"
              >
                Standalone tools ({sortedStandalone.length})
              </td>
            </tr>
          )}

          {sortedStandalone.map((row) => (
            <ToolRowEl
              key={row.id}
              row={row}
              columns={columns}
              selected={selectedIds.has(row.id)}
              onToggle={() => onToggleRow(row)}
              onRowClick={() => onRowClick(row)}
              rowClassName={rowClassName(row)}
              actions={buildRowActions(row)}
              indented={false}
            />
          ))}

          {sortedGangs.length === 0 && sortedStandalone.length === 0 && (
            <tr>
              <td
                colSpan={totalCols}
                className="px-4 py-12 text-center text-sm text-gray-500"
              >
                No tools match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface GangSectionProps {
  gang: SampleGang;
  members: ToolRow[];
  collapsed: boolean;
  totalCols: number;
  columns: Column<ToolRow>[];
  selectedIds: Set<string>;
  onToggleRow: (row: ToolRow) => void;
  onRowClick: (row: ToolRow) => void;
  rowClassName: (row: ToolRow) => string;
  buildRowActions: (row: ToolRow) => ItemComboBoxOption[];
  buildGangActions: (gang: SampleGang) => ItemComboBoxOption[];
  onToggleCollapsed: () => void;
}

function GangSection(props: GangSectionProps) {
  const {
    gang,
    members,
    collapsed,
    totalCols,
    columns,
    selectedIds,
    onToggleRow,
    onRowClick,
    rowClassName,
    buildRowActions,
    buildGangActions,
    onToggleCollapsed,
  } = props;

  return (
    <>
      <tr
        className="bg-indigo-50 hover:bg-indigo-100 border-y border-indigo-200 transition"
        data-testid={`grouped-gang-banner-${gang.id}`}
      >
        <td colSpan={totalCols} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand gang" : "Collapse gang"}
              className="text-indigo-700 hover:text-indigo-900 -ml-1"
              data-testid={`grouped-gang-toggle-${gang.id}`}
            >
              <i
                className={`bx ${collapsed ? "bx-chevron-right" : "bx-chevron-down"} text-lg`}
                aria-hidden
              />
            </button>
            <i
              className="bx bx-collection text-indigo-600 text-base"
              aria-hidden
            />
            <span className="text-sm font-semibold text-indigo-900">
              {gang.name}
            </span>
            {gang.foreman && (
              <span className="text-xs text-indigo-700 ml-2">
                <i className="bx bx-user mr-0.5" aria-hidden />
                {gang.foreman}
              </span>
            )}
            <span className="text-xs text-indigo-700">
              · {members.length}{" "}
              {members.length === 1 ? "tool" : "tools"}
            </span>
            <div
              className="ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ItemComboBox
                sourceId={`grouped-gang-actions-${gang.id}`}
                options={buildGangActions(gang)}
                buttonAriaLabel="Gang actions"
              />
            </div>
          </div>
        </td>
      </tr>
      {!collapsed &&
        members.map((row) => (
          <ToolRowEl
            key={row.id}
            row={row}
            columns={columns}
            selected={selectedIds.has(row.id)}
            onToggle={() => onToggleRow(row)}
            onRowClick={() => onRowClick(row)}
            rowClassName={rowClassName(row)}
            actions={buildRowActions(row)}
            indented
          />
        ))}
    </>
  );
}

interface ToolRowElProps {
  row: ToolRow;
  columns: Column<ToolRow>[];
  selected: boolean;
  onToggle: () => void;
  onRowClick: () => void;
  rowClassName: string;
  actions: ItemComboBoxOption[];
  indented: boolean;
}

function ToolRowEl(props: ToolRowElProps) {
  const {
    row,
    columns,
    selected,
    onToggle,
    onRowClick,
    rowClassName,
    actions,
    indented,
  } = props;

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input[type="checkbox"], button, a, [role="menu"]')
    )
      return;
    onRowClick();
  };

  return (
    <tr
      className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition ${rowClassName} ${
        selected ? "bg-brand-50/60" : ""
      }`}
      onClick={handleRowClick}
    >
      <td
        className={`py-2 px-3 align-middle ${indented ? "border-l-2 border-indigo-200" : ""}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          aria-label={`Select ${row.name}`}
        />
      </td>
      {columns.map((col, idx) => {
        const cellContent: ReactNode = col.render
          ? col.render(row)
          : ((row as unknown as Record<string, unknown>)[
              col.key
            ] as ReactNode);
        return (
          <td
            key={col.key}
            className={`py-2 px-3 align-middle ${idx === 0 && indented ? "pl-8" : ""}`}
          >
            <div className="truncate min-w-0">{cellContent}</div>
          </td>
        );
      })}
      <td
        className="py-2 px-3 align-middle text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <ItemComboBox
          sourceId={`grouped-row-actions-${row.id}`}
          options={actions}
        />
      </td>
    </tr>
  );
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDir;
}) {
  if (!active) {
    return (
      <i
        className="bx bx-sort text-gray-400 text-sm"
        aria-hidden
      />
    );
  }
  return (
    <i
      className={`bx ${direction === "asc" ? "bx-up-arrow-alt" : "bx-down-arrow-alt"} text-gray-700 text-sm`}
      aria-hidden
    />
  );
}
