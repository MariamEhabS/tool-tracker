import type { ReactNode } from "react";
import DataTable, { type Column } from "@/components/table/DataTable";

// type DocRow = {
// 	id: string
// 	name: string
// 	type: string
// 	dateModified: string
// 	isFolder: boolean
// 	[key: string]: unknown
// }

type Props = {
  columns: Column<unknown>[];
  rows: unknown[];
  getRowId: (r: unknown) => string;
  getRowClassName: (r: unknown) => string;
  showSelection: boolean;
  isRowSelected: (r: unknown) => boolean;
  onToggleRow: (r: unknown) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  onRowClick: (row: unknown) => void;
  renderActions?: (row: unknown) => ReactNode;
};

export default function QrDocsTable(props: Props) {
  const {
    columns,
    rows,
    getRowId,
    getRowClassName,
    showSelection,
    isRowSelected,
    onToggleRow,
    allSelected,
    onToggleAll,
    onRowClick,
    renderActions,
  } = props;

  return (
    <DataTable
      key={`docs-table`}
      columns={columns}
      rows={rows}
      getRowId={getRowId}
      getRowClassName={getRowClassName}
      onRowClick={onRowClick}
      showSelection={showSelection}
      isRowSelected={isRowSelected}
      onToggleRow={onToggleRow}
      allSelected={allSelected}
      onToggleAll={onToggleAll}
      renderActions={renderActions}
    />
  );
}
