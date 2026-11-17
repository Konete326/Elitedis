import { Check } from 'lucide-react';
import { formatCurrency, formatWeight } from '../../utils/formatters';

export default function OrderSummaryPanel({
  rules = [],
  grandDiscountRuleId,
  setGrandDiscountRuleId,
  extraGrandDiscountPkr,
  setExtraGrandDiscountPkr,
  grandChargeRuleId,
  setGrandChargeRuleId,
  grandSchemeRuleId,
  setGrandSchemeRuleId,
  grandSummary,
  isSubmitting,
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border bg-[var(--bg-surface)] p-4 gap-3 overflow-y-auto">
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
          Level 2 — Grand Summary
        </h3>

        <div className="space-y-2 text-xs">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Grand Discount Rule</label>
            <select
              value={grandDiscountRuleId}
              onChange={(e) => setGrandDiscountRuleId(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            >
              <option value="">None</option>
              {rules
                .filter((r) => r.ruleCategory === 'DISCOUNT' && r.level === 'GRAND_LEVEL')
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.ruleName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Extra Flat Discount (PKR)</label>
            <input
              type="number"
              min="0"
              value={extraGrandDiscountPkr}
              onChange={(e) => setExtraGrandDiscountPkr(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Grand Charge Rule</label>
            <select
              value={grandChargeRuleId}
              onChange={(e) => setGrandChargeRuleId(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            >
              <option value="">None</option>
              {rules
                .filter((r) => r.ruleCategory === 'CHARGE' && r.level === 'GRAND_LEVEL')
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.ruleName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Grand Target Scheme</label>
            <select
              value={grandSchemeRuleId}
              onChange={(e) => setGrandSchemeRuleId(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs"
            >
              <option value="">None</option>
              {rules
                .filter((r) => r.ruleCategory === 'SCHEME' && r.level === 'GRAND_LEVEL')
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.ruleName}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="border-t pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Items / Qty:</span>
            <span className="font-mono tabular-nums">
              {grandSummary.totalItems} / {grandSummary.totalQuantity}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Total Weight:</span>
            <span className="font-mono tabular-nums">{formatWeight(grandSummary.totalWeightKg)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Gross Amount:</span>
            <span className="font-mono tabular-nums">{formatCurrency(grandSummary.grossAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Total Discounts:</span>
            <span className="font-mono tabular-nums text-[var(--status-danger)]">
              -{formatCurrency(grandSummary.totalItemDiscounts + grandSummary.grandDiscountAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 text-sm font-bold">
            <span>Net Payable:</span>
            <span className="font-mono tabular-nums text-[var(--accent-primary)]">
              {formatCurrency(grandSummary.netPayableAmount)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-10 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" />
        <span>{isSubmitting ? 'Submitting...' : 'Submit Normal Order'}</span>
      </button>
    </div>
  );
}
