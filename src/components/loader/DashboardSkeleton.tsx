export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-lg shadow flex items-center"
          >
            <div className="mr-4 bg-gray-200 rounded-md p-6" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-6 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg shadow-sm p-4">
              <div className="h-10 bg-gray-200 rounded w-10 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
