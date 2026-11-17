import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Building2,
  ClipboardList,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import MiniBarChart from '../../components/shared/MiniBarChart';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';

const DASHBOARD_MODULES = [
  { id: 'main', label: 'Main Business', ctaTo: '/orders/create-normal', ctaLabel: 'New Order' },
  { id: 'inventory', label: 'Inventory', ctaTo: '/inventory/products', ctaLabel: 'Product Master' },
  { id: 'stock', label: 'Stock & Warehouse', ctaTo: '/stock/list', ctaLabel: 'Stock Batches' },
  { id: 'purchase', label: 'Purchase', ctaTo: '/stock/movements/create', ctaLabel: 'Purchase Intake' },
  { id: 'sales', label: 'Sales & Orders', ctaTo: '/sales/master', ctaLabel: 'Sales Master' },
  { id: 'accounts', label: 'Accounts & Recovery', ctaTo: '/accounts/movements', ctaLabel: 'Account Queue' },
  { id: 'crm', label: 'CRM & Beats', ctaTo: '/crm/customers', ctaLabel: 'Customer Master' },
  { id: 'supplier', label: 'Supplier', ctaTo: '/inventory/companies', ctaLabel: 'Companies Master' },
  { id: 'employee', label: 'Employee & Tasks', ctaTo: '/tasks/pending', ctaLabel: 'Pending Tasks' },
  { id: 'pos', label: 'POS Counter', ctaTo: '/portal/pos', ctaLabel: 'Open POS' },
];

