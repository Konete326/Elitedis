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
import { suggestCode, validateField } from '../../utils/validation';

export default function AreasRoutesPage() {
  const queryClient = useQueryClient();
  const { addToast } = useShell();
  const [tab, setTab] = useState('areas');
  const [modalOpen, setModalOpen] = useState(false);
  const [touched, setTouched] = useState({});

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

  const closeModal = () => {
    setModalOpen(false);
    setTouched({});
  };

  const openModal = () => {
    setTouched({});
    const territories = territoriesQuery.data || [];
    const areas = areasQuery.data || [];
    if (tab === 'areas') {
      setAreaForm({
        territoryId: territories[0]?._id || '',
        areaCode: suggestCode('AR', areas.length, areas.map((a) => a.areaCode)),
        areaName: '',
        city: 'Karachi',
        subDistrict: 'Orangi',
        areaType: 'MARKET',
      });
    } else {
      setRouteForm({
        areaId: areas[0]?._id || '',
        routeCode: suggestCode(
          'RT',
          table.pagination?.totalRecords ?? table.rows?.length ?? 0,
          (table.rows || []).map((r) => r.routeCode)
        ),
        routeName: '',
        routeType: 'Main Road',
      });
    }
    setModalOpen(true);
  };

  const areaErrors = {
    areaCode: touched.areaCode
      ? validateField('code', areaForm.areaCode, { required: true, label: 'Area Code' })
      : '',
    areaName: touched.areaName
      ? validateField('required', areaForm.areaName, { required: true, minLength: 2, label: 'Area Name' })
      : '',
  };

  const routeErrors = {
    areaId: touched.areaId
      ? validateField('required', routeForm.areaId, { required: true, minLength: 1, label: 'Area' })
      : '',
    routeCode: touched.routeCode
      ? validateField('code', routeForm.routeCode, { required: true, label: 'Route Code' })
      : '',
    routeName: touched.routeName
      ? validateField('required', routeForm.routeName, { required: true, minLength: 2, label: 'Route Name' })
      : '',
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      tab === 'areas'
        ? apiClient.post('/crm/areas', {
            ...areaForm,
            areaCode: areaForm.areaCode.trim().toUpperCase(),
            areaName: areaForm.areaName.trim(),
          })
        : apiClient.post('/crm/routes', {
            ...routeForm,
            routeCode: routeForm.routeCode.trim().toUpperCase(),
            routeName: routeForm.routeName.trim(),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-areas'] });
      queryClient.invalidateQueries({ queryKey: ['crm-routes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-areas-options'] });
      queryClient.invalidateQueries({ queryKey: ['crm-areas-routes'] });
      queryClient.invalidateQueries({ queryKey: ['prereq-areas'] });
      queryClient.invalidateQueries({ queryKey: ['prereq-routes'] });
      queryClient.invalidateQueries({ queryKey: ['territories-options'] });
      addToast({ type: 'success', message: tab === 'areas' ? 'Area created.' : 'Route created.' });
      closeModal();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === 'areas') {
      setTouched({ areaCode: true, areaName: true });
      const err =
        validateField('code', areaForm.areaCode, { required: true, label: 'Area Code' }) ||
        validateField('required', areaForm.areaName, { required: true, minLength: 2, label: 'Area Name' });
      if (err) return;
      saveMutation.mutate();
      return;
    }
    setTouched({ areaId: true, routeCode: true, routeName: true });
    const err =
      validateField('required', routeForm.areaId, { required: true, minLength: 1, label: 'Area' }) ||
      validateField('code', routeForm.routeCode, { required: true, label: 'Route Code' }) ||
      validateField('required', routeForm.routeName, { required: true, minLength: 2, label: 'Route Name' });
    if (err) return;
    saveMutation.mutate();
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Areas &amp; Routes Setup"
        subtitle="Add cities, market areas, and delivery roads so shops and beat schedules stay organized"
        tabs={[
          { id: 'areas', label: 'Areas List', active: tab === 'areas', onClick: () => { setTab('areas'); setTouched({}); } },
          { id: 'routes', label: 'Routes List', active: tab === 'routes', onClick: () => { setTab('routes'); setTouched({}); } },
        ]}
        actions={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
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
        searchPlaceholder={tab === 'areas' ? 'Search by area name or code...' : 'Search by route name or code...'}
        viewMode={table.viewMode}
        onViewModeChange={table.setViewMode}
        onResetFilters={table.resetFilters}
        onRefresh={table.refresh}
        isRefreshing={table.isFetching}
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
        onEmptyAction={openModal}
      />

      <FormModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={tab === 'areas' ? 'Add Geographical Area' : 'Add Delivery / Booking Route'}
        onSubmit={handleSubmit}
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Area Code *</label>
                <button
                  type="button"
                  onClick={() =>
                    setAreaForm((p) => ({
                      ...p,
                      areaCode: suggestCode('AR', (areasQuery.data || []).length, (areasQuery.data || []).map((a) => a.areaCode)),
                    }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              </div>
              <input
                aria-required="true"
                value={areaForm.areaCode}
                onChange={(e) => setAreaForm((p) => ({ ...p, areaCode: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, areaCode: true }))}
                placeholder="AR-001"
                aria-invalid={Boolean(areaErrors.areaCode)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${areaErrors.areaCode ? 'border-[var(--status-danger)]' : ''}`}
              />
              {areaErrors.areaCode && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{areaErrors.areaCode}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area Name *</label>
              <input
                aria-required="true"
                value={areaForm.areaName}
                onChange={(e) => setAreaForm((p) => ({ ...p, areaName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, areaName: true }))}
                placeholder="Qasba Colony"
                aria-invalid={Boolean(areaErrors.areaName)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${areaErrors.areaName ? 'border-[var(--status-danger)]' : ''}`}
              />
              {areaErrors.areaName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{areaErrors.areaName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Town / Sub-District (Optional)</label>
              <input
                value={areaForm.subDistrict}
                onChange={(e) => setAreaForm((p) => ({ ...p, subDistrict: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">City (Optional)</label>
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
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Area *</label>
              <select
                aria-required="true"
                value={routeForm.areaId}
                onChange={(e) => setRouteForm((p) => ({ ...p, areaId: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, areaId: true }))}
                aria-invalid={Boolean(routeErrors.areaId)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${routeErrors.areaId ? 'border-[var(--status-danger)]' : ''}`}
              >
                <option value="">Select area...</option>
                {(areasQuery.data || []).map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.areaName} ({a.areaCode})
                  </option>
                ))}
              </select>
              {routeErrors.areaId && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{routeErrors.areaId}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Route Code *</label>
                <button
                  type="button"
                  onClick={() =>
                    setRouteForm((p) => ({
                      ...p,
                      routeCode: suggestCode(
                        'RT',
                        table.pagination?.totalRecords ?? table.rows?.length ?? 0,
                        (table.rows || []).map((r) => r.routeCode)
                      ),
                    }))
                  }
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Auto Code
                </button>
              </div>
              <input
                aria-required="true"
                value={routeForm.routeCode}
                onChange={(e) => setRouteForm((p) => ({ ...p, routeCode: e.target.value.toUpperCase() }))}
                onBlur={() => setTouched((p) => ({ ...p, routeCode: true }))}
                placeholder="RT-001"
                aria-invalid={Boolean(routeErrors.routeCode)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${routeErrors.routeCode ? 'border-[var(--status-danger)]' : ''}`}
              />
              {routeErrors.routeCode && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{routeErrors.routeCode}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Route Name *</label>
              <input
                aria-required="true"
                value={routeForm.routeName}
                onChange={(e) => setRouteForm((p) => ({ ...p, routeName: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, routeName: true }))}
                placeholder="Jamsheed Pump Road"
                aria-invalid={Boolean(routeErrors.routeName)}
                className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${routeErrors.routeName ? 'border-[var(--status-danger)]' : ''}`}
              />
              {routeErrors.routeName && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{routeErrors.routeName}</p>}
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
