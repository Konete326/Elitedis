import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Trash2, UserCheck } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import {
  ConfirmModal,
  FilterToolbar,
  FormModal,
  ImageDropzone,
  SmartDataTable,
} from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

const ROLES = ['ADMIN', 'BOOKER', 'SALESMAN', 'POS_OPERATOR', 'WAREHOUSE_MANAGER', 'STOREKEEPER', 'ACCOUNTANT'];
const WORK_PART_LABELS = [
  { key: 'orderBooker', label: 'Order Booker' },
  { key: 'warehouseManager', label: 'Warehouse Management' },
  { key: 'posStore', label: 'POS Store' },
  { key: 'normalInvoice', label: 'Normal Invoice' },
  { key: 'advanceInvoice', label: 'Advance Invoice' },
  { key: 'salesman', label: 'Salesman Delivery' },
];

const INITIAL_FORM = {
  profileId: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  primaryRole: 'BOOKER',
  linkedWarehouseId: '',
  basicSalaryPkr: 0,
  commissionPct: 0,
  status: 'ACTIVE',
  avatar: null,
  workParts: {
    orderBooker: true,
    warehouseManager: false,
    posStore: false,
    normalInvoice: true,
    advanceInvoice: false,
    salesman: false,
  },
};

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'employees',
    endpoint: '/hrm/employees',
    initialFilters: { primaryRole: '', status: '' },
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId ? apiClient.put(`/hrm/employees/${editingId}`, payload) : apiClient.post('/hrm/employees', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: editingId ? 'Employee updated.' : 'Employee created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save employee.' });
    },
  });

  const toggleWorkPartMutation = useMutation({
    mutationFn: ({ id, workParts }) => apiClient.patch(`/hrm/work-assignments/${id}`, { workParts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: 'Work-part permissions updated.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/hrm/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast({ type: 'success', message: 'Employee removed.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Delete failed.' });
      setDeleteTarget(null);
    },
  });

  const columns = [
    { key: 'profileId', header: 'ID', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.profileId}</span> },
    { key: 'fullName', header: 'Employee', mobilePrimary: true, accessor: 'fullName' },
    { key: 'primaryRole', header: 'Role', accessor: 'primaryRole' },
    { key: 'phone', header: 'Contact', numeric: true, accessor: 'phone' },
    { key: 'basicSalaryPkr', header: 'Basic Salary', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.basicSalaryPkr) },
    {
      key: 'workParts',
      header: 'Active Work Parts',
      accessor: (r) =>
        WORK_PART_LABELS.filter((w) => r.workParts?.[w.key])
          .map((w) => w.label)
          .join(', ') || 'Role Default',
    },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Employee Master & Work-Part Assignments"
        subtitle="Manage staff accounts, linked warehouses, and Accept / Non-Accept operational privileges"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(INITIAL_FORM);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold"
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
        searchPlaceholder="Search ID, name, email, phone..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        filters={[
          {
            key: 'primaryRole',
            label: 'Role',
            value: table.filters.primaryRole,
            onChange: (val) => table.setFilter('primaryRole', val),
            options: ROLES,
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
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={UserCheck}
        emptyTitle="No employees added yet"
        emptyDescription="Add Bookers, Salesmen, Storekeepers, POS Operators, and Accountants."
        emptyActionLabel="Add Employee"
        onEmptyAction={() => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setModalOpen(true);
        }}
        renderActions={(row) => (
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
              title="Toggle Order Booker Work Part"
            >
              Toggle Booker
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(row._id);
                setForm({
                  ...INITIAL_FORM,
                  ...row,
                  password: '',
                  linkedWarehouseId: row.linkedWarehouseId?._id || row.linkedWarehouseId || '',
                });
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
        title={editingId ? 'Edit Employee & Work Parts' : 'New Employee Account'}
        size="lg"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...form, linkedWarehouseId: form.linkedWarehouseId || null };
          if (editingId && !payload.password) delete payload.password;
          saveMutation.mutate(payload);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Name</label>
                <input required value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Profile ID</label>
                <input value={form.profileId} onChange={(e) => setForm((p) => ({ ...p, profileId: e.target.value.toUpperCase() }))} placeholder="IFTI-001" className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Phone</label>
                <input required value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {editingId ? 'Reset Password (Optional)' : 'Login Password'}
                </label>
                <input
                  required={!editingId}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Primary Role</label>
                <select value={form.primaryRole} onChange={(e) => setForm((p) => ({ ...p, primaryRole: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Linked Warehouse</label>
                <select value={form.linkedWarehouseId} onChange={(e) => setForm((p) => ({ ...p, linkedWarehouseId: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                  <option value="">All / None</option>
                  {(warehousesQuery.data || []).map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.warehouseName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Basic Salary (PKR)</label>
                <input type="number" value={form.basicSalaryPkr} onChange={(e) => setForm((p) => ({ ...p, basicSalaryPkr: Number(e.target.value) }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums" />
              </div>
            </div>
            <ImageDropzone label="Employee Avatar" folder="employees" value={form.avatar} onChange={(avatar) => setForm((p) => ({ ...p, avatar }))} />
          </div>

          <div className="rounded-xl border p-3.5 space-y-2">
            <span className="text-xs font-bold uppercase text-[var(--accent-primary)]">Work &amp; Task Assignment (Accept / Non-Accept)</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {WORK_PART_LABELS.map((wp) => (
                <label key={wp.key} className="flex items-center gap-2 rounded-lg border p-2 bg-[var(--bg-canvas)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.workParts?.[wp.key])}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        workParts: { ...p.workParts, [wp.key]: e.target.checked },
                      }))
                    }
                    className="accent-[var(--accent-primary)]"
                  />
                  <span>{wp.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Remove employee?"
        message={`Delete ${deleteTarget?.fullName || 'this employee'}?`}
      />
    </div>
  );
}
