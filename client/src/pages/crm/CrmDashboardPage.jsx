import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, MapPin, ShieldAlert, Users } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import MiniBarChart from '../../components/shared/MiniBarChart';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatNumber } from '../../utils/formatters';

export default function CrmDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const distributorId = user?.distributorId || 'default';

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard', distributorId],
    queryFn: async () => {
      const [custRes, terRes, beatRes] = await Promise.all([
        apiClient.get('/crm/customers', { params: { limit: 5 } }),
        apiClient.get('/crm/territories', { params: { limit: 100 } }),
        apiClient.get('/crm/beats', { params: { limit: 100 } }),
      ]);
      const customersPayload = extractListPayload(custRes);
      const territoriesPayload = extractListPayload(terRes);
      const beatsPayload = extractListPayload(beatRes);
      return {
        customers: customersPayload.data,
        totalCustomers: customersPayload.pagination.totalRecords,
        territories: territoriesPayload.data,
        totalTerritories: territoriesPayload.pagination.totalRecords,
        beats: beatsPayload.data,
        totalBeats: beatsPayload.pagination.totalRecords,
      };
    },
  });

  const customers = data?.customers || [];
  const territories = data?.territories || [];

  const columns = [
    { key: 'customerCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.customerCode}</span> },
    { key: 'shopName', header: 'Shop Name', mobilePrimary: true, accessor: 'shopName' },
    { key: 'customerType', header: 'Type', accessor: 'customerType' },
    { key: 'area', header: 'Area / Route', accessor: (r) => r.locationHierarchy?.areaName || r.locationHierarchy?.city || '—' },
    { key: 'outstanding', header: 'Outstanding', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.financialTerms?.outstandingBalancePkr || 0) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const customerTypeBars = [
    { label: 'Wholesalers', value: customers.filter((c) => c.customerType === 'WHOLESALER').length, tone: 'primary' },
    { label: 'Retailers', value: customers.filter((c) => c.customerType === 'RETAILER').length, tone: 'cyan' },
    { label: 'Sub-Distributors', value: customers.filter((c) => c.customerType === 'SUB_DISTRIBUTOR').length, tone: 'success' },
  ].filter((x) => x.value > 0);

  const territoryBars = territories.slice(0, 5).map((t) => ({
    label: t.territoryName,
    value: t.areas?.length || 0,
    tone: 'primary',
  }));

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="CRM & Beat Coverage Dashboard"
        subtitle="Wholesalers, retailers, credit exposure, territories, and weekly beat coverage"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/crm/beats')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Beat Plans</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/customers')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer Master</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Customers" value={formatNumber(data?.totalCustomers || 0)} icon={Users} status="primary" loading={isLoading} />
        <MetricCard title="Active Territories" value={formatNumber(data?.totalTerritories || 0)} icon={Compass} status="info" loading={isLoading} />
        <MetricCard title="Active Beats" value={formatNumber(data?.totalBeats || 0)} status="success" loading={isLoading} />
        <MetricCard
          title="Blocked Accounts"
          value={formatNumber(customers.filter((c) => c.status === 'BLOCKED').length)}
          icon={ShieldAlert}
          status="warning"
          loading={isLoading}
        />
      </div>

      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MiniBarChart
          title="Customers by Channel"
          subtitle="Wholesalers vs Retailers"
          items={customerTypeBars}
          emptyLabel="Add customers in Customer Master to view channel distribution."
        />
        <MiniBarChart
          title="Areas per Territory"
          subtitle="Configured geographical coverage"
          items={territoryBars}
          emptyLabel="Add territories and areas to track market coverage."
        />
      </div>

      <SmartDataTable
        columns={columns}
        data={customers}
        loading={isLoading}
        emptyTitle="No customers registered yet"
        emptyDescription="Add shops with 7-level location and Pehchan landmarks to start booking orders."
        emptyActionLabel="Open Customer Master"
        onEmptyAction={() => navigate('/crm/customers')}
      />
    </div>
  );
}
