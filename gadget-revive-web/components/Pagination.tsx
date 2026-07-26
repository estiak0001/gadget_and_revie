import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Builds a compact page-number sequence with ellipsis gaps, e.g. [1, '…', 4, 5, 6, '…', 12]
function paginationRange(current: number, total: number): (number | '...')[] {
  const delta = 1;
  const range: (number | '...')[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push('...');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('...');
  if (total > 1) range.push(total);

  return range;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col items-center justify-center gap-3 mt-8 pt-5 border-t border-gray-100">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:border-ink hover:text-ink transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {paginationRange(currentPage, totalPages).map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-300 text-sm select-none">
              &hellip;
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-9 h-9 flex items-center justify-center text-sm font-semibold rounded-full transition-all ${
                currentPage === page
                  ? 'bg-ink text-white shadow-md shadow-gray-300'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:border-ink hover:text-ink transition-colors"
          aria-label="Next page"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-900">{rangeStart}–{rangeEnd}</span> of{' '}
        <span className="font-semibold text-gray-900">{totalItems}</span> products
      </p>
    </div>
  );
}
