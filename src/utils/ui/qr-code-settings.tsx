/**
 * @fileoverview QR code settings panel component for managing password
 * protection, time-based schedules, and danger-zone actions.
 */

import { useState } from "react";
import { TrashCanIcon } from "../../assets/icons/TrashCanIcon";
import { TimeZoneDropDown } from "./time-zone-dropdown";

/**
 * Settings panel for an individual QR code. Provides password protection
 * with weekday/weekend time-based scheduling and a danger-zone delete action.
 */
export const QrCodeSettings = () => {
  const [requirePassword, setRequirePassword] = useState(false);
  const [weekdayScheduleEnabled, setWeekdayScheduleEnabled] = useState(false);
  const [weekendScheduleEnabled, setWeekendScheduleEnabled] = useState(false);
  const [passwordMatchError, setPasswordMatchError] = useState(false);
  const [formData, setFormData] = useState({
    timezone: "",
    weekday_start_time: "",
    weekday_end_time: "",
    weekend_start_time: "",
    weekend_end_time: "",
    password: "",
    confirm_password: "",
  });

  const togglePasswordRequirement = () => {
    setRequirePassword(!requirePassword);
  };

  const handleInputChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "password" || name === "confirm_password") {
      setPasswordMatchError(formData.password !== formData.confirm_password);
    }
  };

  const handleCheckboxChange = (e: {
    target: { name: string; checked: boolean };
  }) => {
    const { name, checked } = e.target;
    if (name === "weekday_schedule_enabled") {
      setWeekdayScheduleEnabled(checked);
    } else if (name === "weekend_schedule_enabled") {
      setWeekendScheduleEnabled(checked);
    }
  };

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (formData.password !== formData.confirm_password) {
      setPasswordMatchError(true);
      return;
    }
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
        Settings
      </h3>
      <div className="flex items-center justify-between mb-4">
        <span className="flex flex-grow flex-col">
          <span className="block text-sm font-medium text-gray-700">
            Require Password
          </span>
          <span className="text-sm text-gray-500">
            Enable time-based password protection for this QR code.
          </span>
        </span>
        <button
          type="button"
          onClick={togglePasswordRequirement}
          className={`relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${requirePassword ? "bg-yellow-500" : "bg-gray-200"}`}
          role="switch"
          aria-checked={requirePassword}
        >
          <span className="sr-only">Require Password</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${requirePassword ? "translate-x-5" : "translate-x-0"}`}
          ></span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`${requirePassword ? "block" : "hidden"} space-y-5 pt-4 mt-5 border-t border-gray-200`}
      >
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0"></div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Potential Password Override
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  A password may already be enforced by a parent group
                  (Arrangement, Equipment, or Project). If so, the group
                  password will take precedence over the settings configured
                  here.
                </p>
              </div>
            </div>
          </div>
        </div>

        <TimeZoneDropDown
          value={formData.timezone}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, timezone: value }))
          }
        />
        <fieldset className="space-y-2 border-t border-gray-200 pt-4">
          <div className="relative flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="weekday-schedule-toggle"
                name="weekday_schedule_enabled"
                type="checkbox"
                checked={weekdayScheduleEnabled}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="weekday-schedule-toggle"
                className="font-medium text-gray-700"
              >
                Require on Weekdays (Mon-Fri)
              </label>
            </div>
          </div>
          <div
            className={`${weekdayScheduleEnabled ? "grid" : "hidden"} grid-cols-2 gap-4 pl-7`}
          >
            <div>
              <label
                htmlFor="weekday-start-time"
                className="block text-xs font-medium text-gray-700"
              >
                Start Time
              </label>
              <input
                type="time"
                id="weekday-start-time"
                name="weekday_start_time"
                value={formData.weekday_start_time}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="weekday-end-time"
                className="block text-xs font-medium text-gray-700"
              >
                End Time
              </label>
              <input
                type="time"
                id="weekday-end-time"
                name="weekday_end_time"
                value={formData.weekday_end_time}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-2 border-t border-gray-200 pt-4">
          <div className="relative flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="weekend-schedule-toggle"
                name="weekend_schedule_enabled"
                type="checkbox"
                checked={weekendScheduleEnabled}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="weekend-schedule-toggle"
                className="font-medium text-gray-700"
              >
                Require on Weekends (Sat-Sun)
              </label>
            </div>
          </div>
          <div
            className={`${weekendScheduleEnabled ? "grid" : "hidden"} grid-cols-2 gap-4 pl-7`}
          >
            <div className="">
              <label
                htmlFor="weekend-start-time"
                className="block text-xs font-medium text-gray-700"
              >
                Start Time
              </label>
              <input
                type="time"
                id="weekend-start-time"
                name="weekend_start_time"
                value={formData.weekend_start_time}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="weekend-end-time"
                className="block text-xs font-medium text-gray-700"
              >
                End Time
              </label>
              <input
                type="time"
                id="weekend-end-time"
                name="weekend_end_time"
                value={formData.weekend_end_time}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>
          </div>
        </fieldset>

        <div className="border-t border-gray-200 pt-4">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            value={formData.password}
            onChange={handleInputChange}
            className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Password is required if protection is enabled.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700"
          >
            Confirm Password
          </label>
          <input
            type="password"
            id="confirm-password"
            name="confirm_password"
            required
            value={formData.confirm_password}
            onChange={handleInputChange}
            className="mt-1 block w-full px-2 py-1 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
          />
          {passwordMatchError && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setRequirePassword(false)}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition duration-150 ease-in-out active:scale-95 mr-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-yellow-500 py-1.5 px-3 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:outline-none data-[hover]:bg-yellow-500 data-[open]:bg-yellow-500 data-[focus]:outline-1 data-[focus]:outline-white transition duration-150 ease-in-out active:scale-95"
          >
            Save Password Settings
          </button>
        </div>
      </form>

      <div className="border-t border-gray-200 pt-5 mt-5">
        <h4 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h4>
        <p className="text-sm text-gray-500 mb-3">
          Deleting this QR code is permanent and cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => console.log("Delete QR code")}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100 active:scale-95 transition duration-150 ease-in-out"
        >
          <TrashCanIcon className="!size-4" />
          Delete QR Code
        </button>
      </div>
    </div>
  );
};
