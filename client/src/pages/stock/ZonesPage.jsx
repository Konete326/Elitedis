import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Layers, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

const INITIAL_FORM = {
  warehouseId: '',
  zoneCode: '',
  zoneName: '',
  zoneType: 'NORMAL',
  storageType: 'NORMAL',
  condition: 'NORMAL',
  dimensions: { sizeUnit: 'Feet', width: 0, length: 0, height: 0 },
};

export default function ZonesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'warehouse-zones',
    endpoint: '/warehouses/zones',
    initialFilters: { warehouseId: '' },
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [guardError, setGuardError] = useState('');

  const dimTotals = useMemo(() => {
    const w = Number(form.dimensions?.width) || 0;
    const l = Number(form.dimensions?.length) || 0;
    const h = Number(form.dimensions?.height) || 0;
    return { totalArea: Number((w * l).toFixed(2)), totalVolume: Number((w * l * h).toFixed(2)) };
  }, [form.dimensions]);

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const body = {
        ...payload,
        dimensions: { ...payload.dimensions, ...dimTotals },
      };
      return editing
        ? apiClient.put(`/warehouses/${editing.warehouseId}/zones/${editing._id}`, body)
        : apiClient.post(`/warehouses/${payload.warehouseId}/zones`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-zones'] });
      addToast({ type: 'success', message: editing ? 'Zone updated.' : 'Zone created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save zone.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (row) => apiClient.delete(`/warehouses/${row.warehouseId}/zones/${row._id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-zones'] });
      addToast({ type: 'success', message: 'Zone deleted.' });
      setDeleteTarget(null);
      setGuardError('');
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Delete blocked because stock exists in this zone.';
      setGuardError(msg);
      addToast({ type: 'warning', message: msg });
    },
  });

  const columns = [
    { key: 'zoneCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.zoneCode}</span> },
    { key: 'zoneName', header: 'Zone Name', mobilePrimary: true, accessor: 'zoneName' },
    { key: 'warehouseName', header: 'Warehouse', accessor: 'warehouseName' },
    { key: 'zoneType', header: 'Zone Type', accessor: 'zoneType' },
    { key: 'storageType', header: 'Storage', mobileBadge: true, render: (r) => <StatusBadge status={r.storageType} /> },
    { key: 'areaCount', header: 'Areas', numeric: true, accessor: (r) => r.areaCount ?? r.areas?.length ?? 0 },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Warehouse Zones & Sections"
        subtitle="Configure Normal, Damage, Expiry, and Temperature zones per warehouse"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({
                ...INITIAL_FORM,
                warehouseId: warehousesQuery.data?.[0]?._id || '',
              });
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Zone</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search zone code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'warehouseId',
            label: 'Warehouse',
            value: table.filters.warehouseId,
            onChange: (val) => table.setFilter('warehouseId', val),
            options: (warehousesQuery.data || []).map((w) => ({ value: w._id, label: w.warehouseName })),
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
        emptyIcon={Layers}
        emptyTitle="No warehouse zones defined"
        emptyDescription="Add sections like Main Plot, Damage Zone, or Cold Store inside a warehouse."
        emptyActionLabel="Add Zone"
        onEmptyAction={() => {
          setEditing(null);
          setForm({ ...INITIAL_FORM, warehouseId: warehousesQuery.data?.[0]?._id || '' });
          setModalOpen(true);
        }}
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => {
                setEditing(row);
                setForm({ ...INITIAL_FORM, ...row });
                setModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
            >
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
        title={editing ? 'Edit Zone' : 'New Warehouse Zone'}
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!editing && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Warehouse</label>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select warehouse...</option>
                {(warehousesQuery.data || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName} ({w.warehouseCode})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone Code</label>
            <input
              required
              value={form.zoneCode}
              onChange={(e) => setForm((p) => ({ ...p, zoneCode: e.target.value.toUpperCase() }))}
              placeholder="S-01"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone Name</label>
            <input
              required
              value={form.zoneName}
              onChange={(e) => setForm((p) => ({ ...p, zoneName: e.target.value }))}
              placeholder="Main Plot"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Zone Type</label>
            <select
              value={form.zoneType}
              onChange={(e) => setForm((p) => ({ ...p, zoneType: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="NORMAL">Normal</option>
              <option value="MIX">Mix</option>
              <option value="TEMPERATURE">Temperature</option>
              <option value="COLD_STORE">Cold Store</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Storage Purpose</label>
            <select
              value={form.storageType}
              onChange={(e) => setForm((p) => ({ ...p, storageType: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="NORMAL">Normal</option>
              <option value="DAMAGE">Damage</option>
              <option value="MIX">Mix</option>
              <option value="EXPIRY">Expiry</option>
            </select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Width (Ft)</label>
              <input
                type="number"
                value={form.dimensions?.width || 0}
                onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, width: Number(e.target.value) } }))}
                className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Length (Ft)</label>
              <input
                type="number"
                value={form.dimensions?.length || 0}
                onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, length: Number(e.target.value) } }))}
                className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Height (Ft)</label>
              <input
                type="number"
                value={form.dimensions?.height || 0}
                onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, height: Number(e.target.value) } }))}
                className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums"
              />
            </div>
          </div>
          <p className="sm:col-span-2 text-xs font-mono tabular-nums text-[var(--text-muted)]">
            Computed Area: {dimTotals.totalArea} sq ft · Volume: {dimTotals.totalVolume} cu ft
          </p>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setGuardError('');
        }}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        isLoading={deleteMutation.isPending}
        title="Delete zone?"
        message={guardError || `Delete zone ${deleteTarget?.zoneName || ''}? Zones containing stock cannot be deleted.`}
        secondaryAction={
          guardError
            ? {
                label: 'Move Stock Out First',
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
