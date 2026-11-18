import { useMemo } from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import { SearchableSelect } from '../../components/global';
import { formatDate } from '../../utils/formatters';
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

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p._id, label: `${p.skuCode} — ${p.productName}`, sublabel: p.brandId?.brandName || p.baseUnit?.unitName })),
    [products]
  );

  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: b._id,
        label: `${b.batchNo} — ${b.productId?.productName || 'SKU'} (Avail: ${b.availableBaseQty ?? 0})`,
        sublabel: `EXP: ${formatDate(b.expDate)} · ${b.condition || 'NORMAL'}`,
      })),
    [batches]
  );

  const systemQty = Number(row.systemBaseQty ?? row.previousErpBaseQty ?? 0);
  const physicalQty = Number(row.physicalCountBaseQty ?? systemQty);
  const diffQty = physicalQty - systemQty;
  const updatedBalance = Math.max(0, physicalQty);

  const handleBatchSelect = (nextBatchId) => {
    const b = batches.find((x) => x._id === nextBatchId);
    if (!b) return;
    const baseQty = b.currentBaseQty || 0;
    updateLine(idx, 'batchId', b._id);
    updateLine(idx, 'batchNo', b.batchNo);
    updateLine(idx, 'productId', b.productId?._id || b.productId);
    updateLine(idx, 'fromZoneId', b.zoneId || '');
    updateLine(idx, 'fromAreaId', b.areaId || '');
    updateLine(idx, 'previousErpBaseQty', baseQty);
    updateLine(idx, 'systemBaseQty', baseQty);
    updateLine(idx, 'physicalCountBaseQty', baseQty);
    updateLine(idx, 'differenceBaseQty', 0);
    updateLine(idx, 'updatedBalanceBaseQty', baseQty);
    updateLine(idx, 'mfgDate', b.mfgDate || null);
    updateLine(idx, 'expDate', b.expDate || null);
  };

  const handleQtyChange = (nextVal) => {
    if (movementType === 'ADJUSTMENT') {
      updateLine(idx, 'systemBaseQty', systemQty);
      updateLine(idx, 'physicalCountBaseQty', nextVal);
      updateLine(idx, 'differenceBaseQty', nextVal - systemQty);
      updateLine(idx, 'updatedBalanceBaseQty', Math.max(0, nextVal));
    } else {
      updateLine(idx, 'movedBaseQty', nextVal);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 bg-[var(--bg-canvas)] space-y-2.5 animate-fade-in">
      <div
        className={`space-y-3 md:space-y-0 md:grid ${
          showPurchaseCost ? 'md:grid-cols-7' : 'md:grid-cols-6'
        } md:gap-2.5 md:items-end`}
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
              <SearchableSelect
                options={productOptions}
                value={row.productId}
                clearable={false}
                emptyLabel="Select product..."
                placeholder="Search SKU or product..."
                onChange={(val) =>
                  onPurchaseProductChange ? onPurchaseProductChange(idx, val) : updateLine(idx, 'productId', val)
                }
              />
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
            <SearchableSelect
              options={batchOptions}
              value={row.batchId}
              clearable={false}
              emptyLabel="Select source batch..."
              placeholder="Search batch or product..."
              onChange={handleBatchSelect}
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Target Storage Area</label>
          <select
            value={row.toAreaId}
            onChange={(e) => updateLine(idx, 'toAreaId', e.target.value)}
            className="w-full min-h-[42px] md:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs sm:text-sm"
          >
            {areasList.length === 0 ? (
              <option value="">Create Zone &amp; Area first</option>
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
            {movementType === 'ADJUSTMENT' ? 'Physical Count Qty' : 'Moved Base Qty'}
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="0"
              value={movementType === 'ADJUSTMENT' ? row.physicalCountBaseQty : row.movedBaseQty}
              onChange={(e) => handleQtyChange(Number(e.target.value))}
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

      {movementType === 'ADJUSTMENT' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs font-mono tabular-nums">
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1.5">
            <span className="block text-[10px] font-sans text-[var(--text-muted)]">System Qty</span>
            <strong className="text-[var(--text-primary)]">{systemQty}</strong>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1.5">
            <span className="block text-[10px] font-sans text-[var(--text-muted)]">Physical Count Qty</span>
            <strong className="text-[var(--text-primary)]">{physicalQty}</strong>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1.5">
            <span className="block text-[10px] font-sans text-[var(--text-muted)]">Difference (+/-)</span>
            <strong className={diffQty === 0 ? 'text-[var(--status-success)]' : diffQty < 0 ? 'text-[var(--status-danger)]' : 'text-[var(--accent-primary)]'}>
              {diffQty > 0 ? `+${diffQty}` : diffQty}
            </strong>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1.5">
            <span className="block text-[10px] font-sans text-[var(--text-muted)]">Updated Balance</span>
            <strong className="text-[var(--accent-primary)]">{updatedBalance}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
