import { Calculator, Plus } from 'lucide-react';
import { ImageDropzone } from '../../components/global';
import { suggestTierRates } from '../../utils/validation';

export const PRODUCT_RATE_LIST_COLUMNS = [
  { key: 'skuCode', header: 'SKU', numeric: true },
  { key: 'productName', header: 'Product Name' },
  { key: 'wholesale', header: 'Wholesale Rate', numeric: true, accessor: (r) => r.packingUnits?.[0]?.wholesaleSaleRate || r.baseUnit?.wholesaleSaleRate || 0 },
  { key: 'retail', header: 'POS End Rate', numeric: true, accessor: (r) => r.packingUnits?.[0]?.posRetailEndRate || r.baseUnit?.posRetailEndRate || 0 },
];

export function buildEmptyProduct() {
  return {
    skuCode: '',
    barcode: '',
    productName: '',
    companyId: '',
    brandId: '',
    categoryId: '',
    subCategoryId: '',
    status: 'ACTIVE',
    posPermission: true,
    bookingPermission: true,
    showOnMarketplace: false,
    shortDescription: '',
    unitVersions: [],
    baseUnit: { unitName: 'Piece', weightValue: 0, weightUnit: 'Kg', traderPurchaseRate: 0, wholesaleSaleRate: 0, posRetailEndRate: 0, image: null },
    packingUnits: [{ unitName: 'Carton', conversionQty: 24, weightUnit: 'Kg', traderPurchaseRate: 0, wholesaleSaleRate: 0, posRetailEndRate: 0, dimensions: { sizeUnit: 'Inch', width: 0, length: 0, height: 0 }, image: null, isDefaultStockUnit: true }],
  };
}

export function computeBaseWeightKg(baseUnit) {
  const val = Number(baseUnit?.weightValue) || 0;
  const isSmall = baseUnit?.weightUnit === 'g' || baseUnit?.weightUnit === 'ml';
  return Number((isSmall ? val / 1000 : val).toFixed(4));
}

export function computePackingMath(baseWeightKg, pack0) {
  const conv = Math.max(1, Number(pack0?.conversionQty) || 1);
  const w = Number(pack0?.dimensions?.width) || 0;
  const l = Number(pack0?.dimensions?.length) || 0;
  const h = Number(pack0?.dimensions?.height) || 0;
  return { packingWeightKg: Number((baseWeightKg * conv).toFixed(4)), areaSq: Number((w * l).toFixed(3)), volumeCubic: Number((w * l * h).toFixed(3)) };
}

export function buildProductPayload(form, baseWeightKg, pack0, packingMath, canViewPurchasePrice = true) {
  const baseUnitPayload = {
    ...form.baseUnit,
    weightValue: Number(form.baseUnit.weightValue) || 0,
    weightInKg: baseWeightKg,
    wholesaleSaleRate: Number(form.baseUnit.wholesaleSaleRate) || 0,
    posRetailEndRate: Number(form.baseUnit.posRetailEndRate) || 0,
  };
  const pack0Payload = {
    ...pack0,
    conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
    packingWeightKg: packingMath.packingWeightKg,
    wholesaleSaleRate: Number(pack0.wholesaleSaleRate) || 0,
    posRetailEndRate: Number(pack0.posRetailEndRate) || 0,
    dimensions: { ...(pack0.dimensions || {}), width: Number(pack0.dimensions?.width) || 0, length: Number(pack0.dimensions?.length) || 0, height: Number(pack0.dimensions?.height) || 0, areaSq: packingMath.areaSq, volumeCubic: packingMath.volumeCubic },
  };
  if (canViewPurchasePrice) {
    baseUnitPayload.traderPurchaseRate = Number(form.baseUnit.traderPurchaseRate) || 0;
    pack0Payload.traderPurchaseRate = Number(pack0.traderPurchaseRate) || 0;
  } else {
    delete baseUnitPayload.traderPurchaseRate;
    delete pack0Payload.traderPurchaseRate;
  }
  return { ...form, posPermission: form.posPermission !== false, bookingPermission: form.bookingPermission !== false, companyId: form.companyId || null, brandId: form.brandId || null, categoryId: form.categoryId || null, subCategoryId: form.subCategoryId || null, baseUnit: baseUnitPayload, packingUnits: [pack0Payload] };
}

const VERSION_TONE = {
  ACTIVE_DEFAULT: 'bg-[var(--status-success)]/12 text-[var(--status-success)] border-[var(--status-success)]/30',
  COEXISTING: 'bg-[var(--status-warning)]/12 text-[var(--status-warning)] border-[var(--status-warning)]/30',
  DEPLETED: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
};

