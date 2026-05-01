import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "../../ui/Button";
import Modal from "../Modal";

type SetPasswordModalProps = {
  open: boolean;
  // Legacy: will be called when only password is needed
  onConfirm?: (password: string) => void;
  // New: full values including schedule and timezone
  onConfirmValues?: (values: {
    passwordActivated: boolean;
    password?: string;
    timezone: string;
    weekdayPassword: boolean;
    weekdayPasswordTimeStart?: string;
    weekdayPasswordTimeEnd?: string;
    weekendPassword: boolean;
    weekendPasswordTimeStart?: string;
    weekendPasswordTimeEnd?: string;
  }) => void;
  onClose: () => void;
  /** Optional explicit title. If omitted, falls back to `Set Password` */
  title?: string;
  /** Base singular label used to compose default subtitle when `subtitle` not provided */
  subjectLabel?: string;
  /** Optional count to drive pluralization in default subtitle */
  selectedCount?: number;
  /** Optional explicit subtitle node. If omitted and subjectLabel is provided, a default is composed. */
  subtitle?: ReactNode;
  /** Minimum password length; default 6 */
  minLength?: number;
  /** Require confirm field and equality; default true */
  requireConfirm?: boolean;
  /** Button labels */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional input labels/placeholders */
  passwordLabel?: string;
  confirmPasswordLabel?: string;
  passwordPlaceholder?: string;
  confirmPasswordPlaceholder?: string;
  /** Modal size; defaults to lg */
  size?: "sm" | "md" | "lg" | "xl";
  /** Initial values for editing existing password */
  initialPasswordActivated?: boolean;
  initialPassword?: string;
  initialTimezone?: string;
  initialWeekdayPassword?: boolean;
  initialWeekdayPasswordTimeStart?: string;
  initialWeekdayPasswordTimeEnd?: string;
  initialWeekendPassword?: boolean;
  initialWeekendPasswordTimeStart?: string;
  initialWeekendPasswordTimeEnd?: string;
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
};

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

/** Strip legacy bcrypt hashes that cannot be displayed as plaintext. */
function sanitizeInitialPassword(value?: string): string {
  if (!value) return "";
  // bcrypt hashes start with '$2' and are ~60 chars – they cannot be reversed
  if (value.startsWith("$2")) return "";
  return value;
}

/** Determine whether saved schedule values represent "always" (24/7) or a custom schedule. */
function detectScheduleMode(
  weekdayPassword?: boolean,
  weekendPassword?: boolean,
  weekdayStart?: string,
  weekdayEnd?: string,
  weekendStart?: string,
  weekendEnd?: string,
): "always" | "scheduled" {
  if (!weekdayPassword && !weekendPassword) return "always";
  if (
    weekdayPassword &&
    weekendPassword &&
    weekdayStart === "00:00" &&
    weekdayEnd === "23:59" &&
    weekendStart === "00:00" &&
    weekendEnd === "23:59"
  ) {
    return "always";
  }
  return "scheduled";
}

function getTimezoneOptions(currentTimezone: string): string[] {
  let zones: string[] = [];
  try {
    zones =
      (
        Intl as unknown as {
          supportedValuesOf?: (type: string) => string[];
        }
      ).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }

  if (zones.length === 0) {
    return currentTimezone ? [currentTimezone] : ["UTC"];
  }
  if (currentTimezone && !zones.includes(currentTimezone)) {
    return [currentTimezone, ...zones];
  }
  return zones;
}

