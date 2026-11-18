import { Calculator, Trash2 } from 'lucide-react';
import { suggestCode } from '../../utils/validation';

export default function MovementLineRow({
  row,
  idx,
  movementType,
  products,
  batches,
  destZones,
  canViewPurchasePrice = false,
  onPurchaseProductChange,
  updateLine,
  onOpenKeypad,
  onRemove,
}) {
  const selectedZone = destZones.find((z) => String(z._id) === String(row.toZoneId)) || destZones[0];
  const areasList = selectedZone?.areas || [];
  const selectedProduct = products.find((p) => String(p._id) === String(row.productId));
  const activeVer =
    selectedProduct?.unitVersions?.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') ||
    selectedProduct?.unitVersions?.[0];
  const versionBadge = row.unitVersionId || activeVer?.unitVersionId || 'UV-1';
  const showPurchaseCost = movementType === 'PURCHASE' && canViewPurchasePrice;

  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] p-3.5 bg-[var(--bg-canvas)] space-y-3 md:space-y-0 md:grid ${
        showPurchaseCost ? 'md:grid-cols-7' : 'md:grid-cols-6'
      } md:gap-2.5 md:items-end animate-fade-in`}
    >
      {movementType === 'PURCHASE' ? (
        <>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Product</label>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                {versionBadge}
              </span>
            </div>
            <select
              value={row.productId}
              onChange={(e) =>
                onPurchaseProductChange ? onPurchaseProductChange(idx, e.target.value) : updateLine(idx, 'productId', e.target.value)
              }
              className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.skuCode} — {p.productName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Batch No</label>
              <button
                type="button"
                onClick={() => updateLine(idx, 'batchNo', suggestCode('BAT', idx))}
                className="text-[10px] font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Auto Batch
              </button>
            </div>
            <input
              value={row.batchNo}
              onChange={(e) => updateLine(idx, 'batchNo', e.target.value.toUpperCase())}
              className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm font-mono"
            />
          </div>
          {showPurchaseCost && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                Pack Cost (Opt)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Batch cost"
                value={row.purchaseRatePerPack ?? ''}
                onChange={(e) =>
                  updateLine(idx, 'purchaseRatePerPack', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm tabular-nums"
              />
            </div>
          )}
        </>
      ) : (
        <div className="md:col-span-3">
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Source Batch</label>
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
            className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm"
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
        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Target Floor / Rack</label>
        <select
          value={row.toAreaId}
          onChange={(e) => updateLine(idx, 'toAreaId', e.target.value)}
          className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm"
        >
          {areasList.length === 0 ? (
            <option value="">Create a Zone &amp; Area first</option>
          ) : (
            areasList.map((a) => (
              <option key={a._id} value={a._id}>
                {a.areaCode} — {a.areaName}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
          {movementType === 'ADJUSTMENT' ? 'Physical Base Qty' : 'Moved Base Qty'}
        </label>
        <div className="flex gap-1.5">
          <input
            type="number"
            min="0"
            value={movementType === 'ADJUSTMENT' ? row.physicalCountBaseQty : row.movedBaseQty}
            onChange={(e) =>
              updateLine(idx, movementType === 'ADJUSTMENT' ? 'physicalCountBaseQty' : 'movedBaseQty', Number(e.target.value))
            }
            className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm tabular-nums"
          />
          <button
            type="button"
            onClick={() => onOpenKeypad(idx, movementType === 'ADJUSTMENT' ? 'physicalCountBaseQty' : 'movedBaseQty')}
            aria-label="Open numeric keypad"
            className="w-11 min-h-[42px] md:w-9 md:h-9 shrink-0 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-1 md:pt-0">
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="w-full md:w-auto min-h-[44px] md:min-h-[36px] md:h-9 px-3 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 text-xs font-medium inline-flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="md:hidden">Remove Row</span>
        </button>
      </div>
    </div>
  );
}
