import { useMemo, useState } from 'react';
import { FormModal } from '../../components/global';
import FormModeToggle, { useFormMode } from '../../components/shared/FormModeToggle';
import { suggestCode, validateField } from '../../utils/validation';

export function buildEmptyZone(warehouseId = '') {
  return {
    warehouseId,
    zoneCode: '',
    zoneName: '',
    zoneType: 'NORMAL',
    storageType: 'NORMAL',
    condition: 'NORMAL',
    dimensions: { sizeUnit: 'Feet', width: 0, length: 0, height: 0 },
  };
}

export default function ZoneFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  warehouses = [],
  existingCount = 0,
  existingCodes = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => {
    const base = initialValue || buildEmptyZone(warehouses[0]?._id || '');
    return {
      ...base,
      warehouseId: base.warehouseId || (!isEditing ? warehouses[0]?._id || '' : ''),
      zoneCode: base.zoneCode || (!isEditing ? suggestCode('ZN', existingCount, existingCodes) : ''),
    };
  });
  const [touched, setTouched] = useState({});
  const [formMode, setFormMode] = useFormMode();
  const isAdvanced = formMode === 'advanced';

  const codeError = touched.zoneCode ? validateField('code', form.zoneCode, { required: true, label: 'Zone Code' }) : '';
  const nameError = touched.zoneName ? validateField('required', form.zoneName, { required: true, minLength: 2, label: 'Zone Name' }) : '';

  const dimTotals = useMemo(() => {
    const w = Number(form.dimensions?.width) || 0;
    const l = Number(form.dimensions?.length) || 0;
    const h = Number(form.dimensions?.height) || 0;
    return { totalArea: Number((w * l).toFixed(2)), totalVolume: Number((w * l * h).toFixed(2)) };
  }, [form.dimensions]);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Storage Zone' : 'New Warehouse Zone'}
      subtitle="Hierarchy: Warehouse → Zone → Area"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ zoneCode: true, zoneName: true });
        if (
          validateField('code', form.zoneCode, { required: true, label: 'Zone Code' }) ||
          validateField('required', form.zoneName, { required: true, minLength: 2, label: 'Zone Name' })
        ) {
          return;
        }
        onSave({ ...form, dimensions: { ...form.dimensions, ...dimTotals } });
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)]">{isAdvanced ? 'All zone & dimension specs' : 'Quick entry: warehouse, code, name & storage type'}</span>
          <FormModeToggle mode={formMode} onChange={setFormMode} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isEditing && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Warehouse <span className="text-[var(--status-danger)]">*</span></label>
            <select
              required
              value={form.warehouseId}
              onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.warehouseName} ({w.warehouseCode})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Zone Code <span className="text-[var(--status-danger)]">*</span></label>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, zoneCode: suggestCode('ZN', existingCount, existingCodes) }))}
              className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
            >
              Auto Code
            </button>
          </div>
          <input
            required
            value={form.zoneCode}
            onChange={(e) => setForm((p) => ({ ...p, zoneCode: e.target.value.toUpperCase() }))}
            onBlur={() => setTouched((p) => ({ ...p, zoneCode: true }))}
            placeholder="ZN-001"
            className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
          />
          {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone Name <span className="text-[var(--status-danger)]">*</span></label>
          <input
            required
            value={form.zoneName}
            onChange={(e) => setForm((p) => ({ ...p, zoneName: e.target.value }))}
            onBlur={() => setTouched((p) => ({ ...p, zoneName: true }))}
            placeholder="Main Plot"
            className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
          />
          {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone Type <span className="text-[var(--status-danger)]">*</span></label>
          <select value={form.zoneType} onChange={(e) => setForm((p) => ({ ...p, zoneType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
            <option value="NORMAL">Normal</option>
            <option value="MIX">Mix</option>
            <option value="TEMPERATURE">Temperature</option>
            <option value="COLD_STORE">Cold Store</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Storage Purpose <span className="text-[var(--status-danger)]">*</span></label>
          <select value={form.storageType} onChange={(e) => setForm((p) => ({ ...p, storageType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
            <option value="NORMAL">Normal</option>
            <option value="DAMAGE">Damage</option>
            <option value="MIX">Mix</option>
            <option value="EXPIRY">Expiry</option>
          </select>
        </div>
        {isAdvanced && (
          <>
            <div className="sm:col-span-2 grid grid-cols-3 gap-2 pt-1">
              {['width', 'length', 'height'].map((dim) => (
                <div key={dim}>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1 capitalize">{dim} (Ft) (Optional)</label>
                  <input
                    type="number"
                    value={form.dimensions?.[dim] || 0}
                    onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, [dim]: Number(e.target.value) } }))}
                    className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
                  />
                </div>
              ))}
            </div>
            <p className="sm:col-span-2 text-xs font-mono tabular-nums text-[var(--text-muted)]">
              Computed Area: {dimTotals.totalArea} sq ft · Volume: {dimTotals.totalVolume} cu ft
            </p>
          </>
        )}
      </div>
      </div>
    </FormModal>
  );
}
