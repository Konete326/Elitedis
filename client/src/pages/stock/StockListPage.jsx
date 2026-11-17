import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Boxes, Printer, SlidersHorizontal } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import {
  extractListPayload,
  formatCurrency,
  formatDate,
  formatDualUnit,
  formatWeight,
} from '../../utils/formatters';

export default function StockListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'stock-batches',
    endpoint: '/stocks/batches',
    initialFilters: { warehouseId: '', condition: '', status: '' },
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ minStockPack: 20, maxStockPack: 50, expiryAlertDays: 90 });
  const [printOpen, setPrintOpen] = useState(false);

  const ruleMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/stocks/rules', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: 'Stock threshold rules applied.' });
      setRuleModalOpen(false);
      table.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to update stock rules.' });
    },
  });

  const columns = [
    { key: 'batchNo', header: 'Batch ID', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.batchNo}</span> },
    {
      key: 'product',
      header: 'Product',
      mobilePrimary: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{r.productId?.productName || '—'}</p>
          <p className="text-[11px] font-mono text-[var(--text-muted)]">{r.productId?.skuCode || ''}</p>
        </div>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseId?.warehouseName || '—' },
    {
      key: 'qty',
      header: 'Current (Pack : Base)',
      numeric: true,
      accessor: (r) =>
        formatDualUnit(
          r.currentBaseQty,
          r.productId?.packingUnits?.[0]?.conversionQty || 1,
          r.productId?.packingUnits?.[0]?.unitName || 'CT',
          r.productId?.baseUnit?.unitName || 'Pcs'
        ),
    },
    {
      key: 'available',
      header: 'Avail / Res',
      numeric: true,
      accessor: (r) => `${r.availableBaseQty ?? 0} / ${r.reservedBaseQty ?? 0}`,
    },
    { key: 'weight', header: 'Weight', numeric: true, align: 'right', accessor: (r) => formatWeight(r.totalWeightKg) },
    { key: 'value', header: 'Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.totalStockValuePkr) },
    { key: 'expDate', header: 'EXP Date', accessor: (r) => formatDate(r.expDate) },
    { key: 'condition', header: 'Condition', render: (r) => <StatusBadge status={r.condition} /> },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Batch-Wise Stock Ledger"
        subtitle="Track MFG/EXP batches, reservations, dual units, condition, and availability status"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Stock Report</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/stock/movements/create')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>New Movement</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Matching Batches" value={table.pagination.totalRecords} icon={Boxes} status="primary" />
        <MetricCard
          title="Page Stock Value"
          value={formatCurrency(table.rows.reduce((s, r) => s + (r.totalStockValuePkr || 0), 0))}
          status="info"
        />
        <MetricCard
          title="Low / Out Batches"
          value={table.rows.filter((r) => ['LOW_WARNING', 'OUT'].includes(r.status)).length}
          status="warning"
        />
        <MetricCard
          title="Quarantined / Damaged"
          value={table.rows.filter((r) => r.condition !== 'NORMAL' || r.status === 'QUARANTINED').length}
          status="danger"
        />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search batch ID or product..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        columns={columns}
        visibleColumns={table.visibleColumns}
        onToggleColumn={(k) => table.toggleColumn(k, columns)}
        onResetColumns={table.resetColumns}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        selectedCount={table.selectedKeys.length}
        filters={[
          {
            key: 'warehouseId',
            label: 'Warehouse',
            value: table.filters.warehouseId,
            onChange: (val) => table.setFilter('warehouseId', val),
            options: (warehousesQuery.data || []).map((w) => ({ value: w._id, label: w.warehouseName })),
          },
          {
            key: 'condition',
            label: 'Condition',
            value: table.filters.condition,
            onChange: (val) => table.setFilter('condition', val),
            options: ['NORMAL', 'DAMAGE', 'EXPIRE', 'DAMAGE_EXPIRE'],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['AVAILABLE', 'RESERVED', 'LOW_WARNING', 'OUT', 'BLOCKED', 'QUARANTINED'],
          },
        ]}
        actions={
          table.selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setRuleModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Set Min/Max Rules ({table.selectedKeys.length})</span>
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
        emptyTitle="No stock batches recorded"
        emptyDescription="Create a Purchase Intake movement to populate warehouse batch inventory."
        emptyActionLabel="Record Purchase Intake"
        onEmptyAction={() => navigate('/stock/movements/create')}
      />

      <FormModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Apply Batch Alert Rules"
        size="sm"
        onSubmit={(e) => {
          e.preventDefault();
          ruleMutation.mutate({ batchIds: table.selectedKeys, ...ruleForm });
        }}
        isSubmitting={ruleMutation.isPending}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Minimum Stock (Pack)</label>
            <input
              type="number"
              value={ruleForm.minStockPack}
              onChange={(e) => setRuleForm((p) => ({ ...p, minStockPack: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Maximum Stock (Pack)</label>
            <input
              type="number"
              value={ruleForm.maxStockPack}
              onChange={(e) => setRuleForm((p) => ({ ...p, maxStockPack: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expiry Alert Window (Days)</label>
            <input
              type="number"
              value={ruleForm.expiryAlertDays}
              onChange={(e) => setRuleForm((p) => ({ ...p, expiryAlertDays: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
        </div>
      </FormModal>

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Current Stock Batch Report"
        documentType="Current Stock"
        columns={[
          { key: 'batchNo', header: 'Batch No', numeric: true },
          { key: 'product', header: 'Product', accessor: (r) => r.productId?.productName || '—' },
          { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseId?.warehouseName || '—' },
          { key: 'currentBaseQty', header: 'Current Base Qty', numeric: true },
          { key: 'availableBaseQty', header: 'Available', numeric: true },
          { key: 'status', header: 'Status' },
        ]}
        rows={table.rows}
      />
    </div>
  );
}
