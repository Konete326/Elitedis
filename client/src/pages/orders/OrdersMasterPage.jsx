import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Printer, ShoppingCart, XCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import {
  ConfirmModal,
  FilterToolbar,
  MetricCard,
  PrintPreviewModal,
  SmartDataTable,
} from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime, formatWeight } from '../../utils/formatters';

export default function OrdersMasterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'orders',
    endpoint: '/orders',
    initialFilters: { orderMode: '', orderType: '', source: '', status: '' },
  });

  const [printOrder, setPrintOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const approveBatchMutation = useMutation({
    mutationFn: (orderIds) => apiClient.patch('/orders/approve-batch', { orderIds }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({
        type: 'success',
        message: `Approved ${res.data?.data?.approvedCount || 0} orders and reserved stock.`,
      });
      table.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Approval failed.' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/orders/${id}/cancel`, { reason: 'Cancelled from Order Master' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'info', message: 'Order cancelled and any reserved stock released.' });
      setCancelTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Cancel failed.' });
      setCancelTarget(null);
    },
  });

  const columns = [
    { key: 'orderCode', header: 'Order ID', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.orderCode}</span> },
    {
      key: 'customer',
      header: 'Customer',
      mobilePrimary: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{r.customerId?.shopName || '—'}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{r.source} · {r.orderMode}</p>
        </div>
      ),
    },
    { key: 'items', header: 'Items', numeric: true, accessor: (r) => r.grandSummary?.totalItems || 0 },
    { key: 'weight', header: 'Weight', numeric: true, accessor: (r) => formatWeight(r.grandSummary?.totalWeightKg) },
    { key: 'net', header: 'Net Payable', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.grandSummary?.netPayableAmount) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.approvalInfo?.status} /> },
    { key: 'createdAt', header: 'Booked At', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Orders Master"
        subtitle="Normal, Advance, Booker, and Online orders with stock reservation approval"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/orders/operations')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approval &amp; Dispatch</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders/create-advance')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <span>Advance Order</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders/create-normal')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Normal Order</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Orders" value={table.pagination.totalRecords} icon={ShoppingCart} status="primary" />
        <MetricCard title="Pending Approval" value={table.rows.filter((o) => o.approvalInfo?.status === 'PENDING').length} status="warning" />
        <MetricCard title="Approved (Reserved)" value={table.rows.filter((o) => o.approvalInfo?.status === 'APPROVED').length} status="success" />
        <MetricCard
          title="Page Order Value"
          value={formatCurrency(table.rows.reduce((s, o) => s + (o.grandSummary?.netPayableAmount || 0), 0))}
          status="info"
        />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search order ID..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        columns={columns}
        visibleColumns={table.visibleColumns}
        onToggleColumn={(k) => table.toggleColumn(k, columns)}
        onResetColumns={table.resetColumns}
        onResetFilters={table.resetFilters}
        selectedCount={table.selectedKeys.length}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['DRAFT', 'PENDING', 'APPROVED', 'DELIVERY_ASSIGNED', 'COMPLETED', 'CANCELLED'],
          },
          {
            key: 'source',
            label: 'Source',
            value: table.filters.source,
            onChange: (val) => table.setFilter('source', val),
            options: ['ADMIN', 'BOOKER', 'ONLINE', 'POS', 'WHATSAPP'],
          },
          {
            key: 'orderMode',
            label: 'Mode',
            value: table.filters.orderMode,
            onChange: (val) => table.setFilter('orderMode', val),
            options: ['NORMAL', 'ADVANCE', 'POS'],
          },
        ]}
        actions={
          table.selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => approveBatchMutation.mutate(table.selectedKeys)}
              disabled={approveBatchMutation.isPending}
              className="h-9 px-3 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold"
            >
              Approve Selected ({table.selectedKeys.length})
            </button>
          )
        }
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        visibleColumns={table.visibleColumns}
        selectable
        selectedKeys={table.selectedKeys}
        onSelectionChange={table.setSelectedKeys}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSort={table.handleSort}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyTitle="No orders booked yet"
        emptyDescription="Create a Normal or Advance Order with the 2-level discount, scheme, and tax engine."
        emptyActionLabel="Create Normal Order"
        onEmptyAction={() => navigate('/orders/create-normal')}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => setPrintOrder(row)} className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]" title="Print Invoice">
              <Printer className="w-3.5 h-3.5" />
            </button>
            {['DRAFT', 'PENDING', 'APPROVED'].includes(row.approvalInfo?.status) && (
              <button
                type="button"
                onClick={() => setCancelTarget(row)}
                className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs"
                title="Cancel Order"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      />

      <PrintPreviewModal
        isOpen={Boolean(printOrder)}
        onClose={() => setPrintOrder(null)}
        title={`Order Invoice ${printOrder?.orderCode || ''}`}
        subtitle={printOrder?.customerId?.shopName}
        documentType={printOrder?.invoiceStyle?.layoutType || 'Normal Invoice'}
        columns={[
          { key: 'productName', header: 'Item' },
          { key: 'unitName', header: 'Unit' },
          { key: 'quantity', header: 'Qty', numeric: true },
          { key: 'customSaleRate', header: 'Rate', numeric: true },
          { key: 'itemDiscountAmount', header: 'Discount', numeric: true },
          { key: 'netLineAmount', header: 'Net Amount', numeric: true },
        ]}
        rows={printOrder?.lineItems || []}
        summaryRows={
          printOrder
            ? [
                { label: 'Total Weight', value: formatWeight(printOrder.grandSummary?.totalWeightKg) },
                { label: 'Gross Amount', value: formatCurrency(printOrder.grandSummary?.grossAmount) },
                { label: 'Grand Discount', value: formatCurrency(printOrder.grandSummary?.grandDiscountAmount) },
                { label: 'Net Payable', value: formatCurrency(printOrder.grandSummary?.netPayableAmount) },
              ]
            : []
        }
      />

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget._id)}
        isLoading={cancelMutation.isPending}
        title="Cancel order?"
        message={`Cancel ${cancelTarget?.orderCode || 'this order'}? Any reserved stock will be released back to Available Stock.`}
        confirmLabel="Cancel Order"
      />
    </div>
  );
}
