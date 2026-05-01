import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "../combobox/detail/ItemComboBox";

/** Props for the BulkActionsBar component -- a toolbar displayed when items are selected, showing the count and available bulk actions. */
export type BulkActionsBarProps = {
  /** Number of currently selected items. Defaults to 0. */
  selectedCount?: number;
  /** Action buttons/controls rendered on the right side (hidden on small screens when moreOptions is provided) */
  actions: ReactNode;
  className?: string;
  /** Text label shown after the count, e.g., "items selected". Defaults to "items selected". */
  label?: string;
  /** Custom left-side content; replaces the default count + clear button */
  left?: ReactNode;
  /** CSS classes for the actions container layout. Defaults to "space-x-2". */
  actionsContainerClassName?: string;
  /** Show a select-all checkbox control (currently unused in implementation) */
  showSelectAll?: boolean;
  /** Controlled checked state for select-all checkbox */
  selectAllChecked?: boolean;
  /** Callback for select-all checkbox changes */
  onSelectAllChange?: (checked: boolean) => void;
  /** Label for the select-all checkbox */
  selectAllLabel?: string;
  /** Sets the checkbox to indeterminate (some-but-not-all on page) */
  selectAllIndeterminate?: boolean;
  /** If true, the bar will slide/fade in on mount */
  animate?: boolean;
  /** Optional clear selection control */
  showClearSelection?: boolean;
  onClearSelection?: () => void;
  clearSelectionLabel?: string;
  /** Optional: Provide dropdown options for a responsive 'More' menu on small screens */
  moreOptions?: ItemComboBoxOption[];
  /** Label for the 'More' trigger button */
  moreButtonLabel?: string;
};

export default function BulkActionsBar(props: BulkActionsBarProps) {
  const {
    selectedCount = 0,
    actions,
    className = "",
    label = "items selected",
    left,
    actionsContainerClassName = "space-x-2",
    animate = true,
    onClearSelection,
    clearSelectionLabel = "Clear",
    moreOptions,
    moreButtonLabel = "More",
  } = props;

  // Enter animation on mount: start hidden and slide/fade into place
  const [entered, setEntered] = useState<boolean>(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = window.setTimeout(() => setEntered(true), 10);
    return () => window.clearTimeout(id);
  }, [animate]);

  const leftContent = left ?? (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-gray-700">
        <span className="selected-count">{selectedCount}</span> {label}
      </span>
      <button
        type="button"
        onClick={onClearSelection}
        className="inline-flex items-center px-2 py-1 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      >
        {clearSelectionLabel}
      </button>
    </div>
  );

  const transitionClasses = animate
    ? `transition-all duration-200 ease-out transform ${entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`
    : "";

  const actionsDisabled = (selectedCount ?? 0) <= 0;

  const smallScreenMore = useMemo(() => {
    if (!moreOptions || moreOptions.length === 0) return null;
    const disabled = actionsDisabled;
    const options = moreOptions.map((opt) => ({
      ...opt,
      disabled: opt.disabled || disabled,
    }));
    return (
      <div
        className={`2xl:hidden ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        aria-disabled={disabled}
      >
        <ItemComboBox
          options={options}
          buttonVariant="secondary"
          buttonLabel={moreButtonLabel}
          buttonRightIconClass="bx bx-chevron-down -mr-1 text-gray-400"
          align="right"
          menuWidthClassName="w-48"
        />
      </div>
    );
  }, [moreOptions, moreButtonLabel, actionsDisabled]);

  return (
    <div
      className={`relative bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4 z-30 flex items-center justify-between ${transitionClasses} ${className}`}
    >
      {leftContent}
      <div className="flex items-center space-x-2">
        <div
          className={`hidden 2xl:flex ${actionsContainerClassName} ${actionsDisabled ? "opacity-50 pointer-events-none" : ""}`}
          aria-disabled={actionsDisabled}
        >
          {actions}
        </div>
        {smallScreenMore}
      </div>
    </div>
  );
}
