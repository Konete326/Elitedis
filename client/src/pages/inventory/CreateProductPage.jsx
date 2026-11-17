import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import PageHeader from '../../components/shared/PageHeader';
import SetupGuideBanner from '../../components/shared/SetupGuideBanner';
import ProductUnitPanels from './ProductUnitPanels';
import {
  buildEmptyProduct,
  buildProductPayload,
  computeBaseWeightKg,
  computePackingMath,
} from './ProductFormModal';
import { extractListPayload } from '../../utils/formatters';
import { suggestCode, validateField } from '../../utils/validation';

export default function CreateProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [form, setForm] = useState(buildEmptyProduct);
  const [touched, setTouched] = useState({});
  const [saveAndNew, setSaveAndNew] = useState(false);

  const skuError = touched.skuCode ? validateField('sku', form.skuCode, { required: true, label: 'SKU Code' }) : '';
  const nameError = touched.productName ? validateField('required', form.productName, { required: true, minLength: 2, label: 'Product Name' }) : '';
  const barcodeError = touched.barcode ? validateField('barcode', form.barcode, { label: 'Barcode' }) : '';

  const companiesQuery = useQuery({
    queryKey: ['companies-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/companies', { params: { limit: 100 } })).data,
  });
  const brandsQuery = useQuery({
    queryKey: ['brands-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/brands', { params: { limit: 100 } })).data,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/categories', { params: { limit: 100 } })).data,
  });
  const subCategoriesQuery = useQuery({
    queryKey: ['sub-categories-options'],
    queryFn: async () => extractListPayload(await apiClient.get('/inventory/sub-categories', { params: { limit: 100 } })).data,
  });

  const companies = companiesQuery.data || [];
  const brands = brandsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const subCategories = subCategoriesQuery.data || [];

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

  const saveMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/inventory/products', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-options'] });
      addToast({ type: 'success', message: 'Product added to master catalog.' });
      if (saveAndNew) {
        setForm(buildEmptyProduct());
      } else {
        navigate('/inventory/products');
      }
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not create product.' });
    },
  });

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
    saveMutation.mutate(buildProductPayload(form, baseWeightKg, pack0, packingMath));
  };

  const missingPrereqs =
    !companiesQuery.isLoading &&
    !brandsQuery.isLoading &&
    !categoriesQuery.isLoading &&
    (companies.length === 0 || brands.length === 0 || categories.length === 0);

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Add Product Workbench"
        subtitle="Multi-unit conversion, 3-tier pricing, physical dimensions, and Cloudinary media"
        actions={
          <button
            type="button"
            onClick={() => navigate('/inventory/products')}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Product Catalog</span>
          </button>
        }
      />

      {missingPrereqs && (
        <SetupGuideBanner
          isLoading={companiesQuery.isLoading || brandsQuery.isLoading || categoriesQuery.isLoading}
          isOptional
          title="Optional Catalog Grouping"
          missingMessage="Add Products anytime! Companies, Brands, and Categories are optional for catalog filtering."
          steps={[
            { label: 'Company (Optional)', done: companies.length > 0, to: '/inventory/companies', actionLabel: 'Companies' },
            { label: 'Brand (Optional)', done: brands.length > 0, to: '/inventory/brands', actionLabel: 'Brands' },
            { label: 'Category (Optional)', done: categories.length > 0, to: '/inventory/categories', actionLabel: 'Categories' },
          ]}
        />
      )}

      <form onSubmit={handleSubmit} className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 lg:overflow-hidden">
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-xl border bg-[var(--bg-surface)] p-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">SKU Code <span className="text-[var(--status-danger)]">*</span></label>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, skuCode: suggestCode('SKU', Date.now() % 900) }))}
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
              <select
                value={form.companyId}
                onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value, brandId: '' }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
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
              <select
                value={form.brandId}
                onChange={(e) => setForm((p) => ({ ...p, brandId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
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
              <select
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subCategoryId: '' }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
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
              <select
                value={form.subCategoryId}
                onChange={(e) => setForm((p) => ({ ...p, subCategoryId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Optional...</option>
                {filteredSubCategories.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status <span className="text-[var(--status-danger)]">*</span></label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-1.5 h-9 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnMarketplace}
                  onChange={(e) => setForm((p) => ({ ...p, showOnMarketplace: e.target.checked }))}
                  className="accent-[var(--accent-primary)]"
                />
                <span>Marketplace</span>
              </label>
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
            isSubmitting={saveMutation.isPending}
          />
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            onClick={() => setSaveAndNew(true)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border bg-[var(--bg-surface)] text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Save &amp; Add Another</span>
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            onClick={() => setSaveAndNew(false)}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
          >
            <Check className="w-4 h-4" />
            <span>{saveMutation.isPending ? 'Saving...' : 'Save Product'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
