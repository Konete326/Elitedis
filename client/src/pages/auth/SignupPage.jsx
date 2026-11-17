import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { validateField } from '../../utils/validation';
import AuthSplitLayout from './AuthSplitLayout';

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, getRoleHomeRoute, register } = useAuth();
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

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const markTouched = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  const rawErrors = {
    fullName: validateField('required', form.fullName, { required: true, minLength: 2, label: 'Full name' }),
    distributorName: validateField('required', form.distributorName, { required: true, minLength: 2, label: 'Agency name' }),
    email: validateField('email', form.email, { required: true, label: 'Email address' }),
    phone: validateField('phone', form.phone, { required: true, label: 'Contact number' }),
    password: validateField('password', form.password, { required: true, minLength: 8, label: 'Password' }),
    confirmPassword: form.confirmPassword !== form.password ? 'Passwords do not match.' : '',
  };

  const errors = {
    fullName: (touched.fullName || submitted) ? rawErrors.fullName : '',
    distributorName: (touched.distributorName || submitted) ? rawErrors.distributorName : '',
    email: (touched.email || submitted) ? rawErrors.email : '',
    phone: (touched.phone || submitted) ? rawErrors.phone : '',
    password: (touched.password || submitted) ? rawErrors.password : '',
    confirmPassword: (touched.confirmPassword || submitted) ? rawErrors.confirmPassword : '',
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError('');

    if (Object.values(rawErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      const result = await register({
        fullName: form.fullName.trim(),
        distributorName: form.distributorName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      addToast({ type: 'success', title: 'Workspace created', message: 'Your distributor account is ready.' });
      navigate(result.token ? result.homeRoute : '/auth/login', { replace: true });
    } catch (error) {
      setServerError(
        error?.response?.data?.message || error?.message || 'Registration could not be completed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = (hasErr, withRightPad = false) =>
    `w-full rounded-lg border bg-[var(--bg-canvas)] pl-9 ${withRightPad ? 'pr-10' : 'pr-3'} py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
      hasErr ? 'border-[var(--status-danger)]' : ''
    }`;

  return (
    <AuthSplitLayout
      mode="signup"
      title="Create distributor workspace"
      subtitle="Set up an isolated agency workspace for your products, warehouses, and field team."
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

      <form onSubmit={handleSubmit} noValidate className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-2">
          <label htmlFor="reg-fullname" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Owner / Full Name <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-fullname"
              name="fullName"
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              onBlur={() => markTouched('fullName')}
              aria-invalid={Boolean(errors.fullName)}
              placeholder="Iftikhar Ahmed"
              className={inputClass(errors.fullName)}
            />
          </div>
          {errors.fullName && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.fullName}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="reg-agency" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Distribution Agency Name <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-agency"
              name="organization"
              type="text"
              autoComplete="organization"
              value={form.distributorName}
              onChange={(e) => updateField('distributorName', e.target.value)}
              onBlur={() => markTouched('distributorName')}
              aria-invalid={Boolean(errors.distributorName)}
              placeholder="Al-Rehman Traders Karachi"
              className={inputClass(errors.distributorName)}
            />
          </div>
          {errors.distributorName && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.distributorName}</p>}
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Email Address <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              onBlur={() => markTouched('email')}
              aria-invalid={Boolean(errors.email)}
              placeholder="owner@agency.com"
              className={inputClass(errors.email)}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="reg-phone" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Contact Number <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              onBlur={() => markTouched('phone')}
              aria-invalid={Boolean(errors.phone)}
              placeholder="03001234567"
              className={`${inputClass(errors.phone)} tabular-nums`}
            />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Password <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-password"
              name="newPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              onBlur={() => markTouched('password')}
              aria-invalid={Boolean(errors.password)}
              placeholder="Min 8 characters"
              className={inputClass(errors.password, true)}
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
          {errors.password && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
            Confirm Password <span className="text-[var(--status-danger)]">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              id="reg-confirm"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              onBlur={() => markTouched('confirmPassword')}
              aria-invalid={Boolean(errors.confirmPassword)}
              placeholder="Repeat password"
              className={inputClass(errors.confirmPassword)}
            />
          </div>
          {errors.confirmPassword && <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.confirmPassword}</p>}
        </div>

        <div className="sm:col-span-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {isSubmitting ? 'Creating workspace...' : 'Register Distributor'}
          </button>
        </div>
      </form>
    </AuthSplitLayout>
  );
}
