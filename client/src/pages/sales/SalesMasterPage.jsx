import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Printer, Receipt } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import {
  FilterToolbar,
  FormModal,
  MetricCard,
  PrintPreviewModal,
  SmartDataTable,
} from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function SalesMasterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'sales',
    endpoint: '/sales-recovery/sales',
    initialFilters: { paymentStatus: '', source: '' },
  });

  const [payTarget, setPayTarget] = useState(null);
  const [cashAmount, setCashAmount] = useState(0);
  const [printTarget, setPrintTarget] = useState(null);

  const payMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/sales-recovery/recovery-collect', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      addToast({ type: 'success', message: 'Payment recorded cleanly.' });
      setPayTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Payment collection failed.' });
    },
  });

  const columns = [
    { key: 'invoiceNo', header: 'Sale / Inv No', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.invoiceNo}</span> },
    {
      key: 'customer',
      header: 'Customer',
      mobilePrimary: true,
      accessor: (r) => r.customerId?.shopName || r.walkInCustomerName || 'Walk-in',
    },
    { key: 'source', header: 'Source', accessor: 'source' },
    { key: 'netPayable', header: 'Total Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.grandSummary?.netPayableAmount) },
    { key: 'paidAmountPkr', header: 'Paid', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.paidAmountPkr) },
    { key: 'balanceDuePkr', header: 'Outstanding', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.balanceDuePkr) },
    { key: 'paymentStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Sales Master & DSR Ledger"
        subtitle="Issued invoices, POS receipts, outstanding balances, and direct payments"
        actions={
          <button
            type="button"
            onClick={() => navigate('/recovery/assign')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
          >
            <Receipt className="w-4 h-4" />
            <span>Assign Recovery</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Sales Invoices" value={table.pagination.totalRecords} icon={Receipt} status="primary" />
        <MetricCard
          title="Page Total Value"
          value={formatCurrency(table.rows.reduce((s, r) => s + (r.grandSummary?.netPayableAmount || 0), 0))}
          status="info"
        />
        <MetricCard
          title="Page Collected"
          value={formatCurrency(table.rows.reduce((s, r) => s + (r.paidAmountPkr || 0), 0))}
          status="success"
        />
        <MetricCard
          title="Page Outstanding"
          value={formatCurrency(table.rows.reduce((s, r) => s + (r.balanceDuePkr || 0), 0))}
          status="warning"
        />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search invoice no or walk-in..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Payment',
            value: table.filters.paymentStatus,
            onChange: (val) => table.setFilter('paymentStatus', val),
            options: ['PAID', 'PARTIAL', 'CREDIT', 'OVERDUE'],
          },
          {
            key: 'source',
            label: 'Source',
            value: table.filters.source,
            onChange: (val) => table.setFilter('source', val),
            options: ['ADMIN', 'BOOKER', 'POS', 'SALESMAN', 'ONLINE'],
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
        emptyTitle="No sales invoices issued yet"
        emptyDescription="Invoices appear here automatically after delivery planning or POS checkout."
        emptyActionLabel="Open POS Counter"
        onEmptyAction={() => navigate('/portal/pos')}
        renderActions={(row) => (
          <>
            {row.balanceDuePkr > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPayTarget(row);
                  setCashAmount(row.balanceDuePkr);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Pay</span>
              </button>
            )}
            <button type="button" onClick={() => setPrintTarget(row)} className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]">
              <Printer className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      <FormModal
        isOpen={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={`Collect Payment — ${payTarget?.invoiceNo || ''}`}
        size="sm"
        onSubmit={(e) => {
          e.preventDefault();
          payMutation.mutate({
            customerId: payTarget.customerId?._id || payTarget.customerId,
            saleInvoiceId: payTarget._id,
            paymentMode: 'CASH',
            cashAmountPkr: cashAmount,
            autoApprove: true,
          });
        }}
        isSubmitting={payMutation.isPending}
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <strong>{payTarget?.customerId?.shopName || payTarget?.walkInCustomerName}</strong> · Balance Due:{' '}
            <strong className="font-mono tabular-nums">{formatCurrency(payTarget?.balanceDuePkr)}</strong>
          </p>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Cash Received (PKR)</label>
            <input
              type="number"
              min="1"
              max={payTarget?.balanceDuePkr}
              value={cashAmount}
              onChange={(e) => setCashAmount(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
        </div>
      </FormModal>

      <PrintPreviewModal
        isOpen={Boolean(printTarget)}
        onClose={() => setPrintTarget(null)}
        title={`Sale Invoice ${printTarget?.invoiceNo || ''}`}
        documentType={printTarget?.invoiceMode || 'Sale Invoice'}
        columns={[
          { key: 'productName', header: 'Item' },
          { key: 'unitName', header: 'Unit' },
          { key: 'quantity', header: 'Qty', numeric: true },
          { key: 'netLineAmount', header: 'Net Amount', numeric: true },
        ]}
        rows={printTarget?.lineItems || []}
        summaryRows={[
          { label: 'Net Payable', value: formatCurrency(printTarget?.grandSummary?.netPayableAmount) },
          { label: 'Paid', value: formatCurrency(printTarget?.paidAmountPkr) },
          { label: 'Balance Due', value: formatCurrency(printTarget?.balanceDuePkr) },
        ]}
      />
    </div>
  );
}
