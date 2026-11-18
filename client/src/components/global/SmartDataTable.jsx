import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Loader2, Plus } from 'lucide-react';
import PaginationBar from './PaginationBar';
import SmartMediaCard from './SmartMediaCard';

const getRowKey = (row, idx, keyField) => row?.[keyField] ?? row?.id ?? row?._id ?? idx;

function checkColumnVisible(visibleColumns, key) {
  if (!visibleColumns) return true;
  if (visibleColumns instanceof Set) return visibleColumns.has(key);
  if (Array.isArray(visibleColumns)) return visibleColumns.includes(key);
  if (typeof visibleColumns === 'object') return visibleColumns[key] !== false;
  return true;
}

function getCellValue(row, col, idx) {
  if (typeof col.render === 'function') return col.render(row, idx);
  if (typeof col.accessor === 'function') return col.accessor(row, idx);
  const raw = row?.[col.accessor || col.key];
  return raw === undefined || raw === null || raw === '' ? '—' : raw;
}

function checkSelected(selectedKeys, key) {
  if (!selectedKeys) return false;
  if (selectedKeys instanceof Set) return selectedKeys.has(key);
  return Array.isArray(selectedKeys) && selectedKeys.includes(key);
}

const ALIGN_MAP = { right: 'text-right', center: 'text-center', left: 'text-left' };

/**
 * Responsive SmartDataTable: sticky-header table on desktop (lg >= 1024px) and touch-friendly
 * stacked cards on mobile/tablet (< 1024px) or Card View, with shimmer loading and Empty State CTA.
 */
