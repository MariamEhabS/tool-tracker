import type { ToolTrackerLastMode } from "./toolTrackerCarryDraft";

export interface QuantityModeToggleProps {
  mode: ToolTrackerLastMode;
  onChange: (next: ToolTrackerLastMode) => void;
  /**
   * Prefix for `data-testid` attributes (`<prefix>-toggle`,
   * `<prefix>-single`, `<prefix>-bulk`). Default `"tool-tracker-mode"`
   * preserves the testIds expected by Tool Tracker tests; other v2
   * pages should pass their own prefix to keep selectors page-scoped.
   */
  testIdPrefix?: string;
}

/**
 * Segmented "Single | Bulk" control rendered at the top of v2 Create
 * pages that support both quantity modes (Tool Tracker, Procore
 * Drawing, etc.). Replaces the wizard's dedicated Quantity step —
 * users flip between modes inline without losing the current document
 * context.
 *
 * Visual style: gray pill track with a white active pill (Stripe / Linear /
 * iOS convention). Buttons are real `<button>` elements so they're keyboard
 * focusable and announce as toggle buttons to assistive tech.
 *
 * Reused across the v2 Create pages so Single↔Bulk consistently looks +
 * behaves the same on every page (Tool Tracker is the visual standard).
 */
export default function QuantityModeToggle({
  mode,
  onChange,
  testIdPrefix = "tool-tracker-mode",
}: QuantityModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Number of QR codes to create"
      className="inline-flex items-center bg-gray-100 rounded-lg p-0.5"
      data-testid={`${testIdPrefix}-toggle`}
    >
      <ModeButton
        active={mode === "single"}
        onClick={() => onChange("single")}
        testId={`${testIdPrefix}-single`}
      >
        Single
      </ModeButton>
      <ModeButton
        active={mode === "bulk"}
        onClick={() => onChange("bulk")}
        testId={`${testIdPrefix}-bulk`}
      >
        Bulk
      </ModeButton>
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}

function ModeButton({ active, onClick, testId, children }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={
        "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 " +
        (active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-600 hover:text-gray-900")
      }
    >
      {children}
    </button>
  );
}
