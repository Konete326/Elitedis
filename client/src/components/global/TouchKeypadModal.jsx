import React, { useEffect, useState } from 'react';
import { X, Delete, Check, Plus, Minus } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

/**
 * Mobile touch numeric keypad modal (0-9, +, -, Clear, OK) with >=48px targets
 * for Booker, Salesman, POS, and Physical Stock Count quantity entry.
 */
export function TouchKeypadModal({
  isOpen,
  open,
  onClose,
  onConfirm,
  initialValue = '0',
  title = 'Enter Quantity',
  subtitle = '',
  unit,
  units = [],
  allowDecimal = false,
  min = 0,
  max,
  history = [],
}) {
  const active = isOpen ?? open ?? false;
  const { lockScroll, unlockScroll } = useShell();
  const [rawValue, setRawValue] = useState(String(initialValue ?? '0'));
  const [selectedUnit, setSelectedUnit] = useState(unit || units[0] || '');

  useEffect(() => {
    if (!active) return undefined;
    setRawValue(String(initialValue ?? '0'));
    setSelectedUnit(unit || units[0] || '');
    lockScroll?.();
    return () => unlockScroll?.();
  }, [active, initialValue, unit]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (/^[0-9]$/.test(e.key)) {
        appendDigit(e.key);
      } else if (allowDecimal && e.key === '.') {
        appendDot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const clampValue = (num) => {
    let next = num;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    return next;
  };

  const appendDigit = (digit) => {
    setRawValue((prev) => {
      const nextStr = prev === '0' ? digit : `${prev}${digit}`;
      const num = Number(nextStr);
      if (typeof max === 'number' && num > max) return String(max);
      return nextStr;
    });
  };

  const appendDot = () => {
    if (!allowDecimal) return;
    setRawValue((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`));
  };

  const handleBackspace = () => {
    setRawValue((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleStep = (delta) => {
    setRawValue((prev) => {
      const current = Number(prev) || 0;
      return String(clampValue(current + delta));
    });
  };

  const handleConfirm = () => {
    const parsed = clampValue(Number(rawValue) || 0);
    onConfirm?.(parsed, { unit: selectedUnit });
    onClose?.();
  };

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[var(--bg-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden transition-colors duration-200"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keypad"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {units.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {units.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setSelectedUnit(u)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedUnit === u
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {selectedUnit || 'Qty'}
            </span>
            <span className="text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
              {rawValue}
            </span>
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Recent:</span>
              {history.map((chip, idx) => (
                <button
                  key={`${chip}-${idx}`}
                  type="button"
                  onClick={() => setRawValue(String(chip))}
                  className="px-2 py-0.5 rounded-md text-xs font-mono tabular-nums bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-3 grid grid-cols-3 gap-2">
              {DIGITS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => appendDigit(d)}
                  className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-lg font-semibold tabular-nums text-[var(--text-primary)] active:scale-95 transition"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRawValue('0')}
                className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--status-danger)] active:scale-95 transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => appendDigit('0')}
                className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-lg font-semibold tabular-nums text-[var(--text-primary)] active:scale-95 transition"
              >
                0
              </button>
              {allowDecimal ? (
                <button
                  type="button"
                  onClick={appendDot}
                  className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-lg font-semibold text-[var(--text-primary)] active:scale-95 transition"
                >
                  .
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBackspace}
                  aria-label="Backspace"
                  className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition"
                >
                  <Delete className="w-5 h-5" strokeWidth={1.75} />
                </button>
              )}
            </div>

            <div className="col-span-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleStep(1)}
                aria-label="Increment by 1"
                className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-bold active:scale-95 transition"
              >
                <Plus className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => handleStep(-1)}
                aria-label="Decrement by 1"
                className="min-h-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center font-bold active:scale-95 transition"
              >
                <Minus className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 min-h-[104px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition"
              >
                <Check className="w-5 h-5" strokeWidth={2.5} />
                <span>OK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TouchKeypadModal;
