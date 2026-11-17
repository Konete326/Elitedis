import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, Boxes, Layers, Warehouse } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import MiniBarChart from '../../components/shared/MiniBarChart';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate, formatNumber, formatWeight } from '../../utils/formatters';

export default function StockOverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useShell();
  const distributorId = user?.distributorId || 'default';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['stock-overview', distributorId],
    queryFn: async () => {
      const [valRes, dashRes] = await Promise.allSettled([
        apiClient.get('/stocks/valuation'),
        apiClient.get('/dashboards-reports/dashboards/stock', { params: { limit: 5 } }),
      ]);
      const val = valRes.status === 'fulfilled' ? valRes.value.data?.data || {} : {};
      const dash = dashRes.status === 'fulfilled' ? dashRes.value.data?.data || {} : {};
      return { val, dash };
    },
  });

  const val = data?.val || {};
  const valSummary = val.summary || val;
  const dash = data?.dash || {};
  const kpis = dash.kpis || {};
  const recentBatches = dash.recentRecords || val.lowOrExpiringBatches || [];
  const warehouseBars = (val.byWarehouse || dash.primaryBreakdown || []).map((w) => ({
    label: w.warehouseName || w.label || 'Warehouse',
    value: w.valuePkr ?? w.totalValuePkr ?? w.value ?? 0,
  }));

  const columns = [
    { key: 'batchNo', header: 'Batch', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.batchNo}</span> },
    { key: 'product', header: 'Product', mobilePrimary: true, accessor: (r) => r.productId?.productName || '—' },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseId?.warehouseName || '—' },
    { key: 'qty', header: 'Available Qty', numeric: true, align: 'right', accessor: (r) => formatNumber(r.availableBaseQty) },
    { key: 'expDate', header: 'Expiry', accessor: (r) => formatDate(r.expDate) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Stock & Warehouse Overview"
        subtitle="Batch valuation, warehouse capacity, low-stock warnings, and near-expiry batches"
        onRefresh={async () => {
          await refetch();
          addToast({ type: 'info', message: 'Stock overview refreshed.' });
        }}
        isRefreshing={isFetching}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/stock/list')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Stock Batches</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/stock/movements/create')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Create Movement</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Stock Valuation"
          value={formatCurrency(valSummary.totalStockValuePkr ?? kpis.stockValuationPkr ?? 0)}
          icon={Boxes}
          status="primary"
          loading={isLoading}
        />
        <MetricCard
          title="Total Weight"
          value={formatWeight(valSummary.totalWeightKg ?? 0)}
          icon={Warehouse}
          status="info"
          loading={isLoading}
        />
        <MetricCard
          title="Active Batches"
          value={formatNumber((val.byWarehouse || []).reduce((s, w) => s + (w.batchesCount || 0), 0) || kpis.totalBatches || 0)}
          status="success"
          loading={isLoading}
        />
        <MetricCard
          title="Low / Out Alerts"
          value={formatNumber((valSummary.lowWarningCount || 0) + (valSummary.outOfStockCount || 0) || kpis.lowStockAlerts || 0)}
          icon={AlertTriangle}
          status="warning"
          loading={isLoading}
        />
      </div>

      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MiniBarChart
          title="Valuation by Warehouse"
          subtitle="Current stock value (PKR)"
          items={warehouseBars}
          valueFormatter={(v) => formatCurrency(v)}
          emptyLabel="Record a Purchase movement to populate warehouse stock valuation."
        />
        <MiniBarChart
          title="Stock Health Breakdown"
          subtitle="Available vs reserved vs quarantine"
          items={dash.secondaryBreakdown || []}
          emptyLabel="Batch statuses appear here once inventory batches are active."
        />
      </div>

      <SmartDataTable
        columns={columns}
        data={recentBatches.slice(0, 5)}
        loading={isLoading}
        emptyTitle="No active stock batches"
        emptyDescription="Record a Purchase Intake movement to receive goods and create trackable stock batches."
        emptyActionLabel="Create Purchase Intake"
        onEmptyAction={() => navigate('/stock/movements/create')}
      />
    </div>
  );
}
