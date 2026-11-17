import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Plus, Printer, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { PrintPreviewModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

const STEPS = ['1. Customer Guard', '2. Products & Rules', '3. Invoice Style', '4. Submit & Assign'];

export default function CreateAdvanceOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [overrideBlocked, setOverrideBlocked] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const [layoutType, setLayoutType] = useState('CHILLAN_FINANCE');
  const [originalAndDuplicate, setOriginalAndDuplicate] = useState(true);
  const [assignedSalesmanId, setAssignedSalesmanId] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 100 } })).data,
  });
  const productsQuery = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 100 } })).data,
  });
  const staffQuery = useQuery({
    queryKey: ['salesmen-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });

  const customer = useMemo(
    () => (customersQuery.data || []).find((c) => c._id === customerId) || null,
    [customersQuery.data, customerId]
  );

  const netPayable = useMemo(
    () => lineItems.reduce((s, li) => s + (Number(li.customSaleRate || li.baseRate) || 0) * (Number(li.quantity) || 0), 0),
    [lineItems]
  );

  const submitMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/orders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', message: 'Advance order created cleanly.' });
      navigate('/orders/master');
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to submit advance order.' });
    },
  });

  const addLine = () => {
    const prod = productsQuery.data?.[0];
    if (!prod) return;
    const pack = prod.packingUnits?.[0];
    setLineItems((p) => [
      ...p,
      {
        productId: prod._id,
        productName: prod.productName,
        unitName: pack?.unitName || prod.baseUnit?.unitName || 'Piece',
        conversionQty: pack?.conversionQty || 1,
        unitWeightKg: pack?.packingWeightKg || prod.baseUnit?.weightInKg || 0,
        baseRate: pack?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0,
        customSaleRate: pack?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0,
        quantity: 1,
      },
    ]);
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      orderMode: 'ADVANCE',
      orderType: 'REGULAR',
      customerId,
      overrideBlocked,
      assignedSalesmanId: assignedSalesmanId || null,
      invoiceStyle: { layoutType, originalAndDuplicate },
      lineItems,
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Advance Order Creation Wizard"
        subtitle="Credit & blocked account guard, multi-style Chillan/Finance print, and immediate staff assignment"
        tabs={STEPS.map((label, idx) => ({
          id: label,
          label,
          active: step === idx,
          onClick: () => setStep(idx),
        }))}
      />

      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border bg-[var(--bg-surface)] p-5">
        {step === 0 && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Search &amp; Select Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Choose customer shop...</option>
                {(customersQuery.data || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.customerCode} — {c.shopName} ({c.ownerName})
                  </option>
                ))}
              </select>
            </div>

            {customer && (
              <div className="rounded-xl border p-4 space-y-3 bg-[var(--bg-canvas)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">{customer.shopName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {customer.customerType} · {customer.locationHierarchy?.areaName || customer.locationHierarchy?.city}
                    </p>
                  </div>
                  <StatusBadge status={customer.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Outstanding:</span>
                    <p className="font-mono font-bold tabular-nums">{formatCurrency(customer.financialTerms?.outstandingBalancePkr || 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Credit Limit:</span>
                    <p className="font-mono font-bold tabular-nums">{formatCurrency(customer.financialTerms?.creditLimitPkr || 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Condition:</span>
                    <p className="font-semibold">{customer.financialTerms?.paymentCondition}</p>
                  </div>
                </div>
                {(customer.status === 'BLOCKED' || customer.financialTerms?.paymentCondition === 'PAID_CASH') && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-3 text-xs">
                    <div className="flex items-center gap-2 text-[var(--status-warning)] font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Account Warning: {customer.status === 'BLOCKED' ? 'Blocked Account' : 'Cash Only Terms'}</span>
                    </div>
                    <label className="inline-flex items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={overrideBlocked}
                        onChange={(e) => setOverrideBlocked(e.target.checked)}
                        className="accent-[var(--accent-primary)]"
                      />
                      <span>Admin Override</span>
                    </label>
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={() => setStep(1)} disabled={!customerId} className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50">
              Next: Add Products
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Order Line Items ({lineItems.length})</span>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
            {lineItems.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center border rounded-xl p-2.5 bg-[var(--bg-canvas)]">
                <select
                  value={row.productId}
                  onChange={(e) => {
                    const p = (productsQuery.data || []).find((x) => x._id === e.target.value);
                    if (!p) return;
                    const rate = p.packingUnits?.[0]?.wholesaleSaleRate || p.baseUnit?.wholesaleSaleRate || 0;
                    setLineItems((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, productId: p._id, productName: p.productName, baseRate: rate, customSaleRate: rate } : r))
                    );
                  }}
                  className="sm:col-span-2 h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs"
                >
                  {(productsQuery.data || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.productName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) =>
                    setLineItems((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: Number(e.target.value) } : r)))
                  }
                  className="h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
                />
                <input
                  type="number"
                  value={row.customSaleRate}
                  onChange={(e) =>
                    setLineItems((prev) => prev.map((r, i) => (i === idx ? { ...r, customSaleRate: Number(e.target.value) } : r)))
                  }
                  className="h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="h-8 px-2.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs justify-self-end"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setStep(2)} className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
              Next: Invoice Style
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl space-y-4">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">Print Layout Style</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="CHILLAN_FINANCE">Chillan + Finance Invoice</option>
              <option value="DETAILED_LANDSCAPE">Detailed Landscape Invoice</option>
              <option value="ADVANCE_INVOICE">Advance Invoice</option>
              <option value="EXPIRY_BATCH_CHILLAN">Expiry &amp; Batch Chillan</option>
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={originalAndDuplicate}
                onChange={(e) => setOriginalAndDuplicate(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <span>Print Original &amp; Duplicate copies</span>
            </label>
            <button type="button" onClick={() => setStep(3)} className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
              Next: Review &amp; Submit
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-xl space-y-4">
            <div className="rounded-xl border p-4 space-y-2 bg-[var(--bg-canvas)] text-xs">
              <p className="text-sm font-bold">{customer?.shopName || 'Customer'}</p>
              <p>Total Lines: {lineItems.length} · Layout: {layoutType}</p>
              <p className="text-base font-bold font-mono tabular-nums text-[var(--accent-primary)]">
                Net Payable: {formatCurrency(netPayable)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Optional Direct Salesman Assignment</label>
              <select
                value={assignedSalesmanId}
                onChange={(e) => setAssignedSalesmanId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Assign later in Delivery Planning</option>
                {(staffQuery.data || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName} ({s.primaryRole})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border text-xs font-semibold">
                <Printer className="w-4 h-4" />
                <span>View For Print</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
              >
                <Check className="w-4 h-4" />
                <span>{submitMutation.isPending ? 'Submitting...' : 'Submit Advance Order'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Advance Invoice Preview — ${customer?.shopName || ''}`}
        documentType={layoutType}
        columns={[
          { key: 'productName', header: 'Item' },
          { key: 'quantity', header: 'Qty', numeric: true },
          { key: 'customSaleRate', header: 'Rate', numeric: true },
        ]}
        rows={lineItems}
        summaryRows={[{ label: 'Net Payable', value: formatCurrency(netPayable) }]}
      />
    </div>
  );
}
