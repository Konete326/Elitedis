import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  List,
  LayoutGrid,
  SlidersHorizontal,
  RotateCcw,
  Check,
} from 'lucide-react';

function isColumnVisible(visibleColumns, key) {
  if (!visibleColumns) return true;
  if (visibleColumns instanceof Set) return visibleColumns.has(key);
  if (Array.isArray(visibleColumns)) return visibleColumns.includes(key);
  if (typeof visibleColumns === 'object') return visibleColumns[key] !== false;
  return true;
}

/**
 * Multi-criterion FilterToolbar with 300ms debounced search, View Switcher, and Column Popover.
 */
export function FilterToolbar({
  searchValue = '',
  onSearchChange,
  onResetPage,
  searchPlaceholder = 'Search by code, name, or keyword...',
  filters = [],
  children,
  viewMode,
  onViewModeChange,
  columns = [],
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  onResetFilters,
  onReset,
  actions,
  selectedCount = 0,
  className = '',
}) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const debounceRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    setLocalSearch(searchValue ?? '');
  }, [searchValue]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!columnsOpen) return undefined;
    const handleOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setColumnsOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setColumnsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [columnsOpen]);

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setLocalSearch(nextValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onResetPage?.();
      onSearchChange?.(nextValue);
    }, 300);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onResetPage?.();
    onSearchChange?.('');
  };

  const handleResetAll = onResetFilters || onReset;

  return (
    <div
      className={`shrink-0 flex flex-col gap-2.5 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={localSearch}
                onChange={handleInputChange}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-colors duration-200"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}

          {Array.isArray(filters) &&
            filters.map((filter) => (
              <select
                key={filter.key}
                aria-label={filter.label}
                value={filter.value ?? ''}
                onChange={(e) => {
                  onResetPage?.();
                  filter.onChange?.(e.target.value);
                }}
                className="h-9 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                <option value="">{filter.placeholder || `All ${filter.label}`}</option>
                {(filter.options || []).map((opt) => {
                  const val = typeof opt === 'object' ? opt.value : opt;
                  const lbl = typeof opt === 'object' ? opt.label : opt;
                  return (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  );
                })}
              </select>
            ))}

          {children}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              {selectedCount} selected
            </span>
          )}

          {onViewModeChange && (
            <div
              role="group"
              aria-label="Data view mode"
              className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('table')}
                title="Table List"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
                  viewMode !== 'card'
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Table List</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('card')}
                title="Card View"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
                  viewMode === 'card'
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Card View</span>
              </button>
            </div>
          )}

          {columns.length > 0 && onToggleColumn && (
            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setColumnsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] transition-colors duration-200"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Columns</span>
              </button>

              {columnsOpen && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl z-40 p-2">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border-subtle)] mb-1">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Show / Reset Columns
                    </span>
                    {onResetColumns && (
                      <button
                        type="button"
                        onClick={() => onResetColumns()}
                        className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {columns.map((col) => {
                      const colKey = col.key;
                      const visible = isColumnVisible(visibleColumns, colKey);
                      return (
                        <button
                          key={colKey}
                          type="button"
                          onClick={() => onToggleColumn(colKey)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition-colors"
                        >
                          <span className="truncate">{col.header || col.label || colKey}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              visible
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]'
                            }`}
                          >
                            {visible && <Check className="w-3 h-3" strokeWidth={2.5} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {handleResetAll && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                if (debounceRef.current) clearTimeout(debounceRef.current);
                handleResetAll();
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Reset</span>
            </button>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}

export default FilterToolbar;
