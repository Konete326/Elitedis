import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

const CATEGORIES = [
  { id: 'TAX', label: 'Tax Groups', slug: 'taxes' },
  { id: 'DISCOUNT', label: 'Discount Groups', slug: 'discounts' },
  { id: 'CHARGE', label: 'Charge Groups', slug: 'charges' },
  { id: 'SCHEME', label: 'Free Schemes', slug: 'schemes' },
];

const INITIAL_FORM = {
  ruleName: '',
  level: 'PRODUCT_LEVEL',
  calculationMode: 'GENERAL_FLAT',
  compareBasis: 'NONE',
  thresholdValue: 0,
  benefitValue: 0,
  status: 'ACTIVE',
  timeline: { isAllTime: true, startDate: '', endDate: '' },
  schemeDetails: { paidProductId: '', paidQty: 10, freeProductId: '', freeQty: 1 },
};

export default function RulesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();
  const [category, setCategory] = useState('DISCOUNT');

  const activeCat = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  const table = useServerTable({
    queryKey: `rules-${category}`,
    endpoint: `/rules/${activeCat.slug}`,
    initialFilters: { level: '', status: '' },
  });

  const productsQuery = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? apiClient.put(`/rules/${activeCat.slug}/${editingId}`, payload)
        : apiClient.post(`/rules/${activeCat.slug}`, { ...payload, ruleCategory: category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`rules-${category}`] });
      addToast({ type: 'success', message: editingId ? 'Rule updated.' : 'Commercial rule saved.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save rule.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/rules/${activeCat.slug}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`rules-${category}`] });
      addToast({ type: 'success', message: 'Rule deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not delete rule.' });
      setDeleteTarget(null);
    },
  });

  const columns = [
    { key: 'ruleName', header: 'Rule Name', mobilePrimary: true, accessor: 'ruleName' },
    { key: 'level', header: 'Level', accessor: 'level' },
    { key: 'calculationMode', header: 'Mode', accessor: 'calculationMode' },
    { key: 'compareBasis', header: 'Basis', accessor: 'compareBasis' },
    { key: 'thresholdValue', header: 'Threshold', numeric: true, accessor: 'thresholdValue' },
    { key: 'benefitValue', header: 'Benefit', numeric: true, accessor: 'benefitValue' },
    {
      key: 'status',
      header: 'Status',
      mobileBadge: true,
      render: (r) => <StatusBadge status={r.effectiveStatus || r.status} />,
    },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Discount, Tax &amp; Offer Rules"
        subtitle="Set up automatic item and whole-bill taxes, discounts, extra charges, and free item offers"
        tabs={CATEGORIES.map((c) => ({
          id: c.id,
          label: c.label,
          active: category === c.id,
          onClick: () => setCategory(c.id),
        }))}
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                ...INITIAL_FORM,
                calculationMode: category === 'SCHEME' ? 'PRODUCT_WISE_SCHEME' : 'GENERAL_FLAT',
              });
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeCat.label.slice(0, -1)}</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by rule name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'level',
            label: 'Applies To',
            value: table.filters.level,
            onChange: (val) => table.setFilter('level', val),
            options: [
              { value: 'PRODUCT_LEVEL', label: 'Per Product' },
              { value: 'GRAND_LEVEL', label: 'Whole Bill' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'EXPIRED', 'INACTIVE'],
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
        emptyIcon={SlidersHorizontal}
        emptyTitle={`No ${activeCat.label.toLowerCase()} added yet`}
        emptyDescription="Create rules to apply discounts, charges, tax, or free bonus products automatically on orders."
        emptyActionLabel="Create Rule"
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
                setForm({
                  ...INITIAL_FORM,
                  ...row,
                  schemeDetails: {
                    ...INITIAL_FORM.schemeDetails,
                    ...(row.schemeDetails || {}),
                    paidProductId: row.schemeDetails?.paidProductId?._id || row.schemeDetails?.paidProductId || '',
                    freeProductId: row.schemeDetails?.freeProductId?._id || row.schemeDetails?.freeProductId || '',
                  },
                });
                setModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
            >
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
        title={editingId ? `Edit ${category} Rule` : `New ${category} Rule`}
        size="lg"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Rule Name *</label>
            <input
              required
              value={form.ruleName}
              onChange={(e) => setForm((p) => ({ ...p, ruleName: e.target.value }))}
              placeholder="e.g. 50KG per Rs500 Off or 10 Per 1 Free"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Applies To (Optional)</label>
            <select value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="PRODUCT_LEVEL">Per Product (Item Level)</option>
              <option value="GRAND_LEVEL">Whole Bill (Grand Level)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Calculation Mode (Optional)</label>
            <select value={form.calculationMode} onChange={(e) => setForm((p) => ({ ...p, calculationMode: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="GENERAL_FLAT">General Flat</option>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="SLAB_GENERAL">Slab General</option>
              <option value="FIX_GENERAL">Fix General</option>
              <option value="FIX_PERCENT">Fix %</option>
              <option value="PRODUCT_WISE_SCHEME">Product Wise Scheme</option>
              <option value="SLAB_SCHEME">Slab Scheme</option>
              <option value="TARGET_SCHEME">Target Scheme</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Compare Basis (Optional)</label>
            <select value={form.compareBasis} onChange={(e) => setForm((p) => ({ ...p, compareBasis: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="NONE">None</option>
              <option value="RATE">Rate</option>
              <option value="QUANTITY">Quantity</option>
              <option value="WEIGHT_KG">Weight (KG)</option>
              <option value="AMOUNT_PKR">Amount (PKR)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Threshold Value (Optional)</label>
            <input type="number" value={form.thresholdValue} onChange={(e) => setForm((p) => ({ ...p, thresholdValue: Number(e.target.value) }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Benefit Value (PKR / % / Free Qty) (Optional)</label>
            <input type="number" step="0.01" value={form.benefitValue} onChange={(e) => setForm((p) => ({ ...p, benefitValue: Number(e.target.value) }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status (Optional)</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {category === 'SCHEME' && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2.5 rounded-xl border p-3 bg-[var(--bg-canvas)]">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Paid Product (Optional)</label>
                <select
                  value={form.schemeDetails?.paidProductId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, schemeDetails: { ...p.schemeDetails, paidProductId: e.target.value } }))}
                  className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs"
                >
                  <option value="">Any / Select...</option>
                  {(productsQuery.data || []).map((pr) => (
                    <option key={pr._id} value={pr._id}>
                      {pr.productName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Free Product (Optional)</label>
                <select
                  value={form.schemeDetails?.freeProductId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, schemeDetails: { ...p.schemeDetails, freeProductId: e.target.value } }))}
                  className="w-full h-8 px-2 rounded-lg border bg-[var(--bg-surface)] text-xs"
                >
                  <option value="">Same / Select...</option>
                  {(productsQuery.data || []).map((pr) => (
                    <option key={pr._id} value={pr._id}>
                      {pr.productName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete commercial rule?"
        message={`Delete rule "${deleteTarget?.ruleName || ''}"?`}
      />
    </div>
  );
}
