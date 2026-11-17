import { useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Loader2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { FormModal, ImageDropzone } from '../../components/global';
import { suggestCode, validateField } from '../../utils/validation';

export function buildEmptyDistributor() {
  return {
    distributorId: '',
    distributorName: '',
    ownerName: '',
    email: '',
    phone: '',
    whatsappNo: '',
    adminPassword: '',
    mongodbUri: '',
    status: 'ACTIVE',
    businessProfile: {
      companyTitle: '',
      tagline: '',
      logo: null,
      phonePrimary: '',
      city: '',
      ntn: '',
      strn: '',
      fullAddress: '',
      headerNote: '',
      footerNote: '',
    },
  };
}

export default function DistributorFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  existingCount = 0,
  existingCodes = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || buildEmptyDistributor());
  const [touched, setTouched] = useState({});
  const [uriStatus, setUriStatus] = useState({ testing: false, ok: null, message: '' });

  const idErr = touched.distributorId ? validateField('code', form.distributorId, { required: true, label: 'Distributor Code' }) : '';
  const nameErr = touched.distributorName ? validateField('required', form.distributorName, { required: true, minLength: 2, label: 'Agency Name' }) : '';
  const ownerErr = touched.ownerName ? validateField('required', form.ownerName, { required: true, minLength: 2, label: 'Owner Name' }) : '';
  const emailErr = touched.email ? validateField('email', form.email, { required: true, label: 'Admin Email' }) : '';
  const phoneErr = touched.phone ? validateField('phone', form.phone, { required: true, label: 'Phone' }) : '';
  const passErr = (!isEditing && touched.adminPassword)
    ? validateField('password', form.adminPassword, { required: true, minLength: 8, label: 'Admin Password' })
    : '';

  const updateProfile = (key, value) =>
    setForm((p) => ({ ...p, businessProfile: { ...(p.businessProfile || {}), [key]: value } }));

  const handleTestUri = async () => {
    const uri = String(form.mongodbUri || '').trim();
    if (!uri) {
      setUriStatus({ testing: false, ok: false, message: 'Enter a MongoDB Atlas URI first to test.' });
      return;
    }
    setUriStatus({ testing: true, ok: null, message: 'Testing MongoDB connection...' });
    try {
      const res = await apiClient.post('/super-admin/distributors/test-uri', { mongodbUri: uri });
      const info = res.data?.data || {};
      setUriStatus({
        testing: false,
        ok: true,
        message: res.data?.message || `Connected${info.dbName ? ` (${info.dbName})` : ''}${info.latencyMs ? ` in ${info.latencyMs}ms` : ''}.`,
      });
    } catch (err) {
      setUriStatus({
        testing: false,
        ok: false,
        message: err?.response?.data?.message || 'Connection test failed.',
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ distributorId: true, distributorName: true, ownerName: true, email: true, phone: true, adminPassword: true });
    if (
      validateField('code', form.distributorId, { required: true, label: 'Distributor Code' }) ||
      validateField('required', form.distributorName, { required: true, minLength: 2, label: 'Agency Name' }) ||
      validateField('required', form.ownerName, { required: true, minLength: 2, label: 'Owner Name' }) ||
      validateField('email', form.email, { required: true, label: 'Admin Email' }) ||
      validateField('phone', form.phone, { required: true, label: 'Phone' }) ||
      (!isEditing && validateField('password', form.adminPassword, { required: true, minLength: 8, label: 'Admin Password' }))
    ) {
      return;
    }
    const payload = { ...form };
    if (!payload.adminPassword) delete payload.adminPassword;
    onSave(payload);
  };

  const cls = (err, mono = false) =>
    `w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${mono ? 'font-mono' : ''} ${
      err ? 'border-[var(--status-danger)]' : ''
    }`;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Distributor — ${form.distributorId}` : 'Provision New Distributor Tenant'}
      subtitle="Configure tenant identity, dedicated MongoDB Atlas URI, and optional invoice branding"
      size="xl"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Distributor Code <span className="text-[var(--status-danger)]">*</span>
              </label>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, distributorId: suggestCode('DIST', existingCount, existingCodes) }))}
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              )}
            </div>
            <input
              required
              disabled={isEditing}
              value={form.distributorId}
              onChange={(e) => setForm((p) => ({ ...p, distributorId: e.target.value.toUpperCase() }))}
              onBlur={() => setTouched((p) => ({ ...p, distributorId: true }))}
              placeholder="DIST-001"
              className={`${cls(idErr, true)} disabled:opacity-60`}
            />
            {idErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{idErr}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Distributor / Agency Name <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              required
              value={form.distributorName}
              onChange={(e) => setForm((p) => ({ ...p, distributorName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, distributorName: true }))}
              placeholder="Al-Rehman Traders Lahore"
              className={cls(nameErr)}
            />
            {nameErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameErr}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Owner / Admin Name <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              required
              value={form.ownerName}
              onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, ownerName: true }))}
              placeholder="Muhammad Tariq"
              className={cls(ownerErr)}
            />
            {ownerErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{ownerErr}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Admin Email <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              placeholder="admin@agency.com"
              className={cls(emailErr)}
            />
            {emailErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{emailErr}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Contact Phone <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
              placeholder="03001234567"
              className={`${cls(phoneErr, true)} tabular-nums`}
            />
            {phoneErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{phoneErr}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              WhatsApp No <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
            </label>
            <input
              value={form.whatsappNo}
              onChange={(e) => setForm((p) => ({ ...p, whatsappNo: e.target.value }))}
              placeholder="03001234567"
              className={`${cls('', true)} tabular-nums`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isEditing ? 'Reset Admin Password (Optional)' : <>Initial Admin Password <span className="text-[var(--status-danger)]">*</span></>}
            </label>
            <input
              type="password"
              required={!isEditing}
              value={form.adminPassword}
              onChange={(e) => setForm((p) => ({ ...p, adminPassword: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, adminPassword: true }))}
              placeholder={isEditing ? 'Leave blank to keep unchanged' : 'Min 8 characters'}
              className={cls(passErr)}
            />
            {passErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{passErr}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Tenant Status <span className="text-[var(--status-danger)]">*</span>
            </label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={cls('')}>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-2.5 bg-[var(--bg-canvas)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                Dedicated Tenant MongoDB Atlas URI <span className="normal-case font-normal text-[var(--text-muted)]">(Optional)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleTestUri}
              disabled={uriStatus.testing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold"
            >
              {uriStatus.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
              <span>Test URI Connection</span>
            </button>
          </div>
          <input
            type="password"
            autoComplete="off"
            value={form.mongodbUri}
            onChange={(e) => {
              setForm((p) => ({ ...p, mongodbUri: e.target.value }));
              setUriStatus({ testing: false, ok: null, message: '' });
            }}
            placeholder={
              isEditing && form.hasCustomUri
                ? 'Configured (enter a new URI to replace, or leave blank to keep existing)'
                : 'mongodb+srv://username:password@cluster.mongodb.net/tenant_db'
            }
            className={cls('', true)}
          />
          <p className="text-[11px] text-[var(--text-muted)]">
            Leave blank to share the main Control Plane cluster with strict distributorId isolation, or provide a dedicated cluster URI for physical database isolation.
          </p>
          {uriStatus.message && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${uriStatus.ok ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>
              {uriStatus.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{uriStatus.message}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Pre-Fill Agency &amp; Invoice Branding <span className="normal-case font-normal text-[var(--text-muted)]">(Optional — skips onboarding if filled)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Invoice Header Title (Optional)</label>
                <input value={form.businessProfile?.companyTitle || ''} onChange={(e) => updateProfile('companyTitle', e.target.value)} placeholder="Al-Rehman Distribution Co." className={cls('')} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">City (Optional)</label>
                <input value={form.businessProfile?.city || ''} onChange={(e) => updateProfile('city', e.target.value)} placeholder="Lahore" className={cls('')} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">NTN (Optional)</label>
                <input value={form.businessProfile?.ntn || ''} onChange={(e) => updateProfile('ntn', e.target.value)} placeholder="1234567-8" className={cls('', true)} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Address (Optional)</label>
                <input value={form.businessProfile?.fullAddress || ''} onChange={(e) => updateProfile('fullAddress', e.target.value)} placeholder="Plot 12, Industrial Zone" className={cls('')} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Bill Header Note (Optional)</label>
                <input value={form.businessProfile?.headerNote || ''} onChange={(e) => updateProfile('headerNote', e.target.value)} placeholder="Authorized FMCG Distributor" className={cls('')} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Bill Footer Note (Optional)</label>
                <input value={form.businessProfile?.footerNote || ''} onChange={(e) => updateProfile('footerNote', e.target.value)} placeholder="Thank you for your business!" className={cls('')} />
              </div>
            </div>
            <ImageDropzone label="Agency Logo (Optional)" folder="agencies" value={form.businessProfile?.logo || null} isSubmitting={isSubmitting} onChange={(logo) => updateProfile('logo', logo)} />
          </div>
        </div>
      </div>
    </FormModal>
  );
}
