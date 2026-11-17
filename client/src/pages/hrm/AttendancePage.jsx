import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatDate } from '../../utils/formatters';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'hrm-attendance',
    endpoint: '/hrm/attendance',
    initialFilters: { attendanceStatus: '' },
    initialSortBy: 'date',
  });

  const employeesQuery = useQuery({
    queryKey: ['employees-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    recordType: 'ATTENDANCE',
    attendanceStatus: 'PRESENT',
    date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/hrm/attendance', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-attendance'] });
      addToast({ type: 'success', message: 'Attendance recorded.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to record attendance.' });
    },
  });

  const columns = [
    { key: 'employee', header: 'Employee', mobilePrimary: true, accessor: (r) => r.employeeId?.fullName || '—' },
    { key: 'role', header: 'Role', accessor: (r) => r.employeeId?.primaryRole || '—' },
    { key: 'recordType', header: 'Type', accessor: 'recordType' },
    { key: 'date', header: 'Date', accessor: (r) => formatDate(r.date) },
    { key: 'attendanceStatus', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.attendanceStatus} /> },
    { key: 'remarks', header: 'Remarks', accessor: (r) => r.remarks || '—' },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Attendance & Leave Management"
        subtitle="Track daily staff check-ins, absences, half-days, and leave requests"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Record Attendance</span>
          </button>
        }
      />

      <FilterToolbar
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'attendanceStatus',
            label: 'Status',
            value: table.filters.attendanceStatus,
            onChange: (val) => table.setFilter('attendanceStatus', val),
            options: ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'LATE'],
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
        emptyIcon={UserCheck}
        emptyTitle="No attendance entries yet"
        emptyDescription="Record daily attendance or leave entries for your staff."
        emptyActionLabel="Record Attendance"
        onEmptyAction={() => setModalOpen(true)}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Attendance / Leave"
        size="sm"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Employee</label>
            <select required value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">Select employee...</option>
              {(employeesQuery.data || []).map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName} ({emp.primaryRole})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
            <select value={form.attendanceStatus} onChange={(e) => setForm((p) => ({ ...p, attendanceStatus: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LATE">Late</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Remarks</label>
            <input value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
