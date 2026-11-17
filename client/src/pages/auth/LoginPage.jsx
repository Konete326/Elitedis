import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { validateField } from '../../utils/validation';
import AuthSplitLayout from './AuthSplitLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, getRoleHomeRoute, login } = useAuth();
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

  const emailError = (touched.email || submitted) ? validateField('email', email, { required: true, label: 'Email address' }) : '';
  const passwordError = (touched.password || submitted) ? validateField('password', password, { required: true, minLength: 6, label: 'Password' }) : '';

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError('');

    if (
      validateField('email', email, { required: true, label: 'Email address' }) ||
      validateField('password', password, { required: true, minLength: 6, label: 'Password' })
    ) {
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
      setServerError(
        error?.response?.data?.message || error?.message || 'Sign in failed. Check your email and password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      mode="login"
      title="Sign in to your account"
      subtitle="Enter your registered email and password to open your role workspace."
    >
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
            Email Address <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              aria-invalid={Boolean(emailError)}
              placeholder="name@company.com"
              className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                emailError ? 'border-[var(--status-danger)]' : ''
              }`}
            />
          </div>
          {emailError && <p className="mt-1 text-xs text-[var(--status-danger)]">{emailError}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
            Password <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              aria-invalid={Boolean(passwordError)}
              placeholder="Enter your password"
              className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                passwordError ? 'border-[var(--status-danger)]' : ''
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
          {passwordError && <p className="mt-1 text-xs text-[var(--status-danger)]">{passwordError}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
