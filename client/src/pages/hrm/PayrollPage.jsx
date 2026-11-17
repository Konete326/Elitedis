import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Landmark, Plus, Printer } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [payslipTarget, setPayslipTarget] = useState(null);

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
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Payroll generation failed.' });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/hrm/payroll/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-payroll'] });
      addToast({ type: 'success', message: 'Salary paid & posted to accounting ledger.' });
    },
  });

  const columns = [
    { key: 'employee', header: 'Employee', mobilePrimary: true, accessor: (r) => r.employeeId?.fullName || '—' },
    { key: 'monthYear', header: 'Month', numeric: true, accessor: 'monthYear' },
    { key: 'basicSalaryPkr', header: 'Basic', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.basicSalaryPkr) },
    { key: 'commissionPkr', header: 'Commission', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.commissionPkr) },
    { key: 'netPayablePkr', header: 'Net Payable', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.netPayablePkr) },
    { key: 'paymentStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Payroll & Commission Engine"
        subtitle="Generate monthly salaries with automated sales commission and accounting sync"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Payroll</span>
            </button>
          </div>
        }
      />

      <FilterToolbar
        onResetFilters={table.resetFilters}
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
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={Landmark}
        emptyTitle="No payroll sheets generated yet"
        emptyDescription="Select a month above and click Generate Payroll to compute salary and commissions."
        renderActions={(row) => (
          <>
            {row.paymentStatus !== 'PAID' && (
              <button
                type="button"
                onClick={() => payMutation.mutate(row._id)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pay</span>
              </button>
            )}
            <button type="button" onClick={() => setPayslipTarget(row)} className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]">
              <Printer className="w-3.5 h-3.5" />
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
    </div>
  );
}
