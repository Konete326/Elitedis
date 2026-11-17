import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Landmark, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function AccountMovementsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

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
      addToast({ type: 'success', message: `Movement ${vars.action.toLowerCase()} completed.` });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Verification action failed.' });
    },
  });

  const columns = [
    { key: 'recoveryCode', header: 'Ref ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.recoveryCode}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || '—' },
    { key: 'paymentMode', header: 'Mode', accessor: 'paymentMode' },
    { key: 'amountPkr', header: 'Amount', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.amountPkr) },
    { key: 'collectedBy', header: 'Prepared / Collected', accessor: (r) => r.collectedById?.fullName || '—' },
    { key: 'cheque', header: 'Cheque Status', accessor: (r) => (r.paymentMode === 'CHEQUE' ? r.chequeDetails?.chequeStatus || 'PENDING' : '—') },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Account Movement Verification Queue"
        subtitle="Verify pending Cash, Online, and Cheque collections before posting to General Ledger"
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Movements" value={table.pagination.totalRecords} icon={Landmark} status="primary" />
        <MetricCard title="Pending Approval" value={table.rows.filter((m) => m.status === 'PENDING_VERIFICATION').length} status="warning" />
        <MetricCard title="Approved Vouchers" value={table.rows.filter((m) => m.status === 'APPROVED').length} status="success" />
        <MetricCard title="Pending Cheques" value={table.rows.filter((m) => m.paymentMode === 'CHEQUE' && m.chequeDetails?.chequeStatus === 'PENDING').length} status="info" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search voucher ref..."
        onResetFilters={table.resetFilters}
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
            label: 'Mode',
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
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyTitle="No pending account movements"
        emptyDescription="Customer recoveries and salesman settlements appear here for accounting verification."
        renderActions={(row) => (
          <>
            {row.status === 'PENDING_VERIFICATION' && (
              <button
                type="button"
                onClick={() => actionMutation.mutate({ id: row._id, action: 'APPROVE' })}
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
                  onClick={() => actionMutation.mutate({ id: row._id, action: 'CLEAR_CHEQUE' })}
                  className="px-2 py-1.5 rounded-lg border text-xs font-medium text-[var(--status-success)]"
                >
                  Clear Cheque
                </button>
                <button
                  type="button"
                  onClick={() => actionMutation.mutate({ id: row._id, action: 'BOUNCE_CHEQUE' })}
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
    </div>
  );
}
