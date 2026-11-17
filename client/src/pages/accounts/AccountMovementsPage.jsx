import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Landmark, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const ACTION_COPY = {
  APPROVE: {
    title: 'Approve payment collection?',
    confirmLabel: 'Approve & Post',
    variant: 'primary',
    describe: (row) =>
      `Approve receipt ${row?.recoveryCode || ''} (${formatCurrency(row?.amountPkr || 0)}) from ${row?.customerId?.shopName || 'customer'} and post it to the accounting ledger?`,
  },
  CLEAR_CHEQUE: {
    title: 'Mark cheque as cleared?',
    confirmLabel: 'Clear Cheque',
    variant: 'primary',
    describe: (row) =>
      `Confirm that cheque ${row?.chequeDetails?.chequeNo || row?.recoveryCode || ''} (${formatCurrency(row?.amountPkr || 0)}) has cleared in the bank?`,
  },
  BOUNCE_CHEQUE: {
    title: 'Mark cheque as bounced?',
    confirmLabel: 'Mark Bounced',
    variant: 'danger',
    describe: (row) =>
      `Mark cheque ${row?.chequeDetails?.chequeNo || row?.recoveryCode || ''} (${formatCurrency(row?.amountPkr || 0)}) as bounced? This will restore the unpaid balance on the customer account.`,
  },
};

export default function AccountMovementsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [pendingAction, setPendingAction] = useState(null);

  const table = useServerTable({
    queryKey: 'account-movements',
    endpoint: '/accounts/movements',
    initialFilters: { status: '', paymentMode: '' },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => apiClient.patch(`/accounts/approve/${id}`, { action }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['account-movements'] });
      queryClient.invalidateQueries({ queryKey: ['account-ledgers'] });
      addToast({ type: 'success', message: `Action (${vars.action.replace('_', ' ').toLowerCase()}) completed.` });
      setPendingAction(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Verification action failed.' });
      setPendingAction(null);
    },
  });

  const columns = [
    { key: 'recoveryCode', header: 'Ref ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.recoveryCode}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || '—' },
    { key: 'paymentMode', header: 'Mode', accessor: 'paymentMode' },
    { key: 'amountPkr', header: 'Amount', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.amountPkr) },
    { key: 'collectedBy', header: 'Collected By', accessor: (r) => r.collectedById?.fullName || '—' },
    { key: 'cheque', header: 'Cheque Status', accessor: (r) => (r.paymentMode === 'CHEQUE' ? r.chequeDetails?.chequeStatus || 'PENDING' : '—') },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  const activeCopy = pendingAction ? ACTION_COPY[pendingAction.action] : null;

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Payment Approval Queue"
        subtitle="Check and approve cash, online transfers, and cheques before adding them to the ledger"
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Receipts" value={table.pagination.totalRecords} icon={Landmark} status="primary" />
        <MetricCard title="Waiting Approval" value={table.rows.filter((m) => m.status === 'PENDING_VERIFICATION').length} status="warning" />
        <MetricCard title="Approved Vouchers" value={table.rows.filter((m) => m.status === 'APPROVED').length} status="success" />
        <MetricCard title="Pending Cheques" value={table.rows.filter((m) => m.paymentMode === 'CHEQUE' && m.chequeDetails?.chequeStatus === 'PENDING').length} status="info" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by receipt reference..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'BOUNCED'],
          },
          {
            key: 'paymentMode',
            label: 'Payment Mode',
            value: table.filters.paymentMode,
            onChange: (val) => table.setFilter('paymentMode', val),
            options: ['CASH', 'ONLINE', 'CHEQUE', 'MIXED'],
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
        emptyTitle="No pending payments to verify"
        emptyDescription="Customer payment collections and salesman settlements appear here for approval."
        renderActions={(row) => (
          <>
            {row.status === 'PENDING_VERIFICATION' && (
              <button
                type="button"
                onClick={() => setPendingAction({ row, action: 'APPROVE' })}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            )}
            {row.paymentMode === 'CHEQUE' && row.chequeDetails?.chequeStatus === 'PENDING' && (
              <>
                <button
                  type="button"
                  onClick={() => setPendingAction({ row, action: 'CLEAR_CHEQUE' })}
                  className="px-2 py-1.5 rounded-lg border text-xs font-medium text-[var(--status-success)]"
                >
                  Clear Cheque
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ row, action: 'BOUNCE_CHEQUE' })}
                  className="px-2 py-1.5 rounded-lg border text-xs font-medium text-[var(--status-danger)] inline-flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Bounce</span>
                </button>
              </>
            )}
          </>
        )}
      />

      <ConfirmModal
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          actionMutation.mutate({ id: pendingAction.row._id, action: pendingAction.action })
        }
        isLoading={actionMutation.isPending}
        variant={activeCopy?.variant || 'primary'}
        title={activeCopy?.title || 'Confirm Action'}
        message={activeCopy?.describe(pendingAction?.row) || ''}
        confirmLabel={activeCopy?.confirmLabel || 'Confirm'}
      />
    </div>
  );
}
