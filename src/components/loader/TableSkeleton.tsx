/** Props for the TableSkeleton component -- a full shimmer loading placeholder mimicking the DataTable layout with header, rows, and footer. */
type TableSkeletonProps = {
  /** Number of data columns to render in the skeleton (determines header and cell count) */
  columnCount: number;
  /** Number of skeleton rows to render. Defaults to 10. */
  rowCount?: number;
  /** When true, includes a checkbox column on the left */
  showSelection?: boolean;
  /** When true, includes an actions column on the right */
  showActions?: boolean;
  className?: string;
};

// Simple widths pattern so cells don't all look identical
const CELL_WIDTHS = [
  "70%",
  "55%",
  "45%",
  "60%",
  "40%",
  "50%",
  "35%",
  "65%",
  "45%",
  "55%",
];

export default function TableSkeleton(props: TableSkeletonProps) {
  const {
    columnCount,
    rowCount = 10,
    showSelection,
    showActions,
    className = "",
  } = props;

  function Bar({
    width = "60%",
    className = "",
  }: {
    width?: string;
    className?: string;
  }) {
    return (
      <div
        className={`relative overflow-hidden bg-gray-200 rounded-full h-3 ${className}`}
        style={{ width }}
      >
        <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
    );
  }

  // Distribute widths in percentages:
  // - First data column: 30%
  // - Last column overall: 5% (if actions present, actions column gets 5%; otherwise last data column gets 5%)
  // - Remaining data columns share the rest evenly
  const actionsPercent = showActions ? 5 : 0;
  const firstDataPercent = Math.min(30, 100 - actionsPercent);
  const lastDataPercent = !showActions && columnCount > 1 ? 10 : 0;
  const middleCount = Math.max(
    0,
    columnCount - 1 - (lastDataPercent > 0 ? 1 : 0),
  );
  const remainingForMiddle = Math.max(
    0,
    100 - actionsPercent - firstDataPercent - lastDataPercent,
  );
  const middlePercent = middleCount > 0 ? remainingForMiddle / middleCount : 0;

  return (
    <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
      {/* Local shimmer keyframes */}
      <style>{`
			@keyframes skeleton-shimmer-kf { 100% { transform: translateX(100%); } }
			.skeleton-shimmer { transform: translateX(-100%); animation: skeleton-shimmer-kf 1.4s ease-in-out infinite; }
			`}</style>

      {/* Table mock */}
      <div className="flex-grow flex flex-col overflow-hidden min-h-0">
        <table className="min-w-full table-fixed">
          <colgroup>
            {showSelection ? <col style={{ width: "48px" }} /> : null}
            {Array.from({ length: columnCount }).map((_, i) => {
              const isFirst = i === 0;
              const isLastData =
                !showActions && columnCount > 1 && i === columnCount - 1;
              const w = isFirst
                ? firstDataPercent
                : isLastData
                  ? lastDataPercent
                  : middlePercent;
              return <col key={`data-${i}`} style={{ width: `${w}%` }} />;
            })}
            {showActions ? (
              <col style={{ width: `${actionsPercent}%` }} />
            ) : null}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              {showSelection ? (
                <th className="sticky top-0 bg-gray-50 px-4 py-4 text-center w-12">
                  <span className="inline-block h-4 w-4 rounded-full bg-gray-200 relative overflow-hidden">
                    <span className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </span>
                </th>
              ) : null}
              {Array.from({ length: columnCount }).map((_, i) => (
                <th
                  key={i}
                  className={`sticky top-0 bg-gray-50 ${i === 0 ? "pl-6" : "pl-5"} py-4 text-left`}
                >
                  <Bar width={i === 0 ? "40%" : "55%"} className="h-3" />
                </th>
              ))}
              {showActions ? (
                <th className="sticky top-0 bg-gray-50 py-4 pl-5 pr-6 text-right">
                  <Bar width={`${actionsPercent}%`} />
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rowCount }).map((_, r) => (
              <tr key={r}>
                {showSelection ? (
                  <td className="px-4 py-6 text-center w-12">
                    <span className="inline-block h-4 w-4 rounded-full bg-gray-200 relative overflow-hidden">
                      <span className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    </span>
                  </td>
                ) : null}
                {Array.from({ length: columnCount }).map((_, c) => (
                  <td key={c} className={`${c === 0 ? "pl-6" : "pl-5"} py-4`}>
                    <Bar width={CELL_WIDTHS[(c + r) % CELL_WIDTHS.length]} />
                  </td>
                ))}
                {showActions ? (
                  <td className="pl-5 pr-6 py-6 text-right">
                    <Bar width={`${actionsPercent}%`} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer mock (TableFooter) */}
      <div className="flex-none border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="w-48">
            <Bar width="70%" />
          </div>
          <div className="flex items-center gap-2">
            {/* Previous */}
            <div className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden">
              <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
            {/* Page numbers */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden"
              >
                <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            ))}
            {/* Next */}
            <div className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden">
              <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </div>
          {/* Items per page */}
          <div className="ml-4 h-8 w-24 bg-gray-200 rounded relative overflow-hidden">
            <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
