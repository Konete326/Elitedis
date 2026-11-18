import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import AuthSplitLayout from './AuthSplitLayout';

export default function SignupPage() {
  const { isAuthenticated, getRoleHomeRoute } = useAuth();
  const { openComingSoon } = useShell();

  if (isAuthenticated) {
    return <Navigate to={getRoleHomeRoute()} replace />;
  }

  return (
    <AuthSplitLayout
      mode="signup"
      title="Self-Registration Coming Soon"
      subtitle="New distributor workspaces are currently provisioned by the Super Admin for strict multi-tenant security."
    >
      <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Clock className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-primary)]">
              Tenant Provisioning
            </span>
            <h3 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
              Distributor Sign-Up — Coming Soon
            </h3>
          </div>
        </div>

        <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
          <p className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent-primary)]" />
            <span>
              Each distributor has an isolated tenant configuration and database URI managed by the Platform Super Admin.
            </span>
          </p>
          <p className="pl-6 text-[var(--text-muted)]">
            To get an account for your distribution agency, ask your Super Admin to provision your workspace and send your login credentials.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <Link
            to="/auth/login"
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Sign In</span>
          </Link>
          <button
            type="button"
            onClick={() =>
              openComingSoon({
                title: 'Distributor Self-Registration — Coming Soon',
                description:
                  'Each distributor runs with an isolated database configuration managed by the Super Admin. Ask your Super Admin to create your distributor account.',
                phase: 'Tenant Provisioning',
              })
            }
            className="min-h-[44px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
          >
            View Provisioning Details
          </button>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
