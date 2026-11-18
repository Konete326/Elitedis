import { useMemo } from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import { SearchableSelect } from '../../components/global';
import { formatCurrency } from '../../utils/formatters';

/**
 * Renders a single Level-1 order item as a stacked mobile card (< 768px)
 * and a compact multi-column row on tablet/desktop (>= 768px).
 */
export default function OrderLineItemCard({
  row,
  rawCustomRate,
  idx,
  products,
  onProductChange,
  onUpdateRow,
  onOpenKeypad,
  onRequestRemove,
}) {
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p._id,
        label: `${p.skuCode} — ${p.productName}`,
        sublabel: p.brandId?.brandName || p.baseUnit?.unitName || '',
      })),
    [products]
  );

  const handleSelectProduct = (productId) => {
    const prod = products.find((x) => x._id === productId);
    if (!prod) return;
    const pack = prod.packingUnits?.[0];
    onProductChange(idx, {
      productId: prod._id,
      productName: prod.productName,
      skuCode: prod.skuCode,
      unitName: pack?.unitName || prod.baseUnit?.unitName || 'Piece',
      conversionQty: pack?.conversionQty || 1,
      unitWeightKg: pack?.packingWeightKg || prod.baseUnit?.weightInKg || 0,
      baseRate: pack?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0,
      customSaleRate: '',
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 md:p-2.5">
      {/* Mobile Stacked Card (< 768px) */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              Product #{idx + 1} *
            </label>
            <SearchableSelect
              options={productOptions}
              value={row.productId}
              onChange={handleSelectProduct}
              clearable={false}
              emptyLabel="Select product..."
              placeholder="Search SKU or product..."
            />
          </div>
          <button
            type="button"
            onClick={() => onRequestRemove(idx)}
            aria-label={`Remove ${row.productName}`}
            className="mt-5 shrink-0 min-h-[40px] min-w-[40px] rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">
              Qty ({row.unitName}) *
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                min="1"
                value={row.quantity}
                onChange={(e) => onUpdateRow(idx, { quantity: Number(e.target.value) })}
                className="w-full min-h-[40px] px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => onOpenKeypad(idx)}
                aria-label="Open number pad"
                className="min-w-[40px] min-h-[40px] shrink-0 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center"
              >
                <Calculator className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Standard Rate *</label>
            <input
              type="number"
              min="0"
              value={row.baseRate}
              onChange={(e) => onUpdateRow(idx, { baseRate: Number(e.target.value) })}
              className="w-full min-h-[40px] px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Custom Price (Optional)</label>
            <input
              type="number"
              min="0"
              placeholder={String(row.baseRate)}
              value={rawCustomRate}
              onChange={(e) => onUpdateRow(idx, { customSaleRate: e.target.value })}
              className="w-full min-h-[40px] px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">
              Line Total (Disc {row.effectiveDiscountPct}%)
            </label>
            <p className="min-h-[40px] flex items-center font-mono font-bold text-sm tabular-nums text-[var(--accent-primary)]">
              {formatCurrency(row.netLineAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Row (>= 768px) */}
      <div className="hidden md:grid md:grid-cols-7 gap-2 items-end">
        <div className="md:col-span-2">
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Product *</label>
          <SearchableSelect
            options={productOptions}
            value={row.productId}
            onChange={handleSelectProduct}
            clearable={false}
            emptyLabel="Select product..."
            placeholder="Search SKU or product..."
          />
        </div>
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Qty ({row.unitName}) *</label>
          <div className="flex gap-1">
            <input
              type="number"
              min="1"
              value={row.quantity}
              onChange={(e) => onUpdateRow(idx, { quantity: Number(e.target.value) })}
              className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
            />
            <button
              type="button"
              onClick={() => onOpenKeypad(idx)}
              aria-label="Open number pad"
              className="w-8 h-8 shrink-0 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center"
            >
              <Calculator className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Standard Rate *</label>
          <input
            type="number"
            min="0"
            value={row.baseRate}
            onChange={(e) => onUpdateRow(idx, { baseRate: Number(e.target.value) })}
            className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Custom Price (Optional)</label>
          <input
            type="number"
            min="0"
            placeholder={String(row.baseRate)}
            value={rawCustomRate}
            onChange={(e) => onUpdateRow(idx, { customSaleRate: e.target.value })}
            className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">
            Total / Disc {row.effectiveDiscountPct}%
          </label>
          <p className="h-8 flex items-center font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
            {formatCurrency(row.netLineAmount)}
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRequestRemove(idx)}
            aria-label={`Remove ${row.productName}`}
            className="h-8 px-2.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs hover:bg-[var(--status-danger)]/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
