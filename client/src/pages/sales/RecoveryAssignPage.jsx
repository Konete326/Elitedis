import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Receipt } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
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
  const [printSheetOpen, setPrintSheetOpen] = useState(false);

  const assignMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/sales-recovery/recovery-assign', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      addToast({
        type: 'success',
        message: `Assigned ${res.data?.data?.assignedInvoicesCount || 0} bills as recovery task.`,
      });
      setPrintSheetOpen(true);
      table.setSelectedKeys([]);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Recovery assignment failed.' });
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
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Recovery Assignment Center"
        subtitle="Select unpaid credit bills and assign recovery sheets to Bookers or Salesmen"
      />

      <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Assign To Staff</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
            <option value="">Select booker or salesman...</option>
            {(staffQuery.data || []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.fullName} ({u.primaryRole})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Task Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <button
          type="button"
          disabled={!assignedToId || table.selectedKeys.length === 0 || assignMutation.isPending}
          onClick={() =>
            assignMutation.mutate({
              saleInvoiceIds: table.selectedKeys,
              assignedToId,
              title,
              priority,
            })
          }
          className="h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Assign ({table.selectedKeys.length})</span>
        </button>
      </div>

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search credit invoice..."
        onResetFilters={table.resetFilters}
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
        selectable
        selectedKeys={table.selectedKeys}
        onSelectionChange={table.setSelectedKeys}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={Receipt}
        emptyTitle="No unpaid credit invoices"
        emptyDescription="Credit and partially paid invoices appear here for recovery task assignment."
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
        rows={table.rows.filter((r) => table.selectedKeys.includes(r._id))}
      />
    </div>
  );
}
