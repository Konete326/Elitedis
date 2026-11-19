import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Edit, Layers, Plus, Trash2 } from 'lucide-react';
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
  companyId: '',
  linkedBrandIds: [],
  description: '',
  status: 'ACTIVE',
  image: null,
};

export default function CategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'categories',
    endpoint: '/inventory/categories',
    initialFilters: { companyId: '', status: '' },
  });

  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });

  const brandsQuery = useQuery({
    queryKey: ['brands-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/brands', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [companyAutoHint, setCompanyAutoHint] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const companies = companiesQuery.data || [];
  const brands = brandsQuery.data || [];
  const getId = (ref) => (ref && typeof ref === 'object' ? String(ref._id || '') : String(ref || ''));

  const visibleBrands = useMemo(() => {
    if (!form.companyId) return brands;
    const matched = brands.filter((b) => getId(b.companyId) === String(form.companyId));
    const extras = brands.filter(
      (b) => getId(b.companyId) !== String(form.companyId) && (!b.companyId || form.linkedBrandIds.includes(b._id))
    );
    return [...matched, ...extras];
  }, [brands, form.companyId, form.linkedBrandIds]);

  const codeError = touched.code ? validateField('code', form.code, { required: true, label: 'Category Code' }) : '';
  const nameError = touched.name ? validateField('required', form.name, { required: true, minLength: 2, label: 'Category Name' }) : '';

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const clean = { ...payload, companyId: payload.companyId || null };
      return editingId
        ? apiClient.put(`/inventory/categories/${editingId}`, clean)
        : apiClient.post('/inventory/categories', clean);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-options'] });
      addToast({ type: 'success', message: editingId ? 'Category updated.' : 'Category created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save category.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/inventory/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-options'] });
      addToast({ type: 'success', message: 'Category deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete blocked.' });
      setDeleteTarget(null);
    },
  });

  const toggleBrand = (brandId) => {
    const exists = form.linkedBrandIds.includes(brandId);
    const nextBrands = exists ? form.linkedBrandIds.filter((id) => id !== brandId) : [...form.linkedBrandIds, brandId];
    let nextCompanyId = form.companyId;
    let nextAutoHint = companyAutoHint;
    if (!exists) {
      const selectedCompIds = [...new Set(nextBrands.map((id) => getId(brands.find((b) => b._id === id)?.companyId)).filter(Boolean))];
      const clickedCompId = getId(brands.find((b) => b._id === brandId)?.companyId);
      if (!form.companyId && (clickedCompId || selectedCompIds.length === 1)) {
        nextCompanyId = clickedCompId || selectedCompIds[0];
        nextAutoHint = true;
      } else if (selectedCompIds.length === 1 && nextAutoHint) {
        nextCompanyId = selectedCompIds[0];
      }
    }
    setCompanyAutoHint(nextAutoHint);
    setForm((prev) => ({ ...prev, linkedBrandIds: nextBrands, companyId: nextCompanyId }));
  };

  const handleCompanyChange = (nextCompanyId) => {
    setCompanyAutoHint(false);
    const matchedBrands = nextCompanyId ? brands.filter((b) => getId(b.companyId) === String(nextCompanyId)) : [];
    setForm((prev) => ({ ...prev, companyId: nextCompanyId, linkedBrandIds: nextCompanyId && matchedBrands.length === 1 ? [matchedBrands[0]._id] : prev.linkedBrandIds }));
  };

  const openCreate = () => {
    let defaultCompanyId = table.filters.companyId || (companies.length === 1 ? companies[0]._id : '');
    const companyBrands = defaultCompanyId ? brands.filter((b) => getId(b.companyId) === String(defaultCompanyId)) : brands;
    const defaultBrands = companyBrands.length === 1 ? [companyBrands[0]._id] : brands.length === 1 ? [brands[0]._id] : [];
    let autoFromBrand = false;
    if (!defaultCompanyId && defaultBrands.length === 1) {
      const brandCompId = getId(brands.find((b) => b._id === defaultBrands[0])?.companyId);
      if (brandCompId) {
        defaultCompanyId = brandCompId;
        autoFromBrand = true;
      }
    }
    setEditingId(null);
    setTouched({});
    setCompanyAutoHint(autoFromBrand);
    setForm({ ...INITIAL_FORM, code: suggestCode('CAT', table.pagination.totalRecords, table.rows.map((r) => r.code)), companyId: defaultCompanyId, linkedBrandIds: defaultBrands });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setTouched({});
    setCompanyAutoHint(false);
    setForm({
      ...INITIAL_FORM,
      ...row,
      companyId: row.companyId?._id || row.companyId || '',
      linkedBrandIds: (row.linkedBrandIds || []).map((b) => b?._id || b),
    });
    setModalOpen(true);
  };

  const columns = [
    { key: 'code', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: 'name', header: 'Category Name', mobilePrimary: true, accessor: 'name' },
    { key: 'company', header: 'Company', accessor: (r) => r.companyId?.companyName || '—' },
    {
      key: 'brands',
      header: 'Linked Brands',
      accessor: (r) => (r.linkedBrandIds || []).map((b) => b.brandName || b).join(', ') || '—',
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Categories Master"
        subtitle="Organize product groups and linked brand catalogs"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/inventory/sub-categories')}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <span>Go to Sub-Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </>
        }
      />

      {(companies.length === 0 || brands.length === 0) && (
        <SetupGuideBanner
          isLoading={companiesQuery.isLoading || brandsQuery.isLoading}
          isOptional
          title="Optional Catalog Grouping"
          missingMessage="Categories work standalone, or you can optionally link Companies and Brands for deeper filtering."
          steps={[
            { label: 'Company / Supplier (Optional)', done: companies.length > 0, to: '/inventory/companies', actionLabel: 'Companies' },
            { label: 'Brand (Optional)', done: brands.length > 0, to: '/inventory/brands', actionLabel: 'Brands' },
          ]}
        />
      )}

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search category code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          { key: 'companyId', label: 'Company', value: table.filters.companyId, onChange: (val) => table.setFilter('companyId', val), options: companies.map((c) => ({ value: c._id, label: c.companyName })) },
          { key: 'status', label: 'Status', value: table.filters.status, onChange: (val) => table.setFilter('status', val), options: ['ACTIVE', 'INACTIVE'] },
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
        emptyTitle="No categories found"
        emptyDescription="Create categories like Detergent, Shampoo, or Dish Wash to group products."
        emptyActionLabel="Add Category"
        onEmptyAction={openCreate}
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => navigate(`/inventory/sub-categories?parentCategoryId=${row._id}`)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]/50 text-[var(--accent-primary)] text-xs font-semibold hover:bg-[var(--accent-soft)] inline-flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sub-Categories</span>
            </button>
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
        title={editingId ? 'Edit Category' : 'New Category'}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ code: true, name: true });
          if (validateField('code', form.code, { required: true, label: 'Category Code' }) || validateField('required', form.name, { required: true, minLength: 2, label: 'Category Name' })) return;
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Category Code <span className="text-[var(--status-danger)]">*</span></label>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, code: suggestCode('CAT', table.pagination.totalRecords, table.rows.map((r) => r.code)) }))}
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
                placeholder="CAT-001"
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${codeError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {codeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{codeError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Category Name <span className="text-[var(--status-danger)]">*</span></label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                placeholder="Shampoo"
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
              />
              {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Company <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
                {companyAutoHint && form.companyId && (
                  <span className="text-[11px] font-medium text-[var(--accent-primary)]">Auto-selected from Brand</span>
                )}
              </div>
              <select
                value={form.companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">All / Optional</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName}
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

          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Linked Brands <span className="text-[var(--text-muted)] font-normal">(Optional)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {visibleBrands.map((b) => {
                const selected = form.linkedBrandIds.includes(b._id);
                return (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => toggleBrand(b._id)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                      selected
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {b.brandName}
                  </button>
                );
              })}
            </div>
          </div>

          <ImageDropzone label="Category Image" folder="categories" value={form.image} onChange={(image) => setForm((p) => ({ ...p, image }))} />
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete category?"
        message={`Delete ${deleteTarget?.name || 'this category'}? Linked sub-categories or products must be moved first.`}
      />
    </div>
  );
}
