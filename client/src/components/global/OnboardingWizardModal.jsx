import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { validateField } from '../../utils/validation';
import ImageDropzone from './ImageDropzone';

function extractInitialProfile(agencyProfile, user) {
  const bp = agencyProfile?.businessProfile || {};
  return {
    companyTitle: bp.companyTitle || agencyProfile?.distributorName || user?.distributorName || '',
    tagline: bp.tagline || '',
    phonePrimary: bp.phonePrimary || agencyProfile?.phone || user?.phone || '',
    city: bp.city || '',
    fullAddress: bp.fullAddress || '',
    ntn: bp.ntn || '',
    strn: bp.strn || '',
    headerNote: bp.headerNote || '',
    footerNote: bp.footerNote || '',
    logo: bp.logo?.url ? bp.logo : null,
    showLogo: bp.showLogo !== false,
  };
}

/**
 * Portal-mounted (z-[100]) skippable Agency & Invoice Branding Onboarding Modal.
 * Auto-opens once per session for ADMIN when onboarding is pending, or anytime via openAgencyProfileModal().
 */
export function OnboardingWizardModal() {
  const { user, agencyProfile, updateAgencyProfile, skipAgencyOnboarding } = useAuth();
  const { isAgencyProfileOpen, openAgencyProfileModal, closeAgencyProfileModal, lockScroll, unlockScroll, addToast } = useShell();
  const [form, setForm] = useState(() => extractInitialProfile(agencyProfile, user));
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const autoPromptedRef = useRef(false);

  useEffect(() => {
    if (autoPromptedRef.current || user?.primaryRole !== 'ADMIN' || !agencyProfile) return;
    if (agencyProfile.onboardingCompleted || agencyProfile.onboardingSkipped) return;
    const key = `elitedist_onboard_prompted_${user?.distributorId || 'default'}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch { /* ignore storage errors */ }
    autoPromptedRef.current = true;
    openAgencyProfileModal?.();
  }, [user?.primaryRole, user?.distributorId, agencyProfile, openAgencyProfileModal]);

  useEffect(() => {
    if (!isAgencyProfileOpen) return undefined;
    setForm(extractInitialProfile(agencyProfile, user));
    setTouched({});
    lockScroll?.();
    return () => unlockScroll?.();
  }, [isAgencyProfileOpen, agencyProfile, user, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!isAgencyProfileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) closeAgencyProfileModal?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAgencyProfileOpen, submitting, closeAgencyProfileModal]);

  if (!isAgencyProfileOpen || typeof document === 'undefined') return null;

  const titleErr = touched.companyTitle ? validateField('required', form.companyTitle, { required: true, minLength: 2, label: 'Agency Title' }) : '';
  const phoneErr = touched.phonePrimary ? validateField('phone', form.phonePrimary, { required: true, label: 'Contact Phone' }) : '';
  const ntnErr = touched.ntn && form.ntn.trim() ? validateField('ntn', form.ntn) : '';
  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched({ companyTitle: true, phonePrimary: true, ntn: true });
    if (
      validateField('required', form.companyTitle, { required: true, minLength: 2, label: 'Agency Title' }) ||
      validateField('phone', form.phonePrimary, { required: true, label: 'Contact Phone' }) ||
      (form.ntn.trim() && validateField('ntn', form.ntn))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await updateAgencyProfile?.({ businessProfile: form });
      addToast?.({ type: 'success', message: 'Agency branding saved and synced to invoice headers.' });
      closeAgencyProfileModal?.();
    } catch (err) {
      addToast?.({ type: 'error', message: err?.response?.data?.message || 'Could not update agency branding.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await skipAgencyOnboarding?.();
      addToast?.({ type: 'info', message: 'Skipped for now. You can configure branding anytime from the sidebar.' });
    } catch { /* ignore skip errors */ } finally {
      setSubmitting(false);
      closeAgencyProfileModal?.();
    }
  };

  const inputCls = (err, mono = false) =>
    `w-full min-h-[40px] sm:h-9 sm:min-h-0 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
      mono ? 'font-mono' : ''
    } ${err ? 'border-[var(--status-danger)]' : 'border-[var(--border-subtle)]'}`;

  const isCompleted = Boolean(agencyProfile?.onboardingCompleted);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agency and Invoice Branding Setup"
      onClick={() => !submitting && closeAgencyProfileModal?.()}
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-5 bg-[var(--bg-overlay)] backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[94dvh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
              <Building2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">Agency &amp; Invoice Branding</h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">Appears automatically on every printed invoice, chillan, and report.</p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => closeAgencyProfileModal?.()}
            aria-label="Close setup modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSave} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Agency Title <span className="text-[var(--status-danger)]">*</span>
                </label>
                <input
                  required
                  value={form.companyTitle}
                  onChange={(e) => setField('companyTitle', e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, companyTitle: true }))}
                  placeholder="ELITE DIST Traders"
                  className={inputCls(titleErr)}
                />
                {titleErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{titleErr}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Contact Phone <span className="text-[var(--status-danger)]">*</span>
                </label>
                <input
                  required
                  value={form.phonePrimary}
                  onChange={(e) => setField('phonePrimary', e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, phonePrimary: true }))}
                  placeholder="03001234567"
                  className={`${inputCls(phoneErr, true)} tabular-nums`}
                />
                {phoneErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{phoneErr}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  City <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                </label>
                <input value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Karachi / Lahore" className={inputCls('')} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  NTN / STRN <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.ntn}
                    onChange={(e) => setField('ntn', e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, ntn: true }))}
                    placeholder="NTN 1234567-8"
                    className={inputCls(ntnErr, true)}
                  />
                  <input value={form.strn} onChange={(e) => setField('strn', e.target.value)} placeholder="STRN (Optional)" className={inputCls('', true)} />
                </div>
                {ntnErr && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{ntnErr}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Full Address <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                </label>
                <input value={form.fullAddress} onChange={(e) => setField('fullAddress', e.target.value)} placeholder="Plot 01, Main Wholesale Market" className={inputCls('')} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Header Note <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                </label>
                <input value={form.headerNote} onChange={(e) => setField('headerNote', e.target.value)} placeholder="Authorized FMCG Distributor" className={inputCls('')} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Footer Note <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                </label>
                <input value={form.footerNote} onChange={(e) => setField('footerNote', e.target.value)} placeholder="Goods once sold are subject to policy." className={inputCls('')} />
              </div>
            </div>

            <ImageDropzone label="Agency Logo (Optional)" folder="agency" value={form.logo} isSubmitting={submitting} onChange={(logo) => setField('logo', logo)} />
          </div>

          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60">
            <button
              type="button"
              disabled={submitting}
              onClick={isCompleted ? () => closeAgencyProfileModal?.() : handleSkip}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40"
            >
              {isCompleted ? 'Cancel' : 'Skip for Now'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold disabled:opacity-50"
            >
              <Check className="w-4 h-4" strokeWidth={2} />
              <span>{submitting ? 'Syncing...' : 'Save & Sync to Invoices'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default OnboardingWizardModal;
