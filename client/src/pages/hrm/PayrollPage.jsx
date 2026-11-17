import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Landmark, Plus, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [payslipTarget, setPayslipTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

  const table = useServerTable({
    queryKey: 'hrm-payroll',
    endpoint: '/hrm/payroll',
    initialFilters: { paymentStatus: '' },
  });

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post('/hrm/payroll/generate', { monthYear }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-payroll'] });
      addToast({ type: 'success', message: `Payroll generated for ${monthYear}.` });
      setGenerateConfirmOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Payroll generation failed.' });
      setGenerateConfirmOpen(false);
    },
  });

  const payMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/hrm/payroll/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-payroll'] });
      addToast({ type: 'success', message: 'Salary marked paid & posted to accounts ledger.' });
      setPayTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Salary payment failed.' });
      setPayTarget(null);
    },
  });

  const columns = [
    { key: 'employee', header: 'Employee', mobilePrimary: true, accessor: (r) => r.employeeId?.fullName || '—' },
    { key: 'monthYear', header: 'Month', numeric: true, accessor: 'monthYear' },
    { key: 'basicSalaryPkr', header: 'Basic Salary', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.basicSalaryPkr) },
    { key: 'commissionPkr', header: 'Commission', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.commissionPkr) },
    { key: 'netPayablePkr', header: 'Net Salary', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.netPayablePkr) },
    { key: 'paymentStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Staff Payroll &amp; Commissions"
        subtitle="Create monthly salary sheets with automatic sales commissions and ledger posting"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Month *
              <input
                type="month"
                required
                aria-label="Payroll Month *"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                className="ml-2 min-h-[40px] sm:h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)]"
              />
            </label>
            <button
              type="button"
              onClick={() => setGenerateConfirmOpen(true)}
              disabled={generateMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Payroll</span>
            </button>
          </div>
        }
      />

      <FilterToolbar
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Payment',
            value: table.filters.paymentStatus,
            onChange: (val) => table.setFilter('paymentStatus', val),
            options: ['PENDING', 'PAID'],
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
        emptyIcon={Landmark}
        emptyTitle="No salary sheets created yet"
        emptyDescription="Pick a month above and click Generate Payroll to calculate salaries and sales commissions."
        renderActions={(row) => (
          <>
            {row.paymentStatus !== 'PAID' && (
              <button
                type="button"
                onClick={() => setPayTarget(row)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pay</span>
              </button>
            )}
            <button type="button" onClick={() => setPayslipTarget(row)} className="px-2.5 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1" title="Print Payslip">
              <Printer className="w-3.5 h-3.5" />
              <span className="lg:hidden">Payslip</span>
            </button>
          </>
        )}
      />

      <PrintPreviewModal
        isOpen={Boolean(payslipTarget)}
        onClose={() => setPayslipTarget(null)}
        title={`Salary Payslip — ${payslipTarget?.employeeId?.fullName || ''}`}
        subtitle={`Period: ${payslipTarget?.monthYear || ''}`}
        documentType="Payslip"
        summaryRows={[
          { label: 'Basic Salary', value: formatCurrency(payslipTarget?.basicSalaryPkr) },
          { label: 'Commission', value: formatCurrency(payslipTarget?.commissionPkr) },
          { label: 'Allowances', value: formatCurrency(payslipTarget?.allowancesPkr) },
          { label: 'Deductions', value: formatCurrency(payslipTarget?.deductionsPkr) },
          { label: 'Net Payable', value: formatCurrency(payslipTarget?.netPayablePkr) },
        ]}
      />

      <ConfirmModal
        isOpen={generateConfirmOpen}
        onClose={() => setGenerateConfirmOpen(false)}
        onConfirm={() => generateMutation.mutate()}
        isLoading={generateMutation.isPending}
        variant="primary"
        title="Generate monthly payroll?"
        message={`Calculate salaries and sales commissions for all active employees for ${monthYear}?`}
        confirmLabel="Generate Payroll"
      />

      <ConfirmModal
        isOpen={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={() => payMutation.mutate(payTarget._id)}
        isLoading={payMutation.isPending}
        variant="primary"
        title="Confirm salary payment?"
        message={`Pay ${formatCurrency(payTarget?.netPayablePkr || 0)} to ${payTarget?.employeeId?.fullName || 'this employee'} for ${payTarget?.monthYear || ''}? This will post a salary expense to the ledger.`}
        confirmLabel="Confirm & Pay Salary"
      />
    </div>
  );
}
