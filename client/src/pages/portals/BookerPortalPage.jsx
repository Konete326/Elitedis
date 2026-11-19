import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Check, MapPin, ShoppingCart } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { TouchKeypadModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import ProductCardMedia from '../../components/shared/ProductCardMedia';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatDateTime } from '../../utils/formatters';

export default function BookerPortalPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [tab, setTab] = useState('booking');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [keypadProd, setKeypadProd] = useState(null);

  const beatsQuery = useQuery({
    queryKey: ['booker-beats'],
    queryFn: async () => (await apiClient.get('/portals/booker/beats')).data?.data || [],
  });
  const catalogQuery = useQuery({
    queryKey: ['booker-catalog'],
    queryFn: async () => extractListPayload(await apiClient.get('/portals/booker/catalog', { params: { limit: 50 } })).data,
  });
  const customersQuery = useQuery({
    queryKey: ['booker-customers'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 50 } })).data,
  });
  const historyQuery = useQuery({
    queryKey: ['booker-history'],
    queryFn: async () => extractListPayload(await apiClient.get('/portals/booker/history', { params: { limit: 20 } })).data,
    enabled: tab === 'history',
  });

  const orderTotal = useMemo(
    () => cart.reduce((s, item) => s + (Number(item.baseRate) || 0) * (Number(item.quantity) || 0), 0),
    [cart]
  );

  const submitMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/portals/booker/orders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booker-history'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      addToast({ type: 'success', message: 'Booker order submitted for approval.' });
      setCart([]);
      setSelectedCustomer(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not submit order.' });
    },
  });

  const addProductQty = (prod, qty) => {
    if (!qty || qty <= 0) return;
    const pack = prod.packingUnits?.[0];
    const rate = pack?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0;
    setCart((prev) => {
      const existingIdx = prev.findIndex((x) => x.productId === prod._id);
      if (existingIdx >= 0) {
        return prev.map((x, i) => (i === existingIdx ? { ...x, quantity: qty } : x));
      }
      return [
        ...prev,
        {
          productId: prod._id,
          productName: prod.productName,
          unitName: pack?.unitName || prod.baseUnit?.unitName || 'Piece',
          conversionQty: pack?.conversionQty || 1,
          unitWeightKg: pack?.packingWeightKg || prod.baseUnit?.weightInKg || 0,
          baseRate: rate,
          quantity: qty,
        },
      ];
    });
  };

  const handleRefresh = async () => {
    await Promise.all([
      beatsQuery.refetch(),
      catalogQuery.refetch(),
      customersQuery.refetch(),
      ...(tab === 'history' ? [historyQuery.refetch()] : []),
    ]);
    addToast({ type: 'success', message: 'Booker portal refreshed.' });
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Order Booker Portal"
        subtitle="Pick a visited shop, tap products to enter quantities, and submit orders"
        onRefresh={handleRefresh}
        isRefreshing={beatsQuery.isFetching || catalogQuery.isFetching || customersQuery.isFetching || historyQuery.isFetching}
        tabs={[
          { id: 'booking', label: 'Today Booking', active: tab === 'booking', onClick: () => setTab('booking') },
          { id: 'beats', label: 'My Beat Plans', count: beatsQuery.data?.length || 0, active: tab === 'beats', onClick: () => setTab('beats') },
          { id: 'history', label: 'Booking History', active: tab === 'history', onClick: () => setTab('history') },
        ]}
      />

      {tab === 'booking' && (
        <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 lg:overflow-hidden">
          <div className="rounded-xl border bg-[var(--bg-surface)] flex flex-col lg:overflow-hidden lg:min-h-0">
            <div className="shrink-0 px-3.5 py-2.5 border-b bg-[var(--bg-elevated)] text-xs font-bold uppercase text-[var(--text-secondary)]">
              1. Pick a Shop ({customersQuery.data?.length || 0})
            </div>
            <div className="max-h-[42vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto p-2.5 space-y-2">
              {(customersQuery.data || []).map((c) => {
                const active = selectedCustomer?._id === c._id;
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full text-left rounded-xl border p-3 min-h-[48px] transition-colors ${
                      active ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]' : 'bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{c.shopName}</span>
                      <StatusBadge status={c.visitPosition || 'NORMAL'} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)] truncate">
                      {c.locationHierarchy?.areaName || c.locationHierarchy?.city || '—'} · {c.ownerContact}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border bg-[var(--bg-surface)] flex flex-col lg:overflow-hidden lg:min-h-0">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-[var(--bg-elevated)]">
              <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                2. Tap Product to Enter Qty ({selectedCustomer ? selectedCustomer.shopName : 'Select customer first'})
              </span>
              <span className="font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
                Cart: {cart.length} items · {formatCurrency(orderTotal)}
              </span>
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-3 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 content-start">
              {(catalogQuery.data || []).map((prod) => {
                const inCart = cart.find((x) => x.productId === prod._id);
                const rate = prod.packingUnits?.[0]?.wholesaleSaleRate || prod.baseUnit?.wholesaleSaleRate || 0;
                return (
                  <div
                    key={prod._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setKeypadProd(prod)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setKeypadProd(prod);
                      }
                    }}
                    className={`group cursor-pointer overflow-hidden rounded-2xl border text-left flex flex-col justify-between transition ${
                      inCart ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50 shadow-md' : 'bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)] hover:shadow-md'
                    }`}
                  >
                    <ProductCardMedia product={prod} fallbackIcon={Calculator} />
                    <div className="p-3 w-full">
                      <p className="text-xs font-bold truncate">{prod.productName}</p>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">{prod.skuCode}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                          {formatCurrency(rate)}
                        </span>
                        {inCart ? (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-white font-mono text-[11px]">
                            x{inCart.quantity}
                          </span>
                        ) : (
                          <Calculator className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t bg-[var(--bg-elevated)]">
              <span className="text-xs text-[var(--text-secondary)]">
                Total Order: <strong className="font-mono tabular-nums text-sm">{formatCurrency(orderTotal)}</strong>
              </span>
              <button
                type="button"
                disabled={!selectedCustomer || cart.length === 0 || submitMutation.isPending}
                onClick={() => submitMutation.mutate({ customerId: selectedCustomer._id, lineItems: cart })}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submitMutation.isPending ? 'Submitting...' : 'Create Booker Order'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'beats' && (
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
          {(beatsQuery.data || []).length === 0 ? (
            <div className="col-span-full rounded-xl border bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-[var(--accent-primary)]" />
              No active beats assigned to this account yet.
            </div>
          ) : (
            (beatsQuery.data || []).map((beat) => (
              <div key={beat._id} className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">{beat.beatCode}</span>
                  <StatusBadge status={beat.beatDay} tone="info" />
                </div>
                <p className="font-bold text-sm">{beat.beatName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Wholesalers: {beat.totalWholesalers} · Retailers: {beat.totalRetailers}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-xl border bg-[var(--bg-surface)] divide-y">
          {(historyQuery.data || []).map((o) => (
            <div key={o._id} className="flex items-center justify-between px-4 py-3 text-xs">
              <div>
                <p className="font-mono font-bold">{o.orderCode} — {o.customerId?.shopName}</p>
                <p className="text-[var(--text-muted)]">{formatDateTime(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold tabular-nums">{formatCurrency(o.grandSummary?.netPayableAmount)}</p>
                <StatusBadge status={o.approvalInfo?.status} />
              </div>
            </div>
          ))}
          {(historyQuery.data || []).length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              <ShoppingCart className="w-5 h-5 mx-auto mb-2" />
              No booking history recorded yet.
            </div>
          )}
        </div>
      )}

      <TouchKeypadModal
        isOpen={Boolean(keypadProd)}
        onClose={() => setKeypadProd(null)}
        title={keypadProd?.productName || 'Quantity'}
        subtitle={`SKU: ${keypadProd?.skuCode || ''} · Available: ${keypadProd?.availableBaseQty ?? 0}`}
        initialValue={cart.find((x) => x.productId === keypadProd?._id)?.quantity || 1}
        min={0}
        onConfirm={(qty) => {
          if (keypadProd) addProductQty(keypadProd, qty);
        }}
      />
    </div>
  );
}
