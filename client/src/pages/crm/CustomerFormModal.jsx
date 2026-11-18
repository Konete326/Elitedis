import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';
import { FormModal, ImageDropzone, SearchableSelect } from '../../components/global';
import FormModeToggle, { useFormMode } from '../../components/shared/FormModeToggle';
import { extractListPayload } from '../../utils/formatters';
import { suggestCode, validateField } from '../../utils/validation';

export function buildEmptyCustomer(suggestedCode = '') {
  return {
    customerCode: suggestedCode,
    shopName: '',
    ownerName: '',
    ownerContact: '',
    customerType: 'RETAILER',
    shopCategory: 'General',
    ntn: '',
    registrationNo: '',
    status: 'ACTIVE',
    visitPosition: 'NORMAL',
    shopPic: null,
    locationHierarchy: {
      city: 'Karachi',
      townOrZone: '',
      areaId: '',
      areaName: '',
      routeName: '',
      street: '',
      pehchanRemarks: '',
      mapLink: '',
    },
    financialTerms: {
      paymentCondition: 'PAID_CASH',
      creditLimitPkr: 0,
      creditDays: 0,
    },
    contacts: [{ personName: '', role: 'Shopkeeper', contactNo: '', channelType: 'WHATSAPP', isDefault: true }],
    paymentAccounts: [],
  };
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  existingCount = 0,
  existingCodes = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || buildEmptyCustomer());
  const [touched, setTouched] = useState({});
  const [formMode, setFormMode] = useFormMode();
  const isAdvanced = formMode === 'advanced';

  const areasQuery = useQuery({
    queryKey: ['crm-areas-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/areas', { params: { limit: 100 } })).data,
  });
  const areas = areasQuery.data || [];
  const areaOptions = useMemo(
    () => areas.map((a) => ({ value: a._id, label: `${a.areaCode} — ${a.areaName}`, sublabel: [a.subDistrict, a.city].filter(Boolean).join(' · ') })),
    [areas]
  );

  const handleAreaSelect = (nextAreaId) => {
    const area = areas.find((a) => String(a._id) === String(nextAreaId));
    setForm((p) => ({
      ...p,
      locationHierarchy: {
        ...p.locationHierarchy,
        areaId: nextAreaId || '',
        areaName: area?.areaName || '',
        city: area?.city || p.locationHierarchy?.city || 'Karachi',
        townOrZone: area?.subDistrict || p.locationHierarchy?.townOrZone || '',
      },
    }));
  };

  const errors = {
    customerCode:
      touched.customerCode && form.customerCode
        ? validateField('code', form.customerCode, { label: 'Customer Code' })
        : '',
    shopName: touched.shopName
      ? validateField('required', form.shopName, { required: true, minLength: 2, label: 'Shop Name' })
      : '',
    ownerName: touched.ownerName
      ? validateField('required', form.ownerName, { required: true, minLength: 2, label: 'Owner Name' })
      : '',
    ownerContact: touched.ownerContact
      ? validateField('phone', form.ownerContact, { required: true, label: 'Owner Phone' })
      : '',
  };

  const updateLoc = (key, val) => {
    setForm((p) => ({ ...p, locationHierarchy: { ...p.locationHierarchy, [key]: val } }));
  };

  const updateFin = (key, val) => {
    setForm((p) => ({ ...p, financialTerms: { ...p.financialTerms, [key]: val } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ customerCode: true, shopName: true, ownerName: true, ownerContact: true });
    const invalid =
      (form.customerCode && validateField('code', form.customerCode, { label: 'Customer Code' })) ||
      validateField('required', form.shopName, { required: true, minLength: 2, label: 'Shop Name' }) ||
      validateField('required', form.ownerName, { required: true, minLength: 2, label: 'Owner Name' }) ||
      validateField('phone', form.ownerContact, { required: true, label: 'Owner Phone' });
    if (invalid) return;
    const cleanedPayload = {
      ...form,
      customerCode: form.customerCode?.trim() ? form.customerCode.trim().toUpperCase() : '',
      shopName: String(form.shopName || '').trim(),
      ownerName: String(form.ownerName || '').trim(),
      ownerContact: String(form.ownerContact || '').trim(),
      locationHierarchy: {
        ...(form.locationHierarchy || {}),
        areaId: form.locationHierarchy?.areaId || null,
      },
      contacts: (form.contacts || [])
        .filter((c) => c?.personName?.trim() || c?.contactNo?.trim())
        .map((c) => ({
          ...c,
          personName: c.personName?.trim() || c.role?.trim() || 'Contact',
          contactNo: c.contactNo?.trim() || '',
        })),
      paymentAccounts: (form.paymentAccounts || [])
        .filter((a) => a?.providerName?.trim() || a?.accountTitle?.trim() || a?.accountNo?.trim())
        .map((a) => ({
          ...a,
          providerName: a.providerName?.trim() || '',
          accountTitle: a.accountTitle?.trim() || '',
          accountNo: a.accountNo?.trim() || '',
        })),
    };
    onSave(cleanedPayload);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Customer Shop' : 'Add New Customer Shop'}
      subtitle="Shop details, area & landmark directions (Pehchan), and credit rules"
      size="xl"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)]">{isAdvanced ? 'Full shop profile, Pehchan & credit limits' : 'Quick entry: essential shop, owner & area details'}</span>
          <FormModeToggle mode={formMode} onChange={setFormMode} />
        </div>
        <div className={`grid grid-cols-1 ${isAdvanced ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Customer Code (Optional)</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, customerCode: suggestCode('CUST', existingCount, existingCodes) }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              </div>
              <input
                value={form.customerCode}
                onChange={(e) => setForm((p) => ({ ...p, customerCode: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, customerCode: true }))}
                placeholder="CUST-001"
                aria-invalid={Boolean(errors.customerCode)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${errors.customerCode ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.customerCode && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.customerCode}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Shop / Customer Name *</label>
              <input
                aria-required="true"
                value={form.shopName}
                onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, shopName: true }))}
                placeholder="e.g. Lucky General Store"
                aria-invalid={Boolean(errors.shopName)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.shopName ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.shopName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.shopName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Name *</label>
              <input
                aria-required="true"
                value={form.ownerName}
                onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, ownerName: true }))}
                placeholder="e.g. Imtiaz Ahsan"
                aria-invalid={Boolean(errors.ownerName)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.ownerName ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.ownerName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.ownerName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Phone / WhatsApp *</label>
              <input
                aria-required="true"
                value={form.ownerContact}
                onChange={(e) => setForm((p) => ({ ...p, ownerContact: e.target.value.trim() }))}
                onBlur={() => setTouched((p) => ({ ...p, ownerContact: true }))}
                placeholder="03001234567"
                aria-invalid={Boolean(errors.ownerContact)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${errors.ownerContact ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.ownerContact && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.ownerContact}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Customer Type (Optional)</label>
              <select
                value={form.customerType}
                onChange={(e) => setForm((p) => ({ ...p, customerType: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="RETAILER">Retailer</option>
                <option value="WHOLESALER">Wholesaler</option>
                <option value="SUB_DISTRIBUTOR">Sub-Distributor</option>
                <option value="POS_WALKIN">POS Walk-in</option>
              </select>
            </div>
            {isAdvanced && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Shop Category (Optional)</label>
                <input
                  value={form.shopCategory}
                  onChange={(e) => setForm((p) => ({ ...p, shopCategory: e.target.value }))}
                  placeholder="Confectionery / General"
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
                />
              </div>
            )}
          </div>

          {isAdvanced && (
            <ImageDropzone
              label="Shop Picture (Optional)"
              folder="customers"
              value={form.shopPic}
              isSubmitting={isSubmitting}
              onChange={(shopPic) => setForm((p) => ({ ...p, shopPic }))}
            />
          )}
        </div>

        <div className="rounded-xl border p-3.5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-[var(--accent-primary)]">
            Shop Area &amp; Location {isAdvanced ? '(Full Hierarchy & Pehchan)' : '(Auto-fills City & Zone)'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Select Area (Optional)</label>
              <SearchableSelect
                options={areaOptions}
                value={form.locationHierarchy?.areaId || ''}
                onChange={handleAreaSelect}
                emptyLabel="Choose CRM area..."
                placeholder="Search area or city..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">City (Optional)</label>
              <input placeholder="City" value={form.locationHierarchy?.city || ''} onChange={(e) => updateLoc('city', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Town / Zone (Optional)</label>
              <input placeholder="Town / Zone" value={form.locationHierarchy?.townOrZone || ''} onChange={(e) => updateLoc('townOrZone', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            {isAdvanced && (
              <>
                <input placeholder="Area Name (Optional)" value={form.locationHierarchy?.areaName || ''} onChange={(e) => updateLoc('areaName', e.target.value)} className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
                <input placeholder="Route / Road (Optional)" value={form.locationHierarchy?.routeName || ''} onChange={(e) => updateLoc('routeName', e.target.value)} className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
                <input placeholder="Street / Block (Optional)" value={form.locationHierarchy?.street || ''} onChange={(e) => updateLoc('street', e.target.value)} className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
                <input placeholder="Google Map Link (Optional)" value={form.locationHierarchy?.mapLink || ''} onChange={(e) => updateLoc('mapLink', e.target.value)} className="sm:col-span-3 h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Nearby Landmark / Pehchan Directions (Optional)
                  </label>
                  <input
                    placeholder="e.g. Opposite petrol pump, corner green-gate shop"
                    value={form.locationHierarchy?.pehchanRemarks || ''}
                    onChange={(e) => updateLoc('pehchanRemarks', e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 grid grid-cols-1 ${isAdvanced ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3`}>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Payment Condition (Optional)</label>
            <select
              value={form.financialTerms?.paymentCondition || 'PAID_CASH'}
              onChange={(e) => updateFin('paymentCondition', e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            >
              <option value="PAID_CASH">Paid / Cash Only</option>
              <option value="ALLOW_CREDIT">Allow Credit</option>
              <option value="ADVANCE">Advance</option>
            </select>
          </div>
          {isAdvanced && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Credit Limit PKR (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.financialTerms?.creditLimitPkr ?? 0}
                  onChange={(e) => updateFin('creditLimitPkr', Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Credit Days (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.financialTerms?.creditDays ?? 0}
                  onChange={(e) => updateFin('creditDays', Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Account Status (Optional)</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
