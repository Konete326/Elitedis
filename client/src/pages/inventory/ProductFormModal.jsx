import { useMemo, useState } from 'react';
import { FormModal } from '../../components/global';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import ProductUnitPanels from './ProductUnitPanels';
import { suggestCode, validateField } from '../../utils/validation';

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
    showOnMarketplace: false,
    shortDescription: '',
    baseUnit: {
      unitName: 'Piece',
      weightValue: 0,
      weightUnit: 'Kg',
      traderPurchaseRate: 0,
      wholesaleSaleRate: 0,
      posRetailEndRate: 0,
      image: null,
    },
    packingUnits: [
      {
        unitName: 'Carton',
        conversionQty: 24,
        weightUnit: 'Kg',
        traderPurchaseRate: 0,
        wholesaleSaleRate: 0,
        posRetailEndRate: 0,
        dimensions: { sizeUnit: 'Inch', width: 0, length: 0, height: 0 },
        image: null,
        isDefaultStockUnit: true,
      },
    ],
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
  return {
    packingWeightKg: Number((baseWeightKg * conv).toFixed(4)),
    areaSq: Number((w * l).toFixed(3)),
    volumeCubic: Number((w * l * h).toFixed(3)),
  };
}

export function buildProductPayload(form, baseWeightKg, pack0, packingMath) {
  return {
    ...form,
    companyId: form.companyId || null,
    brandId: form.brandId || null,
    categoryId: form.categoryId || null,
    subCategoryId: form.subCategoryId || null,
    baseUnit: {
      ...form.baseUnit,
      weightValue: Number(form.baseUnit.weightValue) || 0,
      weightInKg: baseWeightKg,
      traderPurchaseRate: Number(form.baseUnit.traderPurchaseRate) || 0,
      wholesaleSaleRate: Number(form.baseUnit.wholesaleSaleRate) || 0,
      posRetailEndRate: Number(form.baseUnit.posRetailEndRate) || 0,
    },
    packingUnits: [
      {
        ...pack0,
        conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
        packingWeightKg: packingMath.packingWeightKg,
        traderPurchaseRate: Number(pack0.traderPurchaseRate) || 0,
        wholesaleSaleRate: Number(pack0.wholesaleSaleRate) || 0,
        posRetailEndRate: Number(pack0.posRetailEndRate) || 0,
        dimensions: {
          ...(pack0.dimensions || {}),
          width: Number(pack0.dimensions?.width) || 0,
          length: Number(pack0.dimensions?.length) || 0,
          height: Number(pack0.dimensions?.height) || 0,
          areaSq: packingMath.areaSq,
          volumeCubic: packingMath.volumeCubic,
        },
      },
    ],
  };
}

