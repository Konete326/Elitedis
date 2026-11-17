import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Edit, Plus, Printer, Trash2, Users } from 'lucide-react';
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
import StatusBadge from '../../components/shared/StatusBadge';
import CustomerFormModal, { buildEmptyCustomer } from './CustomerFormModal';
import { formatCurrency } from '../../utils/formatters';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'customers',
    endpoint: '/crm/customers',
    initialFilters: { customerType: '', paymentCondition: '', status: '' },
  });

  const [modalState, setModalState] = useState({ open: false, initial: null, editingId: null, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [idCardTarget, setIdCardTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editingId
        ? apiClient.put(`/crm/customers/${modalState.editingId}`, payload)
        : apiClient.post('/crm/customers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      addToast({ type: 'success', message: modalState.editingId ? 'Customer updated.' : 'Customer added.' });
      setModalState({ open: false, initial: null, editingId: null, key: 0 });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save customer.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/crm/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      addToast({ type: 'success', message: 'Customer deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete blocked.' });
      setDeleteTarget(null);
    },
  });

  const bulkCreditMutation = useMutation({
    mutationFn: (paymentCondition) =>
      apiClient.post('/crm/customers/bulk-rules', {
        customerIds: table.selectedKeys,
        paymentCondition,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      addToast({ type: 'success', message: 'Bulk rule applied to selected customers.' });
      table.setSelectedKeys([]);
    },
  });

  const openCreate = () => {
    setModalState((p) => ({ open: true, initial: buildEmptyCustomer(), editingId: null, key: p.key + 1 }));
  };

  const openEdit = (row) => {
    setModalState((p) => ({
      open: true,
      editingId: row._id,
      key: p.key + 1,
      initial: { ...buildEmptyCustomer(), ...row },
    }));
  };

  const columns = [
    { key: 'customerCode', header: 'Code', numeric: true, sortable: true, render: (r) => <span className="font-mono font-semibold">{r.customerCode}</span> },
    {
      key: 'shopName',
      header: 'Shop / Owner',
      mobilePrimary: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{r.shopName}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{r.ownerName} · {r.ownerContact}</p>
        </div>
      ),
    },
    { key: 'customerType', header: 'Type', accessor: 'customerType' },
    {
      key: 'location',
      header: 'Area / Pehchan',
      render: (r) => (
        <div className="max-w-[200px] truncate" title={r.locationHierarchy?.pehchanRemarks || ''}>
          {r.locationHierarchy?.areaName || r.locationHierarchy?.city || '—'}
        </div>
      ),
    },
    {
      key: 'paymentCondition',
      header: 'Terms',
      render: (r) => <StatusBadge status={r.financialTerms?.paymentCondition || 'PAID_CASH'} />,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      numeric: true,
      align: 'right',
      accessor: (r) => formatCurrency(r.financialTerms?.outstandingBalancePkr || 0),
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Customer Master (CRM)"
        subtitle="Wholesalers, retailers, 7-level geo addresses, Pehchan landmarks, and credit terms"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Total Customers" value={table.pagination.totalRecords} icon={Users} status="primary" />
        <MetricCard
          title="Credit Allowed"
          value={table.rows.filter((c) => c.financialTerms?.paymentCondition === 'ALLOW_CREDIT').length}
          icon={CreditCard}
          status="info"
        />
        <MetricCard
          title="Page Outstanding"
          value={formatCurrency(table.rows.reduce((s, c) => s + (c.financialTerms?.outstandingBalancePkr || 0), 0))}
          status="warning"
        />
        <MetricCard title="Blocked Accounts" value={table.rows.filter((c) => c.status === 'BLOCKED').length} status="danger" />
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search shop, owner, contact, Pehchan..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        columns={columns}
        visibleColumns={table.visibleColumns}
        onToggleColumn={(k) => table.toggleColumn(k, columns)}
        onResetColumns={table.resetColumns}
        onResetFilters={table.resetFilters}
        selectedCount={table.selectedKeys.length}
        filters={[
          {
            key: 'customerType',
            label: 'Type',
            value: table.filters.customerType,
            onChange: (val) => table.setFilter('customerType', val),
            options: ['WHOLESALER', 'RETAILER', 'SUB_DISTRIBUTOR', 'POS_WALKIN'],
          },
          {
            key: 'paymentCondition',
            label: 'Condition',
            value: table.filters.paymentCondition,
            onChange: (val) => table.setFilter('paymentCondition', val),
            options: ['PAID_CASH', 'ALLOW_CREDIT', 'ADVANCE'],
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
          },
        ]}
        actions={
          table.selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => bulkCreditMutation.mutate('ALLOW_CREDIT')}
              className="h-9 px-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-semibold"
            >
              Allow Credit ({table.selectedKeys.length})
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
        emptyTitle="No customers added yet"
        emptyDescription="Register wholesale and retail shops with Pehchan directions and credit limits."
        emptyActionLabel="Add Customer"
        onEmptyAction={openCreate}
        renderActions={(row) => (
          <>
            <button type="button" onClick={() => setIdCardTarget(row)} title="Print ID Card" className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]">
              <Printer className="w-3.5 h-3.5" />
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

      {modalState.open && (
        <CustomerFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          isEditing={Boolean(modalState.editingId)}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

      <PrintPreviewModal
        isOpen={Boolean(idCardTarget)}
        onClose={() => setIdCardTarget(null)}
        title={`Customer ID Card — ${idCardTarget?.shopName || ''}`}
        documentType="Customer ID Card"
      >
        {idCardTarget && (
          <div className="border rounded-xl p-4 space-y-2 text-xs">
            <p className="font-mono font-bold text-sm">ID: {idCardTarget.customerCode}</p>
            <p className="text-base font-bold">{idCardTarget.shopName}</p>
            <p>Owner: {idCardTarget.ownerName} ({idCardTarget.ownerContact})</p>
            <p>Type: {idCardTarget.customerType} · Terms: {idCardTarget.financialTerms?.paymentCondition}</p>
            <p>Area: {idCardTarget.locationHierarchy?.areaName || '—'} · Route: {idCardTarget.locationHierarchy?.routeName || '—'}</p>
            <p>Pehchan: {idCardTarget.locationHierarchy?.pehchanRemarks || '—'}</p>
          </div>
        )}
      </PrintPreviewModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete customer?"
        message={`Remove ${deleteTarget?.shopName || 'this shop'}? Customers with orders or unpaid invoices must be marked INACTIVE.`}
      />
    </div>
  );
}
