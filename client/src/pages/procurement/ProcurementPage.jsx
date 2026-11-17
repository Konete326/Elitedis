import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightCircle, CheckCircle2, CreditCard, Package, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import useServerTable from '../../hooks/useServerTable';
import { ConfirmModal, FilterToolbar, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import { extractListPayload, formatCurrency } from '../../utils/formatters';
import { ORDER_COLUMNS, PAYMENT_COLUMNS } from './procurementColumns';
import { CreatePoModal, PaySupplierModal, ReceiveGoodsModal } from './ProcurementModals';

export default function ProcurementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [activeTab, setActiveTab] = useState('orders');
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [approvePoTarget, setApprovePoTarget] = useState(null);
  const [payModalState, setPayModalState] = useState({ open: false, target: null });

  const table = useServerTable({
    queryKey: 'procurement-orders',
    endpoint: '/procurement/orders',
    initialFilters: { status: '', supplierCompanyId: '' },
  });

  const paymentsTable = useServerTable({
    queryKey: 'procurement-payments',
    endpoint: '/procurement/payments',
    initialFilters: { supplierCompanyId: '' },
  });

  const summaryQuery = useQuery({
    queryKey: ['procurement-summary', user?.distributorId],
    queryFn: async () => (await apiClient.get('/procurement/summary')).data?.data || {},
  });

  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const productsQuery = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 100 } })).data,
  });

  const invalidateProcurement = () => {
    queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
    queryClient.invalidateQueries({ queryKey: ['procurement-payments'] });
    queryClient.invalidateQueries({ queryKey: ['procurement-summary'] });
  };

  const createPoMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/procurement/orders', payload),
    onSuccess: () => {
      invalidateProcurement();
      addToast({ type: 'success', message: 'Supplier Purchase Order saved.' });
      setCreateOpen(false);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not create purchase order.' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/procurement/orders/${id}/convert`, {}),
    onSuccess: () => {
      invalidateProcurement();
      addToast({ type: 'success', message: 'Purchase request approved as Purchase Order.' });
      setApprovePoTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not approve purchase order.' });
      setApprovePoTarget(null);
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, zoneId, areaId }) => apiClient.patch(`/procurement/orders/${id}/receive`, { zoneId, areaId }),
    onSuccess: () => {
      invalidateProcurement();
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      queryClient.invalidateQueries({ queryKey: ['account-ledgers'] });
      addToast({ type: 'success', message: 'Goods received into Stock Batches and Accounts Payable posted.' });
      setReceiveTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Receiving failed.' });
    },
  });

  const payMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/procurement/payments', payload),
    onSuccess: () => {
      invalidateProcurement();
      queryClient.invalidateQueries({ queryKey: ['account-ledgers'] });
      addToast({ type: 'success', message: 'Supplier payment posted to Accounts Payable.' });
      setPayModalState({ open: false, target: null });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Supplier payment failed.' });
    },
  });

  const summary = summaryQuery.data || {};
  const openAndDrafts = Number(summary.draftRequestsCount || 0) + Number(summary.openOrdersCount || 0);
  const companies = companiesQuery.data || [];
  const products = productsQuery.data || [];
  const prereqReady = !companiesQuery.isLoading && !productsQuery.isLoading;

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Supplier Purchases &amp; Payments"
        subtitle="Create supplier purchase orders, receive stock into warehouse racks, and record supplier payments"
        onRefresh={activeTab === 'orders' ? table.refresh : paymentsTable.refresh}
        isRefreshing={activeTab === 'orders' ? table.isFetching : paymentsTable.isFetching}
        actions={
          <>
            <button
              type="button"
              onClick={() => setPayModalState({ open: true, target: null })}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-elevated)]"
            >
              <CreditCard className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Record Payment</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order</span>
            </button>
          </>
        }
      />

      <SetupGuideBanner
        isLoading={!prereqReady}
        missingMessage="Add at least one Supplier Company and one Product before creating supplier purchase orders."
        steps={[
          { label: 'Add at least 1 Company', done: companies.length > 0, to: '/inventory/companies', actionLabel: 'Add Company' },
          { label: 'Add at least 1 Product', done: products.length > 0, to: '/inventory/products', actionLabel: 'Add Product' },
        ]}
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Open Orders & Drafts"
          value={openAndDrafts}
          subtitle={`Auto Drafts: ${summary.draftRequestsCount ?? 0}`}
          icon={Package}
          status="warning"
          loading={summaryQuery.isLoading}
        />
        <MetricCard title="Received / Completed" value={summary.completedOrdersCount ?? 0} status="success" loading={summaryQuery.isLoading} />
        <MetricCard title="Total Purchased (AP)" value={formatCurrency(summary.totalPurchasedPkr ?? 0)} status="primary" loading={summaryQuery.isLoading} />
        <MetricCard
          title="Outstanding Payable"
          value={formatCurrency(summary.outstandingPayablePkr ?? 0)}
          subtitle={`Paid: ${formatCurrency(summary.totalPaidPkr ?? 0)}`}
          status="info"
          loading={summaryQuery.isLoading}
        />
      </div>

      <div className="shrink-0 flex items-center gap-2 border-b pb-2">
        {[
          ['orders', 'Purchase Orders & Requests'],
          ['payments', 'Supplier AP Payments'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === key
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-surface)] border text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' ? (
        <>
          <FilterToolbar
            searchValue={table.search}
            onSearchChange={table.setSearch}
            onResetPage={() => table.setPage(1)}
            searchPlaceholder="Search by PO number or note..."
            viewMode={table.viewMode}
            onViewModeChange={table.setViewMode}
            onResetFilters={table.resetFilters}
            onRefresh={table.refresh}
            isRefreshing={table.isFetching}
            filters={[
              {
                key: 'supplierCompanyId',
                label: 'Supplier',
                value: table.filters.supplierCompanyId,
                onChange: (val) => table.setFilter('supplierCompanyId', val),
                options: companies.map((c) => ({ value: c._id, label: c.companyName })),
              },
              {
                key: 'status',
                label: 'Status',
                value: table.filters.status,
                onChange: (val) => table.setFilter('status', val),
                options: ['DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'],
              },
            ]}
          />

          <SmartDataTable
            columns={ORDER_COLUMNS}
            data={table.rows}
            loading={table.isLoading}
            viewMode={table.viewMode}
            pagination={table.pagination}
            onPageChange={table.setPage}
            onPageSizeChange={table.setLimit}
            emptyTitle="No purchase orders yet"
            emptyDescription="Create a Supplier Purchase Order or run a low-stock check to generate purchase drafts."
            emptyActionLabel="New Purchase Order"
            onEmptyAction={() => setCreateOpen(true)}
            renderActions={(row) => (
              <>
                {row.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => setApprovePoTarget(row)}
                    disabled={convertMutation.isPending}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Approve PO</span>
                  </button>
                )}
                {['DRAFT', 'PENDING', 'APPROVED'].includes(row.status) && (
                  <button
                    type="button"
                    onClick={() => setReceiveTarget(row)}
                    disabled={receiveMutation.isPending}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--status-success)] text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Receive Goods</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPayModalState({ open: true, target: row })}
                  className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)] inline-flex items-center gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay Supplier</span>
                </button>
              </>
            )}
          />
        </>
      ) : (
        <SmartDataTable
          columns={PAYMENT_COLUMNS}
          data={paymentsTable.rows}
          loading={paymentsTable.isLoading}
          pagination={paymentsTable.pagination}
          onPageChange={paymentsTable.setPage}
          onPageSizeChange={paymentsTable.setLimit}
          emptyTitle="No supplier payments posted yet"
          emptyDescription="Click Record Payment to post an Accounts Payable settlement voucher."
          emptyActionLabel="Record Payment"
          onEmptyAction={() => setPayModalState({ open: true, target: null })}
        />
      )}

      <CreatePoModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={companiesQuery.data || []}
        warehouses={warehousesQuery.data || []}
        products={productsQuery.data || []}
        onSubmit={(payload) => createPoMutation.mutate(payload)}
        isSubmitting={createPoMutation.isPending}
      />

      <ReceiveGoodsModal
        target={receiveTarget}
        warehouses={warehousesQuery.data || []}
        onClose={() => setReceiveTarget(null)}
        onSubmit={(payload) => receiveMutation.mutate(payload)}
        isSubmitting={receiveMutation.isPending}
      />

      <PaySupplierModal
        isOpen={payModalState.open}
        target={payModalState.target}
        companies={companies}
        onClose={() => setPayModalState({ open: false, target: null })}
        onSubmit={(payload) => payMutation.mutate(payload)}
        isSubmitting={payMutation.isPending}
      />

      <ConfirmModal
        isOpen={Boolean(approvePoTarget)}
        onClose={() => setApprovePoTarget(null)}
        onConfirm={() => convertMutation.mutate(approvePoTarget._id)}
        isLoading={convertMutation.isPending}
        variant="primary"
        title="Approve purchase request?"
        message={`Convert draft ${approvePoTarget?.movementCode || ''} into an approved Supplier Purchase Order?`}
        confirmLabel="Approve PO"
      />
    </div>
  );
}
