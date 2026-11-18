import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Edit, Plus, Printer, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { suggestCode, validateField } from '../../utils/validation';

const DOC_TYPES = [
  'RETAIL_POS',
  'WHOLESALE_POS',
  'NORMAL_INVOICE',
  'LANDSCAPE_INVOICE',
  'CHILLAN_FINANCE',
  'ADVANCE_INVOICE',
  'DELIVERY_DISPATCH',
  'SALESMAN_SHEET',
  'RECOVERY_SHEET',
  'RATE_LIST',
  'CURRENT_STOCK',
];

const INITIAL_FORM = {
  templateCode: '',
  templateName: '',
  documentType: 'NORMAL_INVOICE',
  layoutType: 'A4_PORTRAIT',
  showUrduLabels: false,
  isDefault: false,
  headerConfig: { companyTitle: 'ELITE DIST Agency', subjectLine: 'Distribution Invoice', showLogo: true },
  footerConfig: { signature1Label: 'Prepared By', signature2Label: 'Checked By', signature3Label: 'Receiver Sign', footerNoteLine: '' },
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { addToast, openAgencyProfileModal } = useShell();

  const table = useServerTable({
    queryKey: 'print-templates',
    endpoint: '/rules/templates',
    initialFilters: { documentType: '' },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [previewTarget, setPreviewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const closeModal = () => {
    setModalOpen(false);
    setTouched({});
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setTouched({});
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setEditingId(row._id);
    setForm({ ...INITIAL_FORM, ...row });
    setTouched({});
    setModalOpen(true);
  };

  const errors = {
    templateCode:
      touched.templateCode && form.templateCode.trim()
        ? validateField('code', form.templateCode, { label: 'Template Code' })
        : '',
    templateName: touched.templateName
      ? validateField('required', form.templateName, { required: true, minLength: 2, label: 'Template Name' })
      : '',
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? apiClient.put(`/rules/templates/${editingId}`, payload)
        : apiClient.post('/rules/templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      addToast({ type: 'success', message: editingId ? 'Print template updated.' : 'Print template saved.' });
      closeModal();
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save template.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/rules/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      addToast({ type: 'success', message: 'Print template deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not delete template.' });
      setDeleteTarget(null);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ templateCode: true, templateName: true });
    const invalid =
      (form.templateCode.trim() ? validateField('code', form.templateCode, { label: 'Template Code' }) : '') ||
      validateField('required', form.templateName, { required: true, minLength: 2, label: 'Template Name' });
    if (invalid) return;
    const resolvedCode = form.templateCode.trim()
      ? form.templateCode.trim().toUpperCase()
      : suggestCode(
          'TPL',
          table.pagination?.totalRecords ?? table.rows?.length ?? 0,
          (table.rows || []).map((r) => r.templateCode)
        );
    saveMutation.mutate({
      ...form,
      templateCode: resolvedCode,
      templateName: form.templateName.trim(),
    });
  };

  const columns = [
    { key: 'templateCode', header: 'Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.templateCode}</span> },
    { key: 'templateName', header: 'Template Name', mobilePrimary: true, accessor: 'templateName' },
    { key: 'documentType', header: 'Document', accessor: 'documentType' },
    { key: 'layoutType', header: 'Layout', accessor: 'layoutType' },
    { key: 'lang', header: 'Language', accessor: (r) => (r.showUrduLabels ? 'English + Urdu' : 'English') },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Print Layouts &amp; Templates"
        subtitle="Set up bill headers, signatures, English or Urdu labels, and receipt paper sizes"
        actions={
          <>
            <button
              type="button"
              onClick={() => openAgencyProfileModal?.()}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Edit Agency &amp; Bill Branding</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Template</span>
            </button>
          </>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by template name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          { key: 'documentType', label: 'Document Type', value: table.filters.documentType, onChange: (val) => table.setFilter('documentType', val), options: DOC_TYPES },
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
        emptyIcon={Printer}
        emptyTitle="No print templates added yet"
        emptyDescription="Create A4, Landscape, and 80mm POS receipt styles for bills and dispatch sheets."
        emptyActionLabel="Create Template"
        onEmptyAction={openCreateModal}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => setPreviewTarget(row)} className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]" title="Preview Layout">
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => openEditModal(row)} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1">
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
        onClose={closeModal}
        title={editingId ? 'Edit Print Template' : 'New Print Template'}
        size="lg"
        onSubmit={handleSubmit}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Template Code (Optional)</label>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    templateCode: suggestCode(
                      'TPL',
                      table.pagination?.totalRecords ?? table.rows?.length ?? 0,
                      (table.rows || []).map((r) => r.templateCode)
                    ),
                  }))
                }
                className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Auto Code
              </button>
            </div>
            <input
              value={form.templateCode}
              onChange={(e) => setForm((p) => ({ ...p, templateCode: e.target.value.toUpperCase() }))}
              onBlur={() => setTouched((p) => ({ ...p, templateCode: true }))}
              placeholder="TPL-001 (auto if blank)"
              aria-invalid={Boolean(errors.templateCode)}
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${errors.templateCode ? 'border-[var(--status-danger)]' : ''}`}
            />
            {errors.templateCode && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.templateCode}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Template Name *</label>
            <input
              aria-required="true"
              value={form.templateName}
              onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, templateName: true }))}
              placeholder="Standard Chillan + Finance"
              aria-invalid={Boolean(errors.templateName)}
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${errors.templateName ? 'border-[var(--status-danger)]' : ''}`}
            />
            {errors.templateName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{errors.templateName}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Document Type (Optional)</label>
            <select value={form.documentType} onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Paper Layout (Optional)</label>
            <select value={form.layoutType} onChange={(e) => setForm((p) => ({ ...p, layoutType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="A4_PORTRAIT">A4 Portrait</option>
              <option value="A4_LANDSCAPE">A4 Landscape</option>
              <option value="THERMAL_80MM">Thermal 80mm POS</option>
              <option value="THERMAL_58MM">Thermal 58mm</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Header Company Title (Optional)</label>
            <input
              value={form.headerConfig?.companyTitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, headerConfig: { ...p.headerConfig, companyTitle: e.target.value } }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-xs pt-1">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={form.showUrduLabels} onChange={(e) => setForm((p) => ({ ...p, showUrduLabels: e.target.checked }))} />
              <span>Include Urdu Labels (Optional)</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
              <span>Set as Default for Document Type (Optional)</span>
            </label>
          </div>
        </div>
      </FormModal>

      <PrintPreviewModal
        isOpen={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.templateName || 'Template Preview'}
        documentType={previewTarget?.documentType || 'Template'}
        templateConfig={previewTarget?.headerConfig}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete template?"
        message={`Delete ${deleteTarget?.templateName || 'this template'}?`}
      />
    </div>
  );
}
