import type { ReactNode } from "react";
import type {
  ToolTrackerIdentification,
  ToolTrackerLoanPeriod,
  ToolTrackerPinMode,
  ToolTrackerRules,
} from "@/components/create-qr/toolTracker/types";

/**
 * Reusable Tool Tracker rules editor — the four rule cards (Identification,
 * Handoffs, Due Dates, PIN) extracted from the Stage 4 ToolTrackerRules
 * screen so the Stage 6 detail-page Settings panel can render the same
 * controls without duplicating any logic. Pure controlled component.
 *
 * The wrapper component (Stage 4 Rules screen, Stage 6 Settings panel) is
 * responsible for header, footer, and submit semantics.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_RULES: ToolTrackerRules = {
  identification: "name_phone",
  allowHandoffs: true,
  trackDueDates: false,
  defaultLoanPeriod: "1d",
  pinEnabled: false,
};

const IDENTIFICATION_OPTIONS: Array<{
  value: ToolTrackerIdentification;
  label: string;
  sub: string;
}> = [
  { value: "name", label: "Name only", sub: "First and last name." },
  {
    value: "name_phone",
    label: "Name and phone number",
    sub: "Recommended. We'll remember the number on their device so they only type it once.",
  },
  {
    value: "login",
    label: "Taliho account required",
    sub: "Most secure. Only works if the tech has a Taliho login.",
  },
];

const LOAN_PERIOD_OPTIONS: Array<{
  value: ToolTrackerLoanPeriod;
  label: string;
}> = [
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "custom", label: "Custom…" },
];

const PIN_MODE_OPTIONS: Array<{
  value: ToolTrackerPinMode;
  label: string;
  sub: string;
}> = [
  {
    value: "smart",
    label: "Smart PIN (recommended)",
    sub: "Tech types the last 4 of their phone number. We silently verify against the full number stored on their device, or capture it on first scan. Yields a verified phone per sign-out and adds zero friction for returning techs.",
  },
  {
    value: "custom",
    label: "Custom PIN",
    sub: "You set a 4-digit PIN. Same PIN applies to every tool in this batch. Less secure than Smart PIN but useful when you don't want phone-number capture.",
  },
];

interface ToolTrackerRulesEditorProps {
  rules: ToolTrackerRules;
  onChange: (next: ToolTrackerRules) => void;
  /** Optional disabled flag — when true, all controls become non-interactive. */
  disabled?: boolean;
}

export default function ToolTrackerRulesEditor({
  rules,
  onChange,
  disabled = false,
}: ToolTrackerRulesEditorProps) {
  const update = (patch: Partial<ToolTrackerRules>) =>
    onChange({ ...rules, ...patch });

  return (
    <div className="space-y-3" data-testid="tool-tracker-rules-editor">
      <RuleCard
        icon="bx bx-group"
        title="What field techs provide at sign-out"
        description="Field techs don't need a Taliho account to scan. Pick what they must enter before a sign-out goes through."
        testId="rule-identification"
      >
        <div className="space-y-2 mt-3">
          {IDENTIFICATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${
                rules.identification === opt.value
                  ? "border-brand-500 bg-brand-50/40"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
              data-testid={`rule-identification-${opt.value}`}
            >
              <input
                type="radio"
                name="rule-identification"
                checked={rules.identification === opt.value}
                onChange={() => update({ identification: opt.value })}
                disabled={disabled}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {opt.label}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </RuleCard>

      <RuleCard
        icon="bx bxs-shield"
        title="Allow field-to-field handoffs"
        description="If on, one tech can scan and take a tool even if another tech has it out — the previous holder is notified. If off, the tool must be signed back in first."
        testId="rule-handoffs"
        toggle={
          <Toggle
            on={rules.allowHandoffs}
            onChange={(v) => update({ allowHandoffs: v })}
            testId="rule-handoffs-toggle"
            label="Allow field-to-field handoffs"
            disabled={disabled}
          />
        }
      />

      <RuleCard
        icon="bx bx-time-five"
        title="Track due dates"
        description="Set a default loan period. We'll notify the borrower and the PM if a tool goes overdue."
        testId="rule-due-dates"
        toggle={
          <Toggle
            on={rules.trackDueDates}
            onChange={(v) => update({ trackDueDates: v })}
            testId="rule-due-dates-toggle"
            label="Track due dates"
            disabled={disabled}
          />
        }
      >
        {rules.trackDueDates && (
          <div
            className="mt-3 flex items-center gap-3"
            data-testid="rule-due-dates-options"
          >
            <label className="text-sm text-gray-700" htmlFor="loan-period">
              Default loan period:
            </label>
            <select
              id="loan-period"
              value={rules.defaultLoanPeriod}
              onChange={(e) =>
                update({
                  defaultLoanPeriod: e.target.value as ToolTrackerLoanPeriod,
                })
              }
              disabled={disabled}
              data-testid="rule-loan-period-select"
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500 disabled:opacity-60"
            >
              {LOAN_PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </RuleCard>

      <RuleCard
        icon="bx bxs-lock"
        title="Require a PIN to scan"
        description="Useful for high-value tools. Techs enter a 4-digit PIN before they can sign out."
        testId="rule-pin"
        toggle={
          <Toggle
            on={rules.pinEnabled}
            onChange={(v) =>
              update({
                pinEnabled: v,
                // When toggling on, default to Smart PIN (PRD §6.4).
                pinMode: v ? (rules.pinMode ?? "smart") : rules.pinMode,
              })
            }
            testId="rule-pin-toggle"
            label="Require a PIN"
            disabled={disabled}
          />
        }
      >
        {rules.pinEnabled && (
          <div className="mt-3 space-y-2" data-testid="rule-pin-options">
            {PIN_MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                } ${
                  rules.pinMode === opt.value
                    ? "border-brand-500 bg-brand-50/40"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                data-testid={`rule-pin-${opt.value}`}
              >
                <input
                  type="radio"
                  name="rule-pin-mode"
                  checked={rules.pinMode === opt.value}
                  onChange={() => update({ pinMode: opt.value })}
                  disabled={disabled}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {opt.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">{opt.sub}</div>
                </div>
              </label>
            ))}
            {rules.pinMode === "custom" && (
              <div
                className="mt-2 flex items-center gap-3"
                data-testid="rule-pin-custom-row"
              >
                <label
                  className="text-sm text-gray-700"
                  htmlFor="custom-pin-input"
                >
                  PIN:
                </label>
                <input
                  id="custom-pin-input"
                  inputMode="numeric"
                  value={rules.customPin ?? ""}
                  onChange={(e) =>
                    update({
                      customPin: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  placeholder="4 digits"
                  disabled={disabled}
                  data-testid="rule-pin-custom-input"
                  className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-28 focus:outline-none focus:border-brand-500 disabled:opacity-60"
                />
              </div>
            )}
          </div>
        )}
      </RuleCard>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface RuleCardProps {
  icon: string;
  title: string;
  description: string;
  toggle?: ReactNode;
  children?: ReactNode;
  testId: string;
}

function RuleCard({
  icon,
  title,
  description,
  toggle,
  children,
  testId,
}: RuleCardProps) {
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 transition hover:shadow-md"
      data-testid={testId}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shadow-inner">
          <i className={`${icon} text-lg`} aria-hidden />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium text-gray-900">{title}</div>
              <div className="text-sm text-gray-600 mt-1">{description}</div>
            </div>
            {toggle && <div className="pt-0.5">{toggle}</div>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
  testId: string;
  label: string;
  disabled?: boolean;
}

function Toggle({ on, onChange, testId, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 disabled:cursor-not-allowed ${
        on ? "bg-brand-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
