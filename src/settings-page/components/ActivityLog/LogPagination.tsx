interface LogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function LogPagination({
  currentPage,
  totalPages,
  onPageChange,
}: LogPaginationProps) {
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div
      className="flex items-center justify-between py-3 px-2"
      data-testid="log-pagination"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        data-testid="pagination-prev"
      >
        <i className="bx bx-chevron-left"></i>
        Previous
      </button>

      <span className="text-sm text-gray-600" data-testid="pagination-info">
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        data-testid="pagination-next"
      >
        Next
        <i className="bx bx-chevron-right"></i>
      </button>
    </div>
  );
}
