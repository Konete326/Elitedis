import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * Accessible, IME-safe type-to-filter combobox replacing plain <select> on large ERP lists.
 */
export function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Search or select...',
  emptyLabel = 'Select option...',
  disabled = false,
  required = false,
  clearable = true,
  className = '',
  id,
  name,
  ariaLabel,
}) {
  const autoId = useId();
  const controlId = id || autoId;
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        String(opt.label || '').toLowerCase().includes(q) ||
        String(opt.sublabel || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 10);
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [open]);

  const selectValue = (nextVal) => {
    onChange?.(nextVal);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        for (let step = 1; step <= filtered.length; step += 1) {
          const idx = (prev + step) % Math.max(1, filtered.length);
          if (!filtered[idx]?.disabled) return idx;
        }
        return 0;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        for (let step = 1; step <= filtered.length; step += 1) {
          const idx = (prev - step + filtered.length) % Math.max(1, filtered.length);
          if (!filtered[idx]?.disabled) return idx;
        }
        return 0;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIndex] || filtered.find((o) => !o.disabled);
      if (target && !target.disabled) selectValue(target.value);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required
          value={value ?? ''}
          onChange={() => {}}
          className="sr-only pointer-events-none"
        />
      )}
      <div
        id={controlId}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel || placeholder}
        aria-disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {selectedOption ? selectedOption.label : emptyLabel}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                selectValue('');
              }}
              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-50 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full min-h-[36px] sm:h-8 sm:min-h-0 pl-8 pr-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto overscroll-contain p-1 space-y-0.5">
            {clearable && !query && (
              <button
                type="button"
                onClick={() => selectValue('')}
                className="w-full min-h-[40px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg text-left text-xs text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
              >
                {emptyLabel}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No matching options found.</p>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => !opt.disabled && selectValue(opt.value)}
                    className={`w-full min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 text-xs ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                        : isHighlighted
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate">{opt.label}</p>
                      {opt.sublabel && <p className="text-[10px] text-[var(--text-muted)] truncate">{opt.sublabel}</p>}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
