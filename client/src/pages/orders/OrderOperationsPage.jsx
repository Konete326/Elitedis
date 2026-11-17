import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Printer, Truck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatWeight } from '../../utils/formatters';

export default function OrderOperationsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();
  const [tab, setTab] = useState('approve');
  const [salesmanId, setSalesmanId] = useState('');
  const [storekeeperId, setStorekeeperId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [selectedRecoveryIds, setSelectedRecoveryIds] = useState([]);
  const [lastDispatchResult, setLastDispatchResult] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const pendingTable = useServerTable({
    queryKey: 'orders-pending',
    endpoint: '/orders',
    initialFilters: { status: 'PENDING' },
  });

  const approvedTable = useServerTable({
    queryKey: 'orders-approved',
    endpoint: '/orders',
    initialFilters: { status: 'APPROVED' },
  });

  const creditSalesQuery = useQuery({
    queryKey: ['credit-sales-for-plan'],
    queryFn: async () =>
      extractListPayload(await apiClient.get('/sales-recovery/sales', { params: { paymentStatus: 'CREDIT', limit: 50 } })).data,
  });

  const staffQuery = useQuery({
    queryKey: ['staff-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });

  const approveMutation = useMutation({
    mutationFn: (orderIds) => apiClient.patch('/orders/approve-batch', { orderIds }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      queryClient.invalidateQueries({ queryKey: ['orders-approved'] });
      addToast({ type: 'success', message: `Approved ${res.data?.data?.approvedCount || 0} orders & reserved stock.` });
      pendingTable.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Approval failed.' });
    },
  });

  const planMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/orders/delivery-plan', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders-approved'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setLastDispatchResult(res.data?.data || null);
      setPrintOpen(true);
      approvedTable.setSelectedKeys([]);
      setSelectedRecoveryIds([]);
      addToast({ type: 'success', message: 'Delivery Plan & 4 operational sheets generated.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delivery planning failed.' });
    },
  });

  const loadMetrics = useMemo(() => {
    const selected = approvedTable.rows.filter((o) => approvedTable.selectedKeys.includes(o._id));
    return {
      count: selected.length,
      value: selected.reduce((s, o) => s + (o.grandSummary?.netPayableAmount || 0), 0),
      weight: selected.reduce((s, o) => s + (o.grandSummary?.totalWeightKg || 0), 0),
      volume: selected.reduce((s, o) => s + (o.grandSummary?.totalVolumeCubic || 0), 0),
    };
  }, [approvedTable.rows, approvedTable.selectedKeys]);

  const columns = [
    { key: 'orderCode', header: 'Order ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.orderCode}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || '—' },
    { key: 'weight', header: 'Weight', numeric: true, accessor: (r) => formatWeight(r.grandSummary?.totalWeightKg) },
    { key: 'volume', header: 'Volume', numeric: true, accessor: (r) => `${Number(r.grandSummary?.totalVolumeCubic || 0).toFixed(2)} F` },
    { key: 'net', header: 'Order Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.grandSummary?.netPayableAmount) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.approvalInfo?.status} /> },
  ];

  const currentTable = tab === 'approve' ? pendingTable : approvedTable;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Order Operations — Approval & Delivery Planning"
        subtitle="Reserve stock on approval, calculate vehicle load, and generate 4 synchronized sheets"
        tabs={[
          { id: 'approve', label: 'Pending To Approved', count: pendingTable.pagination.totalRecords, active: tab === 'approve', onClick: () => setTab('approve') },
          { id: 'dispatch', label: 'Delivery Planning & Sheets', count: approvedTable.pagination.totalRecords, active: tab === 'dispatch', onClick: () => setTab('dispatch') },
        ]}
      />

      {tab === 'dispatch' && (
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Selected Orders" value={loadMetrics.count} icon={Truck} status="primary" />
          <MetricCard title="Total Load Value" value={formatCurrency(loadMetrics.value)} status="success" />
          <MetricCard title="Total Weight" value={formatWeight(loadMetrics.weight)} status="info" />
          <MetricCard title="Total Volume" value={`${loadMetrics.volume.toFixed(2)} Cu.Ft`} status="warning" />
        </div>
      )}

      {tab === 'dispatch' && (
        <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Assign Salesman</label>
            <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
              <option value="">Select salesman...</option>
              {(staffQuery.data || []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName} ({u.primaryRole})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Assign Storekeeper</label>
            <select value={storekeeperId} onChange={(e) => setStorekeeperId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
              <option value="">Optional...</option>
              {(staffQuery.data || []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName} ({u.primaryRole})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Vehicle No / Route</label>
            <input
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
              placeholder="KHI-4520"
              className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono"
            />
          </div>
          <button
            type="button"
            disabled={!salesmanId || approvedTable.selectedKeys.length === 0 || planMutation.isPending}
            onClick={() =>
              planMutation.mutate({
                orderIds: approvedTable.selectedKeys,
                recoveryInvoiceIds: selectedRecoveryIds,
                salesmanId,
                storekeeperId: storekeeperId || null,
                vehicleInfo: { vehicleNo },
              })
            }
            className="h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Generate 4 Sheets &amp; Plan</span>
          </button>
        </div>
      )}

      {tab === 'approve' && (
        <div className="shrink-0 flex items-center justify-between rounded-xl border bg-[var(--bg-surface)] px-4 py-2.5">
          <span className="text-xs text-[var(--text-secondary)]">
            Selected pending orders: <strong className="tabular-nums">{pendingTable.selectedKeys.length}</strong>
          </span>
          <button
            type="button"
            disabled={pendingTable.selectedKeys.length === 0 || approveMutation.isPending}
            onClick={() => approveMutation.mutate(pendingTable.selectedKeys)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve Selected &amp; Reserve Stock</span>
          </button>
        </div>
      )}

      <SmartDataTable
        columns={columns}
        data={currentTable.rows}
        loading={currentTable.isLoading}
        selectable
        selectedKeys={currentTable.selectedKeys}
        onSelectionChange={currentTable.setSelectedKeys}
        pagination={currentTable.pagination}
        onPageChange={currentTable.setPage}
        onPageSizeChange={currentTable.setLimit}
        emptyTitle={tab === 'approve' ? 'No pending orders' : 'No approved orders waiting for dispatch'}
        emptyDescription={
          tab === 'approve'
            ? 'All booked orders have been processed.'
            : 'Approve pending orders first so they become eligible for delivery planning.'
        }
      />

      {tab === 'dispatch' && (creditSalesQuery.data || []).length > 0 && (
        <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3 text-xs flex flex-wrap items-center gap-2">
          <span className="font-semibold">Include Credit Recovery Bills:</span>
          {(creditSalesQuery.data || []).slice(0, 6).map((inv) => {
            const active = selectedRecoveryIds.includes(inv._id);
            return (
              <button
                key={inv._id}
                type="button"
                onClick={() =>
                  setSelectedRecoveryIds((prev) =>
                    prev.includes(inv._id) ? prev.filter((x) => x !== inv._id) : [...prev, inv._id]
                  )
                }
                className={`px-2 py-1 rounded-md border font-mono ${
                  active ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
                }`}
              >
                {inv.invoiceNo} ({formatCurrency(inv.balanceDuePkr)})
              </button>
            );
          })}
        </div>
      )}

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Dispatch & Delivery Plan ${lastDispatchResult?.dispatchSheet?.dispatchCode || ''}`}
        documentType="4-Sheet Dispatch Pack"
        columns={[
          { key: 'invoiceNo', header: 'Bill / Invoice No', numeric: true },
          { key: 'paymentStatus', header: 'Terms' },
          { key: 'net', header: 'Net Payable', numeric: true, accessor: (r) => r.grandSummary?.netPayableAmount || 0 },
        ]}
        rows={lastDispatchResult?.invoices || []}
        summaryRows={[
          { label: 'Total Load Value', value: formatCurrency(lastDispatchResult?.dispatchSheet?.totalLoadValuePkr || 0) },
          { label: 'Total Weight', value: formatWeight(lastDispatchResult?.dispatchSheet?.totalWeightKg || 0) },
          { label: 'Tasks Created', value: String(lastDispatchResult?.createdTasks?.length || 0) },
        ]}
      />
    </div>
  );
}
