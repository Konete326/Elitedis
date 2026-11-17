import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function AccountLedgersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'account-ledgers',
    endpoint: '/accounts/ledgers',
    initialFilters: { voucherType: '', accountCategory: '' },
    initialSortBy: 'transactionDate',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    voucherNo: '',
    debitCode: '5030',
    debitName: 'Delivery & Trip Expenses',
    debitCategory: 'EXPENSE',
    creditCode: '1010',
    creditName: 'Cash in Hand',
    creditCategory: 'ASSET',
    amountPkr: 0,
    narration: '',
  });

  const journalMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/accounts/ledgers/journal', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-ledgers'] });
      addToast({ type: 'success', message: 'Balanced double-entry journal posted.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Journal posting failed.' });
    },
  });

  const columns = [
    { key: 'voucherNo', header: 'Voucher', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.voucherNo}</span> },
    { key: 'voucherType', header: 'Type', accessor: 'voucherType' },
    { key: 'accountName', header: 'Account', mobilePrimary: true, accessor: (r) => `${r.accountCode} — ${r.accountName}` },
    { key: 'debitPkr', header: 'Debit', numeric: true, align: 'right', accessor: (r) => (r.debitPkr ? formatCurrency(r.debitPkr) : '—') },
    { key: 'creditPkr', header: 'Credit', numeric: true, align: 'right', accessor: (r) => (r.creditPkr ? formatCurrency(r.creditPkr) : '—') },
    { key: 'narration', header: 'Narration', accessor: 'narration' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'transactionDate', header: 'Date', accessor: (r) => formatDateTime(r.transactionDate) },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    journalMutation.mutate({
      voucherNo: form.voucherNo || `JRN-${Date.now().toString().slice(-5)}`,
      voucherType: 'JOURNAL',
      entries: [
        { accountCode: form.debitCode, accountName: form.debitName, accountCategory: form.debitCategory, debitPkr: form.amountPkr, creditPkr: 0, narration: form.narration },
        { accountCode: form.creditCode, accountName: form.creditName, accountCategory: form.creditCategory, debitPkr: 0, creditPkr: form.amountPkr, narration: form.narration },
      ],
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="General Ledger & Day Book"
        subtitle="Double-entry journal vouchers, AR/AP entries, cash, and bank ledgers"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Voucher</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search voucher no or narration..."
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'voucherType',
            label: 'Voucher Type',
            value: table.filters.voucherType,
            onChange: (val) => table.setFilter('voucherType', val),
            options: ['SALE', 'PURCHASE', 'RECOVERY', 'PAYMENT', 'EXPENSE', 'STOCK_ADJUSTMENT', 'PAYROLL', 'JOURNAL'],
          },
          {
            key: 'accountCategory',
            label: 'Category',
            value: table.filters.accountCategory,
            onChange: (val) => table.setFilter('accountCategory', val),
            options: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
          },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={table.rows}
        loading={table.isLoading}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={Landmark}
        emptyTitle="No journal entries posted yet"
        emptyDescription="Balanced Debit/Credit entries post automatically from approved sales, recoveries, and payroll."
        emptyActionLabel="Post Journal Voucher"
        onEmptyAction={() => setModalOpen(true)}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Post Double-Entry Journal Voucher"
        onSubmit={handleSubmit}
        isSubmitting={journalMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Voucher No</label>
            <input value={form.voucherNo} onChange={(e) => setForm((p) => ({ ...p, voucherNo: e.target.value.toUpperCase() }))} placeholder="Auto if blank" className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Amount (PKR)</label>
            <input required type="number" min="1" value={form.amountPkr} onChange={(e) => setForm((p) => ({ ...p, amountPkr: Number(e.target.value) }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Debit Account Name</label>
            <input required value={form.debitName} onChange={(e) => setForm((p) => ({ ...p, debitName: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Credit Account Name</label>
            <input required value={form.creditName} onChange={(e) => setForm((p) => ({ ...p, creditName: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Narration</label>
            <input required value={form.narration} onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))} placeholder="Reason for entry" className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
