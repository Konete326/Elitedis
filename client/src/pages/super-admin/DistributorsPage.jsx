import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Database, Edit, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import DistributorFormModal, { buildEmptyDistributor } from './DistributorFormModal';

export default function DistributorsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'super-admin-distributors',
    endpoint: '/super-admin/distributors',
    initialFilters: { status: '' },
  });

  const [modalState, setModalState] = useState({ open: false, editingId: null, initial: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editingId
        ? apiClient.put(`/super-admin/distributors/${modalState.editingId}`, payload)
        : apiClient.post('/super-admin/distributors', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-distributors'] });
      addToast({
        type: 'success',
        message: modalState.editingId ? 'Distributor tenant updated.' : 'Distributor tenant & Admin account created.',
      });
      setModalState({ open: false, editingId: null, initial: null, key: 0 });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save distributor tenant.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/super-admin/distributors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-distributors'] });
      addToast({ type: 'success', message: 'Distributor tenant deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not delete distributor.' });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setModalState((p) => ({ open: true, editingId: null, initial: buildEmptyDistributor(), key: p.key + 1 }));
  };

  const openEdit = (row) => {
    const base = buildEmptyDistributor();
    setModalState((p) => ({
      open: true,
      editingId: row._id,
      key: p.key + 1,
      initial: {
        ...base,
        ...row,
        mongodbUri: '',
        adminPassword: '',
        hasCustomUri: Boolean(row.hasCustomUri || row.mongodbUriMasked),
        businessProfile: { ...base.businessProfile, ...(row.businessProfile || {}) },
      },
    }));
  };

  const columns = [
    {
      key: 'distributorId',
      header: 'Tenant ID',
      numeric: true,
      sortable: true,
      render: (r) => <span className="font-mono font-semibold">{r.distributorId}</span>,
    },
    {
      key: 'distributorName',
      header: 'Distributor / Agency',
      mobilePrimary: true,
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)] truncate">{r.distributorName}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{r.ownerName || '—'} · {r.email || '—'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', numeric: true, accessor: (r) => r.phone || '—' },
    {
      key: 'dbMode',
      header: 'Database Mode',
      render: (r) => (
        <StatusBadge
          status={r.hasCustomUri || r.mongodbUriMasked ? 'DEDICATED_URI' : 'CONTROL_PLANE'}
          tone={r.hasCustomUri || r.mongodbUriMasked ? 'info' : 'default'}
        />
      ),
    },
    {
      key: 'onboarding',
      header: 'Branding',
      render: (r) => (
        <StatusBadge
          status={r.onboardingCompleted ? 'COMPLETED' : r.onboardingSkipped ? 'SKIPPED' : 'PENDING'}
          tone={r.onboardingCompleted ? 'success' : 'warning'}
        />
      ),
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const dedicatedCount = table.rows.filter((r) => r.hasCustomUri || r.mongodbUriMasked).length;
  const onboardedCount = table.rows.filter((r) => r.onboardingCompleted).length;

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Distributors & Multi-Tenant Clusters"
        subtitle="Super Admin registry for isolated distributor workspaces, dedicated MongoDB Atlas URIs, and agency branding"
        badge="SUPER ADMIN"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Distributor</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Tenants" value={table.pagination.totalRecords} icon={Building2} status="primary" />
        <MetricCard title="Active Tenants" value={table.rows.filter((r) => r.status === 'ACTIVE').length} icon={ShieldCheck} status="success" />
        <MetricCard title="Dedicated Atlas URIs" value={dedicatedCount} icon={Database} status="info" />
        <MetricCard title="Onboarded Profiles" value={onboardedCount} status="default" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search distributor code, agency name, owner, email..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'SUSPENDED'],
          },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSort={table.handleSort}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={Building2}
        emptyTitle="No distributor tenants registered"
        emptyDescription="Provision a distributor workspace with either shared isolation or a dedicated MongoDB Atlas URI."
        emptyActionLabel="Add Distributor"
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
              onClick={() => setDeleteTarget(row)}
              title="Delete Distributor"
              className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      {modalState.open && (
        <DistributorFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editingId)}
          existingCount={table.pagination.totalRecords}
          existingCodes={table.rows.map((r) => r.distributorId)}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete distributor tenant?"
        message={`Remove ${deleteTarget?.distributorName || 'this distributor'} (${deleteTarget?.distributorId || ''}) from the tenant registry?`}
        confirmLabel="Delete Tenant"
      />
    </div>
  );
}
