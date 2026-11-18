import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Layers, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, ImageDropzone, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';
import { suggestCode, validateField } from '../../utils/validation';

const INITIAL_FORM = {
  code: '',
  name: '',
  parentCategoryId: '',
  companyId: '',
  description: '',
  status: 'ACTIVE',
  image: null,
};

export default function SubCategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'sub-categories',
    endpoint: '/inventory/sub-categories',
    initialFilters: { parentCategoryId: '', status: '' },
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/categories', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const codeError = touched.code ? validateField('code', form.code, { required: true, label: 'Sub-Category Code' }) : '';
  const nameError = touched.name ? validateField('required', form.name, { required: true, minLength: 2, label: 'Sub-Category Name' }) : '';

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const clean = { ...payload, companyId: payload.companyId || null };
      return editingId
        ? apiClient.put(`/inventory/sub-categories/${editingId}`, clean)
        : apiClient.post('/inventory/sub-categories', clean);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      queryClient.invalidateQueries({ queryKey: ['sub-categories-options'] });
      addToast({ type: 'success', message: editingId ? 'Sub-category updated.' : 'Sub-category created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save sub-category.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/inventory/sub-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      queryClient.invalidateQueries({ queryKey: ['sub-categories-options'] });
      addToast({ type: 'success', message: 'Sub-category deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete blocked.' });
      setDeleteTarget(null);
    },
  });

  const categories = categoriesQuery.data || [];

  const openCreate = () => {
    const defaultParentId = table.filters.parentCategoryId || categories[0]?._id || '';
    const parentCat = categories.find((c) => String(c._id) === String(defaultParentId));
    const inheritedCompanyId = String(parentCat?.companyId?._id || parentCat?.companyId || '');
    setEditingId(null);
    setTouched({});
    setForm({
      ...INITIAL_FORM,
      code: suggestCode('SUB', table.pagination.totalRecords, table.rows.map((r) => r.code)),
      parentCategoryId: defaultParentId,
      companyId: inheritedCompanyId,
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setTouched({});
    setForm({
      ...INITIAL_FORM,
      ...row,
      parentCategoryId: row.parentCategoryId?._id || row.parentCategoryId || '',
      companyId: row.companyId?._id || row.companyId || '',
    });
    setModalOpen(true);
  };

  const columns = [
    { key: 'code', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: 'name', header: 'Sub-Category Name', mobilePrimary: true, accessor: 'name' },
    { key: 'parentCategory', header: 'Parent Category', accessor: (r) => r.parentCategoryId?.name || '—' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Sub-Categories Master"
        subtitle="Manage product variants under each parent category"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/inventory/categories')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Categories</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Sub-Category</span>
            </button>
          </>
        }
      />

      {categories.length === 0 && (
        <SetupGuideBanner
          isLoading={categoriesQuery.isLoading}
          missingMessage="Create at least one Parent Category before adding Sub-Categories."
          steps={[{ label: 'Create Category', done: false, to: '/inventory/categories', actionLabel: 'Go to Categories' }]}
        />
      )}

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search sub-category..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'parentCategoryId',
            label: 'Category',
            value: table.filters.parentCategoryId,
            onChange: (val) => table.setFilter('parentCategoryId', val),
            options: (categoriesQuery.data || []).map((c) => ({ value: c._id, label: c.name })),
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
        emptyTitle="No sub-categories found"
        emptyDescription="Add sub-categories like Fresh, White, or Lemon under your parent categories."
        emptyActionLabel="Add Sub-Category"
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
        title={editingId ? 'Edit Sub-Category' : 'New Sub-Category'}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ code: true, name: true });
          if (
            validateField('code', form.code, { required: true, label: 'Sub-Category Code' }) ||
            validateField('required', form.name, { required: true, minLength: 2, label: 'Sub-Category Name' })
          ) {
            return;
          }
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Code <span className="text-[var(--status-danger)]">*</span></label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      code: suggestCode('SUB', table.pagination.totalRecords, table.rows.map((r) => r.code)),
                    }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              </div>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, code: true }))}
                placeholder="SUB-001"
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sub-Category Name <span className="text-[var(--status-danger)]">*</span></label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                placeholder="Fresh"
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Parent Category <span className="text-[var(--status-danger)]">*</span></label>
              <select
                required
                value={form.parentCategoryId}
                onChange={(e) => {
                  const nextParentId = e.target.value;
                  const parentCat = categories.find((c) => String(c._id) === String(nextParentId));
                  const inheritedCompanyId = String(parentCat?.companyId?._id || parentCat?.companyId || '');
                  setForm((p) => ({
                    ...p,
                    parentCategoryId: nextParentId,
                    companyId: inheritedCompanyId,
                  }));
                }}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select parent category...</option>
                {(categoriesQuery.data || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status <span className="text-[var(--status-danger)]">*</span></label>
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
          <ImageDropzone label="Sub-Category Image (Optional)" folder="categories" value={form.image} onChange={(image) => setForm((p) => ({ ...p, image }))} />
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete sub-category?"
        message={`Remove ${deleteTarget?.name || 'this sub-category'}?`}
      />
    </div>
  );
}
