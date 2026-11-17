import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass, Edit, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

const INITIAL_FORM = {
  territoryCode: '',
  territoryName: '',
  territoryType: 'DISTRICT_WISE',
  status: 'ACTIVE',
};

export default function TerritoriesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'territories',
    endpoint: '/crm/territories',
    initialFilters: { territoryType: '', status: '' },
  });

  const areasCheck = useQuery({
    queryKey: ['prereq-areas'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/areas', { params: { limit: 1 } })),
  });
  const routesCheck = useQuery({
    queryKey: ['prereq-routes'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/routes', { params: { limit: 1 } })),
  });
  const customersCheck = useQuery({
    queryKey: ['prereq-customers'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 1 } })),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? apiClient.put(`/crm/territories/${editingId}`, payload)
        : apiClient.post('/crm/territories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['territories-options'] });
      addToast({ type: 'success', message: editingId ? 'Territory updated.' : 'Territory created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save territory.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/crm/territories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['territories-options'] });
      addToast({ type: 'success', message: 'Territory deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not delete territory.' });
      setDeleteTarget(null);
    },
  });

  const prereqReady = !areasCheck.isLoading && !routesCheck.isLoading && !customersCheck.isLoading;
  const hasAreasAndRoutes =
    (areasCheck.data?.pagination?.totalRecords || areasCheck.data?.data?.length || 0) > 0 &&
    (routesCheck.data?.pagination?.totalRecords || routesCheck.data?.data?.length || 0) > 0;
  const hasCustomers =
    (customersCheck.data?.pagination?.totalRecords || customersCheck.data?.data?.length || 0) > 0;

  const columns = [
    { key: 'territoryCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.territoryCode}</span> },
    { key: 'territoryName', header: 'Territory Name', mobilePrimary: true, accessor: 'territoryName' },
    { key: 'territoryType', header: 'Group By', accessor: 'territoryType' },
    { key: 'areasCount', header: 'Areas', numeric: true, accessor: (r) => r.areas?.length || 0 },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Sales Territories"
        subtitle="Divide your market by district, brand, warehouse, or order booker"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(INITIAL_FORM);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Territory</span>
          </button>
        }
      />

      <SetupGuideBanner
        optional
        isLoading={!prereqReady}
        missingMessage="Add your market Areas, Routes, and Customer Shops first so territories can group them properly."
        steps={[
          { label: 'Create Areas & Routes', done: hasAreasAndRoutes, to: '/crm/areas-routes', actionLabel: 'Setup Areas' },
          { label: 'Add Customer Shops', done: hasCustomers, to: '/crm/customers', actionLabel: 'Add Customers' },
        ]}
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by territory code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'territoryType',
            label: 'Type',
            value: table.filters.territoryType,
            onChange: (val) => table.setFilter('territoryType', val),
            options: ['BRAND_WISE', 'WAREHOUSE_WISE', 'DISTRICT_WISE', 'BOOKER_WISE'],
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
        emptyIcon={Compass}
        emptyTitle="No territories configured"
        emptyDescription="Create territories to divide coverage by brand, warehouse, district, or booker."
        emptyActionLabel="Add Territory"
        onEmptyAction={() => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setModalOpen(true);
        }}
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => {
                setEditingId(row._id);
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
              onClick={() => setDeleteTarget(row)}
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
        title={editingId ? 'Edit Territory' : 'New Territory'}
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Territory Code *</label>
            <input
              required
              value={form.territoryCode}
              onChange={(e) => setForm((p) => ({ ...p, territoryCode: e.target.value.toUpperCase() }))}
              placeholder="T-01"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Territory Name *</label>
            <input
              required
              value={form.territoryName}
              onChange={(e) => setForm((p) => ({ ...p, territoryName: e.target.value }))}
              placeholder="ORANGI TOWN"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Territory Type (Optional)</label>
            <select
              value={form.territoryType}
              onChange={(e) => setForm((p) => ({ ...p, territoryType: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="DISTRICT_WISE">District Wise</option>
              <option value="BRAND_WISE">Brand Wise</option>
              <option value="WAREHOUSE_WISE">Warehouse Wise</option>
              <option value="BOOKER_WISE">Booker Wise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status (Optional)</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete territory?"
        message={`Remove ${deleteTarget?.territoryName || 'this territory'}?`}
      />
    </div>
  );
}
