import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ShieldAlert, Info, X } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

const TOAST_STYLES = {
  success: {
    border: 'border-[var(--status-success)]/40',
    badge: 'bg-[var(--status-success)]/15 text-[var(--status-success)]',
    Icon: Check,
  },
  error: {
    border: 'border-[var(--status-danger)]/40',
    badge: 'bg-[var(--status-danger)]/15 text-[var(--status-danger)]',
    Icon: ShieldAlert,
  },
  danger: {
    border: 'border-[var(--status-danger)]/40',
    badge: 'bg-[var(--status-danger)]/15 text-[var(--status-danger)]',
    Icon: ShieldAlert,
  },
  warning: {
    border: 'border-[var(--status-warning)]/40',
    badge: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]',
    Icon: ShieldAlert,
  },
  info: {
    border: 'border-[var(--accent-primary)]/40',
    badge: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    Icon: Info,
  },
};

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const ms = toast.duration > 0 ? toast.duration : 5000;
    const id = setTimeout(() => onDismiss?.(toast.id), ms);
    return () => clearTimeout(id);
  }, [toast.id, toast.duration, onDismiss]);

  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const ToastIcon = style.Icon;

  return (
    <div
      role="status"
      className={`animate-slide-up pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${style.border} bg-[var(--bg-surface)] shadow-xl transition-colors duration-200`}
    >
      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${style.badge}`}>
        <ToastIcon className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-xs font-semibold text-[var(--text-primary)]">{toast.title}</p>}
        {toast.message && <p className="text-xs sm:text-sm text-[var(--text-secondary)] break-words">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss?.(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Portal-mounted (z-[110]) bottom-right stacked toast notifications with 5s auto-dismiss safety.
 */
export function ToastContainer() {
  const { toasts = [], removeToast } = useShell();

  if (!toasts.length || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4 z-[110] flex flex-col gap-2 sm:w-96 max-w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>,
    document.body
  );
}

export default ToastContainer;