/** Reusable toggle switch component */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
  srOnly = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  srOnly?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
        checked ? "bg-yellow-500" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className={srOnly ? "sr-only" : "sr-only"}>{label}</span>
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SetPasswordModal(props: SetPasswordModalProps) {
  const {
    open,
    onConfirm,
    onConfirmValues,
    onClose,
    title: titleProp,
    subjectLabel,
    selectedCount,
    subtitle,
    minLength = 6,
    requireConfirm = true,
    confirmLabel: confirmLabelProp,
    cancelLabel = "Cancel",
    passwordLabel = "New Password",
    confirmPasswordLabel = "Confirm Password",
    passwordPlaceholder = `Enter a password (min ${minLength} characters)`,
    confirmPasswordPlaceholder = "Re-enter the password",
    size = "lg",
    initialPasswordActivated,
    initialPassword,
    initialTimezone,
    initialWeekdayPassword,
    initialWeekdayPasswordTimeStart,
    initialWeekdayPasswordTimeEnd,
    initialWeekendPassword,
    initialWeekendPasswordTimeStart,
    initialWeekendPasswordTimeEnd,
    isLoading = false,
    loadingLabel = "Saving…",
  } = props;

  // Auto-detect whether we are editing an existing password configuration
  const isEditing = initialPasswordActivated === true;
  // Legacy bcrypt hashes start with '$2' and cannot be decrypted for display
  const isLegacyHash =
    isEditing &&
    typeof initialPassword === "string" &&
    initialPassword.startsWith("$2");
  const title = titleProp ?? (isEditing ? "Update Password" : "Set Password");
  const confirmLabel =
    confirmLabelProp ?? (isEditing ? "Update Password" : "Set Password");

  const [activated, setActivated] = useState<boolean>(
    initialPasswordActivated ?? false,
  );
  const [password, setPassword] = useState<string>(
    sanitizeInitialPassword(initialPassword),
  );
  const [confirm, setConfirm] = useState<string>(
    sanitizeInitialPassword(initialPassword),
  );
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timezone, setTimezone] = useState<string>(initialTimezone ?? "");
  const [scheduleMode, setScheduleMode] = useState<"always" | "scheduled">(
    detectScheduleMode(
      initialWeekdayPassword,
      initialWeekendPassword,
      initialWeekdayPasswordTimeStart,
      initialWeekdayPasswordTimeEnd,
      initialWeekendPasswordTimeStart,
      initialWeekendPasswordTimeEnd,
    ),
  );
  const [scheduleExpanded, setScheduleExpanded] = useState<boolean>(true);
  const [weekdayEnabled, setWeekdayEnabled] = useState<boolean>(
    initialWeekdayPassword ?? false,
  );
  const [weekendEnabled, setWeekendEnabled] = useState<boolean>(
    initialWeekendPassword ?? false,
  );
  const [weekdayStart, setWeekdayStart] = useState<string>(
    initialWeekdayPasswordTimeStart ?? "08:00",
  );
  const [weekdayEnd, setWeekdayEnd] = useState<string>(
    initialWeekdayPasswordTimeEnd ?? "17:00",
  );
  const [weekendStart, setWeekendStart] = useState<string>(
    initialWeekendPasswordTimeStart ?? "00:00",
  );
  const [weekendEnd, setWeekendEnd] = useState<string>(
    initialWeekendPasswordTimeEnd ?? "23:59",
  );
  useEffect(() => {
    // Initialize/reset form when modal opens
    if (open) {
      // Set timezone from initial value or browser default
      if (initialTimezone) {
        setTimezone(initialTimezone);
      } else {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTimezone(tz || "UTC");
        } catch {
          setTimezone("UTC");
        }
      }

      // Reset all form fields with initial values
      setActivated(initialPasswordActivated ?? false);
      const cleanPw = sanitizeInitialPassword(initialPassword);
      setPassword(cleanPw);
      setConfirm(cleanPw);
      setWeekdayEnabled(initialWeekdayPassword ?? false);
      setWeekendEnabled(initialWeekendPassword ?? false);
      setWeekdayStart(initialWeekdayPasswordTimeStart ?? "08:00");
      setWeekdayEnd(initialWeekdayPasswordTimeEnd ?? "17:00");
      setWeekendStart(initialWeekendPasswordTimeStart ?? "00:00");
      setWeekendEnd(initialWeekendPasswordTimeEnd ?? "23:59");
      setScheduleMode(
        detectScheduleMode(
          initialWeekdayPassword,
          initialWeekendPassword,
          initialWeekdayPasswordTimeStart,
          initialWeekdayPasswordTimeEnd,
          initialWeekendPasswordTimeStart,
          initialWeekendPasswordTimeEnd,
        ),
      );
      setError(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [
    open,
    initialPasswordActivated,
    initialPassword,
    initialTimezone,
    initialWeekdayPassword,
    initialWeekdayPasswordTimeStart,
    initialWeekdayPasswordTimeEnd,
    initialWeekendPassword,
    initialWeekendPasswordTimeStart,
    initialWeekendPasswordTimeEnd,
  ]);

  const canSubmit = useMemo(() => {
    if (!activated) return true; // Allow deactivation without valid password
    const longEnough = password.length >= minLength;
    if (!requireConfirm) return longEnough;
    return longEnough && password === confirm;
  }, [activated, password, confirm, minLength, requireConfirm]);
  const timezoneOptions = useMemo(
    () => getTimezoneOptions(timezone),
    [timezone],
  );

  function handleConfirm() {
    if (!activated) {
      setError(null);
      if (onConfirmValues) {
        onConfirmValues({
          passwordActivated: false,
          timezone,
          weekdayPassword: false,
          weekdayPasswordTimeStart: undefined,
          weekdayPasswordTimeEnd: undefined,
          weekendPassword: false,
          weekendPasswordTimeStart: undefined,
          weekendPasswordTimeEnd: undefined,
        });
      } else if (onConfirm) {
        onConfirm("");
      }
      return;
    }
    if (!canSubmit) {
      const msg = !requireConfirm
        ? `Password must be at least ${minLength} characters.`
        : password !== confirm
          ? "Passwords do not match."
          : `Password must be at least ${minLength} characters.`;
      setError(msg);
      return;
    }
    setError(null);
    if (onConfirmValues) {
      // When "always" mode, enable both weekday and weekend with full-day windows (00:00-23:59)
      // When "scheduled" mode, use the user-configured schedule
      const isAlways = scheduleMode === "always";
      const useSchedule = scheduleMode === "scheduled";
      onConfirmValues({
        passwordActivated: activated,
        password,
        timezone,
        weekdayPassword: isAlways || (useSchedule && weekdayEnabled),
        weekdayPasswordTimeStart: isAlways
          ? "00:00"
          : useSchedule && weekdayEnabled
            ? weekdayStart
            : undefined,
        weekdayPasswordTimeEnd: isAlways
          ? "23:59"
          : useSchedule && weekdayEnabled
            ? weekdayEnd
            : undefined,
        weekendPassword: isAlways || (useSchedule && weekendEnabled),
        weekendPasswordTimeStart: isAlways
          ? "00:00"
          : useSchedule && weekendEnabled
            ? weekendStart
            : undefined,
        weekendPasswordTimeEnd: isAlways
          ? "23:59"
          : useSchedule && weekendEnabled
            ? weekendEnd
            : undefined,
      });
    } else if (onConfirm) {
      onConfirm(password);
    }
  }

  const computedSubtitle: ReactNode =
    subtitle ??
    (subjectLabel && typeof selectedCount === "number" ? (
      <span>
        Apply a password to {selectedCount} selected{" "}
        {pluralize(subjectLabel, selectedCount)}.
      </span>
    ) : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={computedSubtitle}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              isLoading ? "bx bx-loader-alt bx-spin" : "bx bx-lock-alt"
            }
            onClick={handleConfirm}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
      size={size}
      scrollable
    >
      <div className="space-y-6">
        {/* Existing password indicator */}
        {isEditing && !isLegacyHash && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
            <i className="bx bx-info-circle text-base flex-shrink-0" />
            <span>
              Password protection is already configured. You can update the
              settings below.
            </span>
          </div>
        )}
        {isLegacyHash && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
            <i className="bx bx-info-circle text-base flex-shrink-0" />
            <span>
              Your existing password could not be retrieved. Please enter a new
              password to continue using password protection.
            </span>
          </div>
        )}

        {/* Activate Password Protection Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              Password Protection
            </span>
            <span className="text-xs text-gray-500">
              Require a password to access protected content
            </span>
          </div>
          <Toggle
            checked={activated}
            onChange={setActivated}
            label="Activate password protection"
            srOnly
          />
        </div>

        {/* Password Fields */}
        <div
          className={`grid transition-all duration-300 ease-out ${
            activated
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="set-password-input"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {passwordLabel}
                </label>
                <div className="relative">
                  <input
                    id="set-password-input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border-gray-300 pr-10 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                    placeholder={passwordPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center mr-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-0"
                  >
                    <i
                      className={`bx ${showPassword ? "bx-hide" : "bx-show"} text-xl`}
                    ></i>
                  </button>
                </div>
              </div>
              {requireConfirm && (
                <div>
                  <label
                    htmlFor="confirm-password-input"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {confirmPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="block w-full rounded-md border-gray-300 pr-10 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                      placeholder={confirmPasswordPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 flex items-center mr-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-0"
                    >
                      <i
                        className={`bx ${showConfirmPassword ? "bx-hide" : "bx-show"} text-xl`}
                      ></i>
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Mode Selection */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  When is the password required?
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode("always")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      scheduleMode === "always"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <i
                        className={`bx bx-lock-alt text-lg ${
                          scheduleMode === "always"
                            ? "text-yellow-600"
                            : "text-gray-400"
                        }`}
                      />
                      <span>Always</span>
                    </div>
                    <p className="text-xs mt-1 text-gray-500">
                      Password required 24/7
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode("scheduled")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      scheduleMode === "scheduled"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <i
                        className={`bx bx-time text-lg ${
                          scheduleMode === "scheduled"
                            ? "text-yellow-600"
                            : "text-gray-400"
                        }`}
                      />
                      <span>Scheduled</span>
                    </div>
                    <p className="text-xs mt-1 text-gray-500">
                      Only during set hours
                    </p>
                  </button>
                </div>
              </div>

              {/* Schedule Configuration Accordion */}
              <div
                className={`grid transition-all duration-300 ease-out ${
                  scheduleMode === "scheduled"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setScheduleExpanded(!scheduleExpanded)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <i className="bx bx-calendar text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          Schedule Settings
                        </span>
                      </div>
                      <i
                        className={`bx bx-chevron-down text-lg text-gray-500 transition-transform duration-200 ${
                          scheduleExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        scheduleExpanded
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="p-4 space-y-5 border-t border-gray-200 bg-white">
                          {/* Timezone */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Timezone
                            </label>
                            <select
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                            >
                              {timezoneOptions.map((z) => (
                                <option key={z} value={z}>
                                  {z}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Weekday Schedule */}
                          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <i className="bx bx-briefcase text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  Weekdays
                                </span>
                                <span className="text-xs text-gray-400">
                                  (Mon - Fri)
                                </span>
                              </div>
                              <Toggle
                                checked={weekdayEnabled}
                                onChange={setWeekdayEnabled}
                                label="Enable weekday schedule"
                                srOnly
                              />
                            </div>
                            <div
                              className={`grid transition-all duration-200 ease-out ${
                                weekdayEnabled
                                  ? "grid-rows-[1fr] opacity-100 mt-3"
                                  : "grid-rows-[0fr] opacity-0 mt-0"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-3 pl-6">
                                  <span className="text-sm text-gray-600">
                                    From
                                  </span>
                                  <input
                                    type="time"
                                    value={weekdayStart}
                                    onChange={(e) =>
                                      setWeekdayStart(e.target.value)
                                    }
                                    className="rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                                  />
                                  <span className="text-sm text-gray-600">
                                    to
                                  </span>
                                  <input
                                    type="time"
                                    value={weekdayEnd}
                                    onChange={(e) =>
                                      setWeekdayEnd(e.target.value)
                                    }
                                    className="rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Weekend Schedule */}
                          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <i className="bx bx-sun text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  Weekends
                                </span>
                                <span className="text-xs text-gray-400">
                                  (Sat - Sun)
                                </span>
                              </div>
                              <Toggle
                                checked={weekendEnabled}
                                onChange={setWeekendEnabled}
                                label="Enable weekend schedule"
                                srOnly
                              />
                            </div>
                            <div
                              className={`grid transition-all duration-200 ease-out ${
                                weekendEnabled
                                  ? "grid-rows-[1fr] opacity-100 mt-3"
                                  : "grid-rows-[0fr] opacity-0 mt-0"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-3 pl-6">
                                  <span className="text-sm text-gray-600">
                                    From
                                  </span>
                                  <input
                                    type="time"
                                    value={weekendStart}
                                    onChange={(e) =>
                                      setWeekendStart(e.target.value)
                                    }
                                    className="rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                                  />
                                  <span className="text-sm text-gray-600">
                                    to
                                  </span>
                                  <input
                                    type="time"
                                    value={weekendEnd}
                                    onChange={(e) =>
                                      setWeekendEnd(e.target.value)
                                    }
                                    className="rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Helper text */}
                          <div
                            className={`grid transition-all duration-200 ease-out ${
                              !weekdayEnabled && !weekendEnabled
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md flex items-center gap-2">
                                <i className="bx bx-info-circle" />
                                Enable at least one schedule to require password
                                during specific hours
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md flex items-center gap-2">
            <i className="bx bx-error-circle" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
