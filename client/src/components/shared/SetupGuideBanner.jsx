import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Info, X } from 'lucide-react';

function readDismissedState(storageKey) {
  try {
    return sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

/**
 * Prerequisite Setup Guide Banner: hides while loading, supports sessionStorage Dismiss,
 * distinguishes optional setup hints, and provides 1-click navigation links.
 */
export function SetupGuideBanner({
  steps = [],
  missingMessage = '',
  title = 'Quick Setup Required',
  isLoading = false,
  optional = false,
  isOptional = false,
  className = '',
}) {
  const storageKey = `elitedist_guide_dismissed_${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const [dismissed, setDismissed] = useState(() => readDismissedState(storageKey));

  if (isLoading || dismissed) return null;

  const incompleteSteps = steps.filter((step) => !step.done);
  if (steps.length > 0 && incompleteSteps.length === 0) return null;
  if (steps.length === 0 && !missingMessage) return null;

  const showOptional = optional || isOptional;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // Ignore storage quota errors
    }
  };

  return (
    <div
      role="status"
      className={`animate-fade-in shrink-0 rounded-xl border p-3.5 sm:p-4 transition-colors duration-200 ${
        showOptional
          ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]/50'
          : 'border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            showOptional
              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
              : 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]'
          }`}
        >
          <Info className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{title}</h3>
              {showOptional && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  Optional Guide
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss setup guide"
              title="Dismiss"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            {missingMessage ||
              (showOptional
                ? 'These setup steps are optional, or you can configure them now for structured reporting.'
                : 'Create these required records first so dropdowns and links work smoothly.')}
          </p>

          {steps.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {steps.map((step, idx) => (
                <div
                  key={step.label || idx}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                    step.done
                      ? 'border-[var(--status-success)]/30 bg-[var(--bg-surface)]/80 text-[var(--text-muted)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums ${
                        step.done
                          ? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
                          : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {step.done ? <Check className="w-3 h-3" strokeWidth={2.5} /> : idx + 1}
                    </span>
                    <span className={`truncate font-medium ${step.done ? 'line-through' : ''}`}>
                      {step.label}
                    </span>
                  </div>

                  {!step.done && (step.to || step.onAction) && (
                    step.to ? (
                      <Link
                        to={step.to}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-semibold transition-colors"
                      >
                        <span>{step.actionLabel || 'Create'}</span>
                        <ArrowRight className="w-3 h-3" strokeWidth={2} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={step.onAction}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-semibold transition-colors"
                      >
                        <span>{step.actionLabel || 'Create'}</span>
                        <ArrowRight className="w-3 h-3" strokeWidth={2} />
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetupGuideBanner;
