import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const STATUS_STYLES = {
  default: {
    border: 'border-[var(--border-subtle)]',
    accentBar: 'bg-[var(--accent-primary)]',
    iconBox: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
  },
  primary: {
    border: 'border-[var(--accent-primary)]/30',
    accentBar: 'bg-[var(--accent-primary)]',
    iconBox: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
  },
  success: {
    border: 'border-[var(--status-success)]/30',
    accentBar: 'bg-[var(--status-success)]',
    iconBox: 'bg-[var(--status-success)]/12 text-[var(--status-success)]',
  },
  warning: {
    border: 'border-[var(--status-warning)]/30',
    accentBar: 'bg-[var(--status-warning)]',
    iconBox: 'bg-[var(--status-warning)]/12 text-[var(--status-warning)]',
  },
  danger: {
    border: 'border-[var(--status-danger)]/30',
    accentBar: 'bg-[var(--status-danger)]',
    iconBox: 'bg-[var(--status-danger)]/12 text-[var(--status-danger)]',
  },
  info: {
    border: 'border-[var(--status-info)]/30',
    accentBar: 'bg-[var(--status-info)]',
    iconBox: 'bg-[var(--status-info)]/12 text-[var(--status-info)]',
  },
};

function renderIcon(icon) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  const IconComp = icon;
  return <IconComp className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.75} />;
}

/**
 * Global KPI stat card with tabular numerals, semantic status border, and trend badge.
 */
export function MetricCard({
  title,
  label,
  value,
  subtitle,
  hint,
  trend,
  icon,
  status = 'default',
  tone,
  loading = false,
  onClick,
  className = '',
}) {
  const activeTone = STATUS_STYLES[tone || status] || STATUS_STYLES.default;
  const displayTitle = title || label || '';
  const displaySubtitle = subtitle || hint || '';

  const parsedTrend =
    typeof trend === 'string' || typeof trend === 'number'
      ? { value: trend, direction: 'neutral' }
      : trend;

  const trendTone =
    parsedTrend?.direction === 'up'
      ? 'text-[var(--status-success)] bg-[var(--status-success)]/10'
      : parsedTrend?.direction === 'down'
        ? 'text-[var(--status-danger)] bg-[var(--status-danger)]/10'
        : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)]';

  const TrendIcon =
    parsedTrend?.direction === 'up'
      ? TrendingUp
      : parsedTrend?.direction === 'down'
        ? TrendingDown
        : Minus;

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden text-left w-full rounded-xl border ${activeTone.border} bg-[var(--bg-surface)] p-3.5 sm:p-4 transition-colors duration-200 ${
        onClick
          ? 'cursor-pointer hover:bg-[var(--bg-elevated)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
          : ''
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${activeTone.accentBar}`}
      />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] truncate">
            {displayTitle}
          </p>
          {loading && (value === undefined || value === null || value === '') ? (
            <div className="mt-2 h-7 w-24 rounded-md skeleton-shimmer" />
          ) : (
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-primary)] tabular-nums truncate">
              {value ?? '0'}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${activeTone.iconBox}`}
          >
            {renderIcon(icon)}
          </div>
        )}
      </div>

      {(displaySubtitle || parsedTrend) && (
        <div className="mt-2.5 pl-1 flex items-center justify-between gap-2 flex-wrap">
          {displaySubtitle ? (
            <span
              title={displaySubtitle}
              className="text-xs text-[var(--text-secondary)] truncate"
            >
              {displaySubtitle}
            </span>
          ) : (
            <span />
          )}

          {parsedTrend && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 ${trendTone}`}
            >
              <TrendIcon className="w-3 h-3" strokeWidth={2} />
              <span>{parsedTrend.value}</span>
              {parsedTrend.label && (
                <span className="font-normal opacity-80">{parsedTrend.label}</span>
              )}
            </span>
          )}
        </div>
      )}
    </Tag>
  );
}

export default MetricCard;
