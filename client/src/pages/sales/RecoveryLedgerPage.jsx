import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatDateTime } from '../../utils/formatters';

export default function RecoveryLedgerPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'recoveries',
    endpoint: '/sales-recovery/recoveries',
    initialFilters: { paymentMode: '', status: '' },
  });

  const customersQuery = useQuery({
    queryKey: ['customers-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    paymentMode: 'CASH',
    cashAmountPkr: 0,
    onlineProvider: 'JAZZCASH',
    onlineTxId: '',
    onlineAmountPkr: 0,
    chequeNo: '',
    bankName: '',
    chequeAmountPkr: 0,
    autoApprove: true,
  });

  const collectMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/sales-recovery/recovery-collect', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recoveries'] });
      addToast({ type: 'success', message: 'Recovery recorded cleanly.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to record recovery.' });
    },
  });

  const columns = [
    { key: 'recoveryCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.recoveryCode}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || '—' },
    { key: 'paymentMode', header: 'Mode', accessor: 'paymentMode' },
    { key: 'amountPkr', header: 'Amount', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.amountPkr) },
    { key: 'collectedBy', header: 'Collected By', accessor: (r) => r.collectedById?.fullName || '—' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    collectMutation.mutate({
      customerId: form.customerId,
      paymentMode: form.paymentMode,
      cashAmountPkr: form.paymentMode === 'CASH' || form.paymentMode === 'MIXED' ? form.cashAmountPkr : 0,
      onlineDetails:
        form.paymentMode === 'ONLINE' || form.paymentMode === 'MIXED'
          ? { provider: form.onlineProvider, transactionId: form.onlineTxId, amountPkr: form.onlineAmountPkr }
          : {},
      chequeDetails:
        form.paymentMode === 'CHEQUE' || form.paymentMode === 'MIXED'
          ? { chequeNo: form.chequeNo, bankName: form.bankName, amountPkr: form.chequeAmountPkr }
          : {},
      autoApprove: form.autoApprove,
    });
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Customer Payment Collections"
        subtitle="Track cash, JazzCash / EasyPaisa online transfers, cheques, and shop payments"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Receipts" value={table.pagination.totalRecords} icon={Receipt} status="primary" />
        <MetricCard
          title="Page Total Collected"
          value={formatCurrency(table.rows.reduce((s, r) => s + (r.amountPkr || 0), 0))}
          status="success"
        />
        <MetricCard title="Waiting Approval" value={table.rows.filter((r) => r.status === 'PENDING_VERIFICATION').length} status="warning" />
        <MetricCard title="Cheque Receipts" value={table.rows.filter((r) => r.paymentMode === 'CHEQUE').length} status="info" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by receipt code..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'paymentMode',
            label: 'Payment Mode',
            value: table.filters.paymentMode,
            onChange: (val) => table.setFilter('paymentMode', val),
            options: ['CASH', 'ONLINE', 'CHEQUE', 'MIXED'],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'BOUNCED'],
          },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyTitle="No payment collections yet"
        emptyDescription="Record Cash, Online, or Cheque payments received from customers here."
        emptyActionLabel="Record Payment"
        onEmptyAction={() => setModalOpen(true)}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Customer Payment Recovery"
        onSubmit={handleSubmit}
        isSubmitting={collectMutation.isPending}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Customer</label>
            <select
              required
              value={form.customerId}
              onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="">Select customer...</option>
              {(customersQuery.data || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.shopName} (Bal: {formatCurrency(c.financialTerms?.outstandingBalancePkr || 0)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Payment Mode</label>
            <select
              value={form.paymentMode}
              onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online (JazzCash / EasyPaisa / Bank)</option>
              <option value="CHEQUE">Cheque</option>
              <option value="MIXED">Mixed Split</option>
            </select>
          </div>
          {(form.paymentMode === 'CASH' || form.paymentMode === 'MIXED') && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Cash Amount (PKR)</label>
              <input
                type="number"
                min="0"
                value={form.cashAmountPkr}
                onChange={(e) => setForm((p) => ({ ...p, cashAmountPkr: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
              />
            </div>
          )}
          {(form.paymentMode === 'ONLINE' || form.paymentMode === 'MIXED') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={form.onlineProvider}
                onChange={(e) => setForm((p) => ({ ...p, onlineProvider: e.target.value }))}
                className="h-9 px-2 rounded-lg border bg-[var(--bg-elevated)] text-xs"
              >
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">EasyPaisa</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
              <input
                placeholder="Transaction ID"
                value={form.onlineTxId}
                onChange={(e) => setForm((p) => ({ ...p, onlineTxId: e.target.value }))}
                className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono"
              />
              <input
                type="number"
                placeholder="Online PKR"
                value={form.onlineAmountPkr}
                onChange={(e) => setForm((p) => ({ ...p, onlineAmountPkr: Number(e.target.value) }))}
                className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
          )}
          {(form.paymentMode === 'CHEQUE' || form.paymentMode === 'MIXED') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                placeholder="Cheque No"
                value={form.chequeNo}
                onChange={(e) => setForm((p) => ({ ...p, chequeNo: e.target.value }))}
                className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono"
              />
              <input
                placeholder="Bank Name"
                value={form.bankName}
                onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
              />
              <input
                type="number"
                placeholder="Cheque PKR"
                value={form.chequeAmountPkr}
                onChange={(e) => setForm((p) => ({ ...p, chequeAmountPkr: Number(e.target.value) }))}
                className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
          )}
        </div>
      </FormModal>
    </div>
  );
}
