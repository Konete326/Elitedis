import { useMemo, useState } from 'react';
import { FormModal } from '../../components/global';
import FormModeToggle, { useFormMode } from '../../components/shared/FormModeToggle';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import ProductUnitPanels, {
  PRODUCT_RATE_LIST_COLUMNS,
  buildEmptyProduct,
  buildProductPayload,
  computeBaseWeightKg,
  computePackingMath,
} from './ProductUnitPanels';
import { useAuth } from '../../context/AuthContext';
import { suggestCode, validateField } from '../../utils/validation';

export { PRODUCT_RATE_LIST_COLUMNS, buildEmptyProduct, buildProductPayload, computeBaseWeightKg, computePackingMath };

const getId = (ref) => (ref && typeof ref === 'object' ? String(ref._id || '') : String(ref || ''));

export default function ProductFormModal({
  isOpen,
  onClose,
  initialValue,
  isEditing,
  canViewPurchasePrice: canViewPurchasePriceProp,
  existingCount = 0,
  existingCodes = [],
  companies = [],
  brands = [],
  categories = [],
  subCategories = [],
  onSave,
  isSubmitting,
}) {
  const { canViewPurchasePrice: authCanViewPurchasePrice } = useAuth();
  const canViewPurchasePrice = canViewPurchasePriceProp ?? authCanViewPurchasePrice;
  const [form, setForm] = useState(() => initialValue || buildEmptyProduct());
  const [touched, setTouched] = useState({});
  const [draftVersionId, setDraftVersionId] = useState(null);
  const [formMode, setFormMode] = useFormMode();
  const isAdvanced = formMode === 'advanced';

  const skuError = touched.skuCode ? validateField('sku', form.skuCode, { required: true, label: 'SKU Code' }) : '';
  const nameError = touched.productName ? validateField('required', form.productName, { required: true, minLength: 2, label: 'Product Name' }) : '';
  const barcodeError = touched.barcode ? validateField('barcode', form.barcode, { label: 'Barcode' }) : '';

  const baseWeightKg = useMemo(() => computeBaseWeightKg(form.baseUnit), [form.baseUnit]);
  const pack0 = form.packingUnits?.[0] || buildEmptyProduct().packingUnits[0];
  const packingMath = useMemo(() => computePackingMath(baseWeightKg, pack0), [baseWeightKg, pack0]);

  const filteredBrands = useMemo(
    () => (form.companyId ? brands.filter((b) => getId(b.companyId) === String(form.companyId)) : brands),
    [brands, form.companyId]
  );

  const filteredSubCategories = useMemo(
    () => (form.categoryId ? subCategories.filter((s) => getId(s.parentCategoryId) === String(form.categoryId)) : subCategories),
    [subCategories, form.categoryId]
  );

  const updateBase = (key, val) => setForm((p) => ({ ...p, baseUnit: { ...p.baseUnit, [key]: val } }));
  const updatePack0 = (key, val) =>
    setForm((p) => {
      const nextPack = { ...pack0, [key]: val };
      const nextVersions =
        draftVersionId && Array.isArray(p.unitVersions)
          ? p.unitVersions.map((v) =>
              v.unitVersionId === draftVersionId
                ? { ...v, unitName: nextPack.unitName || 'Carton', conversionQty: Math.max(1, Number(nextPack.conversionQty) || 1) }
                : v
            )
          : p.unitVersions;
      return { ...p, packingUnits: [nextPack], unitVersions: nextVersions };
    });
  const updatePackDim = (key, val) =>
    setForm((p) => ({ ...p, packingUnits: [{ ...pack0, dimensions: { ...(pack0.dimensions || {}), [key]: val } }] }));

  const handleCompanyChange = (nextCompanyId) => {
    const matchingBrands = nextCompanyId ? brands.filter((b) => getId(b.companyId) === nextCompanyId) : [];
    const matchingCats = nextCompanyId ? categories.filter((c) => getId(c.companyId) === nextCompanyId) : [];
    setForm((p) => {
      const nextBrandId = matchingBrands.length === 1 ? getId(matchingBrands[0]) : '';
      const nextCatId = matchingCats.length === 1 ? getId(matchingCats[0]) : p.categoryId;
      const matchingSubs = nextCatId ? subCategories.filter((s) => getId(s.parentCategoryId) === nextCatId) : [];
      return {
        ...p,
        companyId: nextCompanyId,
        brandId: nextBrandId,
        categoryId: nextCatId,
        subCategoryId: nextCatId !== p.categoryId ? (matchingSubs.length === 1 ? getId(matchingSubs[0]) : '') : p.subCategoryId,
      };
    });
  };

  const handleBrandChange = (nextBrandId) => {
    const brand = brands.find((b) => getId(b) === nextBrandId);
    const brandCompId = getId(brand?.companyId);
    setForm((p) => {
      const nextCompId = brandCompId || p.companyId;
      const linkedCats = nextBrandId ? categories.filter((c) => (c.linkedBrandIds || []).some((lb) => getId(lb) === nextBrandId)) : [];
      const compCats = nextCompId ? categories.filter((c) => getId(c.companyId) === nextCompId) : [];
      const catPool = linkedCats.length > 0 ? linkedCats : compCats;
      const nextCatId = catPool.length === 1 ? getId(catPool[0]) : p.categoryId;
      const matchingSubs = nextCatId ? subCategories.filter((s) => getId(s.parentCategoryId) === nextCatId) : [];
      return {
        ...p,
        brandId: nextBrandId,
        companyId: nextCompId,
        categoryId: nextCatId,
        subCategoryId: nextCatId !== p.categoryId ? (matchingSubs.length === 1 ? getId(matchingSubs[0]) : '') : p.subCategoryId,
      };
    });
  };

  const handleCategoryChange = (nextCatId) => {
    const cat = categories.find((c) => getId(c) === nextCatId);
    const linkedBrandIds = (cat?.linkedBrandIds || []).map(getId).filter(Boolean);
    const matchingSubs = nextCatId ? subCategories.filter((s) => getId(s.parentCategoryId) === nextCatId) : [];
    setForm((p) => {
      const nextBrandId = linkedBrandIds.length === 1 ? linkedBrandIds[0] : p.brandId;
      const singleBrandCompId = linkedBrandIds.length === 1 ? getId(brands.find((b) => getId(b) === nextBrandId)?.companyId) : '';
      return {
        ...p,
        categoryId: nextCatId,
        companyId: p.companyId || getId(cat?.companyId) || singleBrandCompId,
        brandId: nextBrandId,
        subCategoryId: matchingSubs.length === 1 ? getId(matchingSubs[0]) : '',
      };
    });
  };

  const handleSubCategoryChange = (nextSubId) => {
    const sub = subCategories.find((s) => getId(s) === nextSubId);
    const parentCatId = getId(sub?.parentCategoryId);
    const parentCat = categories.find((c) => getId(c) === parentCatId);
    setForm((p) => ({
      ...p,
      subCategoryId: nextSubId,
      categoryId: parentCatId || p.categoryId,
      companyId: p.companyId || getId(sub?.companyId) || getId(parentCat?.companyId),
    }));
  };

  const handleCreateUnitVersion = () => {
    const currentList = form.unitVersions?.length
      ? form.unitVersions
      : [
          {
            versionNo: 1,
            unitVersionId: 'UV-1',
            unitName: pack0.unitName || 'Carton',
            conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
            packingWeightKg: packingMath.packingWeightKg,
            effectiveFrom: new Date().toISOString(),
            versionStatus: 'ACTIVE_DEFAULT',
          },
        ];
    const nextNo = currentList.reduce((max, v) => Math.max(max, Number(v.versionNo) || 0), 0) + 1;
    const nextId = `UV-${nextNo}`;
    const updated = currentList.map((v) =>
      v.versionStatus === 'ACTIVE_DEFAULT' ? { ...v, versionStatus: isEditing ? 'COEXISTING' : 'DEPLETED' } : v
    );
    updated.push({
      versionNo: nextNo,
      unitVersionId: nextId,
      unitName: pack0.unitName || 'Carton',
      conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
      packingWeightKg: packingMath.packingWeightKg,
      effectiveFrom: new Date().toISOString(),
      versionStatus: 'ACTIVE_DEFAULT',
    });
    setDraftVersionId(nextId);
    setForm((p) => ({ ...p, unitVersions: updated }));
  };

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
    onSave(buildProductPayload(form, baseWeightKg, pack0, packingMath, canViewPurchasePrice));
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)]">{isAdvanced ? 'Showing all catalog fields' : 'Quick entry: essential SKU & pricing fields'}</span>
          <FormModeToggle mode={formMode} onChange={setFormMode} />
        </div>
        {isAdvanced && (companies.length === 0 || brands.length === 0 || categories.length === 0) && (
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
          {isAdvanced && (
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
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
            <select value={form.companyId} onChange={(e) => handleCompanyChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
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
            <select value={form.brandId} onChange={(e) => handleBrandChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
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
            <select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
              <option value="">None / Optional...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {isAdvanced && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sub-Category <span className="text-[var(--text-muted)] font-normal">(Optional)</span></label>
              <select value={form.subCategoryId} onChange={(e) => handleSubCategoryChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm">
                <option value="">None / Optional...</option>
                {filteredSubCategories.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          canViewPurchasePrice={canViewPurchasePrice}
          updateBase={updateBase}
          updatePack0={updatePack0}
          updatePackDim={updatePackDim}
          onApplyRates={applySuggestedRates}
          onToggleField={(k, v) => setForm((p) => ({ ...p, [k]: v }))}
          onCreateUnitVersion={handleCreateUnitVersion}
          isSubmitting={isSubmitting}
        />
      </div>
    </FormModal>
  );
}
