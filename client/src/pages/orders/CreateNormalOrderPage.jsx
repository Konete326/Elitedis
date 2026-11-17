import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Plus, Printer, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { PrintPreviewModal, TouchKeypadModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
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
      addToast({ type: 'success', message: 'Normal order submitted for approval.' });
      navigate('/orders/master');
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not create order.' });
    },
  });

  const addProductRow = () => {
    const prod = productsQuery.data?.[0];
    if (!prod) {
      addToast({ type: 'warning', message: 'Create a product first in Product Master.' });
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
      addToast({ type: 'warning', message: 'Select a customer before submitting.' });
      return;
    }
    if (lineItems.length === 0) {
      addToast({ type: 'warning', message: 'Add at least one product row.' });
      return;
    }
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

  const products = productsQuery.data || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Normal Order Workbench (2-Level Engine)"
        subtitle="Level 1 item rates, reverse sale rate discount, free schemes -> Level 2 grand rules"
        actions={
          <>
            <button type="button" onClick={() => navigate('/orders/master')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Orders Master</span>
            </button>
            <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium">
              <Printer className="w-3.5 h-3.5" />
              <span>Preview Invoice</span>
            </button>
          </>
        }
      />

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3.5 grid grid-cols-1 lg:grid-cols-4 gap-3 items-center">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Customer Shop</label>
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">Select customer...</option>
              {(customersQuery.data || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.customerCode} — {c.shopName} ({c.locationHierarchy?.areaName || c.locationHierarchy?.city || 'City'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Order Type</label>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="REGULAR">Regular</option>
              <option value="URGENT">Urgent</option>
              <option value="SPECIAL">Special</option>
              <option value="CUSTOM_SALE">Custom Sale</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 lg:pt-0">
            {selectedCustomer ? (
              <>
                <StatusBadge status={selectedCustomer.financialTerms?.paymentCondition} />
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  Bal: {formatCurrency(selectedCustomer.financialTerms?.outstandingBalancePkr || 0)}
                </span>
              </>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Select customer for credit terms</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-3 overflow-hidden">
          <div className="xl:col-span-3 flex flex-col rounded-xl border bg-[var(--bg-surface)] overflow-hidden min-h-0">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-[var(--bg-elevated)]">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold uppercase text-[var(--text-secondary)]">Level 1 Items</span>
                {['discountAllow', 'taxAllow', 'schemeAllow', 'chargesAllow'].map((flag) => (
                  <label key={flag} className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invoiceRules[flag]}
                      onChange={(e) => setInvoiceRules((p) => ({ ...p, [flag]: e.target.checked }))}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span>{flag.replace('Allow', '')}</span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={addProductRow} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
              {liveCalc.lineItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                  Click "+ Add Product" to add items and test reverse sale rates, schemes, and discounts.
                </div>
              ) : (
                liveCalc.lineItems.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-end rounded-xl border p-2.5 bg-[var(--bg-canvas)]">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">Product</label>
                      <select
                        value={row.productId}
                        onChange={(e) => {
                          const p = products.find((x) => x._id === e.target.value);
                          if (!p) return;
                          const pack = p.packingUnits?.[0];
                          updateRow(idx, {
                            productId: p._id,
                            productName: p.productName,
                            skuCode: p.skuCode,
                            unitName: pack?.unitName || p.baseUnit?.unitName || 'Piece',
                            conversionQty: pack?.conversionQty || 1,
                            unitWeightKg: pack?.packingWeightKg || p.baseUnit?.weightInKg || 0,
                            baseRate: pack?.wholesaleSaleRate || p.baseUnit?.wholesaleSaleRate || 0,
                            customSaleRate: '',
                          });
                        }}
                        className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.skuCode} — {p.productName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">Qty ({row.unitName})</label>
                      <div className="flex gap-1">
                        <input type="number" min="1" value={row.quantity} onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })} className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums" />
                        <button type="button" onClick={() => setKeypadIdx(idx)} className="w-8 h-8 shrink-0 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">Base Rate</label>
                      <input type="number" value={row.baseRate} onChange={(e) => updateRow(idx, { baseRate: Number(e.target.value) })} className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">Custom Sale Rate</label>
                      <input type="number" placeholder={String(row.baseRate)} value={lineItems[idx].customSaleRate} onChange={(e) => updateRow(idx, { customSaleRate: e.target.value })} className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">Net / Disc {row.effectiveDiscountPct}%</label>
                      <p className="h-8 flex items-center font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
                        {formatCurrency(row.netLineAmount)}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))} className="h-8 px-2.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
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
          />
        </div>
      </form>

      <TouchKeypadModal
        isOpen={keypadIdx !== null}
        onClose={() => setKeypadIdx(null)}
        initialValue={keypadIdx !== null ? lineItems[keypadIdx]?.quantity : 1}
        min={1}
        title="Enter Order Quantity"
        onConfirm={(val) => {
          if (keypadIdx !== null) updateRow(keypadIdx, { quantity: val });
        }}
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
    </div>
  );
}
