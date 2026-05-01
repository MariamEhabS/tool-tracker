import {
  ActivityLogFilters,
  ActivityActionEnum,
  ActivityCategoryEnum,
} from "../../hooks/useActivityLog";

interface LogFiltersProps {
  filters: ActivityLogFilters;
  onFilterChange: (filters: Partial<ActivityLogFilters>) => void;
  users?: Array<{ id: string; name: string }>;
}

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: ActivityCategoryEnum.USERS, label: "Users" },
  { value: ActivityCategoryEnum.SETTINGS, label: "Settings" },
  { value: ActivityCategoryEnum.SECURITY, label: "Security" },
  { value: ActivityCategoryEnum.INTEGRATIONS, label: "Integrations" },
];

const actionOptions = [
  { value: "all", label: "All Actions" },
  // User management
  { value: ActivityActionEnum.USER_INVITED, label: "User Invited" },
  { value: ActivityActionEnum.USER_REMOVED, label: "User Removed" },
  { value: ActivityActionEnum.USER_ACTIVATED, label: "User Activated" },
  { value: ActivityActionEnum.USER_DEACTIVATED, label: "User Deactivated" },
  { value: ActivityActionEnum.ROLE_CHANGED, label: "Role Changed" },
  // Settings
  { value: ActivityActionEnum.SETTINGS_UPDATED, label: "Settings Updated" },
  { value: ActivityActionEnum.LOGO_CHANGED, label: "Logo Changed" },
  { value: ActivityActionEnum.COMPANY_INFO_UPDATED, label: "Company Updated" },
  // Security
  { value: ActivityActionEnum.PASSWORD_CHANGED, label: "Password Changed" },
  { value: ActivityActionEnum.EMAIL_CHANGED, label: "Email Changed" },
  {
    value: ActivityActionEnum.TWO_FACTOR_ENABLED,
    label: "2FA Enabled",
  },
  {
    value: ActivityActionEnum.TWO_FACTOR_DISABLED,
    label: "2FA Disabled",
  },
  { value: ActivityActionEnum.LOGIN_SUCCESS, label: "Login Success" },
  { value: ActivityActionEnum.LOGIN_FAILED, label: "Login Failed" },
  { value: ActivityActionEnum.LOGOUT, label: "Logout" },
  // Integrations
  { value: ActivityActionEnum.PROCORE_CONNECTED, label: "Procore Connected" },
  {
    value: ActivityActionEnum.PROCORE_DISCONNECTED,
    label: "Procore Disconnected",
  },
  {
    value: ActivityActionEnum.PROCORE_SYNC_STARTED,
    label: "Procore Sync Started",
  },
  {
    value: ActivityActionEnum.PROCORE_SYNC_COMPLETED,
    label: "Procore Sync Completed",
  },
  {
    value: ActivityActionEnum.STRIPE_SUBSCRIPTION_CREATED,
    label: "Subscription Created",
  },
  {
    value: ActivityActionEnum.STRIPE_SUBSCRIPTION_UPDATED,
    label: "Subscription Updated",
  },
  {
    value: ActivityActionEnum.STRIPE_SUBSCRIPTION_CANCELLED,
    label: "Subscription Cancelled",
  },
];

const dateRangeOptions = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function LogFilters({
  filters,
  onFilterChange,
  users = [],
}: LogFiltersProps) {
  const hasActiveFilters =
    filters.category !== "all" ||
    filters.action !== "all" ||
    filters.userId !== "all" ||
    filters.dateRange !== "30";

  const handleReset = () => {
    onFilterChange({
      category: "all",
      action: "all",
      userId: "all",
      dateRange: "30",
      page: 1,
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
      data-testid="log-filters"
    >
      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs text-gray-600 mb-1">Category</label>
        <select
          value={filters.category}
          onChange={(e) =>
            onFilterChange({ category: e.target.value, page: 1 })
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="filter-category"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs text-gray-600 mb-1">Action</label>
        <select
          value={filters.action}
          onChange={(e) => onFilterChange({ action: e.target.value, page: 1 })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="filter-action"
        >
          {actionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs text-gray-600 mb-1">User</label>
        <select
          value={filters.userId}
          onChange={(e) => onFilterChange({ userId: e.target.value, page: 1 })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="filter-user"
        >
          <option value="all">All Users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs text-gray-600 mb-1">Date Range</label>
        <select
          value={filters.dateRange}
          onChange={(e) =>
            onFilterChange({ dateRange: e.target.value, page: 1 })
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="filter-date-range"
        >
          {dateRangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <div className="flex items-end">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
            data-testid="reset-filters"
          >
            <i className="bx bx-reset"></i>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
