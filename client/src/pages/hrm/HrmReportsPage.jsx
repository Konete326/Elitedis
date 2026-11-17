import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export default function HrmReportsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['hrm-reports', user?.distributorId],
    queryFn: async () => (await apiClient.get('/hrm/reports')).data?.data || [],
  });

  const columns = [
    { key: 'profileId', header: 'ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.profileId}</span> },
    { key: 'fullName', header: 'Employee', mobilePrimary: true, accessor: 'fullName' },
    { key: 'primaryRole', header: 'Role', accessor: 'primaryRole' },
    { key: 'tasks', header: 'Tasks (Done / Total)', numeric: true, accessor: (r) => `${r.tasks?.completedTasks || 0} / ${r.tasks?.totalTasks || 0}` },
    { key: 'orders', header: 'Booked Orders', numeric: true, accessor: (r) => formatNumber(r.orders?.bookedOrders || 0) },
    { key: 'bookedVal', header: 'Booked Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.orders?.bookedValuePkr || 0) },
    { key: 'recovered', header: 'Recovered Cash', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.recoveries?.recoveredPkr || 0) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Employee Task & Sales Performance"
        subtitle="Completed vs pending tasks, order booking volume, and verified recovery collections"
      />
      <SmartDataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        emptyIcon={BarChart3}
        emptyTitle="No staff performance data yet"
        emptyDescription="Add employees and assign tasks or orders to track real-time performance."
      />
    </div>
  );
}
