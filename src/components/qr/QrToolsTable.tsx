import DataTable from "@components/table/DataTable";

type Row = { id: string; name: string };

type Props = {
  columns: Array<{ key: string; header: string }>;
  rows: unknown[];
  getRowId: (r: unknown) => string;
  getRowClassName: (r: unknown) => string;
  allSelected: boolean;
  showSelection: boolean;
  isRowSelected: (r: unknown) => boolean;
  onToggleRow: (r: unknown) => void;
  onToggleAll: () => void;
  onRowClick: (row: Row) => void;
};

export default function QrToolsTable(props: Props) {
  const {
    columns,
    rows,
    getRowId,
    getRowClassName,
    allSelected,
    showSelection,
    isRowSelected,
    onToggleRow,
    onToggleAll,
    onRowClick,
  } = props;
  return (
    <DataTable
      key={`tools`}
      columns={columns}
      rows={rows}
      getRowId={getRowId}
      getRowClassName={getRowClassName}
      showSelection={showSelection}
      isRowSelected={isRowSelected}
      onToggleRow={onToggleRow}
      allSelected={allSelected}
      onToggleAll={onToggleAll}
      onRowClick={(row) => onRowClick(row as Row)}
    />
  );
}