export function SmartDataTable({
  columns = [],
  data = [],
  keyField = '_id',
  loading = false,
  isLoading = false,
  viewMode = 'table',
  visibleColumns,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  sortBy,
  sortOrder = 'asc',
  onSort,
  onRowClick,
  renderActions,
  renderCard,
  emptyTitle = 'No records found',
  emptyDescription = 'Add a new record or adjust your active filters.',
  emptyActionLabel,
  onEmptyAction,
  emptyIcon: EmptyIcon = Inbox,
  pagination,
  onPageChange,
  onPageSizeChange,
  className = '',
}) {
  const busy = loading || isLoading;
  const showSkeleton = busy && data.length === 0;
  const showRefreshing = busy && data.length > 0;
  const activeCols = columns.filter((col) => checkColumnVisible(visibleColumns, col.key));
  const rowIds = data.map((row, idx) => getRowKey(row, idx, keyField));
  const allSelected = selectable && rowIds.length > 0 && rowIds.every((id) => checkSelected(selectedKeys, id));

  const toggleSelectAll = () => onSelectionChange?.(allSelected ? [] : rowIds);
  const toggleSelectOne = (id) => {
    if (!onSelectionChange) return;
    const current = selectedKeys instanceof Set ? [...selectedKeys] : [...(selectedKeys || [])];
    onSelectionChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const cleanEmptyLabel = emptyActionLabel ? String(emptyActionLabel).replace(/^\+\s*/, '') : '';

  if (!busy && data.length === 0) {
    return (
      <div className={`lg:flex-1 lg:min-h-0 flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:overflow-hidden ${className}`}>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-10 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center mb-3">
            <EmptyIcon className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-md">{emptyDescription}</p>
          {cleanEmptyLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="mt-4 inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors duration-200"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>{cleanEmptyLabel}</span>
            </button>
          )}
        </div>
        {pagination && (
          <PaginationBar pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        )}
      </div>
    );
  }

  return (
    <div className={`relative lg:flex-1 lg:min-h-0 flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:overflow-hidden transition-colors duration-200 ${className}`}>
      {showRefreshing && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] shadow-sm"
        >
          <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-primary)]" strokeWidth={2} />
          <span>Updating...</span>
        </div>
      )}
      {viewMode !== 'card' && (
        <div className="hidden lg:block flex-1 min-h-0 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                {selectable && (
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]"
                    />
                  </th>
                )}
                {activeCols.map((col) => {
                  const isSorted = sortBy && sortBy === col.key;
                  return (
                    <th key={col.key} className={`px-3.5 py-3 whitespace-nowrap ${ALIGN_MAP[col.align] || 'text-left'}`}>
                      {col.sortable && onSort ? (
                        <button type="button" onClick={() => onSort(col.key)} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                          <span>{col.header || col.label}</span>
                          {isSorted ? (
                            sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <ArrowUp className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        <span>{col.header || col.label}</span>
                      )}
                    </th>
                  );
                })}
                {renderActions && (
                  <th className="sticky right-0 z-10 bg-[var(--bg-elevated)] px-3.5 py-3 text-right whitespace-nowrap">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {showSkeleton
                ? Array.from({ length: 3 }).map((_, rIdx) => (
                    <tr key={`skeleton-${rIdx}`}>
                      {selectable && <td className="px-3 py-3"><div className="h-4 w-4 mx-auto rounded skeleton-shimmer" /></td>}
                      {activeCols.map((col) => (
                        <td key={col.key} className="px-3.5 py-3"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
                      ))}
                      {renderActions && <td className="px-3.5 py-3"><div className="h-4 w-16 ml-auto rounded skeleton-shimmer" /></td>}
                    </tr>
                  ))
                : data.map((row, rIdx) => {
                    const id = getRowKey(row, rIdx, keyField);
                    const selected = checkSelected(selectedKeys, id);
                    return (
                      <tr
                        key={id}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={`transition-none ${selected ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--bg-elevated)]/60'} ${onRowClick ? 'cursor-pointer' : ''}`}
                      >
                        {selectable && (
                          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select row ${id}`}
                              checked={selected}
                              onChange={() => toggleSelectOne(id)}
                              className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]"
                            />
                          </td>
                        )}
                        {activeCols.map((col) => (
                          <td
                            key={col.key}
                            className={`px-3.5 py-2.5 text-[var(--text-primary)] ${col.numeric ? 'tabular-nums font-mono' : ''} ${ALIGN_MAP[col.align] || 'text-left'} ${col.className || ''}`}
                          >
                            {getCellValue(row, col, rIdx)}
                          </td>
                        ))}
                        {renderActions && (
                          <td className="sticky right-0 bg-[var(--bg-surface)] px-3.5 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-end gap-1.5">{renderActions(row, rIdx)}</div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      <div className={`${viewMode === 'card' ? 'block' : 'lg:hidden'} lg:flex-1 lg:min-h-0 lg:overflow-auto p-3`}>
        <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          {showSkeleton
            ? Array.from({ length: 3 }).map((_, idx) => (
                <div key={`card-skel-${idx}`} className="h-32 rounded-xl border border-[var(--border-subtle)] skeleton-shimmer" />
              ))
            : data.map((row, rIdx) => {
                const id = getRowKey(row, rIdx, keyField);
                if (renderCard) return <div key={id} className="min-w-0 animate-fade-in">{renderCard(row, rIdx)}</div>;

                const primaryCol = activeCols.find((c) => c.mobilePrimary) || activeCols[0];
                const badgeCol = activeCols.find((c) => c.mobileBadge);
                const detailCols = activeCols.filter((c) => c !== primaryCol && c !== badgeCol && !c.hideOnMobile);
                const selected = checkSelected(selectedKeys, id);

                return (
                  <SmartMediaCard
                    key={id}
                    row={row}
                    rIdx={rIdx}
                    id={id}
                    selected={selected}
                    selectable={selectable}
                    toggleSelectOne={toggleSelectOne}
                    onRowClick={onRowClick}
                    primaryCol={primaryCol}
                    badgeCol={badgeCol}
                    detailCols={detailCols}
                    getCellValue={getCellValue}
                    renderActions={renderActions}
                  />
                );
              })}
        </div>
      </div>

      {pagination && (
        <PaginationBar pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      )}
    </div>
  );
}

export default SmartDataTable;
