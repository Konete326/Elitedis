import { useState } from 'react';
import { FormModal, ImageDropzone } from '../../components/global';
import { suggestCode, validateField } from '../../utils/validation';

export function buildEmptyCompany() {
  return {
    companyCode: '',
    companyName: '',
    shortName: '',
    ownerName: '',
    supplierName: '',
    accountantName: '',
    businessType: 'MANUFACTURER',
    industryType: '',
    ntn: '',
    registrationNo: '',
    status: 'ACTIVE',
    logo: null,
    address: { country: 'PAKISTAN', province: '', city: '', zone: '', streetAddress: '' },
    contacts: [{ personName: '', role: 'Supplier', contactNo: '', channelType: 'WHATSAPP', isDefault: true }],
    socialLinks: [],
    bankAccounts: [],
  };
}

export default function CompanyFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  existingCount = 0,
  existingCodes = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || buildEmptyCompany());
  const [touched, setTouched] = useState({});

  const codeError = touched.companyCode ? validateField('code', form.companyCode, { required: true, label: 'Company Code' }) : '';
  const nameError = touched.companyName ? validateField('required', form.companyName, { required: true, minLength: 2, label: 'Company Name' }) : '';

  const updateSubRow = (field, index, key, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addSubRow = (field, template) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], template] }));
  };

  const removeSubRow = (field, index) => {
    setForm((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Company Profile' : 'New Company / Supplier'}
      size="xl"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ companyCode: true, companyName: true });
        if (
          validateField('code', form.companyCode, { required: true, label: 'Company Code' }) ||
          validateField('required', form.companyName, { required: true, minLength: 2, label: 'Company Name' })
        ) {
          return;
        }
        const cleanedPayload = {
          ...form,
          companyCode: String(form.companyCode || '').trim().toUpperCase(),
          companyName: String(form.companyName || '').trim(),
          contacts: (form.contacts || [])
            .filter((c) => c?.personName?.trim() || c?.contactNo?.trim())
            .map((c) => ({
              ...c,
              personName: c.personName?.trim() || c.role?.trim() || 'Contact',
              role: c.role?.trim() || '',
              contactNo: c.contactNo?.trim() || '',
            })),
          bankAccounts: (form.bankAccounts || [])
            .filter((a) => a?.providerName?.trim() || a?.accountTitle?.trim() || a?.accountNo?.trim())
            .map((a) => ({
              ...a,
              providerName: a.providerName?.trim() || '',
              accountTitle: a.accountTitle?.trim() || '',
              accountNo: a.accountNo?.trim() || '',
            })),
          socialLinks: (form.socialLinks || [])
            .filter((s) => s?.platform?.trim() || s?.url?.trim())
            .map((s) => ({
              ...s,
              platform: s.platform?.trim() || '',
              url: s.url?.trim() || '',
            })),
        };
        onSave(cleanedPayload);
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Company Code <span className="text-[var(--status-danger)]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, companyCode: suggestCode('COMP', existingCount, existingCodes) }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              </div>
              <input
                aria-required="true"
                value={form.companyCode}
                onChange={(e) => setForm((p) => ({ ...p, companyCode: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, companyCode: true }))}
                placeholder="COMP-001"
                aria-invalid={Boolean(codeError)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Company Name <span className="text-[var(--status-danger)]">*</span>
              </label>
              <input
                aria-required="true"
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, companyName: true }))}
                placeholder="Green Chemicals"
                aria-invalid={Boolean(nameError)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Name <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
              <input value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier / Rep Name <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
              <input value={form.supplierName} onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Business Type <span className="text-[var(--status-danger)]">*</span></label>
              <select value={form.businessType} onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                <option value="MANUFACTURER">Manufacturer</option>
                <option value="IMPORTER">Importer</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="SUPPLIER">Supplier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">City <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
              <input value={form.address?.city || ''} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} placeholder="Karachi" className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
            </div>
          </div>
          <ImageDropzone label="Company Logo (Optional)" folder="companies" value={form.logo} isSubmitting={isSubmitting} onChange={(logo) => setForm((p) => ({ ...p, logo }))} />
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">Contact Persons (Optional)</span>
            <button type="button" onClick={() => addSubRow('contacts', { personName: '', role: '', contactNo: '', channelType: 'WHATSAPP', isDefault: false })} className="text-xs font-semibold text-[var(--accent-primary)] hover:underline">
              + Add Contact
            </button>
          </div>
          {form.contacts.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">No contact rows added. Click &ldquo;+ Add Contact&rdquo; if needed.</p>
          )}
          {form.contacts.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <input placeholder="Person Name (Optional)" value={c.personName} onChange={(e) => updateSubRow('contacts', idx, 'personName', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
              <input placeholder="Role (Optional)" value={c.role} onChange={(e) => updateSubRow('contacts', idx, 'role', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
              <input placeholder="Phone / WhatsApp (Optional)" value={c.contactNo} onChange={(e) => updateSubRow('contacts', idx, 'contactNo', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono" />
              <div className="flex items-center justify-between gap-2">
                <select value={c.channelType} onChange={(e) => updateSubRow('contacts', idx, 'channelType', e.target.value)} className="h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs flex-1">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PHONE">Phone</option>
                  <option value="LANDLINE">Landline</option>
                </select>
                <button type="button" onClick={() => removeSubRow('contacts', idx)} className="text-xs text-[var(--status-danger)]">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">Bank &amp; Wallet Accounts (Optional)</span>
            <button type="button" onClick={() => addSubRow('bankAccounts', { accountType: 'BANK', providerName: '', accountTitle: '', accountNo: '', ibanOrRef: '' })} className="text-xs font-semibold text-[var(--accent-primary)] hover:underline">
              + Add Account
            </button>
          </div>
          {form.bankAccounts.map((acc, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
              <select value={acc.accountType} onChange={(e) => updateSubRow('bankAccounts', idx, 'accountType', e.target.value)} className="h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs">
                <option value="BANK">Bank</option>
                <option value="EASYPAISA">EasyPaisa</option>
                <option value="JAZZCASH">JazzCash</option>
              </select>
              <input placeholder="Bank / Provider" value={acc.providerName || ''} onChange={(e) => updateSubRow('bankAccounts', idx, 'providerName', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
              <input placeholder="Account Title" value={acc.accountTitle || ''} onChange={(e) => updateSubRow('bankAccounts', idx, 'accountTitle', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
              <input placeholder="Account No / IBAN" value={acc.accountNo || ''} onChange={(e) => updateSubRow('bankAccounts', idx, 'accountNo', e.target.value)} className="h-8 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono" />
              <button type="button" onClick={() => removeSubRow('bankAccounts', idx)} className="text-xs text-[var(--status-danger)] sm:text-right">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </FormModal>
  );
}
