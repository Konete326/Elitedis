import { getStatusTone } from '../../utils/formatters';

const TONE_CLASSES = {
  success: 'bg-[var(--status-success)]/12 text-[var(--status-success)] border-[var(--status-success)]/30',
  warning: 'bg-[var(--status-warning)]/12 text-[var(--status-warning)] border-[var(--status-warning)]/30',
  danger: 'bg-[var(--status-danger)]/12 text-[var(--status-danger)] border-[var(--status-danger)]/30',
  info: 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/30',
  muted: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
};

export function StatusBadge({ status, label, tone, className = '' }) {
  const resolvedTone = tone || getStatusTone(status);
  const style = TONE_CLASSES[resolvedTone] || TONE_CLASSES.info;
  const text = label || String(status || 'ACTIVE').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${style} ${className}`}
    >
      {text}
    </span>
  );
}

export default StatusBadge;
