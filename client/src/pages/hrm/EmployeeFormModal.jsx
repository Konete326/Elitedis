import { useState } from 'react';
import { FormModal, ImageDropzone } from '../../components/global';
import { suggestCode, validateField } from '../../utils/validation';

export const EMPLOYEE_ROLES = [
  'ADMIN',
  'BOOKER',
  'SALESMAN',
  'POS_OPERATOR',
  'WAREHOUSE_MANAGER',
  'STOREKEEPER',
  'ACCOUNTANT',
];

export const WORK_PART_LABELS = [
  { key: 'orderBooker', label: 'Order Booker' },
  { key: 'warehouseManager', label: 'Warehouse Management' },
  { key: 'posStore', label: 'POS Store' },
  { key: 'normalInvoice', label: 'Normal Invoice' },
  { key: 'advanceInvoice', label: 'Advance Invoice' },
  { key: 'salesman', label: 'Salesman Delivery' },
];

export const INITIAL_EMPLOYEE_FORM = {
  profileId: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  primaryRole: 'BOOKER',
  linkedWarehouseId: '',
  basicSalaryPkr: 0,
  commissionPct: 0,
  status: 'ACTIVE',
  avatar: null,
  workParts: {
    orderBooker: true,
    warehouseManager: false,
    posStore: false,
    normalInvoice: true,
    advanceInvoice: false,
    salesman: false,
  },
};

export default function EmployeeFormModal({
  isOpen,
  onClose,
  initialValue,
  editingId,
  warehouses = [],
  existingCount = 0,
  existingCodes = [],
  isSuperAdmin = false,
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || INITIAL_EMPLOYEE_FORM);
  const [touched, setTouched] = useState({});

  const errors = {
    fullName: touched.fullName ? validateField('required', form.fullName, { required: true, minLength: 2, label: 'Full Name' }) : '',
    profileId: touched.profileId ? validateField('code', form.profileId, { required: true, label: 'Profile ID' }) : '',
    email: touched.email ? validateField('email', form.email, { required: true, label: 'Email' }) : '',
    phone: touched.phone ? validateField('mobilePk', form.phone, { required: true, label: 'Phone' }) : '',
    password:
      touched.password && (!editingId || form.password)
        ? validateField('password', form.password, { required: !editingId, minLength: 6, label: 'Password' })
        : '',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ fullName: true, profileId: true, email: true, phone: true, password: true });
    const hasErrors =
      validateField('required', form.fullName, { required: true, minLength: 2, label: 'Full Name' }) ||
      validateField('code', form.profileId, { required: true, label: 'Profile ID' }) ||
      validateField('email', form.email, { required: true, label: 'Email' }) ||
      validateField('mobilePk', form.phone, { required: true, label: 'Phone' }) ||
      (!editingId || form.password
        ? validateField('password', form.password, { required: !editingId, minLength: 6, label: 'Password' })
        : '');
    if (hasErrors) return;

    const payload = { ...form, linkedWarehouseId: form.linkedWarehouseId || null };
    if (editingId && !payload.password) delete payload.password;
    if (!isSuperAdmin && payload.primaryRole === 'SUPER_ADMIN') return;
    onSave(payload);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'Edit Staff Member & Job Access' : 'Add New Staff Member'}
      subtitle="Login details, role, warehouse link, salary, and allowed modules"
      size="lg"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Name</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                placeholder="e.g. Ali Raza"
                aria-invalid={Boolean(errors.fullName)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.fullName ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.fullName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.fullName}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Profile ID</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, profileId: suggestCode('EMP', existingCount, existingCodes) }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto ID
                </button>
              </div>
              <input
                required
                value={form.profileId}
                onChange={(e) => setForm((p) => ({ ...p, profileId: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, profileId: true }))}
                placeholder="EMP-001"
                aria-invalid={Boolean(errors.profileId)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${errors.profileId ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.profileId && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.profileId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email Address</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                placeholder="ali@agency.com"
                aria-invalid={Boolean(errors.email)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.email ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.email && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Mobile Number</label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.trim() }))}
                onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                placeholder="03001234567"
                aria-invalid={Boolean(errors.phone)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${errors.phone ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.phone && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {editingId ? 'New Password (Optional)' : 'Login Password'}
              </label>
              <input
                required={!editingId}
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                placeholder="At least 6 characters"
                aria-invalid={Boolean(errors.password)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.password ? 'border-[var(--status-danger)]' : ''}`}
              />
              {errors.password && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Staff Role</label>
              <select
                value={form.primaryRole}
                disabled={form.primaryRole === 'SUPER_ADMIN'}
                onChange={(e) => setForm((p) => ({ ...p, primaryRole: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm disabled:opacity-60"
              >
                {form.primaryRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
                {EMPLOYEE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Assigned Warehouse</label>
              <select
                value={form.linkedWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, linkedWarehouseId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">All / None</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Basic Salary (PKR)</label>
              <input
                type="number"
                min="0"
                value={form.basicSalaryPkr}
                onChange={(e) => setForm((p) => ({ ...p, basicSalaryPkr: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
              />
            </div>
          </div>

          <ImageDropzone
            label="Staff Photo"
            folder="employees"
            value={form.avatar}
            isSubmitting={isSubmitting}
            onChange={(avatar) => setForm((p) => ({ ...p, avatar }))}
          />
        </div>

        <div className="rounded-xl border p-3.5 space-y-2">
          <span className="text-xs font-bold uppercase text-[var(--accent-primary)]">
            Allowed Jobs &amp; Portals (Check to Enable)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {WORK_PART_LABELS.map((wp) => (
              <label key={wp.key} className="flex items-center gap-2 rounded-lg border p-2.5 bg-[var(--bg-canvas)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.workParts?.[wp.key])}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      workParts: { ...p.workParts, [wp.key]: e.target.checked },
                    }))
                  }
                  className="accent-[var(--accent-primary)]"
                />
                <span>{wp.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
