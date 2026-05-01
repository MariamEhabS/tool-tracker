import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import SearchBar from "./SearchBar";
import Button from "@components/ui/Button";

/** Configuration for the search input within SearchFiltersCard. */
export type SearchConfig = {
  /** Current search text (controlled) */
  value: string;
  /** Callback fired with the new text value on each keystroke */
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Primitive type for filter option values. */
export type FilterValue = string | number | boolean;
/** A single selectable filter option with a label and value. */
export type FilterOption = { label: string; value: FilterValue };
/** Schema for a filter control with its key, display label, selection mode, and available options. */
export type FilterDefinition = {
  /** Unique key used to store the filter value in ActiveFilters */
  key: string;
  /** Display label for the filter control */
  label: string;
  /** Selection mode: "single" allows one value, "multi" allows multiple, "boolean" is a toggle. */
  type?: "single" | "multi" | "boolean";
  /** Available options for single/multi selection filters */
  options?: FilterOption[];
};
/** Map of filter keys to their currently selected value(s). */
export type ActiveFilters = Record<
  string,
  FilterValue | FilterValue[] | undefined
>;

/** Props for SearchFiltersCard -- a toolbar card combining a search input and filter controls. */
export type SearchFiltersCardProps = {
  /** Search input configuration; when omitted, no search bar is rendered */
  search?: SearchConfig;
  /** Filter controls rendered as ReactNode (typically FilterComboBox components) */
  filters?: ReactNode;
  /** Controlled active filters. If omitted, component manages its own state */
  activeFilters?: ActiveFilters;
  /** Optional callback to reset pagination to page 1 when search/filters change */
  onResetPage?: () => void;
  /** Optional clear filters handler; when provided, a Clear Filters button is shown */
  onClearFilters?: () => void;
  /** Custom label for the clear filters button. Defaults to "Clear Filters". */
  clearButtonLabel?: string;
  className?: string;
};

export default function SearchFiltersCard(props: SearchFiltersCardProps) {
  const {
    search,
    filters,
    activeFilters,
    onResetPage,
    onClearFilters,
    clearButtonLabel,
    className = "",
  } = props;
  const [, setLocalFilters] = useState<ActiveFilters>(activeFilters ?? {});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeFilters) setLocalFilters(activeFilters);
  }, [activeFilters]);

  // When external filters change (e.g., Clear Filters button in parent), request a page reset
  const prevExternalFiltersRef = useRef<string>("");
  useEffect(() => {
    if (!activeFilters || !onResetPage) return;
    const nextStr = JSON.stringify(activeFilters);
    if (
      prevExternalFiltersRef.current &&
      prevExternalFiltersRef.current !== nextStr
    ) {
      onResetPage();
    }
    prevExternalFiltersRef.current = nextStr;
  }, [activeFilters, onResetPage]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!openKey) return;
      const node = containerRefs.current[openKey];
      if (node && !node.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openKey]);

  if (!search && !filters) return null;
  return (
    <div
      className={`relative bg-white rounded-lg shadow-sm p-4 mb-4 ${className}`}
    >
      <div className="flex flex-col md:flex-row gap-4">
        {search ? (
          <div className="flex-1">
            <SearchBar
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 items-center">
          {filters}
          {onClearFilters ? (
            <Button
              type="button"
              variant="clear"
              onClick={onClearFilters}
              leftIconClass="inline-flex items-center bx bx-trash -ml-0.5"
            >
              {clearButtonLabel ?? "Clear Filters"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