export default function ProductUnitPanels({
  form,
  baseWeightKg,
  pack0,
  packingMath,
  canViewPurchasePrice = false,
  updateBase,
  updatePack0,
  updatePackDim,
  onApplyRates,
  onToggleField,
  onCreateUnitVersion,
  isSubmitting,
}) {
  const handleAutoCalcRates = () => {
    const conv = Math.max(1, Number(pack0.conversionQty) || 1);
    const baseRate = Number(form.baseUnit.traderPurchaseRate) || Number(pack0.traderPurchaseRate) / conv || 0;
    const rates = suggestTierRates(baseRate, conv);
    if (onApplyRates) {
      onApplyRates(rates);
    } else {
      updateBase('traderPurchaseRate', rates.basePurchaseRate);
      updateBase('wholesaleSaleRate', rates.baseWholesaleRate);
      updateBase('posRetailEndRate', rates.baseRetailRate);
      updatePack0('traderPurchaseRate', rates.packPurchaseRate);
    }
  };

  const versions =
    Array.isArray(form.unitVersions) && form.unitVersions.length > 0
      ? form.unitVersions
      : [
          {
            versionNo: 1,
            unitVersionId: 'UV-1',
            unitName: pack0.unitName || 'Carton',
            conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
            versionStatus: 'ACTIVE_DEFAULT',
          },
        ];

  return (
    <>
      <div className="rounded-xl border p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="flex items-center gap-2.5 rounded-lg border p-2.5 bg-[var(--bg-canvas)] cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={form.posPermission !== false}
            onChange={(e) => onToggleField?.('posPermission', e.target.checked)}
            className="accent-[var(--accent-primary)]"
          />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">POS Sale Allowed</p>
            <p className="text-[11px] text-[var(--text-muted)]">Allow direct counter checkout via POS</p>
          </div>
        </label>
        <label className="flex items-center gap-2.5 rounded-lg border p-2.5 bg-[var(--bg-canvas)] cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={form.bookingPermission !== false}
            onChange={(e) => onToggleField?.('bookingPermission', e.target.checked)}
            className="accent-[var(--accent-primary)]"
          />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Order Booking Allowed</p>
            <p className="text-[11px] text-[var(--text-muted)]">Allow Booker &amp; Sales order creation</p>
          </div>
        </label>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
            Base Unit &amp; 3-Tier Pricing
          </h3>
          <div className="flex items-center gap-3">
            {canViewPurchasePrice && (
              <button
                type="button"
                onClick={handleAutoCalcRates}
                className="inline-flex items-center gap-1 rounded-md border bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-90"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Auto Calculate Pack Rates</span>
              </button>
            )}
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              Base Weight: {baseWeightKg} Kg
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Unit Name *</label>
              <input value={form.baseUnit.unitName} onChange={(e) => updateBase('unitName', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Weight (Optional)</label>
              <input type="number" step="0.001" value={form.baseUnit.weightValue} onChange={(e) => updateBase('weightValue', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Weight Unit (Optional)</label>
              <select value={form.baseUnit.weightUnit} onChange={(e) => updateBase('weightUnit', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
                <option value="Kg">Kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
              </select>
            </div>
            {canViewPurchasePrice && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Purchase Rate (Optional — Batch Cost)</label>
                <input type="number" step="0.01" value={form.baseUnit.traderPurchaseRate ?? 0} onChange={(e) => updateBase('traderPurchaseRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Wholesale Rate *</label>
              <input type="number" step="0.01" value={form.baseUnit.wholesaleSaleRate} onChange={(e) => updateBase('wholesaleSaleRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">POS End Rate *</label>
              <input type="number" step="0.01" value={form.baseUnit.posRetailEndRate} onChange={(e) => updateBase('posRetailEndRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
          </div>
          <ImageDropzone label="Base Unit Image (Optional)" folder="products" value={form.baseUnit.image} isSubmitting={isSubmitting} onChange={(img) => updateBase('image', img)} />
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
            Packing Unit, Conversion &amp; Dimensions
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            <span>Pack Weight: {packingMath.packingWeightKg} Kg</span>
            <span>Area: {packingMath.areaSq}</span>
            <span>Volume: {packingMath.volumeCubic}</span>
            {onCreateUnitVersion && (
              <button
                type="button"
                onClick={onCreateUnitVersion}
                className="inline-flex items-center gap-1 rounded-md border bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-sans font-semibold text-[var(--accent-primary)] hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Pack Version</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <span
              key={v.unitVersionId}
              className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold ${
                VERSION_TONE[v.versionStatus] || VERSION_TONE.DEPLETED
              }`}
            >
              {v.unitVersionId} • 1 {v.unitName} = {v.conversionQty} {form.baseUnit.unitName || 'Pcs'} • {v.versionStatus}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Name (Optional)</label>
              <input value={pack0.unitName} onChange={(e) => updatePack0('unitName', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Base Qty / Pack *</label>
              <input type="number" min="1" value={pack0.conversionQty} onChange={(e) => updatePack0('conversionQty', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Size Unit (Optional)</label>
              <select value={pack0.dimensions?.sizeUnit || 'Inch'} onChange={(e) => updatePackDim('sizeUnit', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
                <option value="Inch">Inch</option>
                <option value="Feet">Feet</option>
                <option value="cm">cm</option>
              </select>
            </div>
            {canViewPurchasePrice && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Purchase (Optional — Batch Cost)</label>
                <input type="number" step="0.01" value={pack0.traderPurchaseRate ?? 0} onChange={(e) => updatePack0('traderPurchaseRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Wholesale (Optional)</label>
              <input type="number" step="0.01" value={pack0.wholesaleSaleRate} onChange={(e) => updatePack0('wholesaleSaleRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack POS End (Optional)</label>
              <input type="number" step="0.01" value={pack0.posRetailEndRate} onChange={(e) => updatePack0('posRetailEndRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Width (Optional)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.width || 0} onChange={(e) => updatePackDim('width', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Length (Optional)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.length || 0} onChange={(e) => updatePackDim('length', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Height (Optional)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.height || 0} onChange={(e) => updatePackDim('height', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
          </div>
          <ImageDropzone label="Pack Unit Image (Optional)" folder="products" value={pack0.image} isSubmitting={isSubmitting} onChange={(img) => updatePack0('image', img)} />
        </div>
      </div>
    </>
  );
}
