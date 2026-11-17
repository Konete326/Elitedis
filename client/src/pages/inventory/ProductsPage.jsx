import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Edit, Package, Plus, Printer, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import {
  ConfirmModal,
  FilterToolbar,
  MetricCard,
  PrintPreviewModal,
  SmartDataTable,
} from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import ProductFormModal, { buildEmptyProduct } from './ProductFormModal';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'products',
    endpoint: '/inventory/products',
    initialFilters: { companyId: '', brandId: '', categoryId: '', status: '' },
  });

  const fetchOpts = (path) => async () => extractListPayload(await apiClient.get(path, { params: { limit: 100 } })).data;
  const companiesQuery = useQuery({ queryKey: ['companies-options'], queryFn: fetchOpts('/inventory/companies') });
  const brandsQuery = useQuery({ queryKey: ['brands-options'], queryFn: fetchOpts('/inventory/brands') });
  const categoriesQuery = useQuery({ queryKey: ['categories-options'], queryFn: fetchOpts('/inventory/categories') });
  const subCategoriesQuery = useQuery({ queryKey: ['sub-categories-options'], queryFn: fetchOpts('/inventory/sub-categories') });

  const [modalState, setModalState] = useState({ open: false, initial: null, editingId: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editingId
        ? apiClient.put(`/inventory/products/${modalState.editingId}`, payload)
        : apiClient.post('/inventory/products', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast({ type: 'success', message: modalState.editingId ? 'Product updated.' : 'Product created.' });
      setModalState({ open: false, initial: null, editingId: null, key: 0 });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save product.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/inventory/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast({ type: 'success', message: 'Product deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete blocked.' });
      setDeleteTarget(null);
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (status) =>
      apiClient.post('/inventory/products/bulk-rules', {
        productIds: table.selectedKeys,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast({ type: 'success', message: 'Bulk product rule updated.' });
      table.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Bulk update failed.' });
    },
  });

  const openCreate = () => {
    setModalState((prev) => ({
      open: true,
      initial: buildEmptyProduct(),
      editingId: null,
      key: prev.key + 1,
    }));
  };

  const openEdit = (row) => {
    setModalState((prev) => ({
      open: true,
      editingId: row._id,
      key: prev.key + 1,
      initial: {
        ...buildEmptyProduct(),
        ...row,
        companyId: row.companyId?._id || row.companyId || '',
        brandId: row.brandId?._id || row.brandId || '',
        categoryId: row.categoryId?._id || row.categoryId || '',
        subCategoryId: row.subCategoryId?._id || row.subCategoryId || '',
        packingUnits: row.packingUnits?.length ? row.packingUnits : buildEmptyProduct().packingUnits,
      },
    }));
  };

  const columns = [
    { key: 'skuCode', header: 'SKU', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.skuCode}</span> },
    {
      key: 'productName',
      header: 'Product',
      mobilePrimary: true,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {r.baseUnit?.image?.url ? (
            <img src={r.baseUnit.image.url} alt={r.productName} className="w-8 h-8 rounded-lg object-cover border shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate">{r.productName}</p>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {r.brandId?.brandName || '—'} · {r.categoryId?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'pack',
      header: 'Pack Ratio',
      numeric: true,
      accessor: (r) => {
        const p = r.packingUnits?.[0];
        return p ? `1 ${p.unitName} = ${p.conversionQty} ${r.baseUnit?.unitName || 'Pcs'}` : r.baseUnit?.unitName || '—';
      },
    },
    {
      key: 'traderRate',
      header: 'Purchase',
      numeric: true,
      align: 'right',
      accessor: (r) => formatCurrency(r.packingUnits?.[0]?.traderPurchaseRate || r.baseUnit?.traderPurchaseRate || 0),
    },
    {
      key: 'wholesaleRate',
      header: 'Wholesale',
      numeric: true,
      align: 'right',
      accessor: (r) => formatCurrency(r.packingUnits?.[0]?.wholesaleSaleRate || r.baseUnit?.wholesaleSaleRate || 0),
    },
    {
      key: 'retailRate',
      header: 'Retail POS',
      numeric: true,
      align: 'right',
      accessor: (r) => formatCurrency(r.packingUnits?.[0]?.posRetailEndRate || r.baseUnit?.posRetailEndRate || 0),
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const companies = companiesQuery.data || [];
  const brands = brandsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const missingPrereqs =
    !companiesQuery.isLoading && !brandsQuery.isLoading && !categoriesQuery.isLoading && (!companies.length || !brands.length || !categories.length);

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Product Master Catalog"
        subtitle="Static SKU catalog separated from warehouse stock batches"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Rate List</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </>
        }
      />

      {missingPrereqs && (
        <SetupGuideBanner
          missingMessage="Set up at least one Company, Brand, and Category before creating Products."
          steps={[
            { label: 'Company', done: companies.length > 0, to: '/inventory/companies', actionLabel: 'Companies' },
            { label: 'Brand', done: brands.length > 0, to: '/inventory/brands', actionLabel: 'Brands' },
            { label: 'Category', done: categories.length > 0, to: '/inventory/categories', actionLabel: 'Categories' },
          ]}
        />
      )}

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Products" value={table.pagination.totalRecords} icon={Package} status="primary" />
        <MetricCard title="Active SKUs" value={table.rows.filter((p) => p.status === 'ACTIVE').length} status="success" />
        <MetricCard title="Brands Represented" value={brands.length} status="info" />
        <MetricCard title="Selected Rows" value={table.selectedKeys.length} icon={CheckSquare} status="default" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search SKU, barcode, or product..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        columns={columns}
        visibleColumns={table.visibleColumns}
        onToggleColumn={(k) => table.toggleColumn(k, columns)}
        onResetColumns={table.resetColumns}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        selectedCount={table.selectedKeys.length}
        filters={[
          {
            key: 'companyId',
            label: 'Company',
            value: table.filters.companyId,
            onChange: (val) => table.setFilter('companyId', val),
            options: (companiesQuery.data || []).map((c) => ({ value: c._id, label: c.companyName })),
          },
          {
            key: 'brandId',
            label: 'Brand',
            value: table.filters.brandId,
            onChange: (val) => table.setFilter('brandId', val),
            options: (brandsQuery.data || []).map((b) => ({ value: b._id, label: b.brandName })),
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'INACTIVE'],
          },
        ]}
        actions={
          table.selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => bulkStatusMutation.mutate('ACTIVE')}
              className="h-9 px-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-semibold"
            >
              Mark Active ({table.selectedKeys.length})
            </button>
          )
        }
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        visibleColumns={table.visibleColumns}
        selectable
        selectedKeys={table.selectedKeys}
        onSelectionChange={table.setSelectedKeys}
        sortBy={table.sortBy}
        sortOrder={table.sortOrder}
        onSort={table.handleSort}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyTitle="No products in catalog"
        emptyDescription="Add your first product with base/packing conversion and 3-tier rates."
        emptyActionLabel="Add Product"
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

      {modalState.open && (
        <ProductFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editingId)}
          existingCount={table.pagination.totalRecords}
          existingCodes={table.rows.map((r) => r.skuCode)}
          companies={companies}
          brands={brands}
          categories={categories}
          subCategories={subCategoriesQuery.data || []}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Product Wholesale & Retail Rate List"
        documentType="Rate List"
        columns={[
          { key: 'skuCode', header: 'SKU', numeric: true },
          { key: 'productName', header: 'Product Name' },
          { key: 'wholesale', header: 'Wholesale Rate', numeric: true, accessor: (r) => r.packingUnits?.[0]?.wholesaleSaleRate || r.baseUnit?.wholesaleSaleRate || 0 },
          { key: 'retail', header: 'POS End Rate', numeric: true, accessor: (r) => r.packingUnits?.[0]?.posRetailEndRate || r.baseUnit?.posRetailEndRate || 0 },
        ]}
        rows={table.rows}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete product?"
        message={`Delete ${deleteTarget?.productName || 'this SKU'}? Products with active stock batches cannot be removed.`}
      />
    </div>
  );
}
