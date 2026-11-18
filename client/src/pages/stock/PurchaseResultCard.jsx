import { AlertTriangle, CheckCircle2, Printer, RotateCcw } from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');

export default function PurchaseResultCard({
  result,
  canViewPurchasePrice,
  onReset,
  onOpenReturn,
}) {
  if (!result) return null;

  const fields = [
    { label: 'Movement ID', value: result.movementCode, mono: true },
    { label: 'Movement Type', value: result.movementType },
    { label: 'Principal Company', value: result.companyName },
    { label: 'Destination Warehouse', value: result.warehouseName },
    { label: 'Product Code (SKU)', value: result.productCode, mono: true },
    { label: 'Product Name', value: result.productName },
    { label: 'Batch ID / No', value: result.batchNo, mono: true },
    { label: 'Unit & Conversion', value: `${result.unitName || 'Unit'} (1×${result.conversionQty || 1})` },
    { label: 'Dispatch / Expected Qty', value: `${result.dispatchQty ?? 0} Base`, mono: true },
    { label: 'Received Qty', value: `${result.receivedQty ?? 0} Base`, mono: true },
    { label: 'Difference Qty', value: `${(result.differenceQty ?? 0) > 0 ? '+' : ''}${result.differenceQty ?? 0} Base`, mono: true },
    { label: 'Purchase Qty', value: `${result.purchaseQty ?? 0} Base`, mono: true },
    { label: 'Normal Bucket Qty', value: `${result.normalQty ?? 0} Base`, mono: true },
    { label: 'Damaged Bucket Qty', value: `${result.damagedQty ?? 0} Base`, mono: true },
    { label: 'Expired Bucket Qty', value: `${result.expiredQty ?? 0} Base`, mono: true },
    { label: 'Total Weight (kg)', value: `${Number(result.totalWeightKg || 0).toFixed(2)} kg`, mono: true },
    { label: 'Base Value (Rate)', value: canViewPurchasePrice ? formatCurrency(result.baseValue || 0) : 'Restricted', mono: true },
    { label: 'Pack Value (Rate)', value: canViewPurchasePrice ? formatCurrency(result.packValue || 0) : 'Restricted', mono: true },
    { label: 'Total Purchase Value', value: canViewPurchasePrice ? formatCurrency(result.purchaseValue || 0) : 'Restricted', mono: true },
    { label: 'MFG (Expected → Received)', value: `${fmtDate(result.expectedMfgDate)} → ${fmtDate(result.receivedMfgDate)}` },
    { label: 'EXP (Expected → Received)', value: `${fmtDate(result.expectedExpDate)} → ${fmtDate(result.receivedExpDate)}` },
    { label: 'Operator', value: result.operatorName || 'Operator' },
    { label: 'Movement Status', value: result.status },
    { label: 'Completed At', value: result.completedAt ? new Date(result.completedAt).toLocaleString('en-PK') : '—' },
  ];

  return (
    <div className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Purchase Movement Result (24 Fields) — {result.movementCode}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Segregated batches created across Warehouse → Zone → Area
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold hover:bg-[var(--bg-hover)]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          {onOpenReturn && (
            <button
              type="button"
              onClick={onOpenReturn}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--bg-hover)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Purchase Return</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
          >
            <span>New Receiving</span>
          </button>
        </div>
      </div>

      {Array.isArray(result.discrepancyAlerts) && result.discrepancyAlerts.length > 0 && (
        <div className="rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] p-3 space-y-1">
          <p className="text-xs font-bold flex items-center gap-1.5 text-[var(--status-warning)]">
            <AlertTriangle className="w-4 h-4" />
            <span>Discrepancy Alerts Recorded ({result.discrepancyAlerts.length})</span>
          </p>
          {result.discrepancyAlerts.map((al, i) => (
            <p key={i} className="text-xs text-[var(--text-secondary)]">• {al.message}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {fields.map((f) => (
          <div key={f.label} className="rounded-lg border bg-[var(--bg-elevated)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{f.label}</p>
            <p className={`text-xs font-semibold text-[var(--text-primary)] mt-0.5 ${f.mono ? 'font-mono tabular-nums' : ''}`}>
              {f.value || '—'}
            </p>
          </div>
        ))}
      </div>

      {Array.isArray(result.placedBatches) && result.placedBatches.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            Segregated Stock Batches Created ({result.placedBatches.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {result.placedBatches.map((b, i) => (
              <div key={b.batchId || i} className="rounded-lg border bg-[var(--bg-elevated)] p-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold font-mono text-[var(--text-primary)]">{b.batchNo}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Bucket: {b.bucket} • {b.qtyBase} Base</p>
                </div>
                <StatusBadge status={b.condition} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
