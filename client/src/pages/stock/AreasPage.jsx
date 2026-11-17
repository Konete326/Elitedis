import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, MapPin, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import AreaFormModal, { buildEmptyArea } from './AreaFormModal';
import { extractListPayload } from '../../utils/formatters';

export default function AreasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'warehouse-areas',
    endpoint: '/warehouses/areas',
    initialFilters: { warehouseId: '', zoneId: '' },
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const productsQuery = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 100 } })).data,
  });

  const [modalState, setModalState] = useState({ open: false, editing: null, initial: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [guardError, setGuardError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editing
        ? apiClient.put(`/warehouses/${modalState.editing.warehouseId}/zones/${modalState.editing.zoneId}/areas/${modalState.editing._id}`, payload)
        : apiClient.post(`/warehouses/${payload.warehouseId}/zones/${payload.zoneId}/areas`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-areas'] });
      addToast({ type: 'success', message: modalState.editing ? 'Area updated.' : 'Floor/Rack area created.' });
      setModalState({ open: false, editing: null, initial: null, key: 0 });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save area.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (row) =>
      apiClient.delete(`/warehouses/${row.warehouseId}/zones/${row.zoneId}/areas/${row._id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-areas'] });
      addToast({ type: 'success', message: 'Area deleted.' });
      setDeleteTarget(null);
      setGuardError('');
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Zero-quantity guard blocked deletion: transfer stock out first.';
      setGuardError(msg);
      addToast({ type: 'warning', message: msg });
    },
  });

  const openCreate = () => {
    setModalState((p) => ({
      open: true,
      editing: null,
      initial: buildEmptyArea(warehousesQuery.data?.[0]),
      key: p.key + 1,
    }));
  };

  const openEdit = (row) => {
    setModalState((p) => ({
      open: true,
      editing: row,
      key: p.key + 1,
      initial: {
        ...buildEmptyArea(),
        ...row,
        allowedProducts: (row.allowedProducts || []).map((ap) => ({
          productId: ap.productId?._id || ap.productId,
          minQtyPacking: ap.minQtyPacking || 0,
          maxQtyPacking: ap.maxQtyPacking || 0,
        })),
      },
    }));
  };

  const columns = [
    { key: 'areaCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.areaCode}</span> },
    { key: 'areaName', header: 'Area / Floor / Rack', mobilePrimary: true, accessor: 'areaName' },
    { key: 'warehouseName', header: 'Warehouse', accessor: 'warehouseName' },
    { key: 'zoneName', header: 'Zone', accessor: 'zoneName' },
    { key: 'areaType', header: 'Type', accessor: 'areaType' },
    { key: 'storagePurpose', header: 'Purpose', mobileBadge: true, render: (r) => <StatusBadge status={r.storagePurpose} /> },
    { key: 'allowed', header: 'Allowed SKUs', numeric: true, accessor: (r) => r.allowedProducts?.length || 0 },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Floor, Rack & Storage Areas"
        subtitle="Assign allowed products (Min/Max packing limits) with zero-quantity deletion guard"
        actions={
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold">
            <Plus className="w-4 h-4" />
            <span>Add Floor / Rack</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search area code, rack, floor..."
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
        emptyIcon={MapPin}
        emptyTitle="No floor or rack areas configured"
        emptyDescription="Define physical storage bays inside a warehouse zone before receiving stock."
        emptyActionLabel="Add Floor / Rack"
        onEmptyAction={openCreate}
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

      {modalState.open && (
        <AreaFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editing)}
          warehouses={warehousesQuery.data || []}
          products={productsQuery.data || []}
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
        title="Delete storage area?"
        message={guardError || `Delete ${deleteTarget?.areaName || 'this area'}? Stock quantity must be 0 first.`}
        secondaryAction={
          guardError
            ? {
                label: 'Go to Create Movement',
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
