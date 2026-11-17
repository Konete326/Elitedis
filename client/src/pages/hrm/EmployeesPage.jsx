import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Shield, Trash2, UserCheck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency } from '../../utils/formatters';
import { suggestCode } from '../../utils/validation';
import EmployeeFormModal, {
  EMPLOYEE_ROLES,
  INITIAL_EMPLOYEE_FORM,
  WORK_PART_LABELS,
} from './EmployeeFormModal';

export default function EmployeesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useShell();
  const isSuperAdmin = user?.primaryRole === 'SUPER_ADMIN';

  const table = useServerTable({
    queryKey: 'employees',
    endpoint: '/hrm/employees',
    initialFilters: { primaryRole: '', status: '' },
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const [modalState, setModalState] = useState({ open: false, editingId: null, initial: INITIAL_EMPLOYEE_FORM, key: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const visibleRows = isSuperAdmin
    ? table.rows
    : table.rows.filter((r) => r.primaryRole !== 'SUPER_ADMIN');

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      modalState.editingId
        ? apiClient.put(`/hrm/employees/${modalState.editingId}`, payload)
        : apiClient.post('/hrm/employees', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: modalState.editingId ? 'Staff member updated.' : 'Staff member added.' });
      setModalState((p) => ({ ...p, open: false }));
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save staff member.' });
    },
  });

  const toggleWorkPartMutation = useMutation({
    mutationFn: ({ id, workParts }) => apiClient.patch(`/hrm/work-assignments/${id}`, { workParts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: 'Staff job access updated.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not update access.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/hrm/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: 'Staff member removed.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not remove staff member.' });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    const suggested = suggestCode(
      'EMP',
      table.pagination.totalRecords,
      table.rows.map((r) => r.profileId)
    );
    setModalState((p) => ({
      open: true,
      editingId: null,
      initial: { ...INITIAL_EMPLOYEE_FORM, profileId: suggested },
      key: p.key + 1,
    }));
  };

  const openEdit = (row) => {
    if (row.primaryRole === 'SUPER_ADMIN' && !isSuperAdmin) {
      addToast({ type: 'error', message: 'Only Super Admin can manage Super Admin accounts.' });
      return;
    }
    setModalState((p) => ({
      open: true,
      editingId: row._id,
      initial: {
        ...INITIAL_EMPLOYEE_FORM,
        ...row,
        password: '',
        linkedWarehouseId: row.linkedWarehouseId?._id || row.linkedWarehouseId || '',
      },
      key: p.key + 1,
    }));
  };

  const columns = [
    { key: 'profileId', header: 'ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.profileId}</span> },
    { key: 'fullName', header: 'Employee', mobilePrimary: true, accessor: 'fullName' },
    { key: 'primaryRole', header: 'Role', accessor: 'primaryRole' },
    { key: 'phone', header: 'Mobile', numeric: true, accessor: 'phone' },
    { key: 'basicSalaryPkr', header: 'Basic Salary', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.basicSalaryPkr) },
    {
      key: 'workParts',
      header: 'Allowed Jobs',
      accessor: (r) =>
        WORK_PART_LABELS.filter((w) => r.workParts?.[w.key])
          .map((w) => w.label)
          .join(', ') || 'Role Default',
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Staff &amp; Job Permissions"
        subtitle="Manage team accounts, assigned warehouses, and which portals or invoice types each person can use"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by ID, name, email, or phone..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'primaryRole',
            label: 'Role',
            value: table.filters.primaryRole,
            onChange: (val) => table.setFilter('primaryRole', val),
            options: EMPLOYEE_ROLES,
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
          },
        ]}
      />

      <SmartDataTable
        columns={columns}
        data={visibleRows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={UserCheck}
        emptyTitle="No staff members added yet"
        emptyDescription="Add Bookers, Salesmen, Storekeepers, POS Operators, and Accountants."
        emptyActionLabel="Add Employee"
        onEmptyAction={openCreate}
        renderActions={(row) => {
          const isProtectedSuperAdmin = row.primaryRole === 'SUPER_ADMIN' && !isSuperAdmin;
          if (isProtectedSuperAdmin) {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] text-[11px] font-medium text-[var(--text-muted)]">
                <Shield className="w-3 h-3" />
                Protected
              </span>
            );
          }
          return (
            <>
              <button
                type="button"
                onClick={() =>
                  toggleWorkPartMutation.mutate({
                    id: row._id,
                    workParts: { ...row.workParts, orderBooker: !row.workParts?.orderBooker },
                  })
                }
                className="px-2 py-1.5 rounded-lg border text-[11px] hover:bg-[var(--bg-elevated)]"
                title="Toggle Order Booker Access"
              >
                Toggle Booker
              </button>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              {row.primaryRole !== 'SUPER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  aria-label={`Remove ${row.fullName}`}
                  className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          );
        }}
      />

      {modalState.open && (
        <EmployeeFormModal
          key={modalState.key}
          isOpen={modalState.open}
          onClose={() => setModalState((p) => ({ ...p, open: false }))}
          initialValue={modalState.initial}
          editingId={modalState.editingId}
          warehouses={warehousesQuery.data || []}
          existingCount={table.pagination.totalRecords}
          existingCodes={table.rows.map((r) => r.profileId)}
          isSuperAdmin={isSuperAdmin}
          onSave={(payload) => saveMutation.mutate(payload)}
          isSubmitting={saveMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Remove staff member?"
        message={`Delete ${deleteTarget?.fullName || 'this employee'}?`}
      />
    </div>
  );
}