export default function ProductFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  existingCount = 0,
  existingCodes = [],
  companies = [],
  brands = [],
  categories = [],
  subCategories = [],
  onSave,
  isSubmitting,
}) {
  const [form, setForm] = useState(() => initialValue || buildEmptyProduct());
  const [touched, setTouched] = useState({});

  const skuError = touched.skuCode ? validateField('sku', form.skuCode, { required: true, label: 'SKU Code' }) : '';
  const nameError = touched.productName ? validateField('required', form.productName, { required: true, minLength: 2, label: 'Product Name' }) : '';
  const barcodeError = touched.barcode ? validateField('barcode', form.barcode, { label: 'Barcode' }) : '';

  const baseWeightKg = useMemo(() => computeBaseWeightKg(form.baseUnit), [form.baseUnit]);
  const pack0 = form.packingUnits?.[0] || buildEmptyProduct().packingUnits[0];
  const packingMath = useMemo(() => computePackingMath(baseWeightKg, pack0), [baseWeightKg, pack0]);

  const filteredBrands = useMemo(
    () =>
      form.companyId
        ? brands.filter((b) => String(b.companyId?._id || b.companyId) === String(form.companyId))
        : brands,
    [brands, form.companyId]
  );

  const filteredSubCategories = useMemo(
    () =>
      form.categoryId
        ? subCategories.filter(
            (s) => String(s.parentCategoryId?._id || s.parentCategoryId) === String(form.categoryId)
          )
        : subCategories,
    [subCategories, form.categoryId]
  );

  const updateBase = (key, val) => setForm((p) => ({ ...p, baseUnit: { ...p.baseUnit, [key]: val } }));
  const updatePack0 = (key, val) => setForm((p) => ({ ...p, packingUnits: [{ ...pack0, [key]: val }] }));
  const updatePackDim = (key, val) =>
    setForm((p) => ({ ...p, packingUnits: [{ ...pack0, dimensions: { ...(pack0.dimensions || {}), [key]: val } }] }));

  const applySuggestedRates = (rates) => {
    setForm((p) => ({
      ...p,
      baseUnit: {
        ...p.baseUnit,
        traderPurchaseRate: rates.basePurchaseRate,
        wholesaleSaleRate: rates.baseWholesaleRate,
        posRetailEndRate: rates.baseRetailRate,
      },
      packingUnits: [
        {
          ...pack0,
          traderPurchaseRate: rates.packPurchaseRate,
          wholesaleSaleRate: rates.packWholesaleRate,
          posRetailEndRate: rates.packRetailRate,
        },
      ],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ skuCode: true, productName: true, barcode: true });
    if (
      validateField('sku', form.skuCode, { required: true, label: 'SKU Code' }) ||
      validateField('required', form.productName, { required: true, minLength: 2, label: 'Product Name' }) ||
      validateField('barcode', form.barcode, { label: 'Barcode' })
    ) {
      return;
    }
    onSave(buildProductPayload(form, baseWeightKg, pack0, packingMath));
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product Master' : 'Add Product Master'}
      subtitle="Static catalog, multi-unit conversion, 3-tier pricing & dimensions"
      size="xl"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-5">
        {(companies.length === 0 || brands.length === 0 || categories.length === 0) && (
          <SetupGuideBanner
            isOptional
            title="Optional Catalog Grouping"
            missingMessage="You can create Products right away! Companies, Brands, and Categories are optional — add them anytime if you want catalog filtering."
            steps={[
              { label: 'Company (Optional)', done: companies.length > 0, to: '/inventory/companies', actionLabel: 'Companies' },
              { label: 'Brand (Optional)', done: brands.length > 0, to: '/inventory/brands', actionLabel: 'Brands' },
              { label: 'Category (Optional)', done: categories.length > 0, to: '/inventory/categories', actionLabel: 'Categories' },
            ]}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">SKU Code <span className="text-[var(--status-danger)]">*</span></label>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, skuCode: suggestCode('SKU', existingCount, existingCodes) }))}
                className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Auto Code
              </button>
            </div>
            <input
              required
              value={form.skuCode}
              onChange={(e) => setForm((p) => ({ ...p, skuCode: e.target.value.toUpperCase() }))}
              onBlur={() => setTouched((p) => ({ ...p, skuCode: true }))}
              placeholder="SKU-001"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${skuError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {skuError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{skuError}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Product Name <span className="text-[var(--status-danger)]">*</span></label>
            <input
              required
              value={form.productName}
              onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, productName: true }))}
              placeholder="SURAJ Double Horse Rs10"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm ${nameError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {nameError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Barcode <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <input
              value={form.barcode}
              onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
              onBlur={() => setTouched((p) => ({ ...p, barcode: true }))}
              placeholder="8964000123456"
              className={`w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono ${barcodeError ? 'border-[var(--status-danger)]' : ''}`}
            />
            {barcodeError && <p className="mt-1 text-[11px] text-[var(--status-danger)]">{barcodeError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <select value={form.companyId} onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value, brandId: '' }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">None / Optional...</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <select value={form.brandId} onChange={(e) => setForm((p) => ({ ...p, brandId: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">None / Optional...</option>
              {filteredBrands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.brandName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Category <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subCategoryId: '' }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">None / Optional...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sub-Category <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <select value={form.subCategoryId} onChange={(e) => setForm((p) => ({ ...p, subCategoryId: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">None / Optional...</option>
              {filteredSubCategories.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status <span className="text-[var(--status-danger)]">*</span></label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <ProductUnitPanels
          form={form}
          baseWeightKg={baseWeightKg}
          pack0={pack0}
          packingMath={packingMath}
          updateBase={updateBase}
          updatePack0={updatePack0}
          updatePackDim={updatePackDim}
          onApplyRates={applySuggestedRates}
          isSubmitting={isSubmitting}
        />
      </div>
    </FormModal>
  );
}
