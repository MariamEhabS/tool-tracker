import {
  formatActivityTimestamp,
  getActivityIcon,
  getActivityIconColor,
} from "../../utils/settingsFormatters";
import { Activity } from "../../hooks/useActivityLog";

interface LogEntryProps {
  activity: Activity;
}

export default function LogEntry({ activity }: LogEntryProps) {
  const icon = getActivityIcon(activity.action);
  const iconColor = getActivityIconColor(activity.action);

  return (
    <div
      className="flex items-start gap-3 py-3 px-2 hover:bg-gray-50 transition-colors rounded-md"
      data-testid={`log-entry-${activity.id}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconColor}`}
        data-testid={`log-icon-${activity.id}`}
      >
        <i className={`bx ${icon} text-lg`}></i>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          <span className="font-medium" data-testid={`log-user-${activity.id}`}>
            {activity.userName}
          </span>{" "}
          <span data-testid={`log-description-${activity.id}`}>
            {activity.description}
          </span>
        </p>
        <p
          className="text-xs text-gray-500 mt-0.5"
          data-testid={`log-timestamp-${activity.id}`}
        >
          {formatActivityTimestamp(activity.timestamp)}
        </p>
      </div>
    </div>
  );
}
