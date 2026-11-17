import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Printer, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';

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
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'print-templates',
    endpoint: '/rules/templates',
    initialFilters: { documentType: '' },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? apiClient.put(`/rules/templates/${editingId}`, payload)
        : apiClient.post('/rules/templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      addToast({ type: 'success', message: editingId ? 'Print template updated.' : 'Print template saved.' });
      setModalOpen(false);
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
            <span>Add Template</span>
          </button>
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
          {
            key: 'documentType',
            label: 'Document Type',
            value: table.filters.documentType,
            onChange: (val) => table.setFilter('documentType', val),
            options: DOC_TYPES,
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
        emptyIcon={Printer}
        emptyTitle="No print templates added yet"
        emptyDescription="Create A4, Landscape, and 80mm POS receipt styles for bills and dispatch sheets."
        emptyActionLabel="Create Template"
        onEmptyAction={() => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setModalOpen(true);
        }}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => setPreviewTarget(row)} className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]" title="Preview Layout">
              <Printer className="w-3.5 h-3.5" />
            </button>
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
            <button type="button" onClick={() => setDeleteTarget(row)} className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Print Template' : 'New Print Template'}
        size="lg"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Template Name</label>
            <input
              required
              value={form.templateName}
              onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))}
              placeholder="Standard Chillan + Finance"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Document Type</label>
            <select value={form.documentType} onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Paper Layout</label>
            <select value={form.layoutType} onChange={(e) => setForm((p) => ({ ...p, layoutType: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="A4_PORTRAIT">A4 Portrait</option>
              <option value="A4_LANDSCAPE">A4 Landscape</option>
              <option value="THERMAL_80MM">Thermal 80mm POS</option>
              <option value="THERMAL_58MM">Thermal 58mm</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Header Company Title</label>
            <input
              value={form.headerConfig?.companyTitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, headerConfig: { ...p.headerConfig, companyTitle: e.target.value } }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-4 text-xs pt-1">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={form.showUrduLabels} onChange={(e) => setForm((p) => ({ ...p, showUrduLabels: e.target.checked }))} />
              <span>Include Urdu Labels</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
              <span>Set as Default for Document Type</span>
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
