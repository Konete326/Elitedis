import { useState } from 'react';
import { FormModal, ImageDropzone } from '../../components/global';

export function buildEmptyCustomer() {
  return {
    customerCode: '',
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
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || buildEmptyCustomer());

  const updateLoc = (key, val) => {
    setForm((p) => ({ ...p, locationHierarchy: { ...p.locationHierarchy, [key]: val } }));
  };

  const updateFin = (key, val) => {
    setForm((p) => ({ ...p, financialTerms: { ...p.financialTerms, [key]: val } }));
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Customer Profile' : 'Add New Customer Shop'}
      subtitle="7-level location, Pehchan landmark, payment terms, and multi-accounts"
      size="xl"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Customer Code</label>
              <input
                value={form.customerCode}
                onChange={(e) => setForm((p) => ({ ...p, customerCode: e.target.value.toUpperCase() }))}
                placeholder="C-1110 (auto if blank)"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Shop / Customer Name</label>
              <input
                required
                value={form.shopName}
                onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                placeholder="Lucky Store"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Name</label>
              <input
                required
                value={form.ownerName}
                onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
                placeholder="Imtiaz Ahsan"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Contact</label>
              <input
                required
                value={form.ownerContact}
                onChange={(e) => setForm((p) => ({ ...p, ownerContact: e.target.value }))}
                placeholder="03001234567"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Customer Type</label>
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
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Shop Category</label>
              <input
                value={form.shopCategory}
                onChange={(e) => setForm((p) => ({ ...p, shopCategory: e.target.value }))}
                placeholder="Confectionery / General"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
          </div>

          <ImageDropzone
            label="Shop Picture"
            folder="customers"
            value={form.shopPic}
            isSubmitting={isSubmitting}
            onChange={(shopPic) => setForm((p) => ({ ...p, shopPic }))}
          />
        </div>

        <div className="rounded-xl border p-3.5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-[var(--accent-primary)]">
            7-Level Geo &amp; Pehchan Location
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              placeholder="1. City (Karachi)"
              value={form.locationHierarchy?.city || ''}
              onChange={(e) => updateLoc('city', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <input
              placeholder="2. Town / Zone (Orangi)"
              value={form.locationHierarchy?.townOrZone || ''}
              onChange={(e) => updateLoc('townOrZone', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <input
              placeholder="3. Area (Qasba Colony)"
              value={form.locationHierarchy?.areaName || ''}
              onChange={(e) => updateLoc('areaName', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <input
              placeholder="4. Route (Jamsheed Pump Road)"
              value={form.locationHierarchy?.routeName || ''}
              onChange={(e) => updateLoc('routeName', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <input
              placeholder="5. Street"
              value={form.locationHierarchy?.street || ''}
              onChange={(e) => updateLoc('street', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <input
              placeholder="Google Map Link"
              value={form.locationHierarchy?.mapLink || ''}
              onChange={(e) => updateLoc('mapLink', e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            />
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                6. Local Pehchan / Landmark Remarks
              </label>
              <input
                placeholder="e.g. Pump ky ulty haath road per jali wali shop"
                value={form.locationHierarchy?.pehchanRemarks || ''}
                onChange={(e) => updateLoc('pehchanRemarks', e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Payment Condition</label>
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
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Credit Limit (PKR)</label>
            <input
              type="number"
              min="0"
              value={form.financialTerms?.creditLimitPkr ?? 0}
              onChange={(e) => updateFin('creditLimitPkr', Number(e.target.value))}
              className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Credit Days</label>
            <input
              type="number"
              min="0"
              value={form.financialTerms?.creditDays ?? 0}
              onChange={(e) => updateFin('creditDays', Number(e.target.value))}
              className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Account Status</label>
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
