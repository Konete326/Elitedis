import { useEffect, useState } from 'react';
import { FormModal } from '../../components/global';

export function CreatePoModal({
  isOpen,
  onClose,
  companies,
  warehouses,
  products,
  onSubmit,
  isSubmitting,
}) {
  const [form, setForm] = useState({
    supplierCompanyId: '',
    toWarehouseId: '',
    status: 'PENDING',
    taskName: '',
    productId: '',
    movedBaseQty: 24,
    unitCostPkr: 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const prod = products.find((p) => p._id === form.productId);
    const wh = warehouses.find((w) => w._id === form.toWarehouseId);
    const zone = wh?.zones?.[0];
    const area = zone?.areas?.[0];
    const unitRate = Number(form.unitCostPkr || prod?.baseUnit?.traderPurchaseRate || 0);
    const qty = Math.max(1, Number(form.movedBaseQty) || 1);

    onSubmit({
      supplierCompanyId: form.supplierCompanyId || undefined,
      toWarehouseId: form.toWarehouseId,
      status: form.status,
      taskName: form.taskName || `PO — ${prod?.productName || 'Stock'}`,
      items: [
        {
          productId: form.productId,
          toZoneId: zone?._id || null,
          toAreaId: area?._id || null,
          unitName: prod?.baseUnit?.unitName || 'Piece',
          movedBaseQty: qty,
          unitCostPkr: unitRate,
          totalValuePkr: Number((qty * unitRate).toFixed(2)),
        },
      ],
    });
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="New Supplier Purchase Order"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier Company *</label>
            <select
              required
              value={form.supplierCompanyId}
              onChange={(e) => setForm((p) => ({ ...p, supplierCompanyId: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="">Select supplier...</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Order Stage (Optional)</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="PENDING">Pending PO</option>
              <option value="APPROVED">Approved PO</option>
              <option value="DRAFT">Purchase Request (Draft)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Receiving Warehouse *</label>
          <select
            required
            value={form.toWarehouseId}
            onChange={(e) => setForm((p) => ({ ...p, toWarehouseId: e.target.value }))}
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
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Product *</label>
          <select
            required
            value={form.productId}
            onChange={(e) => {
              const prod = products.find((x) => x._id === e.target.value);
              setForm((p) => ({
                ...p,
                productId: e.target.value,
                unitCostPkr: prod?.baseUnit?.traderPurchaseRate || 0,
              }));
            }}
            className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
          >
            <option value="">Select product...</option>
            {products.map((pr) => (
              <option key={pr._id} value={pr._id}>
                {pr.skuCode} — {pr.productName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Base Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={form.movedBaseQty}
              onChange={(e) => setForm((p) => ({ ...p, movedBaseQty: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Purchase Rate PKR (Optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unitCostPkr}
              onChange={(e) => setForm((p) => ({ ...p, unitCostPkr: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
        </div>
      </div>
    </FormModal>
  );
}

export function ReceiveGoodsModal({ target, warehouses, onClose, onSubmit, isSubmitting }) {
  const warehouseId = target?.toWarehouseId?._id || target?.toWarehouseId;
  const wh = warehouses.find((w) => w._id === warehouseId);
  const zones = wh?.zones || [];

  const [zoneId, setZoneId] = useState('');
  const [areaId, setAreaId] = useState('');

  useEffect(() => {
    if (!target) return;
    const item = target.items?.[0];
    const defaultZone = zones.find((z) => z._id === item?.toZoneId) || zones[0];
    const defaultAreas = defaultZone?.areas || [];
    const defaultArea = defaultAreas.find((a) => a._id === item?.toAreaId) || defaultAreas[0];
    setZoneId(defaultZone?._id || '');
    setAreaId(defaultArea?._id || '');
  }, [target?._id]);

  const activeZone = zones.find((z) => z._id === zoneId);
  const areas = activeZone?.areas || [];

  return (
    <FormModal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Receive Goods — ${target?.movementCode || ''}`}
      size="sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: target._id, zoneId, areaId });
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          Destination Warehouse:{' '}
          <strong className="text-[var(--text-primary)]">{wh?.warehouseName || target?.toWarehouseId?.warehouseName || '—'}</strong>
        </p>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Put-Away Zone *</label>
          <select
            required
            value={zoneId}
            onChange={(e) => {
              const nextZone = zones.find((z) => z._id === e.target.value);
              setZoneId(e.target.value);
              setAreaId(nextZone?.areas?.[0]?._id || '');
            }}
            className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
          >
            <option value="">Select zone...</option>
            {zones.map((z) => (
              <option key={z._id} value={z._id}>
                {z.zoneName} ({z.zoneCode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Rack / Floor Area *</label>
          <select
            required
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
          >
            <option value="">Select rack/floor area...</option>
            {areas.map((a) => (
              <option key={a._id} value={a._id}>
                {a.areaName} ({a.areaCode})
              </option>
            ))}
          </select>
        </div>
      </div>
    </FormModal>
  );
}

export function PaySupplierModal({ isOpen, target, companies, onClose, onSubmit, isSubmitting }) {
  const [supplierCompanyId, setSupplierCompanyId] = useState('');
  const [amountPkr, setAmountPkr] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [narration, setNarration] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const total =
      target?.totalAmountPkr ??
      (target?.items || []).reduce((s, i) => s + (Number(i.totalValuePkr) || 0), 0);
    setSupplierCompanyId(target?.supplierCompanyId?._id || target?.supplierCompanyId || '');
    setAmountPkr(total || 0);
    setPaymentMode('CASH');
    setNarration(target?.movementCode ? `Payment for ${target.movementCode}` : 'Supplier AP settlement');
  }, [isOpen, target]);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={target ? `Pay Supplier — ${target.movementCode}` : 'Record Supplier Payment'}
      size="sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ supplierCompanyId, amountPkr: Number(amountPkr), paymentMode, narration });
      }}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier Company *</label>
          <select
            required
            value={supplierCompanyId}
            onChange={(e) => setSupplierCompanyId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
          >
            <option value="">Select supplier...</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Payment Mode (Optional)</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="ONLINE">Online / Wallet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Amount (PKR) *</label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={amountPkr}
              onChange={(e) => setAmountPkr(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Narration (Optional)</label>
          <input
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Invoice / voucher reference"
            className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
          />
        </div>
      </div>
    </FormModal>
  );
}
