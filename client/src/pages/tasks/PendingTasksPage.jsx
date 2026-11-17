import { useNavigate } from 'react-router-dom';
import { ClipboardList, Play } from 'lucide-react';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export default function PendingTasksPage() {
  const navigate = useNavigate();

  const table = useServerTable({
    queryKey: 'pending-tasks',
    endpoint: '/tasks/my-tasks',
    initialFilters: { taskType: '', status: '', priority: '' },
    initialSortBy: 'dueAt',
    initialSortOrder: 'asc',
  });

  const columns = [
    { key: 'taskCode', header: 'Task ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.taskCode}</span> },
    { key: 'title', header: 'Task Title', mobilePrimary: true, accessor: 'title' },
    { key: 'taskType', header: 'Workflow Type', render: (r) => <StatusBadge status={r.taskType} tone="info" /> },
    { key: 'priority', header: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
    { key: 'assignedTo', header: 'Assigned To', accessor: (r) => r.assignedToId?.fullName || '—' },
    { key: 'dueAt', header: 'Due / Created', accessor: (r) => formatDateTime(r.dueAt || r.createdAt) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Pending Tasks & Execution Queue"
        subtitle="Mandatory task-wise closing across Dispatch, Recovery, Put-Away, Transfers, and Physical Count"
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Tasks" value={table.pagination.totalRecords} icon={ClipboardList} status="primary" />
        <MetricCard title="Fresh / Pending" value={table.rows.filter((t) => ['FRESH', 'PENDING'].includes(t.status)).length} status="warning" />
        <MetricCard title="Urgent Tasks" value={table.rows.filter((t) => t.priority === 'URGENT').length} status="danger" />
        <MetricCard title="Completed" value={table.rows.filter((t) => t.status === 'COMPLETE').length} status="success" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search task ID or title..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'taskType',
            label: 'Task Type',
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
            options: ['FRESH', 'DRAFT', 'PENDING', 'COMPLETE'],
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
        emptyTitle="Your task queue is clear"
        emptyDescription="Assigned delivery dispatches, payment recoveries, put-aways, and stock counts appear here."
        renderActions={(row) => (
          <button
            type="button"
            onClick={() => navigate(`/tasks/execute/${row._id}`)}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{row.status === 'COMPLETE' ? 'View' : 'Start Task'}</span>
          </button>
        )}
      />
    </div>
  );
}
