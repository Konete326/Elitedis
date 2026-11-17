import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[96vw]',
};

/**
 * Reusable z-50 slide-over drawer or centered modal with Esc close and ShellContext scroll lock cleanup.
 */
export function FormModal({
  isOpen,
  open,
  onClose,
  title,
  subtitle,
  variant = 'drawer',
  mode,
  size = 'lg',
  onSubmit,
  submitLabel = 'Save Record',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  footer,
  closeOnBackdrop = true,
  children,
  className = '',
}) {
  const active = isOpen ?? open ?? false;
  const resolvedMode = mode || variant;
  const isDrawer = resolvedMode === 'drawer';
  const { lockScroll, unlockScroll } = useShell();

  useEffect(() => {
    if (!active) return undefined;
    lockScroll?.();
    return () => unlockScroll?.();
  }, [active, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, isSubmitting, onClose]);

  if (!active) return null;

  const widthClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg;

  const content = (
    <>
      <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)] truncate">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onClose?.()}
          aria-label="Close form"
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-40 transition"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">{children}</div>

      {(footer || onSubmit) && (
        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60">
          {footer || (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onClose?.()}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 transition"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => closeOnBackdrop && !isSubmitting && onClose?.()}
      className={`fixed inset-0 z-50 flex bg-[var(--bg-overlay)] backdrop-blur-sm ${
        isDrawer ? 'justify-end' : 'items-center justify-center p-3 sm:p-5'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${widthClass} flex flex-col bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-2xl overflow-hidden transition-colors duration-200 ${
          isDrawer
            ? 'h-full border-l'
            : 'max-h-[92dvh] rounded-2xl border'
        } ${className}`}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export default FormModal;
