import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, DollarSign, Printer, Receipt, RefreshCw, RotateCcw, Truck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { FilterToolbar, MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import MiniBarChart from '../../components/shared/MiniBarChart';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatDateTime, formatNumber } from '../../utils/formatters';

export default function DailySalesReportPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [salesmanId, setSalesmanId] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const staffQuery = useQuery({
    queryKey: ['dsr-staff-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });

  const dsrQuery = useQuery({
    queryKey: ['sales-dsr', user?.distributorId, date],
    queryFn: async () => {
      const response = await apiClient.get('/sales-recovery/dsr', {
        params: {
          startDate: date ? `${date}T00:00:00.000Z` : undefined,
          endDate: date ? `${date}T23:59:59.999Z` : undefined,
        },
      });
      return response.data?.data || response.data || {};
    },
  });

  const dsr = dsrQuery.data || {};
  const summary = dsr.summary || {};
  const rawInvoices = Array.isArray(dsr.recentInvoices)
    ? dsr.recentInvoices
    : Array.isArray(dsr.invoices)
      ? dsr.invoices
      : [];

  const invoices = salesmanId
    ? rawInvoices.filter(
        (inv) =>
          (inv.salesmanId?._id || inv.salesmanId) === salesmanId ||
          (inv.bookerId?._id || inv.bookerId) === salesmanId
      )
    : rawInvoices;

  const totalSalesPkr = salesmanId
    ? invoices.reduce((s, inv) => s + Number(inv.grandSummary?.netPayableAmount || 0), 0)
    : Number(summary.deliveredSalesPkr ?? 0);
  const totalCollectedPkr = salesmanId
    ? invoices.reduce((s, inv) => s + Number(inv.paidAmountPkr || 0), 0)
    : Number(summary.totalRecoveredPkr ?? 0);
  const totalCreditPkr = salesmanId
    ? invoices.reduce((s, inv) => s + Number(inv.balanceDuePkr || 0), 0)
    : Math.max(0, totalSalesPkr - totalCollectedPkr);
  const totalExpensesPkr = Number(summary.tripExpensesPkr ?? 0);

  const pipelineBars = [
    { label: 'Booked Orders', value: Number(summary.bookedOrdersCount ?? 0), tone: 'primary' },
    { label: 'Approved Orders', value: Number(summary.approvedOrdersCount ?? 0), tone: 'cyan' },
    { label: 'Dispatched Sheets', value: Number(summary.dispatchedSheetsCount ?? 0), tone: 'primary' },
    { label: 'Delivered Invoices', value: Number(summary.deliveredInvoicesCount ?? invoices.length), tone: 'success' },
  ].filter((x) => x.value > 0);

  const recoveryBars = [
    { label: 'Cash Collected', value: Number(summary.cashRecoveredPkr ?? 0), tone: 'success' },
    { label: 'Online (JazzCash/EasyPaisa)', value: Number(summary.onlineRecoveredPkr ?? 0), tone: 'primary' },
    { label: 'Cheques', value: Number(summary.chequeRecoveredPkr ?? 0), tone: 'cyan' },
    { label: 'Spot Returns', value: Number(summary.spotReturnsPkr ?? 0), tone: 'danger' },
    { label: 'Trip Expenses', value: totalExpensesPkr, tone: 'warning' },
  ].filter((x) => x.value > 0);

  const brandBars = (Array.isArray(dsr.byBrand) ? dsr.byBrand : [])
    .slice(0, 4)
    .map((b, idx) => ({
      label: b.brandName || 'Unbranded',
      value: Number(b.totalAmountPkr || 0),
      tone: idx === 0 ? 'primary' : idx === 1 ? 'cyan' : 'success',
    }))
    .filter((x) => x.value > 0);

  const columns = [
    { key: 'invoiceNo', header: 'Invoice No', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.invoiceNo || r.orderCode || '—'}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || r.walkInCustomerName || 'Walk-in' },
    { key: 'salesman', header: 'Salesman / Booker', accessor: (r) => r.salesmanId?.fullName || r.bookerId?.fullName || '—' },
    { key: 'total', header: 'Net Sale', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.grandSummary?.netPayableAmount || 0) },
    { key: 'paid', header: 'Collected', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.paidAmountPkr || 0) },
    { key: 'due', header: 'Credit Due', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.balanceDuePkr || 0) },
    { key: 'paymentStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.paymentStatus || r.status || 'ISSUED'} /> },
    { key: 'createdAt', header: 'Time', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Daily Sales Report (DSR)"
        subtitle="Automated daily summary of bookings, dispatches, delivered sales, spot returns, recoveries, and expenses"
        actions={
          <>
            <button
              type="button"
              onClick={() => dsrQuery.refetch()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dsrQuery.isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print DSR</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Sales" value={formatCurrency(totalSalesPkr)} icon={DollarSign} status="primary" loading={dsrQuery.isLoading} />
        <MetricCard title="Total Recovered" value={formatCurrency(totalCollectedPkr)} icon={Receipt} status="success" loading={dsrQuery.isLoading} />
        <MetricCard title="Credit Outstanding" value={formatCurrency(totalCreditPkr)} icon={Truck} status="warning" loading={dsrQuery.isLoading} />
        <MetricCard
          title="Trip Expenses"
          value={formatCurrency(totalExpensesPkr)}
          subtitle={`Bookings: ${formatNumber(summary.bookedOrdersCount ?? 0)}`}
          icon={RotateCcw}
          status="info"
          loading={dsrQuery.isLoading}
        />
      </div>

      <FilterToolbar
        onResetFilters={() => {
          setDate(today);
          setSalesmanId('');
        }}
      >
        <input
          type="date"
          aria-label="DSR Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-mono"
        />
        <select
          aria-label="Filter by Salesman"
          value={salesmanId}
          onChange={(e) => setSalesmanId(e.target.value)}
          className="h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs sm:text-sm"
        >
          <option value="">All Staff (Salesmen &amp; Bookers)</option>
          {(staffQuery.data || []).map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.fullName} ({emp.primaryRole})
            </option>
          ))}
        </select>
      </FilterToolbar>

      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <MiniBarChart
          title="Order-to-Delivery Pipeline"
          subtitle={`Daily counts for ${date || 'selected date'}`}
          items={pipelineBars}
          emptyLabel="No order or invoice volume recorded for this date."
        />
        <MiniBarChart
          title="Payment Mode & Expense Breakdown"
          subtitle="Cash, JazzCash/EasyPaisa, Cheque & Expenses"
          items={recoveryBars}
          valueFormatter={(v) => formatCurrency(v)}
          emptyLabel="No collections or trip expenses recorded for this date."
        />
        <MiniBarChart
          title="Sales by Brand"
          subtitle="Top delivered brands for selected date"
          items={brandBars}
          valueFormatter={(v) => formatCurrency(v)}
          emptyLabel="No brand-level sales recorded for this date."
        />
      </div>

      <SmartDataTable
        columns={columns}
        data={invoices}
        loading={dsrQuery.isLoading}
        emptyIcon={BarChart3}
        emptyTitle="No daily sales transactions found"
        emptyDescription="Select another date or record sales, dispatches, and recoveries to populate the DSR."
      />

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Daily Sales Report — ${date}`}
        documentType="Daily Sales Report"
        columns={columns}
        rows={invoices}
        summaryRows={[
          { label: 'Total Sales', value: formatCurrency(totalSalesPkr) },
          { label: 'Total Recovered', value: formatCurrency(totalCollectedPkr) },
          { label: 'Credit Outstanding', value: formatCurrency(totalCreditPkr) },
          { label: 'Trip Expenses', value: formatCurrency(totalExpensesPkr) },
        ]}
      />
    </div>
  );
}
