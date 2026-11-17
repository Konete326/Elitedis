import { Calculator } from 'lucide-react';
import { ImageDropzone } from '../../components/global';
import { suggestTierRates } from '../../utils/validation';

export default function ProductUnitPanels({
  form,
  baseWeightKg,
  pack0,
  packingMath,
  updateBase,
  updatePack0,
  updatePackDim,
  onApplyRates,
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

  return (
    <>
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
            Base Unit &amp; 3-Tier Pricing
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAutoCalcRates}
              className="inline-flex items-center gap-1 rounded-md border bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-90"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Auto Calculate Pack Rates</span>
            </button>
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              Base Weight: {baseWeightKg} Kg
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Unit Name</label>
              <input value={form.baseUnit.unitName} onChange={(e) => updateBase('unitName', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Weight Value</label>
              <input type="number" step="0.001" value={form.baseUnit.weightValue} onChange={(e) => updateBase('weightValue', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Weight Unit</label>
              <select value={form.baseUnit.weightUnit} onChange={(e) => updateBase('weightUnit', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
                <option value="Kg">Kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Trader Purchase Rate</label>
              <input type="number" step="0.01" value={form.baseUnit.traderPurchaseRate} onChange={(e) => updateBase('traderPurchaseRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Wholesale Sale Rate</label>
              <input type="number" step="0.01" value={form.baseUnit.wholesaleSaleRate} onChange={(e) => updateBase('wholesaleSaleRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">POS / Retail End Rate</label>
              <input type="number" step="0.01" value={form.baseUnit.posRetailEndRate} onChange={(e) => updateBase('posRetailEndRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
          </div>
          <ImageDropzone label="Base Unit Image" folder="products" value={form.baseUnit.image} isSubmitting={isSubmitting} onChange={(img) => updateBase('image', img)} />
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
            Packing Unit, Conversion &amp; Dimensions
          </h3>
          <div className="flex flex-wrap gap-3 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            <span>Pack Weight: {packingMath.packingWeightKg} Kg</span>
            <span>Area: {packingMath.areaSq}</span>
            <span>Volume: {packingMath.volumeCubic}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Unit Name</label>
              <input value={pack0.unitName} onChange={(e) => updatePack0('unitName', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Base Qty / Pack</label>
              <input type="number" min="1" value={pack0.conversionQty} onChange={(e) => updatePack0('conversionQty', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Size Unit</label>
              <select value={pack0.dimensions?.sizeUnit || 'Inch'} onChange={(e) => updatePackDim('sizeUnit', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs">
                <option value="Inch">Inch</option>
                <option value="Feet">Feet</option>
                <option value="cm">cm</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Purchase Rate</label>
              <input type="number" step="0.01" value={pack0.traderPurchaseRate} onChange={(e) => updatePack0('traderPurchaseRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack Wholesale Rate</label>
              <input type="number" step="0.01" value={pack0.wholesaleSaleRate} onChange={(e) => updatePack0('wholesaleSaleRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Pack POS End Rate</label>
              <input type="number" step="0.01" value={pack0.posRetailEndRate} onChange={(e) => updatePack0('posRetailEndRate', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Width (W)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.width || 0} onChange={(e) => updatePackDim('width', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Length (L)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.length || 0} onChange={(e) => updatePackDim('length', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Height (H)</label>
              <input type="number" step="0.1" value={pack0.dimensions?.height || 0} onChange={(e) => updatePackDim('height', e.target.value)} className="w-full h-9 px-2.5 rounded-lg border bg-[var(--bg-elevated)] text-xs tabular-nums" />
            </div>
          </div>
          <ImageDropzone label="Pack Unit Image" folder="products" value={pack0.image} isSubmitting={isSubmitting} onChange={(img) => updatePack0('image', img)} />
        </div>
      </div>
    </>
  );
}
