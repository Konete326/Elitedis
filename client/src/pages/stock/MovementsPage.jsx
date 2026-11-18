import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CheckCircle2, Eye, EyeOff, Plus, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export default function MovementsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'stock-movements',
    endpoint: '/stocks/movements',
    initialFilters: { movementType: '', status: '', includeHidden: 'false' },
  });

  const [printTarget, setPrintTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);

  const approveMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/stocks/movements/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: 'Stock movement approved and posted.' });
      setApproveTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Approval failed.' });
      setApproveTarget(null);
    },
  });

  const toggleHideMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/stocks/movements/${id}/toggle-hide`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      addToast({ type: 'info', message: 'Movement visibility updated.' });
    },
  });

  const columns = [
    { key: 'movementCode', header: 'Move ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.movementCode}</span> },
    { key: 'movementType', header: 'Type', mobilePrimary: true, render: (r) => <StatusBadge status={r.movementType} tone="info" /> },
    { key: 'taskName', header: 'Task / Memo', accessor: (r) => r.taskName || '—' },
    {
      key: 'warehouses',
      header: 'From → To',
      accessor: (r) => `${r.fromWarehouseId?.warehouseName || 'Supplier'} → ${r.toWarehouseId?.warehouseName || '—'}`,
    },
    {
      key: 'items',
      header: 'Lines / Count',
      numeric: true,
      render: (r) => {
        const count = r.items?.length || 0;
        if (r.movementType !== 'ADJUSTMENT') return count;
        const netDiff = (r.items || []).reduce(
          (s, it) => s + (it.differenceBaseQty ?? ((it.physicalCountBaseQty ?? 0) - (it.systemBaseQty ?? it.previousErpBaseQty ?? 0))),
          0
        );
        return (
          <span className="inline-flex items-center gap-1.5">
            <span>{count}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${netDiff === 0 ? 'bg-[var(--status-success)]/12 text-[var(--status-success)]' : 'bg-[var(--status-warning)]/12 text-[var(--status-warning)]'}`}>
              Diff {netDiff > 0 ? `+${netDiff}` : netDiff}
            </span>
          </span>
        );
      },
    },
    { key: 'createdAt', header: 'Date', accessor: (r) => formatDateTime(r.createdAt) },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Stock Movements Ledger"
        subtitle="Inter-warehouse transfers, same transfers, physical adjustments, purchases, and returns"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/stock/purchase-receiving')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-xs font-semibold"
            >
              <span>5-Step Receiving</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/stock/movements/create')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Create Movement</span>
            </button>
          </div>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search movement ID or task name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'movementType',
            label: 'Movement Type',
            value: table.filters.movementType,
            onChange: (val) => table.setFilter('movementType', val),
            options: ['TRANSFER', 'SAME_TRANSFER', 'ADJUSTMENT', 'PURCHASE', 'PURCHASE_RETURN', 'EXPIRY_DAMAGE_BACK'],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED'],
          },
          {
            key: 'includeHidden',
            label: 'Show Hidden',
            value: table.filters.includeHidden,
            onChange: (val) => table.setFilter('includeHidden', val),
            options: [
              { value: 'false', label: 'Visible Only' },
              { value: 'true', label: 'Include Hidden' },
            ],
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
        emptyIcon={ArrowLeftRight}
        emptyTitle="No stock movements recorded"
        emptyDescription="Create a Purchase Intake, Transfer, or Physical Adjustment movement to manage stock."
        emptyActionLabel="Create Movement"
        onEmptyAction={() => navigate('/stock/movements/create')}
        renderActions={(row) => (
          <>
            {row.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => setApproveTarget(row)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintTarget(row)}
              className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]"
              title="Print Movement Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleHideMutation.mutate(row._id)}
              className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]"
              title={row.isHidden ? 'Show Movement' : 'Hide Movement'}
            >
              {row.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      />

      <PrintPreviewModal
        isOpen={Boolean(printTarget)}
        onClose={() => setPrintTarget(null)}
        title={`Stock Movement ${printTarget?.movementCode || ''}`}
        documentType={printTarget?.movementType || 'Movement'}
        columns={
          printTarget?.movementType === 'ADJUSTMENT'
            ? [
                { key: 'batchNo', header: 'Batch', numeric: true },
                { key: 'unitName', header: 'Unit' },
                { key: 'systemQty', header: 'System Qty', numeric: true, accessor: (r) => r.systemBaseQty ?? r.previousErpBaseQty ?? 0 },
                { key: 'physicalCountBaseQty', header: 'Physical Count Qty', numeric: true },
                {
                  key: 'diff',
                  header: 'Difference (+/-)',
                  numeric: true,
                  accessor: (r) => {
                    const d = r.differenceBaseQty ?? ((r.physicalCountBaseQty ?? 0) - (r.systemBaseQty ?? r.previousErpBaseQty ?? 0));
                    return d > 0 ? `+${d}` : String(d);
                  },
                },
                { key: 'updatedBal', header: 'Updated Balance', numeric: true, accessor: (r) => r.updatedBalanceBaseQty ?? r.physicalCountBaseQty ?? 0 },
                { key: 'lineDecision', header: 'Decision' },
              ]
            : [
                { key: 'batchNo', header: 'Batch', numeric: true },
                { key: 'unitName', header: 'Unit' },
                { key: 'movedBaseQty', header: 'Moved Base Qty', numeric: true },
                { key: 'physicalCountBaseQty', header: 'Physical Count', numeric: true },
                { key: 'lineDecision', header: 'Decision' },
              ]
        }
        rows={printTarget?.items || []}
      />
      <ConfirmModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => approveMutation.mutate(approveTarget._id)}
        isLoading={approveMutation.isPending}
        variant="primary"
        title="Approve & Post Stock Movement?"
        message={`Approve movement ${approveTarget?.movementCode || ''} and post stock batch updates immediately?`}
        confirmLabel="Approve Movement"
      />
    </div>
  );
}
