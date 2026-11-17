import { Link } from 'react-router-dom';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function AuthSplitLayout({ mode = 'login', title, subtitle, children }) {
  const { isDark, toggleTheme } = useTheme();
  const appName = import.meta.env.VITE_APP_NAME || 'ELITE DIST ERP';

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-[var(--bg-canvas)] text-[var(--text-primary)] animate-fade-in">
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0284C7] text-white font-bold shadow-sm">
            ED
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-[var(--text-primary)]">{appName}</p>
            <p className="text-xs text-[var(--text-muted)]">Distribution ERP &amp; Sales Force Automation</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Multi-Tenant Cloud Platform</span>
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            Inventory, dispatch, field booking, and double-entry ledgers in one workspace.
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Sign in to your existing distributor tenant or launch a new isolated agency workspace with custom invoice branding.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5">
            <p className="font-semibold text-[var(--text-primary)]">Batch &amp; Warehouse</p>
            <p className="mt-1 text-[var(--text-muted)]">Zone, floor, rack &amp; expiry control</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5">
            <p className="font-semibold text-[var(--text-primary)]">2-Level Invoicing</p>
            <p className="mt-1 text-[var(--text-muted)]">Schemes, discounts &amp; live recovery</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#0284C7] text-white text-sm font-bold">
              ED
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)]">{appName}</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {isDark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto my-6 w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm animate-scale-in">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1 mb-5">
            <Link
              to="/auth/login"
              className={`text-center py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sign In
            </Link>
            <Link
              to="/auth/signup"
              className={`text-center py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Create Distributor Account
            </Link>
          </div>

          <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>

          {children}
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          ELITE DIST Distribution Management Platform
        </p>
      </div>
    </div>
  );
}
