import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Eye, EyeOff, Lock, Mail, Moon, Phone, Sun, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useShell } from '../../context/ShellContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, getRoleHomeRoute, register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useShell();

  const [form, setForm] = useState({
    fullName: '',
    distributorName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={getRoleHomeRoute()} replace />;
  }

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const errors = {
    fullName: (touched.fullName || submitted) && form.fullName.trim().length < 2,
    distributorName: (touched.distributorName || submitted) && form.distributorName.trim().length < 2,
    email: (touched.email || submitted) && (!form.email.trim() || !form.email.includes('@')),
    phone: (touched.phone || submitted) && form.phone.trim().length < 7,
    password: (touched.password || submitted) && form.password.length < 8,
    confirmPassword:
      (touched.confirmPassword || submitted) && form.confirmPassword !== form.password,
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError('');

    const hasError =
      form.fullName.trim().length < 2 ||
      form.distributorName.trim().length < 2 ||
      !form.email.includes('@') ||
      form.phone.trim().length < 7 ||
      form.password.length < 8 ||
      form.confirmPassword !== form.password;

    if (hasError) return;

    setIsSubmitting(true);
    try {
      const result = await register({
        fullName: form.fullName.trim(),
        distributorName: form.distributorName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      addToast({
        type: 'success',
        title: 'Account created',
        message: 'Your distributor account is ready.',
      });
      if (result.token) {
        navigate(result.homeRoute, { replace: true });
      } else {
        navigate('/auth/login', { replace: true });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Registration could not be completed.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between p-4 sm:p-8 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#0284C7] text-white text-sm font-bold">
            ED
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {import.meta.env.VITE_APP_NAME || 'ELITE DIST ERP'}
          </span>
        </div>
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

      <div className="mx-auto my-6 w-full max-w-lg rounded-xl border bg-[var(--bg-surface)] p-6 sm:p-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Create distributor workspace</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Set up an isolated agency workspace for your products, warehouses, and field team.
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

        <form onSubmit={handleSubmit} noValidate className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="reg-fullname" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Owner / Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-fullname"
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                onBlur={() => markTouched('fullName')}
                aria-invalid={errors.fullName}
                placeholder="Iftikhar Ahmed"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.fullName ? 'border-[var(--status-danger)]' : ''
                }`}
              />
            </div>
            {errors.fullName && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Enter your full name.</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="reg-agency" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Distribution Agency Name
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-agency"
                type="text"
                value={form.distributorName}
                onChange={(e) => updateField('distributorName', e.target.value)}
                onBlur={() => markTouched('distributorName')}
                aria-invalid={errors.distributorName}
                placeholder="Al-Rehman Traders Karachi"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.distributorName ? 'border-[var(--status-danger)]' : ''
                }`}
              />
            </div>
            {errors.distributorName && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Enter your agency name.</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                onBlur={() => markTouched('email')}
                aria-invalid={errors.email}
                placeholder="owner@agency.com"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.email ? 'border-[var(--status-danger)]' : ''
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Enter a valid email.</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-phone" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Contact Number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                onBlur={() => markTouched('phone')}
                aria-invalid={errors.phone}
                placeholder="03001234567"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.phone ? 'border-[var(--status-danger)]' : ''
                }`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Enter a valid phone number.</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                onBlur={() => markTouched('password')}
                aria-invalid={errors.password}
                placeholder="Min 8 characters"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.password ? 'border-[var(--status-danger)]' : ''
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
            {errors.password && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Minimum 8 characters required.</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                onBlur={() => markTouched('confirmPassword')}
                aria-invalid={errors.confirmPassword}
                placeholder="Repeat password"
                className={`w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                  errors.confirmPassword ? 'border-[var(--status-danger)]' : ''
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-[var(--status-danger)]">Passwords do not match.</p>
            )}
          </div>

          <div className="sm:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 theme-transition"
            >
              {isSubmitting ? 'Creating workspace...' : 'Register Distributor'}
            </button>
          </div>
        </form>

        <div className="mt-5 border-t pt-4 text-center text-xs text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-semibold text-[var(--accent-primary)] hover:underline">
            Sign in instead
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-muted)]">
        ELITE DIST Distribution Management Platform
      </p>
    </div>
  );
}
