import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Check, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { ConfirmModal, PrintPreviewModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import AdvanceOrderItemsStep from './AdvanceOrderItemsStep';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

const STEPS = ['1. Pick Customer', '2. Add Products', '3. Print Style', '4. Review & Submit'];

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
  const [removeIdx, setRemoveIdx] = useState(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

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
      setSubmitConfirmOpen(false);
      addToast({ type: 'success', message: 'Advance order created.' });
      navigate('/orders/master');
    },
    onError: (err) => {
      setSubmitConfirmOpen(false);
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to submit advance order.' });
    },
  });

  const customers = customersQuery.data || [];
  const products = productsQuery.data || [];
  const prereqReady = !customersQuery.isLoading && !productsQuery.isLoading;

  const addLine = () => {
    const prod = products[0];
    if (!prod) {
      addToast({ type: 'warning', message: 'Add a product in Products Master first.' });
      return;
    }
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
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="New Advance Order"
        subtitle="Step-by-step order setup with credit limit check, print layout, and salesman assignment"
        actions={
          <button
            type="button"
            onClick={() => (lineItems.length > 0 || customerId ? setCancelConfirmOpen(true) : navigate('/orders/master'))}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Orders Master</span>
          </button>
        }
        tabs={STEPS.map((label, idx) => ({
          id: label,
          label,
          active: step === idx,
          onClick: () => setStep(idx),
        }))}
      />

      {prereqReady && (
        <SetupGuideBanner
          missingMessage="Add at least one Customer Shop and one Product before creating an advance order."
          steps={[
            { label: 'Add at least 1 Customer Shop', done: customers.length > 0, to: '/crm/customers', actionLabel: 'Add Customer' },
            { label: 'Add at least 1 Product', done: products.length > 0, to: '/inventory/products', actionLabel: 'Add Product' },
          ]}
        />
      )}

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-xl border bg-[var(--bg-surface)] p-4 sm:p-5">
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
          <AdvanceOrderItemsStep
            lineItems={lineItems}
            products={products}
            onAddLine={addLine}
            onChangeLine={(idx, patch) =>
              setLineItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
            }
            onRequestRemove={setRemoveIdx}
            onNext={() => setStep(2)}
          />
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
                onClick={() => setSubmitConfirmOpen(true)}
                disabled={!customerId || lineItems.length === 0 || submitMutation.isPending}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50"
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

      <ConfirmModal
        isOpen={removeIdx !== null}
        onClose={() => setRemoveIdx(null)}
        onConfirm={() => {
          setLineItems((prev) => prev.filter((_, i) => i !== removeIdx));
          setRemoveIdx(null);
        }}
        variant="danger"
        title="Remove item from order?"
        message={`Remove ${lineItems[removeIdx]?.productName || 'this item'} from the order?`}
        confirmLabel="Remove Item"
      />

      <ConfirmModal
        isOpen={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        onConfirm={handleSubmit}
        isLoading={submitMutation.isPending}
        variant="primary"
        title="Submit advance order?"
        message={`Create advance order for ${customer?.shopName || 'selected customer'} totaling ${formatCurrency(netPayable)}?`}
        confirmLabel="Submit Advance Order"
      />

      <ConfirmModal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => navigate('/orders/master')}
        variant="warning"
        title="Cancel advance order?"
        message="Discard your current selections and return to Orders Master?"
        confirmLabel="Discard & Exit"
      />
    </div>
  );
}
