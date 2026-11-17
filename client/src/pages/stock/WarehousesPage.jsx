import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, MapPin, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/formatters';
import { suggestCode, validateField } from '../../utils/validation';

const INITIAL_FORM = {
  warehouseCode: '',
  warehouseName: '',
  warehouseType: 'MAIN',
  utilizationPct: 0,
  status: 'ACTIVE',
  address: { country: 'PAKISTAN', province: 'SINDH', city: 'KARACHI', zone: '', fullAddress: '' },
};

export default function WarehousesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'warehouses',
    endpoint: '/warehouses',
    initialFilters: { warehouseType: '', status: '' },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [guardError, setGuardError] = useState('');

  const codeError = touched.warehouseCode ? validateField('code', form.warehouseCode, { required: true, label: 'Warehouse Code' }) : '';
  const nameError = touched.warehouseName ? validateField('required', form.warehouseName, { required: true, minLength: 2, label: 'Warehouse Name' }) : '';

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId ? apiClient.put(`/warehouses/${editingId}`, payload) : apiClient.post('/warehouses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses-options'] });
      addToast({ type: 'success', message: editingId ? 'Warehouse updated.' : 'Warehouse created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save warehouse.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses-options'] });
      addToast({ type: 'success', message: 'Warehouse deleted.' });
      setDeleteTarget(null);
      setGuardError('');
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Cannot delete warehouse while stock exists.';
      setGuardError(msg);
      addToast({ type: 'warning', message: msg });
    },
  });

  const openEdit = (row) => {
    setEditingId(row._id);
    setTouched({});
    setForm({
      ...INITIAL_FORM,
      ...row,
      address: { ...INITIAL_FORM.address, ...(row.address || {}) },
    });
    setModalOpen(true);
  };

  const columns = [
    { key: 'warehouseCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.warehouseCode}</span> },
    { key: 'warehouseName', header: 'Warehouse', mobilePrimary: true, accessor: 'warehouseName' },
    { key: 'warehouseType', header: 'Type', accessor: 'warehouseType' },
    { key: 'zones', header: 'Zones / Areas', numeric: true, accessor: (r) => `${r.zoneCount ?? r.zones?.length ?? 0} / ${r.areaCount ?? 0}` },
    { key: 'stockVal', header: 'Stock Value', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.stockStats?.totalStockValuePkr || 0) },
    { key: 'utilizationPct', header: 'Utilization', numeric: true, accessor: (r) => `${r.utilizationPct || 0}%` },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Warehouses Master"
        subtitle="Main plots, shop sub-stores, utilization capacity, and zones"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/stock/zones')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Manage Zones</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTouched({});
                setForm(INITIAL_FORM);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Warehouse</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Warehouses" value={table.pagination.totalRecords} icon={WarehouseIcon} status="primary" />
        <MetricCard title="Total Zones" value={table.rows.reduce((s, w) => s + (w.zoneCount ?? w.zones?.length ?? 0), 0)} status="info" />
        <MetricCard title="Total Areas" value={table.rows.reduce((s, w) => s + (w.areaCount ?? 0), 0)} status="success" />
        <MetricCard title="Low Stock Warnings" value={table.rows.reduce((s, w) => s + (w.stockStats?.lowStockCount ?? 0), 0)} status="warning" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search warehouse code, name, city..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'warehouseType',
            label: 'Type',
            value: table.filters.warehouseType,
            onChange: (val) => table.setFilter('warehouseType', val),
            options: ['MAIN', 'SHOP', 'SUB_STORE'],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'INACTIVE'],
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
        emptyTitle="No warehouses created yet"
        emptyDescription="Add your main warehouse or shop store before configuring zones and floor/rack areas."
        emptyActionLabel="Add Warehouse"
        onEmptyAction={() => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setModalOpen(true);
        }}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => openEdit(row)} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1">
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGuardError('');
                setDeleteTarget(row);
              }}
              className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Warehouse' : 'New Warehouse'}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ warehouseCode: true, warehouseName: true });
          if (
            validateField('code', form.warehouseCode, { required: true, label: 'Warehouse Code' }) ||
            validateField('required', form.warehouseName, { required: true, minLength: 2, label: 'Warehouse Name' })
          ) {
            return;
          }
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Warehouse Code <span className="text-[var(--status-danger)]">*</span></label>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    warehouseCode: suggestCode('WH', table.pagination.totalRecords, table.rows.map((r) => r.warehouseCode)),
                  }))
                }
                className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Auto Code
              </button>
            </div>
            <input
              required
              value={form.warehouseCode}
              onChange={(e) => setForm((p) => ({ ...p, warehouseCode: e.target.value.toUpperCase() }))}
              onBlur={() => setTouched((p) => ({ ...p, warehouseCode: true }))}
              placeholder="WH-001"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Warehouse Name <span className="text-[var(--status-danger)]">*</span></label>
            <input
              required
              value={form.warehouseName}
              onChange={(e) => setForm((p) => ({ ...p, warehouseName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, warehouseName: true }))}
              placeholder="Main Godown Plot 01"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Type <span className="text-[var(--status-danger)]">*</span></label>
            <select
              value={form.warehouseType}
              onChange={(e) => setForm((p) => ({ ...p, warehouseType: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="MAIN">Main Plot</option>
              <option value="SHOP">Shop</option>
              <option value="SUB_STORE">Sub-Store</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">City <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <input
              value={form.address?.city || ''}
              onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Address <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <input
              value={form.address?.fullAddress || ''}
              onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, fullAddress: e.target.value } }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setGuardError('');
        }}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete warehouse?"
        message={
          guardError ||
          `Remove ${deleteTarget?.warehouseName || 'this warehouse'}? Deletion is blocked if any batch holds currentBaseQty > 0.`
        }
        secondaryAction={
          guardError
            ? {
                label: 'Execute Stock Movement',
                onClick: () => {
                  setDeleteTarget(null);
                  navigate('/stock/movements/create');
                },
              }
            : undefined
        }
      />
    </div>
  );
}
