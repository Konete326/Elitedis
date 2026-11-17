import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Receipt } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

export default function RecoveryAssignPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'unpaid-sales-assign',
    endpoint: '/sales-recovery/sales',
    initialFilters: { paymentStatus: 'CREDIT' },
  });

  const staffQuery = useQuery({
    queryKey: ['staff-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });

  const [assignedToId, setAssignedToId] = useState('');
  const [title, setTitle] = useState('Payment Recovery Sheet');
  const [priority, setPriority] = useState('NORMAL');
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [assignedRows, setAssignedRows] = useState([]);
  const [printSheetOpen, setPrintSheetOpen] = useState(false);

  const assignMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/sales-recovery/recovery-assign', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      const snapshot = table.rows.filter((r) => table.selectedKeys.includes(r._id));
      setAssignedRows(snapshot);
      addToast({
        type: 'success',
        message: `Assigned ${res.data?.data?.assignedInvoicesCount || 0} unpaid bill(s) as a recovery task.`,
      });
      setAssignConfirmOpen(false);
      setPrintSheetOpen(true);
      table.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Recovery assignment failed.' });
      setAssignConfirmOpen(false);
    },
  });

  const columns = [
    { key: 'invoiceNo', header: 'Invoice No', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.invoiceNo}</span> },
    { key: 'customer', header: 'Customer', mobilePrimary: true, accessor: (r) => r.customerId?.shopName || r.walkInCustomerName || '—' },
    { key: 'area', header: 'Area', accessor: (r) => r.customerId?.locationHierarchy?.areaName || '—' },
    { key: 'balanceDuePkr', header: 'Balance Due', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.balanceDuePkr) },
    { key: 'paymentStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Assign Payment Recovery"
        subtitle="Pick unpaid credit bills and assign a collection task to a Booker or Salesman"
      />

      <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Assign to Staff Member</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full h-10 sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
            <option value="">Choose booker or salesman...</option>
            {(staffQuery.data || []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.fullName} ({u.primaryRole})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Collection Sheet Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Market Collection" className="w-full h-10 sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-10 sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <button
          type="button"
          disabled={!assignedToId || table.selectedKeys.length === 0 || assignMutation.isPending}
          onClick={() => setAssignConfirmOpen(true)}
          className="min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Assign Selected ({table.selectedKeys.length})</span>
        </button>
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by invoice number..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        selectedCount={table.selectedKeys.length}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Payment',
            value: table.filters.paymentStatus,
            onChange: (val) => table.setFilter('paymentStatus', val),
            options: ['CREDIT', 'PARTIAL', 'OVERDUE'],
          },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        selectable
        selectedKeys={table.selectedKeys}
        onSelectionChange={table.setSelectedKeys}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={Receipt}
        emptyTitle="No unpaid credit bills"
        emptyDescription="Unpaid or partially paid customer bills appear here so you can assign them for collection."
      />

      <PrintPreviewModal
        isOpen={printSheetOpen}
        onClose={() => setPrintSheetOpen(false)}
        title={title}
        documentType="Recovery Sheet"
        columns={[
          { key: 'invoiceNo', header: 'Invoice No', numeric: true },
          { key: 'customer', header: 'Customer', accessor: (r) => r.customerId?.shopName || '—' },
          { key: 'balanceDuePkr', header: 'Due Amount', numeric: true },
        ]}
        rows={assignedRows}
      />

      <ConfirmModal
        isOpen={assignConfirmOpen}
        onClose={() => setAssignConfirmOpen(false)}
        onConfirm={() =>
          assignMutation.mutate({
            saleInvoiceIds: table.selectedKeys,
            assignedToId,
            title,
            priority,
          })
        }
        isLoading={assignMutation.isPending}
        variant="primary"
        title="Assign payment recovery task?"
        message={`Assign ${table.selectedKeys.length} unpaid bill(s) to the selected staff member and create a recovery task?`}
        confirmLabel="Assign Recovery"
      />
    </div>
  );
}
