import type { ReactNode } from "react";
// SearchBar is composed within SearchFiltersCard
import SearchFiltersCard, {
  type ActiveFilters,
} from "@components/ui/SearchFiltersCard";

/** Search input configuration for the ListPageLayout header. */
type SearchProps = {
  /** Current search text (controlled) */
  value: string;
  /** Callback fired with the new text value on each keystroke */
  onChange: (value: string) => void;
  /** Placeholder text for the search input */
  placeholder: string;
};

/**
 * Props for the ListPageLayout component -- a standard page layout for list/table views,
 * composing a title header, search + filter toolbar, optional bulk actions bar, and a table area.
 */
type ListPageLayoutProps = {
  /** Page heading text */
  title: string;
  /** Boxicons class for a title icon (e.g., "bx bx-qr-scan") */
  titleIconClass?: string;
  /** Optional React node for the title icon; overrides titleIconClass when provided */
  titleIcon?: ReactNode;
  /** Optional subtitle text below the heading */
  subtitle?: ReactNode;
  /** Action buttons rendered in the top-right corner (e.g., "Create" button) */
  headerActions?: ReactNode;
  /** Search input configuration */
  search: SearchProps;
  /** Filter controls passed to SearchFiltersCard */
  filters?: ReactNode;
  /** Current active filters; if omitted, SearchFiltersCard can manage local state */
  activeFilters?: ActiveFilters;
  /** Reset pagination to page 1 when search/filters change */
  onResetPage?: () => void;
  /** Optional clear filters handler; forwarded to SearchFiltersCard */
  onClearFilters?: () => void;
  /** Bulk actions toolbar shown between filters and table when items are selected */
  bulkActionsBar?: ReactNode;
  /** Only the <table> element with its thead/tbody, without outer wrappers */
  table: ReactNode;
  /** Pagination block rendered below the table wrapper */
  pagination?: ReactNode;
  /** When true, stretches layout to fill parent height. Defaults to true. */
  fillHeight?: boolean;
};

export default function ListPageLayout(props: ListPageLayoutProps) {
  const {
    title,
    titleIconClass,
    titleIcon,
    subtitle,
    headerActions,
    search,
    filters,
    activeFilters,
    onResetPage,
    onClearFilters,
    bulkActionsBar,
    table,
    fillHeight = true,
  } = props;

  return (
    <div className={`flex flex-col ${fillHeight ? "h-full" : ""}`}>
      <div className="flex justify-between items-center mb-6">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            {titleIcon ? (
              titleIcon
            ) : titleIconClass ? (
              <i className={`${titleIconClass} mr-2`}></i>
            ) : null}
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-gray-500 mt-1 max-w-[650px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">{headerActions}</div>
      </div>

      <SearchFiltersCard
        search={search}
        filters={filters}
        activeFilters={activeFilters}
        onResetPage={onResetPage}
        onClearFilters={onClearFilters}
      />

      {bulkActionsBar ?? null}

      <div
        className={`relative z-0 bg-white rounded-lg shadow overflow-hidden ${fillHeight ? "flex-grow min-h-0" : ""}`}
      >
        {table}
      </div>
    </div>
  );
}
