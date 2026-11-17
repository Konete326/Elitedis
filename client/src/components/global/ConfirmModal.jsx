import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Info, Check } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

const TONE_MAP = {
  danger: {
    iconBg: 'bg-[var(--status-danger)]/12 text-[var(--status-danger)]',
    button: 'bg-[var(--status-danger)] hover:opacity-90 text-white',
    Icon: ShieldAlert,
  },
  warning: {
    iconBg: 'bg-[var(--status-warning)]/12 text-[var(--status-warning)]',
    button: 'bg-[var(--status-warning)] hover:opacity-90 text-white',
    Icon: ShieldAlert,
  },
  primary: {
    iconBg: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    button: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
    Icon: Check,
  },
  info: {
    iconBg: 'bg-[var(--status-info)]/12 text-[var(--status-info)]',
    button: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
    Icon: Info,
  },
};

/**
 * Portal-mounted (z-[100]) confirmation / delete-guard modal (replaces native confirm dialog).
 */
export function ConfirmModal({
  isOpen,
  open,
  onClose,
  onCancel,
  onConfirm,
  title = 'Confirm Action',
  message,
  description,
  children,
  confirmLabel,
  confirmText = 'Confirm',
  cancelLabel,
  cancelText = 'Cancel',
  variant = 'danger',
  tone,
  isLoading = false,
  loading = false,
  disableConfirm = false,
  secondaryAction,
}) {
  const active = isOpen ?? open ?? false;
  const busy = isLoading || loading;
  const handleClose = onClose || onCancel;
  const { lockScroll, unlockScroll } = useShell();

  const style = TONE_MAP[tone || variant] || TONE_MAP.danger;
  const StatusIcon = style.Icon;

  useEffect(() => {
    if (!active) return undefined;
    lockScroll?.();
    return () => unlockScroll?.();
  }, [active, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) {
        handleClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, busy, handleClose]);

  if (!active || typeof document === 'undefined') return null;

  const bodyText = message || description;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[var(--bg-overlay)] backdrop-blur-md animate-fade-in"
      onClick={() => !busy && handleClose?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden transition-colors duration-200 animate-scale-in"
      >
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}
          >
            <StatusIcon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-modal-title"
              className="text-base font-semibold text-[var(--text-primary)]"
            >
              {title}
            </h3>
            {bodyText && (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                {bodyText}
              </p>
            )}
            {children && <div className="mt-3">{children}</div>}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleClose?.()}
            aria-label="Close confirmation dialog"
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 px-4 sm:px-5 py-3.5 bg-[var(--bg-elevated)]/60 border-t border-[var(--border-subtle)]">
          {secondaryAction && (
            <button
              type="button"
              disabled={busy}
              onClick={secondaryAction.onClick}
              className="w-full sm:w-auto sm:mr-auto min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs sm:text-sm font-semibold hover:opacity-90 transition"
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleClose?.()}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 transition"
          >
            {cancelLabel || cancelText}
          </button>
          {onConfirm && (
            <button
              type="button"
              disabled={busy || disableConfirm}
              onClick={onConfirm}
              className={`w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${style.button}`}
            >
              {busy ? 'Processing...' : confirmLabel || confirmText}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmModal;
