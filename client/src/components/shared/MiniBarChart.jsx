import { BarChart3 } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

/**
 * Fixed-height responsive horizontal bar breakdown chart (zero purple, ResizeObserver-safe).
 */
export function MiniBarChart({
  title,
  subtitle,
  items = [],
  valueFormatter = (v) => formatNumber(v),
  emptyLabel = 'No activity recorded yet.',
}) {
  const maxVal = Math.max(
    1,
    ...items.map((item) => Math.max(0, Number(item.value) || 0))
  );

  return (
    <div className="h-56 min-w-0 flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 theme-transition">
      <div className="shrink-0 flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>
          )}
        </div>
        <BarChart3 className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" strokeWidth={1.75} />
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] text-center">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {items.map((item, idx) => {
            const val = Math.max(0, Number(item.value) || 0);
            const pct = Math.min(100, Math.round((val / maxVal) * 100));
            return (
              <div key={item.label || idx} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[var(--text-secondary)] truncate">
                    {item.label}
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)] shrink-0">
                    {valueFormatter(val)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.tone === 'cyan'
                        ? 'bg-[var(--accent-cyan)]'
                        : item.tone === 'success'
                          ? 'bg-[var(--status-success)]'
                          : item.tone === 'warning'
                            ? 'bg-[var(--status-warning)]'
                            : 'bg-[var(--accent-primary)]'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MiniBarChart;
