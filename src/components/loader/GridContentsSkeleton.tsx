/** Props for the GridContentsSkeleton component -- a body-only grid skeleton (no header/footer) used during sort or pagination transitions. */
type GridContentsSkeletonProps = {
  /** Number of skeleton card placeholders to render. Defaults to 12. */
  itemCount?: number;
  className?: string;
  /** Tailwind grid layout classes matching the target DataGrid. */
  gridClassName?: string;
};

export default function GridContentsSkeleton(props: GridContentsSkeletonProps) {
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

      {/* Body-only grid skeleton (no header/footer) */}
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
          </div>
        ))}
      </div>
    </div>
  );
}
