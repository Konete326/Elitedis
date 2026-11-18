import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { ConfirmModal, TouchKeypadModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import MovementLineRow from './MovementLineRow';
import { extractListPayload } from '../../utils/formatters';

const MOVEMENT_TYPES = [
  { id: 'PURCHASE', label: 'Purchase Intake' },
  { id: 'TRANSFER', label: 'Inter-Warehouse Transfer' },
  { id: 'SAME_TRANSFER', label: 'Same-Warehouse Transfer' },
  { id: 'ADJUSTMENT', label: 'Stock Adjustment / Count' },
  { id: 'EXPIRY_DAMAGE_BACK', label: 'Expiry & Damage Return' },
];

export default function CreateMovementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canViewPurchasePrice } = useAuth();
  const { addToast } = useShell();

  const [movementType, setMovementType] = useState('PURCHASE');
  const [taskName, setTaskName] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [supplierCompanyId, setSupplierCompanyId] = useState('');
  const [status, setStatus] = useState('COMPLETED');
  const [items, setItems] = useState([]);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [removeIndexTarget, setRemoveIndexTarget] = useState(null);

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });
  const productsQuery = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 100 } })).data,
  });
  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });

  const warehouses = warehousesQuery.data || [];
  const effectiveFromWarehouseId = fromWarehouseId || warehouses[0]?._id || '';
  const effectiveToWarehouseId = toWarehouseId || warehouses[0]?._id || '';

  const batchesQuery = useQuery({
    queryKey: ['stock-batches-options', effectiveFromWarehouseId],
    queryFn: async () =>
      extractListPayload(
        await apiClient.get('/stocks/batches', {
          params: { limit: 100, warehouseId: effectiveFromWarehouseId || undefined },
        })
      ).data,
    enabled: movementType !== 'PURCHASE',
  });

  const destZones = useMemo(() => {
    const targetWhId = movementType === 'SAME_TRANSFER' ? effectiveFromWarehouseId : effectiveToWarehouseId;
    const wh = warehouses.find((w) => String(w._id) === String(targetWhId));
    return wh?.zones || [];
  }, [warehouses, movementType, effectiveFromWarehouseId, effectiveToWarehouseId]);

  const mutation = useMutation({
    mutationFn: (payload) => apiClient.post('/stocks/movements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      addToast({ type: 'success', message: 'Stock movement saved.' });
      navigate('/stock/movements');
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Movement failed.' });
    },
  });

  const resolveProductMeta = (prod) => {
    const activeVer = prod?.unitVersions?.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || prod?.unitVersions?.[0];
    const pack0 = prod?.packingUnits?.[0];
    return {
      unitVersionId: activeVer?.unitVersionId || 'UV-1',
      unitName: activeVer?.unitName || pack0?.unitName || prod?.baseUnit?.unitName || 'Piece',
      conversionQty: activeVer?.conversionQty || pack0?.conversionQty || 1,
      purchaseRatePerPack: pack0?.traderPurchaseRate || 0,
      companyId: String(prod?.companyId?._id || prod?.companyId || ''),
    };
  };

  const addLineItem = () => {
    const firstProd = productsQuery.data?.[0];
    const firstBatch = batchesQuery.data?.[0];
    const firstZone = destZones[0];
    const firstArea = firstZone?.areas?.[0];

    if (movementType === 'PURCHASE') {
      if (!firstProd) {
        addToast({ type: 'warning', message: 'Create a product first before recording a purchase.' });
        return;
      }
      const meta = resolveProductMeta(firstProd);
      if (!supplierCompanyId && meta.companyId) setSupplierCompanyId(meta.companyId);
      setItems((prev) => [
        ...prev,
        {
          productId: firstProd._id,
          batchNo: `B-${Date.now().toString().slice(-4)}`,
          toZoneId: firstZone?._id || '',
          toAreaId: firstArea?._id || '',
          unitVersionId: meta.unitVersionId,
          unitName: meta.unitName,
          conversionQty: meta.conversionQty,
          ...(canViewPurchasePrice ? { purchaseRatePerPack: meta.purchaseRatePerPack } : {}),
          movedBaseQty: meta.conversionQty || 24,
          lineDecision: 'ACCEPT',
        },
      ]);
      return;
    }

    if (!firstBatch) {
      addToast({ type: 'warning', message: 'No batches available in selected source warehouse.' });
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: firstBatch.productId?._id || firstBatch.productId,
        batchId: firstBatch._id,
        batchNo: firstBatch.batchNo,
        fromZoneId: firstBatch.zoneId,
        fromAreaId: firstBatch.areaId,
        toZoneId: firstZone?._id || firstBatch.zoneId,
        toAreaId: firstArea?._id || firstBatch.areaId,
        unitVersionId: firstBatch.unitVersionId || 'UV-1',
        unitName: firstBatch.unitName || firstBatch.productId?.baseUnit?.unitName || 'Piece',
        previousErpBaseQty: firstBatch.currentBaseQty || 0,
        physicalCountBaseQty: firstBatch.currentBaseQty || 0,
        movedBaseQty: 1,
        lineDecision: 'ACCEPT',
      },
    ]);
  };

  const updateLine = (idx, key, val) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));
  };

  const handlePurchaseProductChange = (idx, prodId) => {
    const prod = (productsQuery.data || []).find((p) => String(p._id) === String(prodId));
    const meta = resolveProductMeta(prod);
    if (meta.companyId && (!supplierCompanyId || items.length <= 1)) {
      setSupplierCompanyId(meta.companyId);
    }
    setItems((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              productId: prodId,
              unitVersionId: meta.unitVersionId,
              unitName: meta.unitName,
              conversionQty: meta.conversionQty,
              ...(canViewPurchasePrice ? { purchaseRatePerPack: meta.purchaseRatePerPack } : {}),
            }
          : row
      )
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) {
      addToast({ type: 'warning', message: 'Add at least one item line.' });
      return;
    }
    const cleanItems = canViewPurchasePrice
      ? items
      : items.map(({ purchaseRatePerPack: _drop, ...rest }) => rest);
    mutation.mutate({
      movementType,
      taskName: taskName || `${movementType} Movement`,
      fromWarehouseId: movementType !== 'PURCHASE' ? effectiveFromWarehouseId || null : null,
      toWarehouseId: movementType === 'PURCHASE' || movementType === 'TRANSFER' ? effectiveToWarehouseId || null : null,
      supplierCompanyId: supplierCompanyId || null,
      status,
      items: cleanItems,
    });
  };

  const products = productsQuery.data || [];
  const missingPrereqs =
    !warehousesQuery.isLoading && !productsQuery.isLoading && (warehouses.length === 0 || products.length === 0);

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Create Stock Movement"
        subtitle="Execute purchase intake, warehouse transfers, physical adjustments, or damage returns"
        actions={
          <button type="button" onClick={() => navigate('/stock/movements')} className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Movements</span>
          </button>
        }
        tabs={MOVEMENT_TYPES.map((t) => ({
          id: t.id,
          label: t.label,
          active: movementType === t.id,
          onClick: () => {
            setMovementType(t.id);
            setItems([]);
          },
        }))}
      />

      {missingPrereqs && (
        <SetupGuideBanner
          isLoading={warehousesQuery.isLoading || productsQuery.isLoading}
          missingMessage="Create at least one Warehouse and one Product SKU before posting Stock Movements."
          steps={[
            { label: 'Warehouse', done: warehouses.length > 0, to: '/stock/warehouses', actionLabel: 'Warehouses' },
            { label: 'Product SKU', done: products.length > 0, to: '/inventory/products', actionLabel: 'Products' },
          ]}
        />
      )}

      <form onSubmit={handleSubmit} className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 lg:overflow-hidden">
        <div className="shrink-0 rounded-xl border bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Task / Reference Name <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder={`New ${movementType.toLowerCase()} batch`} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
          </div>

          {movementType !== 'PURCHASE' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">From Warehouse <span className="text-[var(--status-danger)]">*</span></label>
              <select required value={effectiveFromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                <option value="">Select source...</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(movementType === 'PURCHASE' || movementType === 'TRANSFER') && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Destination Warehouse <span className="text-[var(--status-danger)]">*</span></label>
              <select required value={effectiveToWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                <option value="">Select destination...</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(movementType === 'PURCHASE' || movementType === 'EXPIRY_DAMAGE_BACK') && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier Company <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
              <select value={supplierCompanyId} onChange={(e) => setSupplierCompanyId(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                <option value="">Optional...</option>
                {(companiesQuery.data || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Commit Mode <span className="text-[var(--status-danger)]">*</span></label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="COMPLETED">Approve &amp; Post Stock Immediately</option>
              <option value="PENDING">Save as Pending Verification</option>
            </select>
          </div>
        </div>

        <div className="lg:flex-1 lg:min-h-0 flex flex-col rounded-xl border bg-[var(--bg-surface)] lg:overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b bg-[var(--bg-elevated)]">
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">Movement Line Items ({items.length})</span>
            <button type="button" onClick={addLineItem} className="inline-flex items-center gap-1 min-h-[38px] sm:h-8 px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="lg:flex-1 lg:min-h-0 lg:overflow-auto p-3 space-y-2.5">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                Select warehouses above and tap Add Item to configure batches and quantities.
              </div>
            ) : (
              items.map((row, idx) => (
                <MovementLineRow
                  key={idx}
                  row={row}
                  idx={idx}
                  movementType={movementType}
                  products={products}
                  batches={batchesQuery.data || []}
                  destZones={destZones}
                  canViewPurchasePrice={canViewPurchasePrice}
                  onPurchaseProductChange={handlePurchaseProductChange}
                  updateLine={updateLine}
                  onOpenKeypad={(i, field) => setKeypadTarget({ idx: i, field, val: items[i][field] })}
                  onRemove={(i) => setRemoveIndexTarget(i)}
                />
              ))
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-2 px-4 py-3 border-t bg-[var(--bg-elevated)]">
            <button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:h-10 px-5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold">
              <Check className="w-4 h-4" />
              <span>{mutation.isPending ? 'Submitting...' : 'Submit Movement'}</span>
            </button>
          </div>
        </div>
      </form>

      <TouchKeypadModal
        isOpen={Boolean(keypadTarget)}
        onClose={() => setKeypadTarget(null)}
        initialValue={keypadTarget?.val ?? 0}
        title="Enter Base Unit Quantity"
        onConfirm={(val) => {
          if (keypadTarget) updateLine(keypadTarget.idx, keypadTarget.field, val);
        }}
      />

      <ConfirmModal
        isOpen={removeIndexTarget !== null}
        onClose={() => setRemoveIndexTarget(null)}
        onConfirm={() => {
          setItems((prev) => prev.filter((_, n) => n !== removeIndexTarget));
          setRemoveIndexTarget(null);
        }}
        title="Remove movement item row?"
        message="Remove this batch line from the current stock movement?"
        confirmLabel="Remove Row"
      />
    </div>
  );
}
