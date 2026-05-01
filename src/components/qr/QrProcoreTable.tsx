import DataTable from "@components/table/DataTable";

export type Bundle = {
  columns: Array<{ key: string; header: string }>;
  rows: unknown[];
  getRowId: (r: unknown) => string;
  renderActions?: (row: unknown) => React.ReactNode;
};

type Props = {
  keyName: string;
  bundle: Bundle;
  rows: unknown[];
  getRowClassName: (r: unknown) => string;
  showSelection: boolean;
  isRowSelected: (r: unknown) => boolean;
  onToggleRow: (r: unknown) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  onRowClick: (row: unknown) => void;
};

export default function QrProcoreTable(props: Props) {
  const {
    keyName,
    bundle,
    rows,
    getRowClassName,
    showSelection,
    isRowSelected,
    onToggleRow,
    allSelected,
    onToggleAll,
    onRowClick,
  } = props;
  return (
    <DataTable
      key={`procore-${keyName}`}
      columns={bundle.columns as unknown as { key: string; header: string }[]}
      rows={rows}
      getRowId={bundle.getRowId as unknown as (r: unknown) => string}
      // getRowUrl={() => undefined}
      getRowClassName={getRowClassName}
      onRowClick={onRowClick}
      showSelection={showSelection}
      isRowSelected={isRowSelected}
      onToggleRow={onToggleRow}
      allSelected={allSelected}
      onToggleAll={onToggleAll}
      renderActions={bundle.renderActions}
    />
  );
}
