import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Boxes, Lock, Printer, SlidersHorizontal, Unlock } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency, formatDate, formatDualUnit, formatWeight } from '../../utils/formatters';

export default function StockListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canViewPurchasePrice } = useAuth();
  const { addToast } = useShell();
  const canEditPolicy = ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'].includes(user?.primaryRole);

  const table = useServerTable({ queryKey: 'stock-batches', endpoint: '/stocks/batches', initialFilters: { warehouseId: '', condition: '', status: '' } });
  const warehousesQuery = useQuery({ queryKey: ['warehouses-options'], queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data });
  const policyQuery = useQuery({
    queryKey: ['stock-policy'],
    queryFn: async () => (await apiClient.get('/stocks/policy')).data?.data || { stockIssuePolicy: 'FEFO', customStockConditions: [] },
  });
  const activePolicy = policyQuery.data?.stockIssuePolicy || 'FEFO';
  const customConditions = policyQuery.data?.customStockConditions || [];

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ minStockPack: 20, maxStockPack: 50, expiryAlertDays: 90, condition: '', customConditionLabel: '', status: '' });
  const [printOpen, setPrintOpen] = useState(false);

  const policyMutation = useMutation({
    mutationFn: (stockIssuePolicy) => apiClient.put('/stocks/policy', { stockIssuePolicy }),
    onSuccess: (_res, nextPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['stock-policy'] });
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: `Stock issue policy switched to ${nextPolicy}.` });
    },
    onError: (err) => addToast({ type: 'error', message: err?.response?.data?.message || 'Could not switch policy.' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => apiClient.patch(`/stocks/batches/${id}/status-condition`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: 'Batch status updated.' });
    },
    onError: (err) => addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to update batch status.' }),
  });

  const ruleMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/stocks/rules', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: 'Stock rules & condition overrides applied.' });
      setRuleModalOpen(false);
      table.setSelectedKeys([]);
    },
    onError: (err) => addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to update stock rules.' }),
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
      render: (r) => {
        const conv = r.conversionQty || r.productId?.packingUnits?.[0]?.conversionQty || 1;
        const packName = r.unitName || r.productId?.packingUnits?.[0]?.unitName || 'CT';
        return (
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <span>{formatDualUnit(r.currentBaseQty, conv, packName, r.productId?.baseUnit?.unitName || 'Pcs')}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">{r.unitVersionId || 'UV-1'}</span>
          </span>
        );
      },
    },
    { key: 'available', header: 'Avail / Res', numeric: true, accessor: (r) => `${r.availableBaseQty ?? 0} / ${r.reservedBaseQty ?? 0}` },
    { key: 'weight', header: 'Weight', numeric: true, align: 'right', accessor: (r) => formatWeight(r.totalWeightKg) },
    ...(canViewPurchasePrice ? [{ key: 'value', header: 'Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.totalStockValuePkr) }] : []),
    { key: 'expDate', header: 'EXP Date', accessor: (r) => formatDate(r.expDate) },
    {
      key: 'condition',
      header: 'Condition',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={r.condition} />
          {r.customConditionLabel && <span className="px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[10px] font-medium text-[var(--text-secondary)]">{r.customConditionLabel}</span>}
        </span>
      ),
    },
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

      <div className={`shrink-0 grid grid-cols-2 ${canViewPurchasePrice ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
        <MetricCard title="Matching Batches" value={table.pagination.totalRecords} icon={Boxes} status="primary" />
        {canViewPurchasePrice && (
          <MetricCard
            title="Page Stock Value"
            value={formatCurrency(table.rows.reduce((s, r) => s + (r.totalStockValuePkr || 0), 0))}
            status="info"
          />
        )}
        <MetricCard
          title="Low / Out Batches"
          value={table.rows.filter((r) => ['LOW', 'WARNING', 'LOW_WARNING', 'OUT'].includes(r.status)).length}
          status="warning"
        />
        <MetricCard
          title="Quarantined / Damaged"
          value={table.rows.filter((r) => ['DAMAGE', 'EXPIRE', 'DAMAGE_EXPIRE'].includes(r.condition) || ['QUARANTINED', 'BLOCKED'].includes(r.status)).length}
          status="danger"
        />
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[var(--text-secondary)]">Stock Issue Policy:</span>
          <div className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
            {['FIFO', 'FEFO', 'MANUAL'].map((mode) => {
              const active = activePolicy === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!canEditPolicy || policyMutation.isPending}
                  onClick={() => policyMutation.mutate(mode)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                    active ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
        {canEditPolicy && (
          <button
            type="button"
            onClick={() => navigate('/settings/stock-policy')}
            className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent-primary)]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Policy &amp; Conditions</span>
          </button>
        )}
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
          { key: 'warehouseId', label: 'Warehouse', value: table.filters.warehouseId, onChange: (val) => table.setFilter('warehouseId', val), options: (warehousesQuery.data || []).map((w) => ({ value: w._id, label: w.warehouseName })) },
          { key: 'condition', label: 'Condition', value: table.filters.condition, onChange: (val) => table.setFilter('condition', val), options: ['FRESH', 'NORMAL', 'DAMAGE', 'EXPIRE', 'DAMAGE_EXPIRE'] },
          { key: 'status', label: 'Status', value: table.filters.status, onChange: (val) => table.setFilter('status', val), options: ['AVAILABLE', 'RESERVED', 'LOW', 'WARNING', 'LOW_WARNING', 'OUT', 'BLOCKED', 'QUARANTINED'] },
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
        renderActions={(row) => (
          <button
            type="button"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate({ id: row._id, status: row.status === 'BLOCKED' ? 'UNBLOCK' : 'BLOCKED' })}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 ${
              row.status === 'BLOCKED'
                ? 'border-[var(--status-success)]/40 text-[var(--status-success)] hover:bg-[var(--status-success)]/10'
                : 'border-[var(--status-danger)]/30 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10'
            }`}
          >
            {row.status === 'BLOCKED' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{row.status === 'BLOCKED' ? 'Unblock' : 'Block'}</span>
          </button>
        )}
      />

      <FormModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Apply Batch Alert Rules & Conditions"
        size="sm"
        onSubmit={(e) => {
          e.preventDefault();
          ruleMutation.mutate({
            batchIds: table.selectedKeys,
            minStockPack: ruleForm.minStockPack,
            maxStockPack: ruleForm.maxStockPack,
            expiryAlertDays: ruleForm.expiryAlertDays,
            ...(ruleForm.condition ? { condition: ruleForm.condition } : {}),
            ...(ruleForm.customConditionLabel.trim() ? { customConditionLabel: ruleForm.customConditionLabel.trim() } : {}),
            ...(ruleForm.status ? { status: ruleForm.status } : {}),
          });
        }}
        isSubmitting={ruleMutation.isPending}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Min Pack</label>
              <input type="number" value={ruleForm.minStockPack} onChange={(e) => setRuleForm((p) => ({ ...p, minStockPack: Number(e.target.value) }))} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Max Pack</label>
              <input type="number" value={ruleForm.maxStockPack} onChange={(e) => setRuleForm((p) => ({ ...p, maxStockPack: Number(e.target.value) }))} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Expiry Days</label>
              <input type="number" value={ruleForm.expiryAlertDays} onChange={(e) => setRuleForm((p) => ({ ...p, expiryAlertDays: Number(e.target.value) }))} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Condition Override (Optional)</label>
            <select value={ruleForm.condition} onChange={(e) => setRuleForm((p) => ({ ...p, condition: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">Keep Existing</option>
              {['FRESH', 'NORMAL', 'DAMAGE', 'EXPIRE'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Custom Condition Label (Optional)</label>
            {customConditions.length > 0 && (
              <select
                value={customConditions.some((c) => c.label === ruleForm.customConditionLabel) ? ruleForm.customConditionLabel : ''}
                onChange={(e) => {
                  const chosen = customConditions.find((c) => c.label === e.target.value);
                  setRuleForm((p) => ({
                    ...p,
                    customConditionLabel: e.target.value,
                    condition: chosen && !p.condition ? chosen.mappedSystemCondition : p.condition,
                  }));
                }}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm mb-2"
              >
                <option value="">Pick configured label...</option>
                {customConditions.map((c) => <option key={c.label} value={c.label}>{c.label} ({c.mappedSystemCondition})</option>)}
              </select>
            )}
            <input
              value={ruleForm.customConditionLabel}
              onChange={(e) => setRuleForm((p) => ({ ...p, customConditionLabel: e.target.value }))}
              placeholder="Or type custom label (e.g. Box Torn)"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Batch Status Override (Optional)</label>
            <select value={ruleForm.status} onChange={(e) => setRuleForm((p) => ({ ...p, status: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">Keep Existing</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="QUARANTINED">QUARANTINED</option>
              <option value="UNBLOCK">UNBLOCK</option>
            </select>
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
