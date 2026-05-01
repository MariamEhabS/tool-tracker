import SearchFiltersCard, {
  type ActiveFilters,
} from "@/components/ui/SearchFiltersCard";
import FilterComboBox from "@/components/combobox/detail/FilterComboBox";
import Button from "@/components/ui/Button";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  mode: "tools" | "docs" | "procore";
  toolRefs?: string[];
  toolTypes?: string[];
  docTypes?: string[];
  procoreStatuses?: string[];
  filters: ActiveFilters;
  onFiltersChange: (next: ActiveFilters) => void;
  onClear: () => void;
};

export default function QrFilters(props: Props) {
  const {
    query,
    onQueryChange,
    mode,
    toolRefs = [],
    toolTypes = [],
    docTypes = [],
    procoreStatuses = [],
    filters,
    onFiltersChange,
    onClear,
  } = props;
  return (
    <SearchFiltersCard
      search={{
        value: query,
        onChange: (v) => onQueryChange(v),
        placeholder:
          mode === "procore"
            ? "Search items..."
            : mode === "docs"
              ? "Search documents..."
              : "Search tools...",
      }}
      filters={
        <>
          {mode === "tools" ? (
            <>
              <FilterComboBox
                multiple
                placeholder="Reference"
                options={toolRefs.map((r) => ({ label: r, value: r }))}
                value={filters.reference as string[] | undefined}
                onChange={(next) =>
                  onFiltersChange({ ...filters, reference: next as string[] })
                }
              />
              <FilterComboBox
                multiple
                placeholder="Type"
                options={toolTypes.map((t) => ({ label: t, value: t }))}
                value={filters.type as string[] | undefined}
                onChange={(next) =>
                  onFiltersChange({ ...filters, type: next as string[] })
                }
              />
            </>
          ) : null}
          {mode === "docs" ? (
            <FilterComboBox
              multiple
              placeholder="Type"
              options={docTypes.map((t) => ({ label: t, value: t }))}
              value={filters.doctype as string[] | undefined}
              onChange={(next) =>
                onFiltersChange({ ...filters, doctype: next as string[] })
              }
            />
          ) : null}
          {mode === "procore" && procoreStatuses.length > 0 ? (
            <FilterComboBox
              multiple
              placeholder="Status"
              options={procoreStatuses.map((s) => ({ label: s, value: s }))}
              value={filters.status as string[] | undefined}
              onChange={(next) =>
                onFiltersChange({ ...filters, status: next as string[] })
              }
            />
          ) : null}
          <Button
            type="button"
            variant="clear"
            onClick={onClear}
            leftIconClass="inline-flex items-center bx bx-trash -ml-0.5"
          >
            Clear Filters
          </Button>
        </>
      }
      activeFilters={filters}
      onResetPage={() => undefined}
    />
  );
}