const DASH_LIMIT = Number(import.meta.env.VITE_DASHBOARD_PAGE_SIZE) || 5;

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useShell();
  const [activeModule, setActiveModule] = useState('main');
  const distributorId = user?.distributorId || 'default';

  const currentMeta = DASHBOARD_MODULES.find((m) => m.id === activeModule) || DASHBOARD_MODULES[0];

  const { data: dashData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['dashboard', distributorId, activeModule, DASH_LIMIT],
    queryFn: async () => {
      const response = await apiClient.get(`/dashboards-reports/dashboards/${activeModule}`, {
        params: { limit: DASH_LIMIT },
      });
      return response.data?.data || response.data || {};
    },
  });

  const kpis = dashData?.kpis || {};

  const metricCards = useMemo(() => {
    if (activeModule === 'inventory') {
      return [
        { title: 'Total SKUs', value: formatNumber(kpis.productsTotal || 0), subtitle: 'Catalog items', icon: Package, status: 'primary' },
        { title: 'Active Products', value: formatNumber(kpis.productsActive || 0), subtitle: 'Ready for order', icon: Package, status: 'success' },
        { title: 'Inactive Products', value: formatNumber(kpis.productsInactive || 0), subtitle: 'Paused SKUs', icon: Package, status: 'default' },
        { title: 'Low Stock Alerts', value: formatNumber(kpis.lowStockCount || 0), subtitle: 'Below threshold', icon: AlertTriangle, status: kpis.lowStockCount > 0 ? 'warning' : 'default' },
      ];
    }
    if (activeModule === 'stock' || activeModule === 'purchase') {
      return [
        { title: 'Stock Valuation', value: formatCurrency(kpis.stockValuePkr || 0), subtitle: `${Number(kpis.stockWeightKg || 0).toFixed(1)} Kg total`, icon: Boxes, status: 'primary' },
        { title: 'Low Warnings', value: formatNumber(kpis.lowStockCount || 0), subtitle: 'Requires purchase', icon: AlertTriangle, status: 'warning' },
        { title: 'Out of Stock', value: formatNumber(kpis.outOfStockCount || 0), subtitle: 'Zero available qty', icon: AlertTriangle, status: 'danger' },
        { title: 'Pending Tasks', value: formatNumber(kpis.tasksPending || 0), subtitle: 'Warehouse queue', icon: ClipboardList, status: 'info' },
      ];
    }
    if (activeModule === 'accounts') {
      return [
        { title: 'Total Sales Billed', value: formatCurrency(kpis.totalSalesPkr || 0), subtitle: `${kpis.totalInvoices || 0} invoices`, icon: DollarSign, status: 'primary' },
        { title: 'Collected Amount', value: formatCurrency(kpis.totalCollectedPkr || 0), subtitle: 'Approved receipts', icon: TrendingUp, status: 'success' },
        { title: 'Receivable Balance', value: formatCurrency(kpis.totalReceivablePkr || 0), subtitle: 'Open credit', icon: AlertTriangle, status: 'warning' },
        { title: 'Pending Recoveries', value: formatNumber(kpis.recoveriesPending || 0), subtitle: 'Awaiting approval', icon: ClipboardList, status: 'info' },
      ];
    }
    return [
      { title: 'Total Sales Value', value: formatCurrency(kpis.totalSalesPkr || 0), subtitle: `${kpis.totalInvoices || 0} invoices`, icon: DollarSign, status: 'primary' },
      { title: 'Stock Valuation', value: formatCurrency(kpis.stockValuePkr || 0), subtitle: `${kpis.productsActive || 0} active SKUs`, icon: Boxes, status: 'info' },
      { title: 'Active Customers', value: formatNumber(kpis.customersTotal || 0), subtitle: `${kpis.ordersApproved || 0} approved orders`, icon: Users, status: 'success' },
      { title: 'Pending Queue & Alerts', value: formatNumber((kpis.ordersPending || 0) + (kpis.tasksPending || 0)), subtitle: `${kpis.unreadAlerts || 0} unread alerts`, icon: AlertTriangle, status: kpis.unreadAlerts > 0 ? 'warning' : 'default' },
    ];
  }, [activeModule, kpis]);

  const recentRows = useMemo(() => {
    if (activeModule === 'employee') return (dashData?.recentTasks || []).slice(0, DASH_LIMIT);
    if (activeModule === 'stock' || activeModule === 'purchase') return (dashData?.recentMovements || []).slice(0, DASH_LIMIT);
    return (dashData?.recentOrders || []).slice(0, DASH_LIMIT);
  }, [activeModule, dashData]);

  const recentColumns = [
    {
      key: 'code',
      header: 'Reference',
      mobilePrimary: true,
      numeric: true,
      accessor: (r) => r.orderCode || r.taskCode || r.movementCode || r._id?.slice(-6) || '—',
    },
    {
      key: 'party',
      header: 'Customer / Assignee / Type',
      accessor: (r) => r.customerId?.shopName || r.assignedToId?.fullName || r.movementType || r.title || '—',
    },
    {
      key: 'amount',
      header: 'Net / Lines',
      numeric: true,
      align: 'right',
      accessor: (r) =>
        r.grandSummary?.netPayableAmount !== undefined
          ? formatCurrency(r.grandSummary.netPayableAmount)
          : r.items
            ? `${r.items.length} lines`
            : r.taskType || '—',
    },
    {
      key: 'status',
      header: 'Status',
      mobileBadge: true,
      render: (r) => <StatusBadge status={r.approvalInfo?.status || r.status || 'ACTIVE'} />,
    },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDate(r.createdAt) },
  ];

  const chartSeriesA = [
    { label: 'Total Sales', value: kpis.totalSalesPkr || 0, tone: 'primary' },
    { label: 'Collected', value: kpis.totalCollectedPkr || 0, tone: 'success' },
    { label: 'Receivables', value: kpis.totalReceivablePkr || 0, tone: 'warning' },
    { label: 'Stock Value', value: kpis.stockValuePkr || 0, tone: 'cyan' },
  ].filter((x) => x.value > 0);

  const chartSeriesB = [
    { label: 'Active SKUs', value: kpis.productsActive || 0, tone: 'primary' },
    { label: 'Active Customers', value: kpis.customersTotal || 0, tone: 'success' },
    { label: 'Pending Orders', value: kpis.ordersPending || 0, tone: 'warning' },
    { label: 'Pending Tasks', value: kpis.tasksPending || 0, tone: 'cyan' },
  ].filter((x) => x.value > 0);

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title={`${currentMeta.label} Dashboard`}
        subtitle="Real-time distribution KPIs, operational counts, and active queues"
        badge={user?.distributorId || 'ELITE DIST'}
        actions={
          <>
            <button
              type="button"
              onClick={async () => {
                await refetch();
                addToast({ type: 'info', message: `${currentMeta.label} dashboard refreshed.` });
              }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium theme-transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(currentMeta.ctaTo)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold theme-transition"
            >
              <span>{currentMeta.ctaLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </>
        }
        tabs={DASHBOARD_MODULES.map((m) => ({
          id: m.id,
          label: m.label,
          active: activeModule === m.id,
          onClick: () => setActiveModule(m.id),
        }))}
      />

      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {metricCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            status={card.status}
            loading={isLoading}
          />
        ))}
      </div>

      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MiniBarChart
          title="Financial & Valuation Overview"
          subtitle="Live PKR totals across sales, receipts, and stock"
          items={chartSeriesA}
          valueFormatter={(v) => formatCurrency(v)}
          emptyLabel="Record stock purchases, sales, or recoveries to view live financial charts."
        />
        <MiniBarChart
          title="Operations & Coverage Volume"
          subtitle="SKUs, customers, pending orders, and tasks"
          items={chartSeriesB}
          emptyLabel="Operational counts appear here as catalog and CRM records are added."
        />
      </div>

      <div className="lg:flex-1 lg:min-h-0 flex flex-col">
        <SmartDataTable
          columns={recentColumns}
          data={recentRows}
          loading={isLoading}
          emptyTitle={`No ${currentMeta.label.toLowerCase()} activity yet`}
          emptyDescription="Latest 5 database records appear here automatically once created."
          emptyActionLabel={currentMeta.ctaLabel}
          onEmptyAction={() => navigate(currentMeta.ctaTo)}
          emptyIcon={
            activeModule === 'inventory'
              ? Package
              : activeModule === 'crm'
                ? Users
                : activeModule === 'pos'
                  ? Store
                  : activeModule === 'employee'
                    ? ClipboardList
                    : activeModule === 'supplier'
                      ? Building2
                      : activeModule === 'main'
                        ? Activity
                        : ShoppingCart
          }
        />
      </div>
    </div>
  );
}
