/** Props for the TableContentsSkeleton component -- a body-only table skeleton (renders a `<tbody>`) used during sort or pagination transitions while the header remains visible. */
type TableContentsSkeletonProps = {
  /** Number of data columns to render in each skeleton row */
  columnCount: number;
  /** Number of skeleton rows to render. Defaults to 10. */
  rowCount?: number;
  /** When true, includes a checkbox cell on the left of each row */
  showSelection?: boolean;
  /** When true, includes an actions cell on the right of each row */
  showActions?: boolean;
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

export default function TableContentsSkeleton(
  props: TableContentsSkeletonProps,
) {
  const { columnCount, rowCount = 10, showSelection, showActions } = props;

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

  return (
    <>
      {/* Local shimmer keyframes */}
      <style>{`
      @keyframes skeleton-shimmer-kf { 100% { transform: translateX(100%); } }
      .skeleton-shimmer { transform: translateX(-100%); animation: skeleton-shimmer-kf 1.4s ease-in-out infinite; }
      `}</style>
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
                <Bar width="40%" />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </>
  );
}
