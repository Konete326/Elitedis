import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Copy, Edit, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import CompanyFormModal, { buildEmptyCompany } from './CompanyFormModal';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'companies',
    endpoint: '/inventory/companies',
    initialFilters: { status: '', businessType: '' },
  });

  const [modalState, setModalState] = useState({ open: false, editingId: null, initial: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editingId
        ? apiClient.put(`/inventory/companies/${modalState.editingId}`, payload)
        : apiClient.post('/inventory/companies', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      addToast({ type: 'success', message: modalState.editingId ? 'Company updated.' : 'Company created.' });
      setModalState({ open: false, editingId: null, initial: null, key: 0 });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save company.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/inventory/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      addToast({ type: 'success', message: 'Company deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete failed.' });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setModalState((p) => ({ open: true, editingId: null, initial: buildEmptyCompany(), key: p.key + 1 }));
  };

  const openEdit = (row, duplicate = false) => {
    const base = buildEmptyCompany();
    setModalState((p) => ({
      open: true,
      editingId: duplicate ? null : row._id,
      key: p.key + 1,
      initial: {
        ...base,
        ...row,
        companyCode: duplicate ? `${row.companyCode}-COPY` : row.companyCode,
        address: { ...base.address, ...(row.address || {}) },
        contacts: row.contacts?.length ? row.contacts : base.contacts,
        bankAccounts: row.bankAccounts || [],
      },
    }));
  };

  const columns = [
    { key: 'companyCode', header: 'Code', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.companyCode}</span> },
    {
      key: 'companyName',
      header: 'Company',
      mobilePrimary: true,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {r.logo?.url ? (
            <img src={r.logo.url} alt={r.companyName} className="w-8 h-8 rounded-lg object-cover border shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)] truncate">{r.companyName}</p>
            <p className="text-[11px] text-[var(--text-muted)] truncate">{r.businessType}</p>
          </div>
        </div>
      ),
    },
    { key: 'ownerName', header: 'Owner', accessor: (r) => r.ownerName || '—' },
    { key: 'supplierName', header: 'Supplier', accessor: (r) => r.supplierName || '—' },
    { key: 'contact', header: 'Primary Contact', numeric: true, accessor: (r) => r.contacts?.[0]?.contactNo || '—' },
    { key: 'city', header: 'City', accessor: (r) => r.address?.city || '—' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Companies & Suppliers Master"
        subtitle="Manufacturers, importers, contacts, and payment accounts"
        actions={
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold theme-transition">
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Companies" value={table.pagination.totalRecords} icon={Building2} status="primary" />
        <MetricCard title="Active Manufacturers" value={table.rows.filter((r) => r.status === 'ACTIVE').length} subtitle="Current page active" status="success" />
        <MetricCard title="Bank Accounts Linked" value={table.rows.reduce((sum, r) => sum + (r.bankAccounts?.length || 0), 0)} status="info" />
        <MetricCard title="Contact Persons" value={table.rows.reduce((sum, r) => sum + (r.contacts?.length || 0), 0)} status="default" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search company code, name, owner..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        columns={columns}
        visibleColumns={table.visibleColumns}
        onToggleColumn={(k) => table.toggleColumn(k, columns)}
        onResetColumns={table.resetColumns}
        onResetFilters={table.resetFilters}
        filters={[
          { key: 'status', label: 'Status', value: table.filters.status, onChange: (val) => table.setFilter('status', val), options: ['ACTIVE', 'INACTIVE'] },
          { key: 'businessType', label: 'Type', value: table.filters.businessType, onChange: (val) => table.setFilter('businessType', val), options: ['MANUFACTURER', 'IMPORTER', 'DISTRIBUTOR', 'SUPPLIER'] },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        visibleColumns={table.visibleColumns}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSort={table.handleSort}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyTitle="No companies added yet"
        emptyDescription="Create your first manufacturer or supplier profile to start adding brands and products."
        emptyActionLabel="Add First Company"
        onEmptyAction={openCreate}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => openEdit(row)} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1">
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button type="button" onClick={() => openEdit(row, true)} title="Duplicate" className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setDeleteTarget(row)} title="Delete" className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      {modalState.open && (
        <CompanyFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editingId)}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete company?"
        message={`Remove ${deleteTarget?.companyName || 'this company'}? Companies with linked brands or products cannot be deleted.`}
        confirmLabel="Delete Company"
      />
    </div>
  );
}
