import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Truck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { FormModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

export default function SalesmanPortalPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [dealTarget, setDealTarget] = useState(null);
  const [cashAmount, setCashAmount] = useState(0);
  const [fuelExpense, setFuelExpense] = useState(0);
  const [extraDisc, setExtraDisc] = useState(0);

  const planQuery = useQuery({
    queryKey: ['salesman-delivery-plan'],
    queryFn: async () => (await apiClient.get('/portals/salesman/delivery-plan')).data?.data || [],
  });

  const salesQuery = useQuery({
    queryKey: ['salesman-invoices'],
    queryFn: async () => (await apiClient.get('/sales-recovery/sales', { params: { limit: 100 } })).data?.data || [],
  });

  const dealMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/portals/salesman/deal', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesman-delivery-plan'] });
      addToast({ type: 'success', message: 'Delivery deal closed and posted.' });
      setDealTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not close delivery deal.' });
    },
  });

  const sheets = planQuery.data || [];

  const handleRefresh = async () => {
    await Promise.all([planQuery.refetch(), salesQuery.refetch()]);
    addToast({ type: 'success', message: 'Delivery plan refreshed.' });
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Salesman Delivery &amp; Recovery Portal"
        subtitle="See your assigned delivery stops, collect shop payments, and record fuel expenses"
        onRefresh={handleRefresh}
        isRefreshing={planQuery.isFetching || salesQuery.isFetching}
      />

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto space-y-3">
        {sheets.length === 0 ? (
          <div className="rounded-xl border bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-muted)]">
            <Truck className="w-7 h-7 mx-auto mb-2 text-[var(--accent-primary)]" />
            No active delivery plans assigned to you right now.
          </div>
        ) : (
          sheets.map((sheet) => (
            <div key={sheet._id} className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                <div>
                  <p className="font-mono font-bold text-sm">{sheet.dispatchCode}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Vehicle: {sheet.vehicleInfo?.vehicleNo || 'Assigned'} · Load: {formatCurrency(sheet.totalLoadValuePkr)}
                  </p>
                </div>
                <StatusBadge status={sheet.status} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(sheet.orderIds || []).map((ord) => (
                  <div key={ord._id} className="rounded-xl border bg-[var(--bg-canvas)] p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{ord.customerId?.shopName || ord.orderCode}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {ord.customerId?.locationHierarchy?.pehchanRemarks || ord.customerId?.locationHierarchy?.areaName || 'Route Stop'}
                      </p>
                      <p className="mt-1 font-mono font-bold text-xs tabular-nums text-[var(--accent-primary)]">
                        {formatCurrency(ord.grandSummary?.netPayableAmount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDealTarget({ sheetId: sheet._id, order: ord });
                        setCashAmount(ord.grandSummary?.netPayableAmount || 0);
                        setExtraDisc(0);
                        setFuelExpense(0);
                      }}
                      className="shrink-0 min-h-[44px] px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
                    >
                      Start Deal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <FormModal
        isOpen={Boolean(dealTarget)}
        onClose={() => setDealTarget(null)}
        title={`Deal Execution — ${dealTarget?.order?.customerId?.shopName || ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          const matchedInvoice = (salesQuery.data || []).find(
            (inv) => String(inv.orderId?._id || inv.orderId) === String(dealTarget.order._id)
          );
          dealMutation.mutate({
            saleInvoiceId: matchedInvoice?._id || dealTarget.order.saleInvoiceId || dealTarget.order._id,
            dispatchSheetId: dealTarget.sheetId,
            extraGrandDiscountPkr: extraDisc,
            payment: { paymentMode: 'CASH', cashAmountPkr: cashAmount },
            tripExpenses: fuelExpense > 0 ? [{ category: 'GAS_PETROL', amountPkr: fuelExpense, remark: 'Route Fuel' }] : [],
          });
        }}
        isSubmitting={dealMutation.isPending}
        submitLabel="Close Deal"
      >
        <div className="space-y-3">
          <div className="rounded-lg border p-3 bg-[var(--bg-canvas)] text-xs">
            <p className="font-semibold">Order: {dealTarget?.order?.orderCode}</p>
            <p className="font-mono tabular-nums">Original Total: {formatCurrency(dealTarget?.order?.grandSummary?.netPayableAmount)}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">On-Spot Extra Discount (PKR)</label>
            <input type="number" min="0" value={extraDisc} onChange={(e) => setExtraDisc(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Cash Payment Collected (PKR)</label>
            <input type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Trip Expense — Gas / Petrol (PKR)</label>
            <input type="number" min="0" value={fuelExpense} onChange={(e) => setFuelExpense(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
