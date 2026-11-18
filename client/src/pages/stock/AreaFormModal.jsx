import { useMemo, useState } from 'react';
import { FormModal } from '../../components/global';
import { suggestCode, validateField } from '../../utils/validation';

export function buildEmptyArea(wh = null) {
  return {
    warehouseId: wh?._id || '',
    zoneId: wh?.zones?.[0]?._id || '',
    areaCode: '',
    areaName: '',
    areaType: 'FLOOR',
    storagePurpose: 'NORMAL',
    condition: 'NORMAL',
    allowedProducts: [],
  };
}

export default function AreaFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  existingCount = 0,
  existingCodes = [],
  warehouses = [],
  products = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => {
    const base = initialValue || buildEmptyArea(warehouses[0]);
    const wh = warehouses.find((w) => String(w._id) === String(base.warehouseId)) || warehouses[0];
    return {
      ...base,
      warehouseId: base.warehouseId || (!isEditing ? wh?._id || '' : ''),
      zoneId: base.zoneId || (!isEditing ? wh?.zones?.[0]?._id || '' : ''),
      areaCode: base.areaCode || (!isEditing ? suggestCode('AR', existingCount, existingCodes) : ''),
    };
  });
  const [touched, setTouched] = useState({});

  const codeError = touched.areaCode ? validateField('code', form.areaCode, { required: true, label: 'Area Code' }) : '';
  const nameError = touched.areaName ? validateField('required', form.areaName, { required: true, minLength: 2, label: 'Area Name' }) : '';

  const availableZones = useMemo(() => {
    const wh = warehouses.find((w) => String(w._id) === String(form.warehouseId));
    return wh?.zones || [];
  }, [warehouses, form.warehouseId]);

  const addAllowedProduct = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setForm((prev) => ({
      ...prev,
      allowedProducts: [...prev.allowedProducts, { productId: firstProd._id, minQtyPacking: 5, maxQtyPacking: 100 }],
    }));
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Storage Area' : 'New Floor / Rack Area'}
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ areaCode: true, areaName: true });
        if (
          validateField('code', form.areaCode, { required: true, label: 'Area Code' }) ||
          validateField('required', form.areaName, { required: true, minLength: 2, label: 'Area Name' })
        ) {
          return;
        }
        onSave(form);
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isEditing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Warehouse <span className="text-[var(--status-danger)]">*</span></label>
                <select
                  required
                  value={form.warehouseId}
                  onChange={(e) => {
                    const nextWhId = e.target.value;
                    const newWh = warehouses.find((w) => String(w._id) === String(nextWhId));
                    setForm((p) => ({ ...p, warehouseId: nextWhId, zoneId: newWh?.zones?.[0]?._id || '' }));
                  }}
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.warehouseName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone <span className="text-[var(--status-danger)]">*</span></label>
                <select required value={form.zoneId} onChange={(e) => setForm((p) => ({ ...p, zoneId: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                  <option value="">Select zone...</option>
                  {availableZones.map((z) => (
                    <option key={z._id} value={z._id}>
                      {z.zoneName} ({z.zoneCode})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Area Code <span className="text-[var(--status-danger)]">*</span></label>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, areaCode: suggestCode('AR', existingCount, existingCodes) }))
                }
                className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Auto Code
              </button>
            </div>
            <input
              required
              value={form.areaCode}
              onChange={(e) => setForm((p) => ({ ...p, areaCode: e.target.value.toUpperCase() }))}
              onBlur={() => setTouched((p) => ({ ...p, areaCode: true }))}
              placeholder="AR-001"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area Name <span className="text-[var(--status-danger)]">*</span></label>
            <input
              required
              value={form.areaName}
              onChange={(e) => setForm((p) => ({ ...p, areaName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, areaName: true }))}
              placeholder="1st Floor / Rack A1"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area Type <span className="text-[var(--status-danger)]">*</span></label>
            <select value={form.areaType} onChange={(e) => setForm((p) => ({ ...p, areaType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="FLOOR">Floor</option>
              <option value="RACK">Rack</option>
              <option value="WALKED">Walked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Storage Purpose <span className="text-[var(--status-danger)]">*</span></label>
            <select value={form.storagePurpose} onChange={(e) => setForm((p) => ({ ...p, storagePurpose: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="NORMAL">Normal</option>
              <option value="DAMAGE">Damage</option>
              <option value="MIX">Mix</option>
              <option value="EXPIRY">Expiry</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">Allowed Products &amp; Capacity (Optional)</span>
            <button type="button" onClick={addAllowedProduct} className="text-xs font-semibold text-[var(--accent-primary)] hover:underline">
              + Add Product Rule
            </button>
          </div>
          {form.allowedProducts.map((ap, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <select
                value={ap.productId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    allowedProducts: p.allowedProducts.map((row, i) => (i === idx ? { ...row, productId: e.target.value } : row)),
                  }))
                }
                className="sm:col-span-2 h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs"
              >
                {products.map((pr) => (
                  <option key={pr._id} value={pr._id}>
                    {pr.skuCode} — {pr.productName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Min Pack"
                value={ap.minQtyPacking}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    allowedProducts: p.allowedProducts.map((row, i) => (i === idx ? { ...row, minQtyPacking: Number(e.target.value) } : row)),
                  }))
                }
                className="h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
              <input
                type="number"
                placeholder="Max Pack"
                value={ap.maxQtyPacking}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    allowedProducts: p.allowedProducts.map((row, i) => (i === idx ? { ...row, maxQtyPacking: Number(e.target.value) } : row)),
                  }))
                }
                className="h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>
    </FormModal>
  );
}
