import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { ConfirmModal, PrintPreviewModal, TouchKeypadModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import OrderLineItemCard from './OrderLineItemCard';
import OrderSummaryPanel from './OrderSummaryPanel';
import { calculateLiveOrderSummary } from '../../utils/invoiceMath';
import { extractListPayload, formatCurrency, formatWeight } from '../../utils/formatters';

export default function CreateNormalOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [customerId, setCustomerId] = useState('');
  const [orderType, setOrderType] = useState('REGULAR');
  const [invoiceRules, setInvoiceRules] = useState({
    discountAllow: true,
    taxAllow: true,
    schemeAllow: true,
    chargesAllow: true,
  });
  const [grandDiscountRuleId, setGrandDiscountRuleId] = useState('');
  const [grandChargeRuleId, setGrandChargeRuleId] = useState('');
  const [grandSchemeRuleId, setGrandSchemeRuleId] = useState('');
  const [extraGrandDiscountPkr, setExtraGrandDiscountPkr] = useState(0);
  const [lineItems, setLineItems] = useState([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [keypadIdx, setKeypadIdx] = useState(null);
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
  const rulesQuery = useQuery({
    queryKey: ['rules-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/rules', { params: { limit: 100, status: 'ACTIVE' } })).data,
  });

  const selectedCustomer = useMemo(
    () => (customersQuery.data || []).find((c) => c._id === customerId) || null,
    [customersQuery.data, customerId]
  );

  const rules = rulesQuery.data || [];
  const ruleMap = useMemo(() => new Map(rules.map((r) => [r._id, r])), [rules]);

  const liveCalc = useMemo(
    () =>
      calculateLiveOrderSummary({
        lineItems,
        invoiceRules,
        ruleMap,
        grandDiscountRuleId,
        grandChargeRuleId,
        extraGrandDiscountPkr,
      }),
    [lineItems, invoiceRules, ruleMap, grandDiscountRuleId, grandChargeRuleId, extraGrandDiscountPkr]
  );

  const submitMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/orders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      setSubmitConfirmOpen(false);
      addToast({ type: 'success', message: 'Normal order submitted for approval.' });
      navigate('/orders/master');
    },
    onError: (err) => {
      setSubmitConfirmOpen(false);
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not create order.' });
    },
  });

  const addProductRow = () => {
    const prod = productsQuery.data?.[0];
    if (!prod) {
      addToast({ type: 'warning', message: 'Add at least one product in Products Master first.' });
      return;
    }
    const pack = prod.packingUnits?.[0];
    setLineItems((prev) => [
      ...prev,
      {
        productId: prod._id,
        productName: prod.productName,
        skuCode: prod.skuCode,
        unitName: pack?.unitName || prod.baseUnit?.unitName || 'Piece',
        conversionQty: pack?.conversionQty || 1,
        unitWeightKg: pack?.packingWeightKg || prod.baseUnit?.weightInKg || 0,
        baseRate: pack?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0,
        customSaleRate: '',
        quantity: 1,
      },
    ]);
  };

  const updateRow = (idx, patch) => {
    setLineItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId) {
      addToast({ type: 'warning', message: 'Please pick a customer shop before submitting.' });
      return;
    }
    if (lineItems.length === 0) {
      addToast({ type: 'warning', message: 'Please add at least one product to the order.' });
      return;
    }
    setSubmitConfirmOpen(true);
  };

  const confirmSubmitOrder = () => {
    submitMutation.mutate({
      orderMode: 'NORMAL',
      orderType,
      customerId,
      invoiceRules,
      grandDiscountRuleId: grandDiscountRuleId || null,
      grandChargeRuleId: grandChargeRuleId || null,
      grandSchemeRuleId: grandSchemeRuleId || null,
      extraGrandDiscountPkr,
      lineItems,
    });
  };

  const customers = customersQuery.data || [];
  const products = productsQuery.data || [];
  const prereqReady = !customersQuery.isLoading && !productsQuery.isLoading;

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="New Normal Order"
        subtitle="Pick a customer, add products, adjust custom prices or discounts, and submit for approval"
        actions={
          <>
            <button
              type="button"
              onClick={() => (lineItems.length > 0 ? setCancelConfirmOpen(true) : navigate('/orders/master'))}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Orders Master</span>
            </button>
            <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium">
              <Printer className="w-3.5 h-3.5" />
              <span>Preview Bill</span>
            </button>
          </>
        }
      />

      <SetupGuideBanner
        isLoading={!prereqReady}
        missingMessage="Add at least one Customer Shop and one Product before creating an order."
        steps={[
          { label: 'Add at least 1 Customer Shop', done: customers.length > 0, to: '/crm/customers', actionLabel: 'Add Customer' },
          { label: 'Add at least 1 Product', done: products.length > 0, to: '/inventory/products', actionLabel: 'Add Product' },
        ]}
      />

      <form onSubmit={handleSubmit} className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 lg:overflow-hidden">
        <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3.5 grid grid-cols-1 lg:grid-cols-4 gap-3 items-center">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Customer Shop *</label>
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-10 sm:h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">Choose customer shop...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.customerCode} — {c.shopName} ({c.locationHierarchy?.areaName || c.locationHierarchy?.city || 'City'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Order Priority (Optional)</label>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full h-10 sm:h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="REGULAR">Regular</option>
              <option value="URGENT">Urgent</option>
              <option value="SPECIAL">Special</option>
              <option value="CUSTOM_SALE">Custom Sale</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 lg:pt-0">
            {selectedCustomer ? (
              <>
                <StatusBadge status={selectedCustomer.financialTerms?.paymentCondition} />
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  Balance: {formatCurrency(selectedCustomer.financialTerms?.outstandingBalancePkr || 0)}
                </span>
              </>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Select a customer to see credit terms</span>
            )}
          </div>
        </div>

        <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-3 lg:overflow-hidden">
          <div className="xl:col-span-3 flex flex-col rounded-xl border bg-[var(--bg-surface)] lg:overflow-hidden lg:min-h-0">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-[var(--bg-elevated)]">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold uppercase text-[var(--text-secondary)]">Order Items</span>
                {[
                  ['discountAllow', 'Discounts'],
                  ['taxAllow', 'Tax'],
                  ['schemeAllow', 'Free Offers'],
                  ['chargesAllow', 'Charges'],
                ].map(([flag, label]) => (
                  <label key={flag} className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceRules[flag]}
                      onChange={(e) => setInvoiceRules((p) => ({ ...p, [flag]: e.target.checked }))}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={addProductRow}
                disabled={products.length === 0}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-auto p-3 space-y-2">
              {liveCalc.lineItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                  Click &quot;Add Product&quot; above to add items and calculate prices, discounts, and free offers.
                </div>
              ) : (
                liveCalc.lineItems.map((row, idx) => (
                  <OrderLineItemCard
                    key={`${row.productId}-${idx}`}
                    row={row}
                    rawCustomRate={lineItems[idx]?.customSaleRate ?? ''}
                    idx={idx}
                    products={products}
                    onProductChange={updateRow}
                    onUpdateRow={updateRow}
                    onOpenKeypad={setKeypadIdx}
                    onRequestRemove={setRemoveIdx}
                  />
                ))
              )}
            </div>
          </div>

          <OrderSummaryPanel
            rules={rules}
            grandDiscountRuleId={grandDiscountRuleId}
            setGrandDiscountRuleId={setGrandDiscountRuleId}
            extraGrandDiscountPkr={extraGrandDiscountPkr}
            setExtraGrandDiscountPkr={setExtraGrandDiscountPkr}
            grandChargeRuleId={grandChargeRuleId}
            setGrandChargeRuleId={setGrandChargeRuleId}
            grandSchemeRuleId={grandSchemeRuleId}
            setGrandSchemeRuleId={setGrandSchemeRuleId}
            grandSummary={liveCalc.grandSummary}
            isSubmitting={submitMutation.isPending}
            onCancelClick={() => (lineItems.length > 0 ? setCancelConfirmOpen(true) : navigate('/orders/master'))}
          />
        </div>
      </form>

      <TouchKeypadModal
        isOpen={keypadIdx !== null}
        onClose={() => setKeypadIdx(null)}
        initialValue={keypadIdx !== null ? lineItems[keypadIdx]?.quantity : 1}
        min={1}
        title="Enter Order Quantity"
        onConfirm={(val) => { if (keypadIdx !== null) updateRow(keypadIdx, { quantity: val }); }}
      />
      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Normal Order Draft Preview"
        subtitle={selectedCustomer?.shopName}
        columns={[
          { key: 'productName', header: 'Item' },
          { key: 'unitName', header: 'Unit' },
          { key: 'quantity', header: 'Qty', numeric: true },
          { key: 'customSaleRate', header: 'Sale Rate', numeric: true },
          { key: 'netLineAmount', header: 'Net Amount', numeric: true },
        ]}
        rows={liveCalc.lineItems}
        summaryRows={[
          { label: 'Total Weight', value: formatWeight(liveCalc.grandSummary.totalWeightKg) },
          { label: 'Net Payable', value: formatCurrency(liveCalc.grandSummary.netPayableAmount) },
        ]}
      />

      <ConfirmModal
        isOpen={removeIdx !== null}
        onClose={() => setRemoveIdx(null)}
        onConfirm={() => { setLineItems((prev) => prev.filter((_, i) => i !== removeIdx)); setRemoveIdx(null); }}
        variant="danger"
        title="Remove product from order?"
        message={`Remove ${lineItems[removeIdx]?.productName || 'this item'} from the order?`}
        confirmLabel="Remove Item"
      />
      <ConfirmModal
        isOpen={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        onConfirm={confirmSubmitOrder}
        isLoading={submitMutation.isPending}
        variant="primary"
        title="Submit this order?"
        message={`Create normal order for ${selectedCustomer?.shopName || 'selected customer'} totaling ${formatCurrency(liveCalc.grandSummary.netPayableAmount)} (${liveCalc.lineItems.length} items)?`}
        confirmLabel="Submit Order"
      />
      <ConfirmModal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => navigate('/orders/master')}
        variant="warning"
        title="Discard draft order?"
        message="You have unsaved items in this order. Leave without saving?"
        confirmLabel="Discard & Exit"
      />
    </div>
  );
}
