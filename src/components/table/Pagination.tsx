import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type PageButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

function PageButton(props: PageButtonProps) {
  const { active, children, className = "", ...rest } = props;
  if (active) {
    return (
      <span
        className={`z-10 bg-yellow-50 border-yellow-500 text-yellow-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium ${className}`}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Props for the Pagination component -- a page navigation control with numbered page buttons and prev/next arrows. */
type PaginationProps = {
  /** The currently active page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  pageCount: number;
  /** Callback for the "Previous" button; when undefined, the button is rendered but non-functional */
  onPrev?: () => void;
  /** Callback for the "Next" button; when undefined, the button is rendered but non-functional */
  onNext?: () => void;
  /** Callback fired when a specific page number is clicked */
  onPageChange?: (page: number) => void;
} & HTMLAttributes<HTMLDivElement>;

export default function Pagination(props: PaginationProps) {
  const {
    currentPage,
    pageCount,
    onPrev,
    onNext,
    onPageChange,
    className = "",
    ...rest
  } = props;

  function renderPages() {
    if (pageCount <= 6) {
      return Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <PageButton
          key={p}
          active={p === currentPage}
          onClick={onPageChange ? () => onPageChange(p) : undefined}
        >
          {p}
        </PageButton>
      ));
    }

    // Always show first and last; compute a middle window around current.
    // When on the first or last page, show 5 numbers before/after the ellipsis (window size 4 between first/last).
    const pages: number[] = [];
    const first = 1;
    const last = pageCount;
    const windowSize = [1, 2, 3, last - 2, last - 1, last].includes(currentPage)
      ? 4
      : 3;
    let start = Math.max(2, currentPage - Math.floor(windowSize / 2));
    const end = Math.min(pageCount - 1, start + (windowSize - 1));
    start = Math.max(2, end - (windowSize - 1)); // ensure middle has the requested length

    // First page
    pages.push(first);
    // Middle window
    for (let p = start; p <= end; p++) pages.push(p);
    // Last page
    pages.push(last);

    const nodes: ReactNode[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const prev = i > 0 ? pages[i - 1] : undefined;
      if (prev !== undefined && p - prev > 1) {
        nodes.push(
          <span
            key={`ellipsis-${prev}`}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500"
          >
            ...
          </span>,
        );
      }
      nodes.push(
        <PageButton
          key={p}
          active={p === currentPage}
          onClick={onPageChange ? () => onPageChange(p) : undefined}
        >
          {p}
        </PageButton>,
      );
    }
    return nodes;
  }

  return (
    <nav
      className={`relative z-0 inline-flex rounded-md shadow-sm -space-x-px ${className}`}
      aria-label="Pagination"
      {...rest}
    >
      <PageButton className="rounded-l-md" onClick={onPrev}>
        <i className="bx bx-chevron-left"></i>
        <span className="sr-only">Previous</span>
      </PageButton>
      {renderPages()}
      <PageButton className="rounded-r-md" onClick={onNext}>
        <i className="bx bx-chevron-right"></i>
        <span className="sr-only">Next</span>
      </PageButton>
    </nav>
  );
}
