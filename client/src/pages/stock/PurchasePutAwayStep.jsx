export default function PurchasePutAwayStep({
  form,
  setForm,
  zones,
  segSum,
  segMismatch,
  onBack,
  onNext,
}) {
  const renderBucketLocation = (label, qty, zoneKey, areaKey) => {
    if ((Number(qty) || 0) <= 0) return null;
    const zId = form[zoneKey] || zones[0]?._id || '';
    const zObj = zones.find((z) => String(z._id) === String(zId)) || zones[0];
    const zAreas = zObj?.areas || [];
    return (
      <div className="rounded-lg border bg-[var(--bg-elevated)] p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)]">{label}</p>
          <p className="text-[11px] font-mono text-[var(--accent-primary)]">{qty} Base Units</p>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Zone</label>
          <select
            value={zId}
            onChange={(e) => {
              const nextZ = zones.find((z) => String(z._id) === String(e.target.value));
              setForm((p) => ({ ...p, [zoneKey]: e.target.value, [areaKey]: nextZ?.areas?.[0]?._id || '' }));
            }}
            className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs"
          >
            {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Storage Area</label>
          <select
            value={form[areaKey] || zAreas[0]?._id || ''}
            onChange={(e) => setForm((p) => ({ ...p, [areaKey]: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs"
          >
            {zAreas.map((a) => <option key={a._id} value={a._id}>{a.areaName} ({a.condition})</option>)}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Normal Qty</label>
          <input type="number" min="0" value={form.normalBaseQty} onChange={(e) => setForm((p) => ({ ...p, normalBaseQty: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Damaged Qty</label>
          <input type="number" min="0" value={form.damagedBaseQty} onChange={(e) => setForm((p) => ({ ...p, damagedBaseQty: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expired Qty</label>
          <input type="number" min="0" value={form.expiredBaseQty} onChange={(e) => setForm((p) => ({ ...p, expiredBaseQty: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
        </div>
      </div>
      {segMismatch && (
        <p className="text-xs font-semibold text-[var(--status-danger)]">
          Sum ({segSum}) must equal Received Qty ({form.receivedBaseQty}).
        </p>
      )}
      <div className="space-y-2">
        {renderBucketLocation('Normal Stock Area', form.normalBaseQty, 'normalZoneId', 'normalAreaId')}
        {renderBucketLocation('Damage Stock Area', form.damagedBaseQty, 'damagedZoneId', 'damagedAreaId')}
        {renderBucketLocation('Expiry Stock Area', form.expiredBaseQty, 'expiredZoneId', 'expiredAreaId')}
      </div>
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="h-9 px-3 rounded-lg border text-xs font-semibold">Back</button>
        <button type="button" disabled={segMismatch} onClick={onNext} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50">
          <span>Next: Review & Confirm</span>
        </button>
      </div>
    </div>
  );
}
