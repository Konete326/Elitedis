import { useQuery } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export default function HrmReportsPage() {
  const { user } = useAuth();
  const { addToast } = useShell();
  const isSuperAdmin = user?.primaryRole === 'SUPER_ADMIN';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['hrm-reports', user?.distributorId],
    queryFn: async () => (await apiClient.get('/hrm/reports')).data?.data || [],
  });

  const rows = isSuperAdmin
    ? data || []
    : (data || []).filter((emp) => emp.primaryRole !== 'SUPER_ADMIN');

  const handleRefresh = async () => {
    await refetch();
    addToast({ type: 'success', message: 'Staff performance report refreshed.' });
  };

  const columns = [
    { key: 'profileId', header: 'ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.profileId}</span> },
    { key: 'fullName', header: 'Employee', mobilePrimary: true, accessor: 'fullName' },
    { key: 'primaryRole', header: 'Role', accessor: 'primaryRole' },
    { key: 'tasks', header: 'Tasks (Done / Total)', numeric: true, accessor: (r) => `${r.tasks?.completedTasks || 0} / ${r.tasks?.totalTasks || 0}` },
    { key: 'orders', header: 'Orders Booked', numeric: true, accessor: (r) => formatNumber(r.orders?.bookedOrders || 0) },
    { key: 'bookedVal', header: 'Booked Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.orders?.bookedValuePkr || 0) },
    { key: 'recovered', header: 'Collected Cash', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.recoveries?.recoveredPkr || 0) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Staff Task &amp; Sales Performance"
        subtitle="Track completed tasks, orders booked, and verified payment collections per staff member"
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />
      <SmartDataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        emptyIcon={BarChart3}
        emptyTitle="No staff performance data yet"
        emptyDescription="Add employees and assign tasks or orders to track real-time performance."
      />
    </div>
  );
}
