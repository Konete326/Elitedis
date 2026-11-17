import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import { formatCurrency } from '../../utils/formatters';

const TABS = [
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'profit-loss', label: 'Profit & Loss (P&L)' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'cash-flow', label: 'Cash Flow Statement' },
];

export default function FinancialStatementsPage() {
  const { user } = useAuth();
  const { addToast } = useShell();
  const [tab, setTab] = useState('trial-balance');
  const [printOpen, setPrintOpen] = useState(false);

  const statementQuery = useQuery({
    queryKey: ['financial-statement', user?.distributorId, tab],
    queryFn: async () => (await apiClient.get(`/accounts/${tab}`)).data?.data || {},
  });

  const { data, isLoading, isFetching, refetch } = statementQuery;

  const handleRefresh = async () => {
    await refetch();
    addToast({ type: 'success', message: 'Financial statement refreshed.' });
  };

  const rows =
    tab === 'trial-balance'
      ? data?.rows || []
      : tab === 'profit-loss'
        ? [...(data?.revenueAccounts || []), ...(data?.expenseAccounts || [])]
        : tab === 'balance-sheet'
          ? [...(data?.assets || []), ...(data?.liabilities || []), ...(data?.equity || [])]
          : (data?.breakdown || []).map((b) => ({ accountCode: b._id, accountName: b._id, inflowPkr: b.inflowPkr, outflowPkr: b.outflowPkr }));

  const columns =
    tab === 'trial-balance'
      ? [
          { key: 'accountCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.accountCode}</span> },
          { key: 'accountName', header: 'Account', mobilePrimary: true, accessor: 'accountName' },
          { key: 'accountCategory', header: 'Category', accessor: 'accountCategory' },
          { key: 'debitPkr', header: 'Debit', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.debitPkr) },
          { key: 'creditPkr', header: 'Credit', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.creditPkr) },
        ]
      : tab === 'cash-flow'
        ? [
            { key: 'accountName', header: 'Activity Type', mobilePrimary: true, accessor: 'accountName' },
            { key: 'inflowPkr', header: 'Inflow', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.inflowPkr) },
            { key: 'outflowPkr', header: 'Outflow', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.outflowPkr) },
          ]
        : [
            { key: 'accountCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.accountCode}</span> },
            { key: 'accountName', header: 'Account', mobilePrimary: true, accessor: 'accountName' },
            { key: 'accountCategory', header: 'Category', accessor: (r) => r.accountCategory || 'EQUITY' },
            { key: 'amountPkr', header: 'Balance', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.amountPkr) },
          ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Financial Reports &amp; Statements"
        subtitle="Check your Trial Balance, Profit &amp; Loss, Balance Sheet, and Cash Flow in real time"
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
        tabs={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          active: tab === t.id,
          onClick: () => setTab(t.id),
        }))}
        actions={
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tab === 'trial-balance' && (
          <>
            <MetricCard title="Total Debits" value={formatCurrency(data?.totalDebits || 0)} status="primary" />
            <MetricCard title="Total Credits" value={formatCurrency(data?.totalCredits || 0)} status="info" />
            <MetricCard title="Ledger Status" value={data?.isBalanced ? 'BALANCED' : 'UNBALANCED'} status={data?.isBalanced ? 'success' : 'danger'} />
          </>
        )}
        {tab === 'profit-loss' && (
          <>
            <MetricCard title="Total Revenue" value={formatCurrency(data?.totalRevenue || 0)} status="primary" />
            <MetricCard title="Total Expenses" value={formatCurrency(data?.totalExpenses || 0)} status="warning" />
            <MetricCard title="Net Profit" value={formatCurrency(data?.netProfitPkr || 0)} status={(data?.netProfitPkr || 0) >= 0 ? 'success' : 'danger'} />
          </>
        )}
        {tab === 'balance-sheet' && (
          <>
            <MetricCard title="Total Assets" value={formatCurrency(data?.totalAssets || 0)} status="primary" />
            <MetricCard title="Total Liabilities" value={formatCurrency(data?.totalLiabilities || 0)} status="warning" />
            <MetricCard title="Equity + Net Profit" value={formatCurrency(data?.totalEquityAndProfit || 0)} status="success" />
          </>
        )}
        {tab === 'cash-flow' && (
          <>
            <MetricCard title="Total Cash Inflow" value={formatCurrency(data?.totalInflow || 0)} status="success" />
            <MetricCard title="Total Cash Outflow" value={formatCurrency(data?.totalOutflow || 0)} status="warning" />
            <MetricCard title="Net Cash Flow" value={formatCurrency(data?.netCashFlowPkr || 0)} status="primary" />
          </>
        )}
      </div>

      <SmartDataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        emptyTitle="No financial ledger postings yet"
        emptyDescription="Statements populate automatically once sales, recoveries, or journal vouchers are approved."
      />

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={TABS.find((t) => t.id === tab)?.label || 'Financial Statement'}
        documentType="Financial Statement"
        columns={columns}
        rows={rows}
      />
    </div>
  );
}
