import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X, ArrowRight } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

/**
 * Portal-mounted (z-[100]) Coming Soon modal for planned phases and upcoming routes.
 */
export function ComingSoonModal({
  isOpen: propOpen,
  onClose: propClose,
  title: propTitle,
  featureName,
  description: propDescription,
  phase: propPhase,
}) {
  const { comingSoonState, closeComingSoon, lockScroll, unlockScroll } = useShell();
  const isControlled = propOpen !== undefined;
  const active = isControlled ? Boolean(propOpen) : Boolean(comingSoonState?.isOpen);

  const handleClose = () => {
    if (isControlled) {
      propClose?.();
    } else {
      closeComingSoon?.();
    }
  };

  useEffect(() => {
    if (!isControlled || !active) return undefined;
    lockScroll?.();
    return () => unlockScroll?.();
  }, [isControlled, active, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!active || typeof document === 'undefined') return null;

  const title = propTitle || featureName || comingSoonState?.title || 'Scheduled Module';
  const phase = propPhase || comingSoonState?.phase || '';
  const description =
    propDescription ||
    comingSoonState?.description ||
    'This workflow is part of the active ELITE DIST release roadmap and is currently scheduled for upcoming rollout.';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
      onClick={handleClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[var(--bg-overlay)] backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden transition-colors duration-200 animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
              <Clock className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  Planned Release
                </span>
                {phase && (
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    {phase}
                  </span>
                )}
              </div>
              <h3
                id="coming-soon-title"
                className="mt-1 text-base font-bold text-[var(--text-primary)] truncate"
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold transition"
          >
            <span>Continue Working</span>
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ComingSoonModal;
