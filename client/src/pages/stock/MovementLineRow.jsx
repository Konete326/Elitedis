import { Calculator, Trash2 } from 'lucide-react';

export default function MovementLineRow({
  row,
  idx,
  movementType,
  products,
  batches,
  destZones,
  updateLine,
  onOpenKeypad,
  onRemove,
}) {
  const selectedZone = destZones.find((z) => String(z._id) === String(row.toZoneId)) || destZones[0];
  const areasList = selectedZone?.areas || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end rounded-xl border p-3 bg-[var(--bg-canvas)]">
      {movementType === 'PURCHASE' ? (
        <>
          <div className="md:col-span-2">
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Product</label>
            <select value={row.productId} onChange={(e) => updateLine(idx, 'productId', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs">
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.skuCode} — {p.productName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Batch No</label>
            <input value={row.batchNo} onChange={(e) => updateLine(idx, 'batchNo', e.target.value.toUpperCase())} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs font-mono" />
          </div>
        </>
      ) : (
        <div className="md:col-span-3">
          <label className="block text-[11px] text-[var(--text-muted)] mb-1">Source Batch</label>
          <select
            value={row.batchId}
            onChange={(e) => {
              const b = batches.find((x) => x._id === e.target.value);
              if (b) {
                updateLine(idx, 'batchId', b._id);
                updateLine(idx, 'batchNo', b.batchNo);
                updateLine(idx, 'productId', b.productId?._id || b.productId);
                updateLine(idx, 'previousErpBaseQty', b.currentBaseQty || 0);
              }
            }}
            className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs"
          >
            {batches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.batchNo} — {b.productId?.productName} (Avail: {b.availableBaseQty})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-[11px] text-[var(--text-muted)] mb-1">Target Area</label>
        <select value={row.toAreaId} onChange={(e) => updateLine(idx, 'toAreaId', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs">
          {areasList.map((a) => (
            <option key={a._id} value={a._id}>
              {a.areaCode} — {a.areaName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
          {movementType === 'ADJUSTMENT' ? 'Physical Base Qty' : 'Moved Base Qty'}
        </label>
        <div className="flex gap-1">
          <input
            type="number"
            min="0"
            value={movementType === 'ADJUSTMENT' ? row.physicalCountBaseQty : row.movedBaseQty}
            onChange={(e) =>
              updateLine(idx, movementType === 'ADJUSTMENT' ? 'physicalCountBaseQty' : 'movedBaseQty', Number(e.target.value))
            }
            className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
          />
          <button
            type="button"
            onClick={() => onOpenKeypad(idx, movementType === 'ADJUSTMENT' ? 'physicalCountBaseQty' : 'movedBaseQty')}
            className="w-9 h-9 shrink-0 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => onRemove(idx)} className="h-9 px-3 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
