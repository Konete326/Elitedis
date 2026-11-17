import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function AdvanceOrderItemsStep({
  lineItems,
  products,
  onAddLine,
  onChangeLine,
  onRequestRemove,
  onNext,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">Order Items ({lineItems.length})</span>
        <button
          type="button"
          onClick={onAddLine}
          disabled={products.length === 0}
          className="inline-flex items-center gap-1 min-h-[38px] px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Item</span>
        </button>
      </div>
      {lineItems.length === 0 ? (
        <div className="rounded-xl border bg-[var(--bg-canvas)] py-8 text-center text-xs text-[var(--text-muted)]">
          Click &quot;Add Item&quot; above to add products to this advance order.
        </div>
      ) : (
        lineItems.map((row, idx) => (
          <div
            key={idx}
            className="rounded-xl border p-3 bg-[var(--bg-canvas)] space-y-2.5 md:space-y-0 md:grid md:grid-cols-6 md:gap-2 md:items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Product #{idx + 1} *</label>
              <select
                value={row.productId}
                onChange={(e) => {
                  const p = products.find((x) => x._id === e.target.value);
                  if (!p) return;
                  const rate = p.packingUnits?.[0]?.wholesaleSaleRate || p.baseUnit?.wholesaleSaleRate || 0;
                  onChangeLine(idx, {
                    productId: p._id,
                    productName: p.productName,
                    baseRate: rate,
                    customSaleRate: rate,
                  });
                }}
                className="w-full h-10 md:h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.productName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 md:contents gap-2">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => onChangeLine(idx, { quantity: Number(e.target.value) })}
                  className="w-full h-10 md:h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Sale Rate (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  value={row.customSaleRate}
                  onChange={(e) => onChangeLine(idx, { customSaleRate: Number(e.target.value) })}
                  className="w-full h-10 md:h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
                />
              </div>
            </div>
            <div className="flex items-center justify-between md:col-span-2 md:justify-end gap-3">
              <span className="font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
                {formatCurrency((Number(row.customSaleRate || row.baseRate) || 0) * (Number(row.quantity) || 0))}
              </span>
              <button
                type="button"
                onClick={() => onRequestRemove(idx)}
                aria-label={`Remove ${row.productName}`}
                className="min-h-[38px] md:h-8 px-2.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="md:hidden">Remove</span>
              </button>
            </div>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={lineItems.length === 0}
        className="min-h-[40px] px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50"
      >
        Next: Invoice Style
      </button>
    </div>
  );
}
