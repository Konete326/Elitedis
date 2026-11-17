import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Play, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export default function PendingTasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const table = useServerTable({
    queryKey: 'pending-tasks',
    endpoint: '/tasks/my-tasks',
    initialFilters: { taskType: '', status: '', priority: '' },
    initialSortBy: 'dueAt',
    initialSortOrder: 'asc',
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => apiClient.patch(`/tasks/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      addToast({ type: 'info', message: 'Task cancelled.' });
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not cancel this task.' });
      setCancelTarget(null);
    },
  });

  const columns = [
    { key: 'taskCode', header: 'Task ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.taskCode}</span> },
    { key: 'title', header: 'Task Name', mobilePrimary: true, accessor: 'title' },
    { key: 'taskType', header: 'Job Type', render: (r) => <StatusBadge status={r.taskType} tone="info" /> },
    { key: 'priority', header: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
    { key: 'assignedTo', header: 'Assigned To', accessor: (r) => r.assignedToId?.fullName || '—' },
    { key: 'dueAt', header: 'Due / Created', accessor: (r) => formatDateTime(r.dueAt || r.createdAt) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Pending Tasks &amp; Work Queue"
        subtitle="Assigned packing, delivery, payment recovery, put-away, and stock count jobs"
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Tasks" value={table.pagination.totalRecords} icon={ClipboardList} status="primary" />
        <MetricCard title="Waiting / In Progress" value={table.rows.filter((t) => ['FRESH', 'PENDING', 'DRAFT'].includes(t.status)).length} status="warning" />
        <MetricCard title="Urgent Tasks" value={table.rows.filter((t) => t.priority === 'URGENT').length} status="danger" />
        <MetricCard title="Completed" value={table.rows.filter((t) => t.status === 'COMPLETE').length} status="success" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by task ID or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'taskType',
            label: 'Job Type',
            value: table.filters.taskType,
            onChange: (val) => table.setFilter('taskType', val),
            options: [
              'DELIVERY_DISPATCH',
              'PAYMENT_RECOVERY',
              'RETURN_PUT_AWAY',
              'WAREHOUSE_TRANSFER',
              'EXPIRY_QUARANTINE',
              'PURCHASE_PUT_AWAY',
              'PHYSICAL_STOCK_COUNT',
            ],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['FRESH', 'DRAFT', 'PENDING', 'COMPLETE', 'CANCELLED'],
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
        emptyTitle="Your task list is empty"
        emptyDescription="Assigned delivery packing, payment recovery, put-away, and stock count jobs appear here."
        renderActions={(row) => (
          <>
            {row.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={() => navigate(`/tasks/execute/${row._id}`)}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{row.status === 'COMPLETE' ? 'View' : 'Start Task'}</span>
              </button>
            )}
            {['FRESH', 'DRAFT', 'PENDING'].includes(row.status) && (
              <button
                type="button"
                onClick={() => {
                  setCancelReason('');
                  setCancelTarget(row);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs inline-flex items-center gap-1"
                title="Cancel Task"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </>
        )}
      />

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate({ id: cancelTarget._id, reason: cancelReason.trim() || undefined })}
        isLoading={cancelMutation.isPending}
        variant="danger"
        title="Cancel this task?"
        message={`Cancel task ${cancelTarget?.taskCode || ''} (${cancelTarget?.title || ''})? This cannot be undone.`}
        confirmLabel="Cancel Task"
      >
        <input
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason for cancelling (Optional)"
          className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-xs"
        />
      </ConfirmModal>
    </div>
  );
}
