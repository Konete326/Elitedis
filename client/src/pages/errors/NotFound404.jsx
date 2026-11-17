import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function NotFound404() {
  const navigate = useNavigate();
  const { isAuthenticated, getRoleHomeRoute } = useAuth();
  const homePath = isAuthenticated ? getRoleHomeRoute() : '/auth/login';

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="w-full max-w-lg rounded-xl border bg-[var(--bg-surface)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Compass className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <p className="tabular-nums text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The page URL you entered does not exist or has moved to another section.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] theme-transition"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate(homePath, { replace: true })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] theme-transition"
          >
            <Home className="h-4 w-4" strokeWidth={1.75} />
            {isAuthenticated ? 'Go to Workspace' : 'Go to Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
