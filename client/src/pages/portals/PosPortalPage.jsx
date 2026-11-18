import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Search, Store, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { PrintPreviewModal, SearchableSelect } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import { extractListPayload, formatCurrency, formatDateTime } from '../../utils/formatters';

export default function PosPortalPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [tab, setTab] = useState('counter');
  const [search, setSearch] = useState('');
  const [invoiceMode, setInvoiceMode] = useState('POS_RETAIL');
  const [customerId, setCustomerId] = useState('');
  const [walkInCustomerName, setWalkInCustomerName] = useState('Walk-in Customer');
  const [cart, setCart] = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);

  const catalogQuery = useQuery({
    queryKey: ['pos-catalog', search],
    queryFn: async () =>
      extractListPayload(await apiClient.get('/portals/pos/catalog', { params: { search: search || undefined, limit: 36 } })).data,
  });
  const customersQuery = useQuery({
    queryKey: ['customers-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 100 } })).data,
  });
  const historyQuery = useQuery({
    queryKey: ['pos-history'],
    queryFn: async () => extractListPayload(await apiClient.get('/portals/pos/history', { params: { limit: 25 } })).data,
    enabled: tab === 'history',
  });

  const cartTotal = useMemo(
    () => cart.reduce((s, item) => s + (Number(item.baseRate) || 0) * (Number(item.quantity) || 0), 0),
    [cart]
  );

  const customerOptions = useMemo(
    () =>
      (customersQuery.data || []).map((c) => ({
        value: c._id,
        label: `${c.customerCode || ''} — ${c.shopName}`.replace(/^ — /, ''),
        sublabel: c.locationHierarchy?.areaName || c.ownerContact || '',
      })),
    [customersQuery.data]
  );

  const productOptions = useMemo(
    () =>
      (catalogQuery.data || []).map((p) => ({
        value: p._id,
        label: `${p.skuCode} — ${p.productName}`,
        sublabel: `Stock: ${p.availableBaseQty ?? 0} ${p.baseUnit?.unitName || 'Pc'}`,
      })),
    [catalogQuery.data]
  );

  const checkoutMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/portals/pos/checkout', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pos-history'] });
      queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      setLastReceipt(res.data?.data || null);
      setCart([]);
      addToast({ type: 'success', message: 'POS checkout completed and receipt generated.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'POS checkout failed.' });
    },
  });

  const addItem = (prod) => {
    const rate =
      invoiceMode === 'POS_WHOLESALE'
        ? prod.baseUnit?.wholesaleSaleRate || 0
        : prod.baseUnit?.posRetailEndRate || 0;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === prod._id);
      if (idx >= 0) {
        return prev.map((i, n) => (n === idx ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: prod._id,
          productName: prod.productName,
          unitName: prod.baseUnit?.unitName || 'Piece',
          conversionQty: 1,
          unitWeightKg: prod.baseUnit?.weightInKg || 0,
          baseRate: rate,
          quantity: 1,
        },
      ];
    });
  };

  const handleRefresh = async () => {
    await Promise.all([
      catalogQuery.refetch(),
      customersQuery.refetch(),
      ...(tab === 'history' ? [historyQuery.refetch()] : []),
    ]);
    addToast({ type: 'success', message: 'POS counter refreshed.' });
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="POS Store Counter"
        subtitle="Fast retail and wholesale counter billing with instant receipt printing"
        onRefresh={handleRefresh}
        isRefreshing={catalogQuery.isFetching || customersQuery.isFetching || historyQuery.isFetching}
        tabs={[
          { id: 'counter', label: 'Counter Billing', active: tab === 'counter', onClick: () => setTab('counter') },
          { id: 'history', label: 'Sales History & Profit', active: tab === 'history', onClick: () => setTab('history') },
        ]}
      />

      {tab === 'counter' ? (
        <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 lg:overflow-hidden">
          <div className="lg:col-span-2 flex flex-col rounded-xl border bg-[var(--bg-surface)] lg:overflow-hidden lg:min-h-0">
            <div className="shrink-0 p-3 border-b bg-[var(--bg-elevated)] flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan barcode or search SKU / product..."
                  className="w-full min-h-[40px] sm:h-9 pl-9 pr-3 rounded-lg border bg-[var(--bg-surface)] text-sm"
                />
              </div>
              <div className="w-full sm:w-56">
                <SearchableSelect
                  options={productOptions}
                  value=""
                  emptyLabel="Quick-add product..."
                  placeholder="Type SKU / name..."
                  onChange={(prodId) => {
                    const found = (catalogQuery.data || []).find((x) => x._id === prodId);
                    if (found) addItem(found);
                  }}
                />
              </div>
              <select
                value={invoiceMode}
                onChange={(e) => setInvoiceMode(e.target.value)}
                className="min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-semibold"
              >
                <option value="POS_RETAIL">Retail Mode</option>
                <option value="POS_WHOLESALE">Wholesale Mode</option>
              </select>
            </div>

            <div className="max-h-[48vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto p-3 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 content-start">
              {(catalogQuery.data || []).map((prod) => {
                const rate =
                  invoiceMode === 'POS_WHOLESALE'
                    ? prod.baseUnit?.wholesaleSaleRate || 0
                    : prod.baseUnit?.posRetailEndRate || 0;
                const imgUrl = prod.baseUnit?.image?.url || prod.packingUnits?.[0]?.image?.url || '';
                return (
                  <button
                    key={prod._id}
                    type="button"
                    onClick={() => addItem(prod)}
                    className="group overflow-hidden rounded-2xl border bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)] hover:shadow-md text-left flex flex-col justify-between transition"
                  >
                    <div className="relative h-28 sm:h-32 w-full bg-[var(--bg-elevated)] overflow-hidden border-b border-[var(--border-subtle)]">
                      {imgUrl ? (
                        <img src={imgUrl} alt={prod.productName} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[var(--accent-primary)]/40">
                          <Store className="w-8 h-8" />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--bg-surface)]/90 text-[var(--text-primary)] border border-[var(--border-subtle)] backdrop-blur-sm">
                        Stock {prod.availableBaseQty ?? 0}
                      </span>
                    </div>
                    <div className="p-3 w-full">
                      <p className="text-xs font-bold truncate">{prod.productName}</p>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">{prod.skuCode}</p>
                      <p className="mt-1.5 font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
                        {formatCurrency(rate)} / {prod.baseUnit?.unitName || 'Pc'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border bg-[var(--bg-surface)] lg:overflow-hidden lg:min-h-0">
            <div className="shrink-0 p-3 border-b bg-[var(--bg-elevated)] space-y-2">
              <SearchableSelect
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                emptyLabel="Walk-in Customer"
                placeholder="Search customer shop..."
              />
              {!customerId && (
                <input
                  value={walkInCustomerName}
                  onChange={(e) => setWalkInCustomerName(e.target.value)}
                  placeholder="Customer name (Optional)"
                  className="w-full min-h-[38px] sm:h-8 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs"
                />
              )}
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  <Store className="w-6 h-6 mx-auto mb-2 text-[var(--accent-primary)]" />
                  Tap products on the left to add them to the counter bill.
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={item.productId} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{item.productName}</p>
                      <p className="font-mono text-[var(--text-muted)]">{formatCurrency(item.baseRate)}</p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        setCart((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                      }
                      className="w-14 h-8 px-1.5 rounded border bg-[var(--bg-elevated)] text-center font-mono tabular-nums"
                    />
                    <button type="button" onClick={() => setCart((p) => p.filter((_, i) => i !== idx))} className="text-[var(--status-danger)]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 p-3.5 border-t bg-[var(--bg-elevated)] space-y-2.5">
              <div className="flex justify-between text-sm font-bold">
                <span>Total Payable:</span>
                <span className="font-mono tabular-nums text-[var(--accent-primary)]">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                type="button"
                disabled={cart.length === 0 || checkoutMutation.isPending}
                onClick={() =>
                  checkoutMutation.mutate({
                    customerId: customerId || null,
                    walkInCustomerName,
                    invoiceMode,
                    lineItems: cart,
                    paidAmountPkr: cartTotal,
                  })
                }
                className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{checkoutMutation.isPending ? 'Completing...' : 'Complete & Print Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-xl border bg-[var(--bg-surface)] divide-y">
          {(historyQuery.data || []).map((sale) => (
            <div key={sale._id} className="flex items-center justify-between px-4 py-3 text-xs">
              <div>
                <p className="font-mono font-bold">{sale.invoiceNo} — {sale.customerId?.shopName || sale.walkInCustomerName}</p>
                <p className="text-[var(--text-muted)]">{formatDateTime(sale.createdAt)}</p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <p className="font-bold">{formatCurrency(sale.grandSummary?.netPayableAmount)}</p>
                <p className="text-[var(--status-success)]">Profit: {formatCurrency(sale.grandSummary?.grossProfitPkr || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <PrintPreviewModal
        isOpen={Boolean(lastReceipt)}
        onClose={() => setLastReceipt(null)}
        title={`POS Receipt ${lastReceipt?.invoiceNo || ''}`}
        documentType="POS Receipt"
        defaultFormat="thermal"
        columns={[
          { key: 'productName', header: 'Item' },
          { key: 'quantity', header: 'Qty', numeric: true },
          { key: 'netLineAmount', header: 'Amount', numeric: true },
        ]}
        rows={lastReceipt?.lineItems || []}
        summaryRows={[{ label: 'Net Paid', value: formatCurrency(lastReceipt?.grandSummary?.netPayableAmount) }]}
      />
    </div>
  );
}
