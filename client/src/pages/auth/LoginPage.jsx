import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useShell } from '../../context/ShellContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, getRoleHomeRoute, login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useShell();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={getRoleHomeRoute()} replace />;
  }

  const emailInvalid = (touched.email || submitted) && (!email.trim() || !email.includes('@'));
  const passwordInvalid = (touched.password || submitted) && password.length < 6;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError('');

    if (!email.trim() || !email.includes('@') || password.length < 6) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login({ email: email.trim(), password });
      addToast({
        type: 'success',
        title: 'Signed in',
        message: `Welcome back, ${result?.user?.fullName || 'Operator'}.`,
      });
      const redirectTo = location.state?.from?.pathname || result.homeRoute;
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Sign in failed. Check your email and password.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between border-r bg-[var(--bg-surface)] p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0284C7] text-white font-bold">
            ED
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              {import.meta.env.VITE_APP_NAME || 'ELITE DIST ERP'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Distribution ERP &amp; Sales Force Automation
            </p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <span className="inline-block rounded-full border bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            Unified Operations
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Inventory, dispatch, field booking, and double-entry ledgers in one system.
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Sign in with your distributor or staff account to open your assigned role workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border bg-[var(--bg-canvas)] p-3">
            <p className="font-semibold text-[var(--text-primary)]">Batch &amp; Warehouse</p>
            <p className="mt-1 text-[var(--text-muted)]">Zone, floor, rack &amp; expiry control</p>
          </div>
          <div className="rounded-lg border bg-[var(--bg-canvas)] p-3">
            <p className="font-semibold text-[var(--text-primary)]">2-Level Invoicing</p>
            <p className="mt-1 text-[var(--text-muted)]">Schemes, discounts &amp; recovery</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#0284C7] text-white text-sm font-bold">
              ED
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {import.meta.env.VITE_APP_NAME || 'ELITE DIST ERP'}
            </span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-2 rounded-lg border bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] theme-transition"
            >
              {isDark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-xl border bg-[var(--bg-surface)] p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Sign in to your account</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Enter your email address and password to continue.
          </p>

          {serverError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--status-danger)] bg-red-500/10 px-3 py-2.5 text-sm text-[var(--status-danger)]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  aria-invalid={emailInvalid}
                  placeholder="name@company.com"
                  className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                    emailInvalid ? 'border-[var(--status-danger)]' : ''
                  }`}
                />
              </div>
              {emailInvalid && (
                <p className="mt-1 text-xs text-[var(--status-danger)]">
                  Enter a valid email address.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  aria-invalid={passwordInvalid}
                  placeholder="Enter your password"
                  className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                    passwordInvalid ? 'border-[var(--status-danger)]' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordInvalid && (
                <p className="mt-1 text-xs text-[var(--status-danger)]">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 theme-transition"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 border-t pt-4 text-center text-xs text-[var(--text-secondary)]">
            Need a new distributor workspace?{' '}
            <Link to="/auth/signup" className="font-semibold text-[var(--accent-primary)] hover:underline">
              Create distributor account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          ELITE DIST Distribution Management Platform
        </p>
      </div>
    </div>
  );
}
