import { useActivityLog } from "../../hooks/useActivityLog";
import LogEntry from "./LogEntry";
import LogFilters from "./LogFilters";
import LogPagination from "./LogPagination";

interface ActivityLogProps {
  companyId: string;
}

export default function ActivityLog({ companyId }: ActivityLogProps) {
  const { data, isLoading, isError, filters, setFilters } =
    useActivityLog(companyId);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        data-testid="loading"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center p-12 text-center"
        data-testid="error"
      >
        <i className="bx bx-error-circle text-4xl text-red-500 mb-2"></i>
        <p className="text-sm text-gray-600">Failed to load activity log</p>
      </div>
    );
  }

  const activities = data?.activities || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-4" data-testid="activity-log">
      <LogFilters
        filters={filters}
        onFilterChange={(newFilters) =>
          setFilters((prev) => ({ ...prev, ...newFilters }))
        }
      />

      {activities.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-center"
          data-testid="empty"
        >
          <i className="bx bx-history text-4xl text-gray-400 mb-2"></i>
          <p className="text-sm text-gray-600">No activity found</p>
          <p className="text-xs text-gray-500 mt-1">
            Activity will appear here as changes are made
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-200" data-testid="activity-list">
            {activities.map((activity) => (
              <LogEntry key={activity.id} activity={activity} />
            ))}
          </div>

          <LogPagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </>
      )}
    </div>
  );
}
