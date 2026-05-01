import ResultsSummary from "./ResultsSummary";
import Pagination from "./Pagination";
import ItemsPerPage from "./ItemsPerPage";

/** Props for the TableFooter component -- a composite footer composing ResultsSummary, Pagination, and ItemsPerPage controls. */
export type TableFooterProps = {
  /** First item number on the current page (1-based) */
  resultsStart: number;
  /** Last item number on the current page */
  resultsEnd: number;
  /** Total number of items across all pages */
  resultsTotal: number;
  /** Current active page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  pageCount: number;
  /** Callback for the "Previous" button */
  onPrev?: () => void;
  /** Callback for the "Next" button */
  onNext?: () => void;
  /** Callback fired when a specific page number is clicked */
  onPageChange?: (page: number) => void;
  /** Currently selected items-per-page value */
  itemsPerPage: number;
  /** Callback fired when items-per-page selection changes */
  onItemsPerPageChange: (value: number) => void;
  /** HTML id for the items-per-page select element. Defaults to "table-items-per-page". */
  itemsPerPageSelectId?: string;
  /** Available page size options forwarded to ItemsPerPage */
  itemsPerPageOptions?: number[];
  /** Whether to show the "Showing X of Y results" summary. Defaults to true. */
  showResultsSummary?: boolean;
  /** Whether to show the items-per-page selector. Defaults to true. */
  showItemsPerPage?: boolean;
};

export default function TableFooter(props: TableFooterProps) {
  const {
    resultsStart,
    resultsEnd,
    resultsTotal,
    currentPage,
    pageCount,
    onPrev,
    onNext,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    itemsPerPageSelectId = "table-items-per-page",
    itemsPerPageOptions,
    showResultsSummary = true,
    showItemsPerPage = true,
  } = props;

  return (
    <div
      className={`flex-none bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 min-h-14 h-14`}
    >
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between w-full">
        {/* {resultsTotal > 0 ? ( */}
        <>
          <div className="flex-1">
            {showResultsSummary ? (
              <ResultsSummary
                start={resultsStart}
                end={resultsEnd}
                total={resultsTotal}
              />
            ) : null}
          </div>
          <div className="flex-1 flex justify-center">
            <Pagination
              currentPage={currentPage}
              pageCount={pageCount}
              onPrev={onPrev}
              onNext={onNext}
              onPageChange={onPageChange}
            />
          </div>
          <div className="flex-1 flex justify-end">
            {showItemsPerPage ? (
              <ItemsPerPage
                value={itemsPerPage}
                onChange={onItemsPerPageChange}
                selectId={itemsPerPageSelectId}
                options={itemsPerPageOptions}
              />
            ) : null}
          </div>
        </>
        {/* ) : null} */}
        {/* {resultsTotal === 0 ? <div className="w-full h-6" /> : null} */}
      </div>
    </div>
  );
}
