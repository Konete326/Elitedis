import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Copy, Edit, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const INITIAL_FORM = {
  beatCode: '',
  beatName: '',
  beatDay: 'MONDAY',
  assignedBookerId: '',
  status: 'ACTIVE',
};

export default function BeatsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const table = useServerTable({
    queryKey: 'beats',
    endpoint: '/crm/beats',
    initialFilters: { beatDay: '', status: '' },
  });

  const employeesQuery = useQuery({
    queryKey: ['booker-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/hrm/employees', { params: { limit: 100 } })).data,
  });
  const areasCheck = useQuery({
    queryKey: ['prereq-areas'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/areas', { params: { limit: 1 } })),
  });
  const routesCheck = useQuery({
    queryKey: ['prereq-routes'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/routes', { params: { limit: 1 } })),
  });
  const customersCheck = useQuery({
    queryKey: ['prereq-customers'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/customers', { params: { limit: 1 } })),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const prereqReady = !areasCheck.isLoading && !routesCheck.isLoading && !customersCheck.isLoading;
  const hasAreasAndRoutes =
    (areasCheck.data?.pagination?.totalRecords || areasCheck.data?.data?.length || 0) > 0 &&
    (routesCheck.data?.pagination?.totalRecords || routesCheck.data?.data?.length || 0) > 0;
  const hasCustomers =
    (customersCheck.data?.pagination?.totalRecords || customersCheck.data?.data?.length || 0) > 0;

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? apiClient.put(`/crm/beats/${editingId}`, payload)
        : apiClient.post('/crm/beats', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beats'] });
      addToast({ type: 'success', message: editingId ? 'Beat plan updated.' : 'Beat plan created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save beat plan.' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/crm/beats/${id}/duplicate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beats'] });
      addToast({ type: 'success', message: 'Beat duplicated cleanly for reassignment.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/crm/beats/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beats'] });
      addToast({ type: 'success', message: 'Beat plan deleted.' });
      setDeleteTarget(null);
    },
  });

  const columns = [
    { key: 'beatCode', header: 'Beat Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.beatCode}</span> },
    { key: 'beatName', header: 'Beat Name', mobilePrimary: true, accessor: 'beatName' },
    { key: 'beatDay', header: 'Day', accessor: 'beatDay' },
    { key: 'booker', header: 'Assigned Booker', accessor: (r) => r.assignedBookerId?.fullName || 'Unassigned' },
    { key: 'wholesalers', header: 'Wholesalers', numeric: true, accessor: 'totalWholesalers' },
    { key: 'retailers', header: 'Retailers', numeric: true, accessor: 'totalRetailers' },
    { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Weekly Booker Beat Plans"
        subtitle="Schedule which day and routes each order booker visits shops, with 1-click copy"
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
            <span>Create Beat Plan</span>
          </button>
        }
      />

      {prereqReady && (
        <SetupGuideBanner
          missingMessage="Set up Areas, Routes, and Customer Shops first before assigning weekly booker beats."
          steps={[
            { label: 'Create Areas & Routes', done: hasAreasAndRoutes, to: '/crm/areas-routes', actionLabel: 'Setup Areas' },
            { label: 'Add Customer Shops', done: hasCustomers, to: '/crm/customers', actionLabel: 'Add Customers' },
          ]}
        />
      )}

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder="Search by beat code or name..."
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
        filters={[
          {
            key: 'beatDay',
            label: 'Day',
            value: table.filters.beatDay,
            onChange: (val) => table.setFilter('beatDay', val),
            options: DAYS,
          },
          {
            key: 'status',
            label: 'Status',
            value: table.filters.status,
            onChange: (val) => table.setFilter('status', val),
            options: ['ACTIVE', 'INACTIVE'],
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
        emptyIcon={ClipboardList}
        emptyTitle="No beat plans created"
        emptyDescription="Create a Monday–Sunday beat schedule and assign it to an Order Booker."
        emptyActionLabel="Create Beat Plan"
        onEmptyAction={() => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setModalOpen(true);
        }}
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => duplicateMutation.mutate(row._id)}
              title="Duplicate Beat"
              className="px-2 py-1.5 rounded-lg border text-xs hover:bg-[var(--bg-elevated)]"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(row._id);
                setForm({
                  ...INITIAL_FORM,
                  ...row,
                  assignedBookerId: row.assignedBookerId?._id || row.assignedBookerId || '',
                });
                setModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Beat Plan' : 'Create Beat Plan'}
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
        isSubmitting={saveMutation.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Beat Code</label>
            <input
              required
              value={form.beatCode}
              onChange={(e) => setForm((p) => ({ ...p, beatCode: e.target.value.toUpperCase() }))}
              placeholder="BATB-1"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Beat Name</label>
            <input
              required
              value={form.beatName}
              onChange={(e) => setForm((p) => ({ ...p, beatName: e.target.value }))}
              placeholder="ALIGARH TO BANARAS"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Beat Day</label>
            <select
              value={form.beatDay}
              onChange={(e) => setForm((p) => ({ ...p, beatDay: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Assign Booker</label>
            <select
              value={form.assignedBookerId}
              onChange={(e) => setForm((p) => ({ ...p, assignedBookerId: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            >
              <option value="">Select booker...</option>
              {(employeesQuery.data || []).map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName} ({emp.profileId})
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        isLoading={deleteMutation.isPending}
        title="Delete beat plan?"
        message={`Remove ${deleteTarget?.beatName || 'this beat'}?`}
      />
    </div>
  );
}
