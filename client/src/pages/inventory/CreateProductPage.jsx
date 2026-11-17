import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import PageHeader from '../../components/shared/PageHeader';
import ProductUnitPanels from './ProductUnitPanels';
import { buildEmptyProduct } from './ProductFormModal';
import { extractListPayload } from '../../utils/formatters';

export default function CreateProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [form, setForm] = useState(buildEmptyProduct);
  const [saveAndNew, setSaveAndNew] = useState(false);

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

  const baseWeightKg = useMemo(() => {
    const val = Number(form.baseUnit?.weightValue) || 0;
    const isSmall = form.baseUnit?.weightUnit === 'g' || form.baseUnit?.weightUnit === 'ml';
    return Number((isSmall ? val / 1000 : val).toFixed(4));
  }, [form.baseUnit?.weightValue, form.baseUnit?.weightUnit]);

  const pack0 = form.packingUnits?.[0] || buildEmptyProduct().packingUnits[0];
  const packingMath = useMemo(() => {
    const conv = Math.max(1, Number(pack0.conversionQty) || 1);
    const w = Number(pack0.dimensions?.width) || 0;
    const l = Number(pack0.dimensions?.length) || 0;
    const h = Number(pack0.dimensions?.height) || 0;
    return {
      packingWeightKg: Number((baseWeightKg * conv).toFixed(4)),
      areaSq: Number((w * l).toFixed(3)),
      volumeCubic: Number((w * l * h).toFixed(3)),
    };
  }, [baseWeightKg, pack0]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
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
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Add Product Workbench"
        subtitle="Multi-unit conversion, 3-tier pricing, physical dimensions, and Cloudinary media"
        actions={
          <button
            type="button"
            onClick={() => navigate('/inventory/products')}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Product Catalog</span>
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border bg-[var(--bg-surface)] p-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">SKU Code</label>
              <input
                required
                value={form.skuCode}
                onChange={(e) => setForm((p) => ({ ...p, skuCode: e.target.value.toUpperCase() }))}
                placeholder="SDH-10"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Product Name</label>
              <input
                required
                value={form.productName}
                onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                placeholder="SURAJ Double Horse Rs10"
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Barcode</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company</label>
              <select
                required
                value={form.companyId}
                onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value, brandId: '' }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select company...</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand</label>
              <select
                required
                value={form.brandId}
                onChange={(e) => setForm((p) => ({ ...p, brandId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select brand...</option>
                {filteredBrands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.brandName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Category</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subCategoryId: '' }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sub-Category</label>
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
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
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
