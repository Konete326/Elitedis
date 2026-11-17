import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function buildPageRange(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('...');
    }
    result.push(sorted[i]);
  }
  return result;
}

/**
 * Synchronized server-side pagination footer with tabular counts and page size selector.
 */
export function PaginationBar({
  pagination,
  currentPage: propPage,
  pageSize: propPageSize,
  totalRecords: propTotalRecords,
  totalPages: propTotalPages,
  onPageChange,
  onPageSizeChange,
  onLimitChange,
  pageSizeOptions = [5, 10, 20],
  className = '',
}) {
  const totalRecords = Number(pagination?.totalRecords ?? propTotalRecords ?? 0);
  const pageSize = Math.max(1, Number(pagination?.pageSize ?? propPageSize ?? 10));
  const currentPage = Math.max(1, Number(pagination?.currentPage ?? propPage ?? 1));
  const totalPages = Math.max(
    1,
    Number(pagination?.totalPages ?? propTotalPages ?? Math.ceil(totalRecords / pageSize) ?? 1)
  );

  const hasPrev = pagination?.hasPrevPage ?? currentPage > 1;
  const hasNext = pagination?.hasNextPage ?? currentPage < totalPages;

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = totalRecords === 0 ? 0 : Math.min(currentPage * pageSize, totalRecords);

  const handleSizeChange = onPageSizeChange || onLimitChange;
  const mergedOptions = Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  const pageButtons = buildPageRange(currentPage, totalPages);

  return (
    <div
      className={`relative z-20 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-3 sm:px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] transition-colors duration-200 ${className}`}
    >
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <p className="tabular-nums">
          Showing{' '}
          <span className="font-semibold text-[var(--text-primary)]">{startRecord}</span>
          {'–'}
          <span className="font-semibold text-[var(--text-primary)]">{endRecord}</span> of{' '}
          <span className="font-semibold text-[var(--text-primary)]">{totalRecords}</span> records
        </p>

        {handleSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="h-8 px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              {mergedOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center justify-center sm:justify-end gap-1">
        <button
          type="button"
          onClick={() => onPageChange?.(1)}
          disabled={!hasPrev}
          aria-label="First page"
          className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200"
        >
          <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[32px] px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="hidden xs:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {pageButtons.map((item, idx) =>
            item === '...' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-[var(--text-muted)] select-none"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange?.(item)}
                aria-current={item === currentPage ? 'page' : undefined}
                className={`min-w-[34px] min-h-[36px] sm:min-h-[32px] px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors duration-200 ${
                  item === currentPage
                    ? 'bg-[var(--accent-primary)] text-white border border-[var(--accent-primary)]'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
          disabled={!hasNext}
          aria-label="Next page"
          className="inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[32px] px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange?.(totalPages)}
          disabled={!hasNext}
          aria-label="Last page"
          className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200"
        >
          <ChevronsRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;
