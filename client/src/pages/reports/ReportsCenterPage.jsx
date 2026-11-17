import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import { extractListPayload, formatCurrency, formatDate } from '../../utils/formatters';

const REPORT_CATALOG = [
  { slug: 'daily-sales', label: 'Daily Sales Report (DSR)' },
  { slug: 'weekly-sales', label: 'Weekly Sales Report' },
  { slug: 'monthly-sales', label: 'Monthly Sales Report' },
  { slug: 'yearly-sales', label: 'Yearly Sales Report' },
  { slug: 'purchase', label: 'Purchase Intake Report' },
  { slug: 'profit-loss', label: 'Profit & Loss Ledger' },
  { slug: 'cash-flow', label: 'Cash Flow Ledger' },
  { slug: 'customer-ledger', label: 'Customer Ledger (AR)' },
  { slug: 'supplier-ledger', label: 'Supplier Ledger (AP)' },
  { slug: 'stock-movement', label: 'Stock Movement Report' },
  { slug: 'batch-stock', label: 'Batch-wise Current Stock' },
  { slug: 'expiry', label: 'Near-Expiry & Expiry Report' },
  { slug: 'employee-task', label: 'Employee Task Report' },
  { slug: 'recovery', label: 'Payment Recovery Report' },
  { slug: 'expense', label: 'Trip & Operational Expenses' },
  { slug: 'tax', label: 'Tax & GST Report' },
  { slug: 'product-profitability', label: 'Product-wise Profitability' },
  { slug: 'customer-profitability', label: 'Customer-wise Profitability' },
  { slug: 'company-performance', label: 'Company & Brand Performance' },
];

export default function ReportsCenterPage() {
  const { user } = useAuth();
  const { addToast } = useShell();
  const [reportSlug, setReportSlug] = useState('daily-sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ['report', user?.distributorId, reportSlug, startDate, endDate, page],
    queryFn: async () =>
      extractListPayload(
        await apiClient.get(`/dashboards-reports/reports/${reportSlug}`, {
          params: {
            page,
            limit: 10,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        })
      ),
  });

  const handleRefresh = async () => {
    await reportQuery.refetch();
    addToast({ type: 'success', message: 'Report refreshed.' });
  };

  const activeLabel = REPORT_CATALOG.find((r) => r.slug === reportSlug)?.label || reportSlug;
  const rows = reportQuery.data?.data || [];

  const columns = [
    {
      key: 'ref',
      header: 'Reference',
      numeric: true,
      mobilePrimary: true,
      accessor: (r) =>
        r.invoiceNo || r.movementCode || r.batchNo || r.taskCode || r.recoveryCode || r.voucherNo || r._id?.slice(-6) || '—',
    },
    {
      key: 'party',
      header: 'Party / Item / Account',
      accessor: (r) =>
        r.customerId?.shopName ||
        r.productId?.productName ||
        r.assignedToId?.fullName ||
        r.accountName ||
        r.taskName ||
        r.title ||
        '—',
    },
    {
      key: 'metric',
      header: 'Value / Qty',
      numeric: true,
      align: 'right',
      accessor: (r) =>
        r.grandSummary?.netPayableAmount !== undefined
          ? formatCurrency(r.grandSummary.netPayableAmount)
          : r.amountPkr !== undefined
            ? formatCurrency(r.amountPkr)
            : r.totalStockValuePkr !== undefined
              ? formatCurrency(r.totalStockValuePkr)
              : r.debitPkr || r.creditPkr
                ? formatCurrency(r.debitPkr || r.creditPkr)
                : r.items?.length ?? r.currentBaseQty ?? '—',
    },
    {
      key: 'status',
      header: 'Status / Type',
      mobileBadge: true,
      accessor: (r) => r.paymentStatus || r.movementType || r.status || r.voucherType || 'ACTIVE',
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (r) => formatDate(r.createdAt || r.transactionDate || r.expDate),
    },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Business Reports Center"
        subtitle="Pick any sales, stock, customer, supplier, or expense report to view and print"
        onRefresh={handleRefresh}
        isRefreshing={reportQuery.isFetching}
        actions={
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Export</span>
          </button>
        }
      />

      <FilterToolbar
        onRefresh={handleRefresh}
        isRefreshing={reportQuery.isFetching}
        onResetFilters={() => {
          setStartDate('');
          setEndDate('');
          setPage(1);
        }}
      >
        <select
          aria-label="Report Type"
          value={reportSlug}
          onChange={(e) => {
            setReportSlug(e.target.value);
            setPage(1);
          }}
          className="w-full md:w-auto min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-xs sm:text-sm font-semibold md:min-w-[220px]"
        >
          {REPORT_CATALOG.map((rep) => (
            <option key={rep.slug} value={rep.slug}>
              {rep.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Start Date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="w-full md:w-auto min-h-[40px] sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
        />
        <input
          type="date"
          aria-label="End Date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="w-full md:w-auto min-h-[40px] sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs"
        />
      </FilterToolbar>

      <SmartDataTable
        columns={columns}
        data={rows}
        loading={reportQuery.isLoading}
        pagination={reportQuery.data?.pagination}
        onPageChange={setPage}
        emptyIcon={BarChart3}
        emptyTitle={`No records for ${activeLabel}`}
        emptyDescription="Adjust date filters or record transactions in the corresponding module."
      />

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={activeLabel}
        documentType="Business Report"
        columns={columns}
        rows={rows}
      />
    </div>
  );
}
