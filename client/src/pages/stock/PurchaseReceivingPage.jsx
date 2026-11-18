import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { SearchableSelect } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import FormModeToggle, { useFormMode } from '../../components/shared/FormModeToggle';
import PurchaseResultCard from './PurchaseResultCard';
import PurchaseReturnModal from './PurchaseReturnModal';
import PurchasePutAwayStep from './PurchasePutAwayStep';
import { extractListPayload } from '../../utils/formatters';

const STEPS = [
  { id: 1, label: '1. Purchase Received' },
  { id: 2, label: '2. Check & Received' },
  { id: 3, label: '3. Move & Put Away' },
  { id: 4, label: '4. Create Movement' },
  { id: 5, label: '5. Movement Result' },
];

export default function PurchaseReceivingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canViewPurchasePrice } = useAuth();
  const { addToast } = useShell();
  const [formMode, setFormMode] = useFormMode();

  const [step, setStep] = useState(1);
  const [returnOpen, setReturnOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [touchedDates, setTouchedDates] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const [form, setForm] = useState({
    companyId: '',
    productId: '',
    warehouseId: '',
    batchNo: `B-${Date.now().toString().slice(-5)}`,
    unitName: '',
    conversionQty: 1,
    purchaseRatePerPack: '',
    expectedBaseQty: 100,
    receivedBaseQty: 100,
    normalBaseQty: 100,
    damagedBaseQty: 0,
    expiredBaseQty: 0,
    expectedMfgDate: '',
    expectedExpDate: '',
    receivedMfgDate: '',
    receivedExpDate: '',
    normalZoneId: '',
    normalAreaId: '',
    damagedZoneId: '',
    damagedAreaId: '',
    expiredZoneId: '',
    expiredAreaId: '',
    notes: '',
  });

  const companiesQ = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });
  const productsQ = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/products', { params: { limit: 200 } })).data,
  });
  const warehousesQ = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/warehouses', { params: { limit: 100 } })).data,
  });

  const companies = companiesQ.data || [];
  const products = productsQ.data || [];
  const warehouses = warehousesQ.data || [];
  const activeWhId = form.warehouseId || warehouses[0]?._id || '';
  const activeWh = warehouses.find((w) => String(w._id) === String(activeWhId)) || warehouses[0] || null;
  const zones = activeWh?.zones || [];

  const allAreas = useMemo(
    () =>
      zones.flatMap((z) =>
        (z.areas || []).map((a) => ({
          ...a,
          zoneId: z._id,
          zoneName: z.zoneName,
        }))
      ),
    [zones]
  );

  const pickDefaultLocation = (preferredConditions) => {
    const match = allAreas.find((a) => preferredConditions.includes(a.condition)) || allAreas[0];
    return { zoneId: match?.zoneId || zones[0]?._id || '', areaId: match?._id || '' };
  };

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => !form.companyId || String(p.companyId?._id || p.companyId) === String(form.companyId))
        .map((p) => ({
          value: p._id,
          label: `${p.skuCode} — ${p.productName}`,
          sublabel: p.companyId?.companyName || p.baseUnit?.unitName || '',
        })),
    [products, form.companyId]
  );

  const companyOptions = useMemo(
    () => companies.map((c) => ({ value: c._id, label: c.companyName, sublabel: c.companyCode || '' })),
    [companies]
  );

  const handleProductPick = (prodId) => {
    const prod = products.find((p) => String(p._id) === String(prodId));
    const activeVer = prod?.unitVersions?.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || prod?.unitVersions?.[0];
    const pack0 = prod?.packingUnits?.[0];
    const normLoc = pickDefaultLocation(['NORMAL', 'MIX', 'FRESH']);
    const dmgLoc = pickDefaultLocation(['DAMAGE', 'DAMAGED']);
    const expLoc = pickDefaultLocation(['EXPIRY', 'EXPIRE']);
    setForm((prev) => ({
      ...prev,
      productId: prodId,
      companyId: String(prod?.companyId?._id || prod?.companyId || prev.companyId || ''),
      unitName: activeVer?.unitName || pack0?.unitName || prod?.baseUnit?.unitName || 'Piece',
      conversionQty: activeVer?.conversionQty || pack0?.conversionQty || 1,
      purchaseRatePerPack: pack0?.traderPurchaseRate || prev.purchaseRatePerPack || '',
      normalZoneId: prev.normalZoneId || normLoc.zoneId,
      normalAreaId: prev.normalAreaId || normLoc.areaId,
      damagedZoneId: prev.damagedZoneId || dmgLoc.zoneId,
      damagedAreaId: prev.damagedAreaId || dmgLoc.areaId,
      expiredZoneId: prev.expiredZoneId || expLoc.zoneId,
      expiredAreaId: prev.expiredAreaId || expLoc.areaId,
    }));
  };

  const qtyDiff = (Number(form.receivedBaseQty) || 0) - (Number(form.expectedBaseQty) || 0);
  const segSum = (Number(form.normalBaseQty) || 0) + (Number(form.damagedBaseQty) || 0) + (Number(form.expiredBaseQty) || 0);
  const segMismatch = segSum !== (Number(form.receivedBaseQty) || 0);
  const mfgMismatch = Boolean(form.expectedMfgDate && form.receivedMfgDate && form.expectedMfgDate !== form.receivedMfgDate);
  const expMismatch = Boolean(form.expectedExpDate && form.receivedExpDate && form.expectedExpDate !== form.receivedExpDate);

  const submitMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/stocks/purchase-receiving', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
      setResultData(res?.data?.data?.purchaseResult || null);
      setStep(5);
      addToast({ type: 'success', message: 'Purchase receiving & segregated put-away completed.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Purchase receiving failed.' });
    },
  });

  const handleConfirmPutAway = () => {
    if (!form.productId || !activeWhId) {
      addToast({ type: 'warning', message: 'Select a product and destination warehouse first.' });
      return;
    }
    if (segMismatch) {
      addToast({ type: 'warning', message: `Normal + Damaged + Expired (${segSum}) must equal Received Qty (${form.receivedBaseQty}).` });
      return;
    }
    const normLoc = pickDefaultLocation(['NORMAL', 'MIX', 'FRESH']);
    const dmgLoc = pickDefaultLocation(['DAMAGE', 'DAMAGED']);
    const expLoc = pickDefaultLocation(['EXPIRY', 'EXPIRE']);
    submitMutation.mutate({
      idempotencyKey,
      toWarehouseId: activeWhId,
      supplierCompanyId: form.companyId || null,
      notes: form.notes,
      items: [
        {
          productId: form.productId,
          batchNo: form.batchNo,
          unitName: form.unitName,
          conversionQty: Number(form.conversionQty) || 1,
          ...(canViewPurchasePrice && form.purchaseRatePerPack ? { purchaseRatePerPack: Number(form.purchaseRatePerPack) } : {}),
          expectedBaseQty: Number(form.expectedBaseQty) || 0,
          receivedBaseQty: Number(form.receivedBaseQty) || 0,
          normalBaseQty: Number(form.normalBaseQty) || 0,
          damagedBaseQty: Number(form.damagedBaseQty) || 0,
          expiredBaseQty: Number(form.expiredBaseQty) || 0,
          expectedMfgDate: form.expectedMfgDate || null,
          expectedExpDate: form.expectedExpDate || null,
          receivedMfgDate: form.receivedMfgDate || form.expectedMfgDate || null,
          receivedExpDate: form.receivedExpDate || form.expectedExpDate || null,
          normalZoneId: form.normalZoneId || normLoc.zoneId,
          normalAreaId: form.normalAreaId || normLoc.areaId,
          damagedZoneId: form.damagedZoneId || dmgLoc.zoneId,
          damagedAreaId: form.damagedAreaId || dmgLoc.areaId,
          expiredZoneId: form.expiredZoneId || expLoc.zoneId,
          expiredAreaId: form.expiredAreaId || expLoc.areaId,
        },
      ],
    });
  };

  const resetWizard = () => {
    setResultData(null);
    setStep(1);
    setTouchedDates(false);
    setIdempotencyKey(`pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    setForm((p) => ({ ...p, batchNo: `B-${Date.now().toString().slice(-5)}` }));
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in overflow-y-auto pr-1">
      <PageHeader
        title="5-Step Purchase Receiving"
        subtitle="Purchase Received → Check & Received → Move & Put Away → Create Movement → 24-Field Result"
        actions={
          <div className="flex items-center gap-2">
            <FormModeToggle mode={formMode} onChange={setFormMode} />
            <button type="button" onClick={() => setReturnOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold text-[var(--status-warning)]">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Purchase Return</span>
            </button>
            <button type="button" onClick={() => navigate('/stock/movements')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Movements</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.id === 5 && !resultData}
            onClick={() => (s.id < 5 || resultData) && setStep(s.id)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left transition-none ${
              step === s.id ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Principal Company</label>
              <SearchableSelect options={companyOptions} value={form.companyId} onChange={(val) => setForm((p) => ({ ...p, companyId: val }))} placeholder="Auto-filled from product or search..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Product SKU *</label>
              <SearchableSelect options={productOptions} value={form.productId} onChange={handleProductPick} placeholder="Search SKU or product name..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Destination Warehouse *</label>
              <select value={activeWhId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value, normalZoneId: '', normalAreaId: '' }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.warehouseName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Batch No *</label>
              <input value={form.batchNo} onChange={(e) => setForm((p) => ({ ...p, batchNo: e.target.value.toUpperCase() }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expected Qty (Base Units) *</label>
              <input type="number" min="1" value={form.expectedBaseQty} onChange={(e) => setForm((p) => ({ ...p, expectedBaseQty: e.target.value, receivedBaseQty: e.target.value, normalBaseQty: e.target.value, damagedBaseQty: 0, expiredBaseQty: 0 }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
            </div>
            {canViewPurchasePrice && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Purchase Rate / Pack</label>
                <input type="number" min="0" step="0.01" value={form.purchaseRatePerPack} onChange={(e) => setForm((p) => ({ ...p, purchaseRatePerPack: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
              </div>
            )}
            {formMode === 'advanced' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expected MFG Date</label>
                  <input type="date" value={form.expectedMfgDate} onChange={(e) => setForm((p) => ({ ...p, expectedMfgDate: e.target.value, receivedMfgDate: p.receivedMfgDate || e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expected EXP Date</label>
                  <input type="date" value={form.expectedExpDate} onChange={(e) => setForm((p) => ({ ...p, expectedExpDate: e.target.value, receivedExpDate: p.receivedExpDate || e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
                  <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
              <span>Next: Check & Received</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Received Qty (Base Units)</label>
              <input type="number" min="0" value={form.receivedBaseQty} onChange={(e) => setForm((p) => ({ ...p, receivedBaseQty: e.target.value, normalBaseQty: e.target.value, damagedBaseQty: 0, expiredBaseQty: 0 }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Received MFG Date</label>
              <input type="date" value={form.receivedMfgDate} onBlur={() => setTouchedDates(true)} onChange={(e) => setForm((p) => ({ ...p, receivedMfgDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Received EXP Date</label>
              <input type="date" value={form.receivedExpDate} onBlur={() => setTouchedDates(true)} onChange={(e) => setForm((p) => ({ ...p, receivedExpDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm" />
            </div>
          </div>
          {(qtyDiff !== 0 || (touchedDates && (mfgMismatch || expMismatch))) && (
            <div className="rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] p-3 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-[var(--status-warning)]"><AlertTriangle className="w-4 h-4" /><span>Discrepancy Detected</span></p>
              {qtyDiff !== 0 && <p>Quantity difference: {qtyDiff > 0 ? `+${qtyDiff} Excess` : `${qtyDiff} Shortage`}</p>}
              {touchedDates && mfgMismatch && <p>MFG Date mismatch ({form.expectedMfgDate} vs {form.receivedMfgDate})</p>}
              {touchedDates && expMismatch && <p>EXP Date mismatch ({form.expectedExpDate} vs {form.receivedExpDate})</p>}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep(1)} className="h-9 px-3 rounded-lg border text-xs font-semibold">Back</button>
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold">
              <span>Next: Segregated Put-Away</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <PurchasePutAwayStep
          form={form}
          setForm={setForm}
          zones={zones}
          segSum={segSum}
          segMismatch={segMismatch}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <div className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Confirm Purchase Movement & Segregated Put-Away</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border p-2.5"><span className="text-[var(--text-muted)]">Batch:</span> <strong className="font-mono">{form.batchNo}</strong></div>
            <div className="rounded-lg border p-2.5"><span className="text-[var(--text-muted)]">Expected → Received:</span> <strong className="font-mono">{form.expectedBaseQty} → {form.receivedBaseQty}</strong></div>
            <div className="rounded-lg border p-2.5"><span className="text-[var(--text-muted)]">Split (N/D/E):</span> <strong className="font-mono">{form.normalBaseQty}/{form.damagedBaseQty}/{form.expiredBaseQty}</strong></div>
            <div className="rounded-lg border p-2.5"><span className="text-[var(--text-muted)]">Warehouse:</span> <strong>{activeWh?.warehouseName || '—'}</strong></div>
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep(3)} className="h-9 px-3 rounded-lg border text-xs font-semibold">Back</button>
            <button type="button" disabled={submitMutation.isPending} onClick={handleConfirmPutAway} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50">
              <Check className="w-4 h-4" />
              <span>{submitMutation.isPending ? 'Posting...' : 'Confirm & Create Movement'}</span>
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <PurchaseResultCard
          result={resultData}
          canViewPurchasePrice={canViewPurchasePrice}
          onReset={resetWizard}
          onOpenReturn={() => setReturnOpen(true)}
        />
      )}

      <PurchaseReturnModal isOpen={returnOpen} onClose={() => setReturnOpen(false)} />
    </div>
  );
}
