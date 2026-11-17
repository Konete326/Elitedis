import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Tag, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import {
  ConfirmModal,
  FilterToolbar,
  FormModal,
  ImageDropzone,
  MetricCard,
  SmartDataTable,
} from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

const INITIAL_FORM = {
  brandCode: '',
  brandName: '',
  companyId: '',
  brandType: 'Personal Care',
  ownerName: '',
  brandManager: '',
  salesManager: '',
  description: '',
  status: 'ACTIVE',
  logo: null,
  coverImage: null,
};

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'brands',
    endpoint: '/inventory/brands',
    initialFilters: { companyId: '', status: '' },
  });

  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId ? apiClient.put(`/inventory/brands/${editingId}`, payload) : apiClient.post('/inventory/brands', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      addToast({ type: 'success', message: editingId ? 'Brand updated.' : 'Brand created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save brand.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/inventory/brands/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      addToast({ type: 'success', message: 'Brand deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete failed.' });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm({
      ...INITIAL_FORM,
      ...row,
      companyId: row.companyId?._id || row.companyId || '',
    });
    setModalOpen(true);
  };

  const columns = [
    { key: 'brandCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.brandCode}</span> },
    {
      key: 'brandName',
      header: 'Brand Name',
      mobilePrimary: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          {r.logo?.url ? (
            <img src={r.logo.url} alt={r.brandName} className="w-8 h-8 rounded-lg object-cover border shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate">{r.brandName}</p>
            <p className="text-[11px] text-[var(--text-muted)] truncate">{r.brandType || 'FMCG'}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Parent Company', accessor: (r) => r.companyId?.companyName || '—' },
    { key: 'brandManager', header: 'Brand Manager', accessor: (r) => r.brandManager || '—' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Brands Master"
        subtitle="Manage manufacturer brands, cover visuals, and brand managers"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Brand</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Brands" value={table.pagination.totalRecords} icon={Tag} status="primary" />
        <MetricCard title="Active Brands" value={table.rows.filter((b) => b.status === 'ACTIVE').length} status="success" />
        <MetricCard title="Linked Companies" value={companiesQuery.data?.length || 0} status="info" />
        <MetricCard title="Inactive Brands" value={table.rows.filter((b) => b.status === 'INACTIVE').length} status="default" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search brand code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'companyId',
            label: 'Company',
            value: table.filters.companyId,
            onChange: (val) => table.setFilter('companyId', val),
            options: (companiesQuery.data || []).map((c) => ({ value: c._id, label: c.companyName })),
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
        emptyTitle="No brands configured"
        emptyDescription="Add a brand under an existing company before adding categories and products."
        emptyActionLabel="Add First Brand"
        onEmptyAction={openCreate}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => openEdit(row)} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1">
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button type="button" onClick={() => setDeleteTarget(row)} className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Brand' : 'New Brand'}
        size="lg"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand Code</label>
              <input
                required
                value={form.brandCode}
                onChange={(e) => setForm((p) => ({ ...p, brandCode: e.target.value.toUpperCase() }))}
                placeholder="S-01"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand Name</label>
              <input
                required
                value={form.brandName}
                onChange={(e) => setForm((p) => ({ ...p, brandName: e.target.value }))}
                placeholder="SURAJ"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Parent Company</label>
              <select
                required
                value={form.companyId}
                onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select company...</option>
                {(companiesQuery.data || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand Type</label>
              <input
                value={form.brandType}
                onChange={(e) => setForm((p) => ({ ...p, brandType: e.target.value }))}
                placeholder="Personal Care / Detergent"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand Manager</label>
              <input
                value={form.brandManager}
                onChange={(e) => setForm((p) => ({ ...p, brandManager: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ImageDropzone label="Brand Logo" folder="brands" value={form.logo} onChange={(logo) => setForm((p) => ({ ...p, logo }))} />
            <ImageDropzone label="Cover Image" folder="brands" value={form.coverImage} onChange={(coverImage) => setForm((p) => ({ ...p, coverImage }))} />
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete brand?"
        message={`Delete ${deleteTarget?.brandName || 'this brand'}? Brands with linked products cannot be deleted.`}
        confirmLabel="Delete Brand"
      />
    </div>
  );
}
