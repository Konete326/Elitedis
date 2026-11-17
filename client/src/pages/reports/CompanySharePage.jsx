import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Share2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { MetricCard, PrintPreviewModal, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import { extractListPayload, formatCurrency, formatNumber } from '../../utils/formatters';

export default function CompanySharePage() {
  const { user } = useAuth();
  const { addToast } = useShell();
  const [companyId, setCompanyId] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });

  const shareQuery = useQuery({
    queryKey: ['company-share', user?.distributorId, companyId],
    queryFn: async () =>
      (await apiClient.get('/dashboards-reports/reports/company-share', { params: { companyId } })).data?.data || {
        products: [],
        batches: [],
      },
    enabled: Boolean(companyId),
  });

  const handleRefresh = async () => {
    await companiesQuery.refetch();
    if (companyId) await shareQuery.refetch();
    addToast({ type: 'success', message: companyId ? 'Company stock report refreshed.' : 'Company list refreshed.' });
  };

  const selectedCompany = (companiesQuery.data || []).find((c) => c._id === companyId);
  const products = shareQuery.data?.products || [];
  const batches = shareQuery.data?.batches || [];

  const columns = [
    { key: 'batchNo', header: 'Batch', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.batchNo}</span> },
    { key: 'product', header: 'Product', mobilePrimary: true, accessor: (r) => r.productId?.productName || '—' },
    { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.warehouseId?.warehouseName || '—' },
    { key: 'availableBaseQty', header: 'Available Qty', numeric: true, accessor: (r) => formatNumber(r.availableBaseQty) },
    { key: 'totalStockValuePkr', header: 'Valuation', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.totalStockValuePkr) },
    { key: 'status', header: 'Status', mobileBadge: true, accessor: 'status' },
  ];

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Company Stock Sharing Report"
        subtitle="View and share stock quantities strictly for one supplier company while keeping other companies private"
        onRefresh={handleRefresh}
        isRefreshing={companiesQuery.isFetching || shareQuery.isFetching}
        actions={
          <button
            type="button"
            disabled={!companyId}
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Preview &amp; Share</span>
          </button>
        }
      />

      <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-xs font-semibold text-[var(--text-secondary)]">Choose Supplier Company:</label>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="w-full sm:w-auto min-h-[40px] sm:h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm sm:min-w-[240px]"
        >
          <option value="">Select a company...</option>
          {(companiesQuery.data || []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyCode} — {c.companyName}
            </option>
          ))}
        </select>
      </div>

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard title="Company SKUs" value={products.length} icon={Share2} status="primary" />
        <MetricCard title="Stock Batches" value={batches.length} status="info" />
        <MetricCard
          title="Company Stock Value"
          value={formatCurrency(batches.reduce((s, b) => s + (b.totalStockValuePkr || 0), 0))}
          status="success"
        />
      </div>

      <SmartDataTable
        columns={columns}
        data={batches}
        loading={shareQuery.isFetching}
        emptyTitle={companyId ? 'No batches found for this company' : 'Select a company above'}
        emptyDescription="Only products and batches owned by the selected company will appear here, keeping other companies confidential."
      />

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Company Stock Pack — ${selectedCompany?.companyName || ''}`}
        documentType="Company Information Share"
        columns={columns}
        rows={batches}
      />
    </div>
  );
}
