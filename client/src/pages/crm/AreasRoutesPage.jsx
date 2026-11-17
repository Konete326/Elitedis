import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { FilterToolbar, FormModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload } from '../../utils/formatters';

export default function AreasRoutesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();
  const [tab, setTab] = useState('areas');
  const [modalOpen, setModalOpen] = useState(false);

  const table = useServerTable({
    queryKey: `crm-${tab}`,
    endpoint: tab === 'areas' ? '/crm/areas' : '/crm/routes',
  });

  const territoriesQuery = useQuery({
    queryKey: ['territories-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/territories', { params: { limit: 100 } })).data,
  });

  const areasQuery = useQuery({
    queryKey: ['crm-areas-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/crm/areas', { params: { limit: 100 } })).data,
  });

  const [areaForm, setAreaForm] = useState({
    territoryId: '',
    areaCode: '',
    areaName: '',
    city: 'Karachi',
    subDistrict: 'Orangi',
    areaType: 'MARKET',
  });
  const [routeForm, setRouteForm] = useState({
    areaId: '',
    routeCode: '',
    routeName: '',
    routeType: 'Main Road',
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      tab === 'areas'
        ? apiClient.post('/crm/areas', areaForm)
        : apiClient.post('/crm/routes', routeForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`crm-${tab}`] });
      queryClient.invalidateQueries({ queryKey: ['crm-areas-options'] });
      addToast({ type: 'success', message: tab === 'areas' ? 'Area created.' : 'Route created.' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save record.' });
    },
  });

  const areaColumns = [
    { key: 'areaCode', header: 'Area Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.areaCode}</span> },
    { key: 'areaName', header: 'Area Name', mobilePrimary: true, accessor: 'areaName' },
    { key: 'subDistrict', header: 'Town / Sub-District', accessor: 'subDistrict' },
    { key: 'city', header: 'City', accessor: 'city' },
    { key: 'territoryName', header: 'Territory', accessor: 'territoryName' },
    { key: 'routeCount', header: 'Routes', numeric: true, accessor: 'routeCount' },
  ];

  const routeColumns = [
    { key: 'routeCode', header: 'Route Code', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.routeCode}</span> },
    { key: 'routeName', header: 'Route Name', mobilePrimary: true, accessor: 'routeName' },
    { key: 'areaName', header: 'Area', accessor: 'areaName' },
    { key: 'routeType', header: 'Type', accessor: 'routeType' },
    { key: 'isAccepted', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.isAccepted ? 'ACCEPT' : 'NON_ACCEPT'} /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Areas & Routes Hierarchy"
        subtitle="Manage Karachi towns, commercial areas, and road routes for Beat planning"
        tabs={[
          { id: 'areas', label: 'Areas Master', active: tab === 'areas', onClick: () => setTab('areas') },
          { id: 'routes', label: 'Routes Master', active: tab === 'routes', onClick: () => setTab('routes') },
        ]}
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>{tab === 'areas' ? 'Add Area' : 'Add Route'}</span>
          </button>
        }
      />

      <FilterToolbar
        searchValue={table.search}
        onSearchChange={table.setSearch}
        onResetPage={() => table.setPage(1)}
        searchPlaceholder={`Search ${tab}...`}
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
      />

      <SmartDataTable
        columns={tab === 'areas' ? areaColumns : routeColumns}
        data={table.rows}
        loading={table.isLoading}
        viewMode={table.viewMode}
        pagination={table.pagination}
        onPageChange={table.setPage}
        onPageSizeChange={table.setLimit}
        emptyIcon={MapPin}
        emptyTitle={`No ${tab} configured`}
        emptyDescription="Add Areas and Routes to organize territories and daily booker beats."
        emptyActionLabel={tab === 'areas' ? 'Add Area' : 'Add Route'}
        onEmptyAction={() => setModalOpen(true)}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tab === 'areas' ? 'Add Geographical Area' : 'Add Delivery / Booking Route'}
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        isSubmitting={saveMutation.isPending}
      >
        {tab === 'areas' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Parent Territory (Optional)</label>
              <select
                value={areaForm.territoryId}
                onChange={(e) => setAreaForm((p) => ({ ...p, territoryId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Auto-create / Default Territory</option>
                {(territoriesQuery.data || []).map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.territoryName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area Code</label>
              <input
                required
                value={areaForm.areaCode}
                onChange={(e) => setAreaForm((p) => ({ ...p, areaCode: e.target.value.toUpperCase() }))}
                placeholder="AQC-23"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area Name</label>
              <input
                required
                value={areaForm.areaName}
                onChange={(e) => setAreaForm((p) => ({ ...p, areaName: e.target.value }))}
                placeholder="Qasba Colony"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Town / Sub-District</label>
              <input
                value={areaForm.subDistrict}
                onChange={(e) => setAreaForm((p) => ({ ...p, subDistrict: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">City</label>
              <input
                value={areaForm.city}
                onChange={(e) => setAreaForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area</label>
              <select
                required
                value={routeForm.areaId}
                onChange={(e) => setRouteForm((p) => ({ ...p, areaId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select area...</option>
                {(areasQuery.data || []).map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.areaName} ({a.areaCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Route Code</label>
              <input
                required
                value={routeForm.routeCode}
                onChange={(e) => setRouteForm((p) => ({ ...p, routeCode: e.target.value.toUpperCase() }))}
                placeholder="R-1"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Route Name</label>
              <input
                required
                value={routeForm.routeName}
                onChange={(e) => setRouteForm((p) => ({ ...p, routeName: e.target.value }))}
                placeholder="Jamsheed Pump Road"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
