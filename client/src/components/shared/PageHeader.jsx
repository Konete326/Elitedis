import { RefreshCw } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  tabs,
  onRefresh,
  isRefreshing = false,
  className = '',
}) {
  return (
    <div className={`shrink-0 flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>

        {(actions || onRefresh) && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto [&>button]:w-full [&>button]:sm:w-auto [&>a]:w-full [&>a]:sm:w-auto [&>button]:min-h-[40px] [&>button]:sm:min-h-[36px] [&>button]:justify-center">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                <span>Refresh</span>
              </button>
            )}
            {actions}
          </div>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 border-b border-[var(--border-subtle)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors duration-200 ${
                tab.active
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] tabular-nums bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
