/** Props for the GridSkeleton component -- a shimmer loading placeholder that mimics the DataGrid card layout with a footer. */
type GridSkeletonProps = {
  /** Number of skeleton card placeholders to render. Defaults to 12. */
  itemCount?: number;
  className?: string;
  /** Tailwind grid layout classes matching the target DataGrid. Defaults to a responsive 1-6 column grid. */
  gridClassName?: string;
};

export default function GridSkeleton(props: GridSkeletonProps) {
  const {
    itemCount = 12,
    className = "",
    gridClassName = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 p-8",
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
        className={`relative overflow-hidden bg-gray-200 rounded ${className}`}
        style={{ width }}
      >
        <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
      {/* Local shimmer keyframes */}
      <style>{`
			@keyframes skeleton-shimmer-kf { 100% { transform: translateX(100%); } }
			.skeleton-shimmer { transform: translateX(-100%); animation: skeleton-shimmer-kf 1.4s ease-in-out infinite; }
			`}</style>

      {/* Body */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <div className="flex-grow overflow-hidden">
          <div className={gridClassName}>
            {Array.from({ length: itemCount }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow overflow-hidden flex flex-col relative"
              >
                {/* Image area */}
                <div className="aspect-square bg-white flex items-center justify-center border-b border-gray-200 p-4">
                  <div className="w-full h-full bg-gray-200 rounded relative overflow-hidden">
                    <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </div>
                </div>
                {/* Content */}
                <div className="p-4 flex-grow">
                  <Bar width="80%" className="h-4 mb-2 rounded-md" />
                  <Bar width="64px" className="h-5 mb-3 rounded-full" />
                  <Bar width="40%" className="h-3 mb-2 rounded-md" />
                  <Bar width="32%" className="h-3 rounded-md" />
                </div>
                {/* Footer actions */}
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-end space-x-2">
                  <Bar width="28px" className="h-7 rounded" />
                  <Bar width="28px" className="h-7 rounded" />
                  <Bar width="28px" className="h-7 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer mock (TableFooter parity) */}
        <div className="flex-none border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="w-48">
              <Bar width="70%" className="h-4 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden">
                <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden"
                >
                  <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
              ))}
              <div className="h-8 w-8 bg-gray-200 rounded relative overflow-hidden">
                <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            </div>
            <div className="ml-4 h-8 w-24 bg-gray-200 rounded relative overflow-hidden">
              <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
