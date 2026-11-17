import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Layers, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import ZoneFormModal, { buildEmptyZone } from './ZoneFormModal';
import { extractListPayload } from '../../utils/formatters';

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

  const [modalState, setModalState] = useState({ open: false, editing: null, initial: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [guardError, setGuardError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (body) =>
      modalState.editing
        ? apiClient.put(`/warehouses/${modalState.editing.warehouseId}/zones/${modalState.editing._id}`, body)
        : apiClient.post(`/warehouses/${body.warehouseId}/zones`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-zones'] });
      addToast({ type: 'success', message: modalState.editing ? 'Zone updated.' : 'Zone created.' });
      setModalState({ open: false, editing: null, initial: null, key: 0 });
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

  const warehouses = warehousesQuery.data || [];
  const openCreate = () =>
    setModalState((p) => ({ open: true, editing: null, initial: buildEmptyZone(warehouses[0]?._id || ''), key: p.key + 1 }));
  const openEdit = (row) =>
    setModalState((p) => ({ open: true, editing: row, initial: { ...buildEmptyZone(), ...row }, key: p.key + 1 }));

  const columns = [
    { key: 'zoneCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.zoneCode}</span> },
    { key: 'zoneName', header: 'Zone Name', mobilePrimary: true, accessor: 'zoneName' },
    { key: 'warehouseName', header: 'Warehouse', accessor: 'warehouseName' },
    { key: 'zoneType', header: 'Zone Type', accessor: 'zoneType' },
    { key: 'storageType', header: 'Storage', mobileBadge: true, render: (r) => <StatusBadge status={r.storageType} /> },
    { key: 'areaCount', header: 'Areas', numeric: true, accessor: (r) => r.areaCount ?? r.areas?.length ?? 0 },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Warehouse Zones & Sections"
        subtitle="Configure Normal, Damage, Expiry, and Temperature zones per warehouse"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Zone</span>
          </button>
        }
      />

      {!warehousesQuery.isLoading && warehouses.length === 0 && (
        <SetupGuideBanner
          missingMessage="Create a Warehouse before adding Zones or storage sections."
          steps={[{ label: 'Create Warehouse', done: false, to: '/stock/warehouses', actionLabel: 'Go to Warehouses' }]}
        />
      )}

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search zone code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'warehouseId',
            label: 'Warehouse',
            value: table.filters.warehouseId,
            onChange: (val) => table.setFilter('warehouseId', val),
            options: warehouses.map((w) => ({ value: w._id, label: w.warehouseName })),
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
        onEmptyAction={openCreate}
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(row)}
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

      {modalState.open && (
        <ZoneFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editing)}
          warehouses={warehouses}
          existingCount={table.pagination.totalRecords}
          existingCodes={table.rows.map((r) => r.zoneCode)}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

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
