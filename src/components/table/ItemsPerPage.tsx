import { useEffect, type SelectHTMLAttributes } from "react";

/** Props for the ItemsPerPage component -- a select control for choosing how many items to display per page, with localStorage persistence. */
type ItemsPerPageProps = {
  /** Label text shown before the select. Defaults to "Show:". */
  label?: string;
  /** Currently selected items-per-page value */
  value: number;
  /** Callback fired when the user selects a different value */
  onChange: (value: number) => void;
  /** Available page size options. Defaults to [10, 20, 50]. */
  options?: number[];
  /** HTML id for the select element; also used as the localStorage key suffix for persistence */
  selectId?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value">;

export default function ItemsPerPage(props: ItemsPerPageProps) {
  const {
    label = "Show:",
    value,
    onChange,
    options = [10, 20, 50],
    selectId,
    className = "",
    ...rest
  } = props;

  const storageKey = `itemsPerPage:${selectId ?? "data-table-items-per-page"}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const persisted = Number(raw);
      if (!Number.isFinite(persisted)) return;
      if (!options.includes(persisted)) return;
      if (persisted !== value) onChange(persisted);
    } catch {
      // ignore storage errors (e.g., SSR or private mode)
    }
  }, [storageKey, onChange, options, value]);
  return (
    <div className={`flex items-center ${className}`}>
      <label
        htmlFor={selectId}
        className="text-sm font-medium text-gray-700 mr-2"
      >
        {label}
      </label>
      <select
        id={selectId}
        className="block w-auto pl-3 pr-8 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md"
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          try {
            window.localStorage.setItem(storageKey, String(next));
          } catch {
            /* ignore */
          }
          onChange(next);
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-700 ml-2">items</span>
    </div>
  );
}
