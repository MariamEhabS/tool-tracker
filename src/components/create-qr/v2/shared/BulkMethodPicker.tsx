import type { ReactNode } from "react";

/**
 * The three bulk creation methods supported on flat v2 Create pages.
 * Each Create page (Tool Tracker, Equipment Code, etc.) supplies its own
 * `BulkMethodDefinition[]` so it can pick which methods apply and tune
 * copy per type — the picker component itself is type-agnostic.
 */
export type BulkMethod = "manual" | "prefix" | "csv";

export interface BulkMethodDefinition {
  value: BulkMethod;
  /** BoxIcons class string, e.g. "bx bx-list-ul". */
  icon: string;
  /** Card title, e.g. "Manual entry". */
  label: string;
  /** One-line card description shown under the title. */
  description: string;
}

interface BulkMethodPickerProps {
  active: BulkMethod;
  methods: ReadonlyArray<BulkMethodDefinition>;
  onChange: (next: BulkMethod) => void;
  /**
   * Optional aria-label for the radiogroup. Each Create page should set
   * this to something type-specific (e.g. "How to add tools").
   */
  ariaLabel?: string;
  testId?: string;
}

/**
 * Reusable 3-card method picker for v2 Create pages. Active card gets a
 * brand-tinted border + filled icon; inactive cards are gray-bordered white
 * with a hover state. Renders as a real `<button role="radio">` group so
 * keyboard navigation and screen-reader semantics are correct.
 *
 * Place this at the top of the bulk content area, outside any SectionCard,
 * so it functions as a primary nav control rather than a section detail.
 */
export default function BulkMethodPicker({
  active,
  methods,
  onChange,
  ariaLabel,
  testId,
}: BulkMethodPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Bulk creation method"}
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      data-testid={testId ?? "bulk-method-picker"}
    >
      {methods.map((method) => (
        <MethodCard
          key={method.value}
          method={method}
          active={method.value === active}
          onClick={() => onChange(method.value)}
        />
      ))}
    </div>
  );
}

interface MethodCardProps {
  method: BulkMethodDefinition;
  active: boolean;
  onClick: () => void;
}

function MethodCard({ method, active, onClick }: MethodCardProps): ReactNode {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      data-testid={`bulk-method-${method.value}`}
      className={
        "text-left rounded-xl border p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 " +
        (active
          ? "border-brand-500 bg-brand-50/40 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50")
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={
            "inline-flex items-center justify-center h-7 w-7 rounded-md transition " +
            (active ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600")
          }
          aria-hidden
        >
          <i className={method.icon} />
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {method.label}
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        {method.description}
      </p>
    </button>
  );
}
