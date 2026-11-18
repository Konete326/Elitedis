import { useCallback, useState } from 'react';
import { SlidersHorizontal, Zap } from 'lucide-react';

const STORAGE_KEY = 'elitedist_form_mode';

function readInitialFormMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'advanced' ? 'advanced' : 'basic';
  } catch {
    return 'basic';
  }
}

export function useFormMode() {
  const [mode, setModeState] = useState(readInitialFormMode);

  const setMode = useCallback((nextMode) => {
    const normalized = nextMode === 'advanced' ? 'advanced' : 'basic';
    setModeState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  return [mode, setMode];
}

export function FormModeToggle({ mode = 'basic', onChange, className = '' }) {
  return (
    <div
      role="group"
      aria-label="Form detail mode"
      className={`inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange?.('basic')}
        className={`inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-[30px] px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
          mode !== 'advanced'
            ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        <span>Quick / Basic</span>
      </button>
      <button
        type="button"
        onClick={() => onChange?.('advanced')}
        className={`inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-[30px] px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
          mode === 'advanced'
            ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Advanced</span>
      </button>
    </div>
  );
}

export default FormModeToggle;
