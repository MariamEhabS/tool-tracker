import { useMemo } from "react";
import { ToggleGroup, type ToggleItem } from "./ToggleGroup";
import {
  useNotificationPrefs,
  type NotificationPreferences as NotificationPrefsType,
} from "../../hooks/useNotificationPrefs";

interface NotificationPreferencesProps {
  userId: string;
  companyId: string;
}

const FREQUENCY_OPTIONS = [
  { value: "immediate", label: "Immediate (as they happen)" },
  { value: "daily", label: "Daily Digest (8:00 AM)" },
  { value: "weekly", label: "Weekly Summary (Monday 8:00 AM)" },
] as const;

export function NotificationPreferences({
  userId,
  companyId,
}: NotificationPreferencesProps) {
  const {
    data,
    isLoading,
    isError,
    isUpdating,
    toggleEmailPref,
    togglePushPref,
    updateFrequency,
    toggleQuietHours,
    updateQuietHours,
  } = useNotificationPrefs(userId, companyId);

  const emailToggleItems: ToggleItem[] = useMemo(
    () => [
      {
        id: "projectUpdates",
        label: "Project Updates",
        description: "Notifications about project changes and milestones",
        icon: <i className="bx bx-folder text-xl text-blue-600" />,
        iconBgColor: "bg-blue-100",
        checked: data?.email?.projectUpdates ?? true,
      },
      {
        id: "inspectionReminders",
        label: "Inspection Reminders",
        description: "Reminders for upcoming inspections",
        icon: <i className="bx bx-calendar-check text-xl text-amber-600" />,
        iconBgColor: "bg-amber-100",
        checked: data?.email?.inspectionReminders ?? true,
      },
      {
        id: "documentUploads",
        label: "Document Uploads",
        description: "Notifications when new documents are uploaded",
        icon: <i className="bx bx-file text-xl text-green-600" />,
        iconBgColor: "bg-green-100",
        checked: data?.email?.documentUploads ?? true,
      },
      {
        id: "teamActivity",
        label: "Team Activity",
        description: "Updates on team member actions and changes",
        icon: <i className="bx bx-group text-xl text-purple-600" />,
        iconBgColor: "bg-purple-100",
        checked: data?.email?.teamActivity ?? true,
      },
      {
        id: "weeklyDigest",
        label: "Weekly Digest",
        description: "Summary of QR scans, uploads, and activity",
        icon: <i className="bx bx-bar-chart-alt-2 text-xl text-indigo-600" />,
        iconBgColor: "bg-indigo-100",
        checked: data?.email?.weeklyDigest ?? true,
      },
    ],
    [data?.email],
  );

  const pushToggleItems: ToggleItem[] = useMemo(
    () => [
      {
        id: "projectUpdates",
        label: "Project Updates",
        description: "Push notifications for project changes",
        icon: <i className="bx bx-folder text-xl text-blue-600" />,
        iconBgColor: "bg-blue-100",
        checked: data?.push?.projectUpdates ?? true,
      },
      {
        id: "inspectionReminders",
        label: "Inspection Reminders",
        description: "Push reminders for upcoming inspections",
        icon: <i className="bx bx-calendar-check text-xl text-amber-600" />,
        iconBgColor: "bg-amber-100",
        checked: data?.push?.inspectionReminders ?? true,
      },
      {
        id: "documentUploads",
        label: "Document Uploads",
        description: "Push notifications for new documents",
        icon: <i className="bx bx-file text-xl text-green-600" />,
        iconBgColor: "bg-green-100",
        checked: data?.push?.documentUploads ?? true,
      },
      {
        id: "teamActivity",
        label: "Team Activity",
        description: "Push updates on team member actions",
        icon: <i className="bx bx-group text-xl text-purple-600" />,
        iconBgColor: "bg-purple-100",
        checked: data?.push?.teamActivity ?? true,
      },
    ],
    [data?.push],
  );

  const handleEmailToggle = (id: string, _checked: boolean) => {
    // The hook handles the toggle internally
    toggleEmailPref(id as keyof NotificationPrefsType["email"]);
  };

  const handlePushToggle = (id: string, _checked: boolean) => {
    togglePushPref(id as keyof NotificationPrefsType["push"]);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const frequency = e.target.value as NotificationPrefsType["frequency"];
    updateFrequency(frequency);
  };

  const handleQuietHoursToggle = () => {
    toggleQuietHours();
  };

  const handleQuietHoursStartChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updateQuietHours(e.target.value, data?.quietHoursEnd ?? "08:00");
  };

  const handleQuietHoursEndChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updateQuietHours(data?.quietHoursStart ?? "22:00", e.target.value);
  };

  if (isLoading) {
    return (
      <div
        data-testid="notification-prefs-loading"
        className="animate-pulse space-y-4"
      >
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="notification-prefs-error" className="text-red-600">
        Failed to load notification preferences
      </div>
    );
  }

  return (
    <div data-testid="notification-preferences">
      <div className="space-y-8">
        {/* Email Notifications Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            Email Notifications
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Choose which email notifications you'd like to receive
          </p>
          <ToggleGroup
            items={emailToggleItems}
            disabled={isUpdating}
            onToggle={handleEmailToggle}
          />
        </div>

        {/* Push Notifications Section */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            Push Notifications
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Choose which push notifications you'd like to receive
          </p>
          <ToggleGroup
            items={pushToggleItems}
            disabled={isUpdating}
            onToggle={handlePushToggle}
          />
        </div>

        {/* Frequency Selection */}
        <div className="pt-4 border-t border-gray-200">
          <label
            htmlFor="frequency"
            className="block text-sm font-medium text-gray-700"
          >
            Notification Frequency
          </label>
          <p className="text-sm text-gray-500 mb-2">
            How often would you like to receive notification summaries?
          </p>
          <select
            id="frequency"
            value={data?.frequency ?? "immediate"}
            onChange={handleFrequencyChange}
            disabled={isUpdating}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
            data-testid="frequency-select"
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quiet Hours Section */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Quiet Hours</h4>
              <p className="text-sm text-gray-500">
                Pause notifications during specific hours
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data?.quietHoursEnabled ?? false}
              onClick={handleQuietHoursToggle}
              disabled={isUpdating}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                data?.quietHoursEnabled ? "bg-brand-600" : "bg-gray-200"
              } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid="toggle-switch-quietHours"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  data?.quietHoursEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {data?.quietHoursEnabled && (
            <div className="flex items-center gap-4 ml-0">
              <div>
                <label
                  htmlFor="quietHoursStart"
                  className="block text-xs text-gray-500"
                >
                  Start
                </label>
                <input
                  type="time"
                  id="quietHoursStart"
                  value={data?.quietHoursStart ?? "22:00"}
                  onChange={handleQuietHoursStartChange}
                  disabled={isUpdating}
                  className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                  data-testid="quiet-hours-start"
                />
              </div>
              <span className="text-gray-500 mt-5">to</span>
              <div>
                <label
                  htmlFor="quietHoursEnd"
                  className="block text-xs text-gray-500"
                >
                  End
                </label>
                <input
                  type="time"
                  id="quietHoursEnd"
                  value={data?.quietHoursEnd ?? "08:00"}
                  onChange={handleQuietHoursEndChange}
                  disabled={isUpdating}
                  className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                  data-testid="quiet-hours-end"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationPreferences;
