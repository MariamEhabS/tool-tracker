import { useEffect, useMemo, useState } from "react";
import { useCombobox } from "../Combobox";

/** Primitive value type for combobox options (string or number). */
export type ComboBoxValue = string | number;
/** Extended value type that also supports boolean (used in some filter contexts). */
export type ComboValue = string | number | boolean;
/** A selectable option with a display label and value. */
export type ComboOption = { label: string; value: ComboValue };

/** A selectable option for FilterComboBox with optional disabled state. */
export type ComboBoxOption = {
  /** Display text for the option */
  label: string;
  /** Value used for selection tracking and onChange callback */
  value: ComboBoxValue;
  /** When true, the option is shown but cannot be selected */
  disabled?: boolean;
};

/** Props for the FilterComboBox component -- a dropdown filter control with single or multi-select support, styled as a pill button. */
type FilterComboBoxProps = {
  /** Available options to display in the dropdown */
  options: ComboBoxOption[];
  /** Currently selected value(s); single value for single-select, array for multi-select */
  value: ComboBoxValue | ComboBoxValue[] | undefined;
  /** Callback fired when the selection changes */
  onChange: (next: ComboBoxValue | ComboBoxValue[] | undefined) => void;
  /** Enable multi-select mode with checkboxes. Defaults to false (single-select with radio buttons). */
  multiple?: boolean;
  /** Text shown on the trigger button. Defaults to "Select...". */
  placeholder?: string;
  /** Enable a search input within the dropdown (currently not wired in UI). */
  searchable?: boolean;
  /** Placeholder text for the search input when searchable is true. */
  searchPlaceholder?: string;
  id?: string;
  className?: string;
  /** Additional CSS classes for the trigger button */
  buttonClassName?: string;
  /** Maximum height of the dropdown menu in pixels. Defaults to 280. */
  maxMenuHeightPx?: number;
  /** Allow clearing the selection (currently commented out in implementation). */
  allowClear?: boolean;
  /** Custom render function for the trigger button label based on selected options. */
  renderButtonLabel?: (selected: ComboBoxOption[]) => string;
};

export default function FilterComboBox(props: FilterComboBoxProps) {
  const {
    options,
    value,
    onChange,
    multiple = false,
    placeholder = "Select...",
    id,
    className = "",
    buttonClassName = "",
    maxMenuHeightPx = 280,
    // allowClear = true,
    // renderButtonLabel,
  } = props;

  const [query] = useState("");
  const {
    open,
    setOpen,
    shouldRender,
    entered,
    activeIndex,
    setActiveIndex,
    setRootNode,
    setListNode,
  } = useCombobox({ sourceId: "filter-combobox" });

  const valueArray: ComboBoxValue[] = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value : [];
    return typeof value === "string" || typeof value === "number"
      ? [value]
      : [];
  }, [value, multiple]);

  const selectedOptions = useMemo(() => {
    const set = new Set(valueArray);
    return options.filter((o) => set.has(o.value));
  }, [options, valueArray]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(filtered.length ? 0 : -1);
  }, [open, filtered.length, setActiveIndex]);

  function commitSingle(next?: ComboBoxValue) {
    onChange(next);
    setOpen(false);
  }

  function commitMultiToggle(v: ComboBoxValue) {
    const curr = new Set(valueArray);
    if (curr.has(v)) curr.delete(v);
    else curr.add(v);
    onChange(Array.from(curr));
  }

  // function clearSelection() {
  // 	if (!allowClear) return
  // 	onChange(multiple ? [] : undefined)
  // }

  function buttonLabel(): string {
    // if (renderButtonLabel) return renderButtonLabel(selectedOptions)
    // if (selectedOptions.length === 0) return placeholder
    // if (!multiple) return selectedOptions[0]?.label ?? placeholder
    // if (selectedOptions.length === 1) return selectedOptions[0].label
    // return `${selectedOptions.length} selected`
    return placeholder;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (
      !open &&
      (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
    ) {
      setOpen(true);
      e.preventDefault();
      return;
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (
      e.key === "Enter" &&
      activeIndex >= 0 &&
      activeIndex < filtered.length
    ) {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (!opt || opt.disabled) return;
      if (multiple) commitMultiToggle(opt.value);
      else commitSingle(opt.value);
    }
  }

  const isActive = selectedOptions.length > 0;
  const baseBtn =
    "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium border transition-colors duration-150";
  const inactiveBtn = "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  const activeBtn =
    "border-yellow-500 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-500 hover:bg-yellow-50";

  return (
    <div
      ref={setRootNode}
      className={`relative inline-block text-left ${className}`}
      id={id}
    >
      <button
        type="button"
        className={`${baseBtn} ${isActive ? activeBtn : inactiveBtn} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        {buttonLabel()}
        <i className="bx bx-chevron-down ml-1 text-gray-400"></i>
      </button>

      {shouldRender ? (
        <div
          className={`absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-gray-300 ring-opacity-5 focus:outline-none transition-all duration-200 ease-out transform ${entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
        >
          <ul
            ref={setListNode}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="max-h-72 overflow-auto py-1"
            style={{ maxHeight: maxMenuHeightPx }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No results</li>
            ) : (
              filtered.map((opt, idx) => {
                const selected = valueArray.includes(opt.value);
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={selected}
                    className={`px-3 py-1.5 text-sm cursor-pointer flex items-center ${idx === activeIndex ? "bg-gray-50" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (opt.disabled) return;
                      if (multiple) commitMultiToggle(opt.value);
                      else commitSingle(opt.value);
                    }}
                  >
                    {multiple ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 mr-2"
                        readOnly
                        checked={selected}
                      />
                    ) : (
                      <input
                        type="radio"
                        name={`cb-${id ?? "combobox"}`}
                        className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 mr-2"
                        readOnly
                        checked={selected}
                      />
                    )}
                    <span className="text-gray-700">{opt.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
