import { Company, Brand, Category, Product, StockBatch } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { getTenantModel, getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { preserveHiddenProductRates, stripProductPurchaseRates } from '../middlewares/rbacMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { applyProductUnitVersionChange } from '../services/stockLedger.service.js';

async function safeDestroyImages(publicIds = []) {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];
  await Promise.allSettled(uniqueIds.map((id) => destroyImage(id)));
}

function nullIfEmpty(val) {
  return val === '' || val === undefined ? null : val;
}

function sanitizeInventoryPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload.contacts)) {
    payload.contacts = payload.contacts
      .filter((c) => (c?.personName || '').trim() || (c?.contactNo || '').trim())
      .map((c) => ({ ...c, personName: (c?.personName || '').trim(), contactNo: (c?.contactNo || '').trim() }));
  }
  if (Array.isArray(payload.bankAccounts)) {
    payload.bankAccounts = payload.bankAccounts.filter(
      (a) => (a?.providerName || '').trim() || (a?.accountNo || '').trim()
    );
  }
  if (Array.isArray(payload.socialLinks)) {
    payload.socialLinks = payload.socialLinks.filter((s) => (s?.url || '').trim());
  }

  for (const imgField of ['logo', 'coverImage', 'image']) {
    if (payload[imgField] === null) payload[imgField] = { url: '', publicId: '' };
  }
  if (payload.baseUnit && payload.baseUnit.image === null) {
    payload.baseUnit.image = { url: '', publicId: '' };
  }
  if (Array.isArray(payload.packingUnits)) {
    payload.packingUnits = payload.packingUnits.map((pack) =>
      pack && pack.image === null ? { ...pack, image: { url: '', publicId: '' } } : pack
    );
  }
  return payload;
}

function buildResourceHandlers(config) {
  const { Model, name, searchFields, filterKeys = [], populate = '', defaultSortBy = 'createdAt', beforeCreate, beforeUpdate, beforeDelete, extractPublicIds, afterRead } = config;

  return {
    list: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultSortBy });
      const extra = { ...(config.fixedFilter || {}) };
      for (const key of filterKeys) {
        if (req.query[key] !== undefined && req.query[key] !== '') {
          extra[key] = req.query[key] === 'true' ? true : req.query[key] === 'false' ? false : req.query[key];
        }
      }
      const filter = buildScopedFilter(req, extra, searchFields, searchRegex);
      const query = M.find(filter).sort(sort).skip(skip).limit(limit);
      if (populate) query.populate(populate);
      const [records, totalRecords] = await Promise.all([query.lean(), M.countDocuments(filter)]);
      const data = afterRead ? records.map((r) => afterRead(r, req)) : records;
      res.status(200).json({ success: true, data, pagination: buildPaginationMeta(totalRecords) });
    }),

    getById: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const query = M.findOne({ _id: req.params.id, distributorId: req.distributorId, ...config.fixedFilter });
      if (populate) query.populate(populate);
      const record = await query.lean();
      if (!record) throw new AppError(`${name} not found.`, 404, 'NOT_FOUND');

      let extraStats = null;
      if (name === 'Brand') {
        const ProductM = getTenantModel('Product', Product);
        const [totalProducts, activeProducts] = await Promise.all([
          ProductM.countDocuments({ distributorId: req.distributorId, brandId: record._id }),
          ProductM.countDocuments({ distributorId: req.distributorId, brandId: record._id, status: 'ACTIVE' }),
        ]);
        extraStats = { totalProducts, activeProducts, inactiveProducts: totalProducts - activeProducts };
      }
      const shaped = afterRead ? afterRead(record, req) : record;
      res.status(200).json({ success: true, data: extraStats ? { ...shaped, stats: extraStats } : shaped });
    }),

    create: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const payload = { ...req.body, distributorId: req.distributorId, ...(config.fixedFilter || {}) };
      if (beforeCreate) await beforeCreate(payload, req);
      const created = await M.create(payload);
      const data = afterRead ? afterRead(created, req) : created;
      res.status(201).json({ success: true, data });
    }),

    update: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const existing = await M.findOne({ _id: req.params.id, distributorId: req.distributorId });
      if (!existing) throw new AppError(`${name} not found.`, 404, 'NOT_FOUND');
      const oldIds = extractPublicIds ? extractPublicIds(existing) : [];
      const payload = { ...req.body, distributorId: req.distributorId };
      if (beforeUpdate) await beforeUpdate(payload, existing, req);
      Object.assign(existing, payload);
      await existing.save();
      const newIds = new Set(extractPublicIds ? extractPublicIds(existing) : []);
      const removedIds = oldIds.filter((id) => !newIds.has(id));
      if (removedIds.length > 0) await safeDestroyImages(removedIds);
      const data = afterRead ? afterRead(existing, req) : existing;
      res.status(200).json({ success: true, data });
    }),

    remove: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const existing = await M.findOne({ _id: req.params.id, distributorId: req.distributorId });
      if (!existing) throw new AppError(`${name} not found.`, 404, 'NOT_FOUND');
      if (beforeDelete) await beforeDelete(existing, req);
      const oldIds = extractPublicIds ? extractPublicIds(existing) : [];
      await existing.deleteOne();
      if (oldIds.length > 0) await safeDestroyImages(oldIds);
      res.status(200).json({ success: true, message: `${name} deleted successfully.` });
    }),
  };
}

export const companyHandlers = buildResourceHandlers({
  Model: Company,
  name: 'Company',
  searchFields: ['companyCode', 'companyName', 'shortName', 'ownerName', 'supplierName'],
  filterKeys: ['status', 'businessType'],
  extractPublicIds: (doc) => [doc.logo?.publicId],
  beforeCreate: async (payload) => {
    sanitizeInventoryPayload(payload);
    if (!payload.companyCode) payload.companyCode = `CMP-${Date.now().toString().slice(-5)}`;
  },
  beforeUpdate: async (payload) => {
    sanitizeInventoryPayload(payload);
  },
  beforeDelete: async (doc, req) => {
    const { Brand: BrandM, Product: ProductM } = getTenantModels({ Brand, Product });
    const [hasBrands, hasProducts] = await Promise.all([
      BrandM.exists({ distributorId: req.distributorId, companyId: doc._id }),
      ProductM.exists({ distributorId: req.distributorId, companyId: doc._id }),
    ]);
    if (hasBrands || hasProducts) throw new AppError('Cannot delete company with linked brands or products.', 400, 'COMPANY_IN_USE');
  },
});

export const brandHandlers = buildResourceHandlers({
  Model: Brand,
  name: 'Brand',
  searchFields: ['brandCode', 'brandName', 'brandType', 'ownerName'],
  filterKeys: ['companyId', 'brandType', 'status'],
  populate: 'companyId',
  extractPublicIds: (doc) => [doc.logo?.publicId, doc.coverImage?.publicId],
  beforeCreate: async (payload, req) => {
    sanitizeInventoryPayload(payload);
    payload.companyId = nullIfEmpty(payload.companyId);
    if (payload.companyId && !(await getTenantModel('Company', Company).exists({ _id: payload.companyId, distributorId: req.distributorId }))) {
      throw new AppError('Selected Company was not found.', 400, 'PREREQUISITE_COMPANY_NOT_FOUND');
    }
    if (!payload.brandCode) payload.brandCode = `BRD-${Date.now().toString().slice(-5)}`;
  },
  beforeUpdate: async (payload, _existing, req) => {
    sanitizeInventoryPayload(payload);
    if ('companyId' in payload) {
      payload.companyId = nullIfEmpty(payload.companyId);
      if (payload.companyId && !(await getTenantModel('Company', Company).exists({ _id: payload.companyId, distributorId: req.distributorId }))) {
        throw new AppError('Selected Company was not found.', 400, 'PREREQUISITE_COMPANY_NOT_FOUND');
      }
    }
  },
  beforeDelete: async (doc, req) => {
    if (await getTenantModel('Product', Product).exists({ distributorId: req.distributorId, brandId: doc._id })) {
      throw new AppError('Cannot delete brand while products are linked to it.', 400, 'BRAND_IN_USE');
    }
  },
});

const categoryGuard = async (doc, req) => {
  const { Category: CatM, Product: ProductM } = getTenantModels({ Category, Product });
  const [hasChildren, hasProducts] = await Promise.all([
    CatM.exists({ distributorId: req.distributorId, parentCategoryId: doc._id }),
    ProductM.exists({ distributorId: req.distributorId, $or: [{ categoryId: doc._id }, { subCategoryId: doc._id }] }),
  ]);
  if (hasChildren || hasProducts) throw new AppError('Cannot delete category with linked sub-categories or products.', 400, 'CATEGORY_IN_USE');
};

async function resolveCategoryBrandCompany(payload, existing, req) {
  const companyId = 'companyId' in payload ? payload.companyId : existing?.companyId;
  const brandIds = 'linkedBrandIds' in payload ? payload.linkedBrandIds : existing?.linkedBrandIds;
  if (!companyId && Array.isArray(brandIds) && brandIds.length > 0) {
    const brand = await getTenantModel('Brand', Brand).findOne({ _id: brandIds[0], distributorId: req.distributorId }).select('companyId').lean();
    if (brand?.companyId) payload.companyId = brand.companyId;
  }
}

async function resolveSubCategoryParentDefaults(payload, existing, req) {
  const parentId = 'parentCategoryId' in payload ? payload.parentCategoryId : existing?.parentCategoryId;
  const companyId = 'companyId' in payload ? payload.companyId : existing?.companyId;
  if (!parentId) return;
  const parent = await getTenantModel('Category', Category).findOne({ _id: parentId, distributorId: req.distributorId, level: 'CATEGORY' }).select('companyId linkedBrandIds').lean();
  if ('parentCategoryId' in payload && payload.parentCategoryId && !parent) {
    throw new AppError('Parent Category was not found.', 400, 'PREREQUISITE_CATEGORY_NOT_FOUND');
  }
  if (!parent) return;
  if (!companyId && parent.companyId) payload.companyId = parent.companyId;
  const brandIds = 'linkedBrandIds' in payload ? payload.linkedBrandIds : existing?.linkedBrandIds;
  if ((!Array.isArray(brandIds) || brandIds.length === 0) && parent.linkedBrandIds?.length > 0) {
    payload.linkedBrandIds = parent.linkedBrandIds;
  }
}

export const categoryHandlers = buildResourceHandlers({
  Model: Category,
  name: 'Category',
  fixedFilter: { level: 'CATEGORY' },
  searchFields: ['code', 'name'],
  filterKeys: ['companyId', 'status'],
  populate: 'companyId linkedBrandIds',
  extractPublicIds: (doc) => [doc.image?.publicId],
  beforeCreate: async (payload, req) => {
    sanitizeInventoryPayload(payload);
    payload.companyId = nullIfEmpty(payload.companyId);
    if (payload.companyId && !(await getTenantModel('Company', Company).exists({ _id: payload.companyId, distributorId: req.distributorId }))) {
      throw new AppError('Selected Company was not found.', 400, 'PREREQUISITE_COMPANY_NOT_FOUND');
    }
    await resolveCategoryBrandCompany(payload, null, req);
    if (!payload.code) payload.code = `CAT-${Date.now().toString().slice(-5)}`;
  },
  beforeUpdate: async (payload, existing, req) => {
    sanitizeInventoryPayload(payload);
    if ('companyId' in payload) {
      payload.companyId = nullIfEmpty(payload.companyId);
      if (payload.companyId && !(await getTenantModel('Company', Company).exists({ _id: payload.companyId, distributorId: req.distributorId }))) {
        throw new AppError('Selected Company was not found.', 400, 'PREREQUISITE_COMPANY_NOT_FOUND');
      }
    }
    await resolveCategoryBrandCompany(payload, existing, req);
  },
  beforeDelete: categoryGuard,
});

async function ensureUniqueSubCategoryCode(CatM, distributorId, rawCode) {
  const trimmed = String(rawCode || '').trim().toUpperCase();
  const isAuto = !trimmed || /^SUB-\d+$/i.test(trimmed);
  if (trimmed && !isAuto) {
    if (await CatM.exists({ distributorId, level: 'SUB_CATEGORY', code: trimmed })) throw new AppError('Sub-Category code already exists.', 409, 'DUPLICATE_SUBCATEGORY_CODE');
    return trimmed;
  }
  if (trimmed && !(await CatM.exists({ distributorId, level: 'SUB_CATEGORY', code: trimmed }))) return trimmed;
  const base = await CatM.countDocuments({ distributorId, level: 'SUB_CATEGORY' });
  for (let i = 0; i < 20; i++) {
    const candidate = `SUB-${String(base + 1 + i).padStart(3, '0')}`;
    if (!(await CatM.exists({ distributorId, level: 'SUB_CATEGORY', code: candidate }))) return candidate;
  }
  return `SUB-${Date.now().toString().slice(-5)}`;
}

export const subCategoryHandlers = buildResourceHandlers({
  Model: Category,
  name: 'Sub-Category',
  fixedFilter: { level: 'SUB_CATEGORY' },
  searchFields: ['code', 'name'],
  filterKeys: ['parentCategoryId', 'companyId', 'status'],
  populate: 'parentCategoryId companyId linkedBrandIds',
  extractPublicIds: (doc) => [doc.image?.publicId],
  beforeCreate: async (payload, req) => {
    sanitizeInventoryPayload(payload);
    payload.companyId = nullIfEmpty(payload.companyId);
    payload.parentCategoryId = nullIfEmpty(payload.parentCategoryId);
    if (!payload.parentCategoryId) throw new AppError('Parent Category is required.', 400, 'PARENT_CATEGORY_REQUIRED');
    await resolveSubCategoryParentDefaults(payload, null, req);
    payload.code = await ensureUniqueSubCategoryCode(getTenantModel('Category', Category), req.distributorId, payload.code);
  },
  beforeUpdate: async (payload, existing, req) => {
    sanitizeInventoryPayload(payload);
    if ('companyId' in payload) payload.companyId = nullIfEmpty(payload.companyId);
    if ('parentCategoryId' in payload) {
      payload.parentCategoryId = nullIfEmpty(payload.parentCategoryId);
      if (!payload.parentCategoryId) throw new AppError('Parent Category is required.', 400, 'PARENT_CATEGORY_REQUIRED');
    }
    await resolveSubCategoryParentDefaults(payload, existing, req);
  },
  beforeDelete: categoryGuard,
});

async function assertOptionalProductRefs(payload, req) {
  const { Company: CompanyM, Brand: BrandM, Category: CatM } = getTenantModels({ Company, Brand, Category });
  for (const field of ['companyId', 'brandId', 'categoryId', 'subCategoryId']) {
    if (field in payload) payload[field] = nullIfEmpty(payload[field]);
  }
  const checks = [
    [payload.companyId, CompanyM, { _id: payload.companyId, distributorId: req.distributorId }, 'Selected Company was not found.', 'PREREQUISITE_COMPANY_NOT_FOUND'],
    [payload.brandId, BrandM, { _id: payload.brandId, distributorId: req.distributorId }, 'Selected Brand was not found.', 'PREREQUISITE_BRAND_NOT_FOUND'],
    [payload.categoryId, CatM, { _id: payload.categoryId, distributorId: req.distributorId, level: 'CATEGORY' }, 'Selected Category was not found.', 'PREREQUISITE_CATEGORY_NOT_FOUND'],
    [payload.subCategoryId, CatM, { _id: payload.subCategoryId, distributorId: req.distributorId, level: 'SUB_CATEGORY' }, 'Selected Sub-Category was not found.', 'PREREQUISITE_SUBCATEGORY_NOT_FOUND'],
  ];
  for (const [val, M, q, msg, code] of checks) {
    if (val && !(await M.exists(q))) throw new AppError(msg, 400, code);
  }
}

export const productHandlers = buildResourceHandlers({
  Model: Product,
  name: 'Product',
  searchFields: ['skuCode', 'barcode', 'productName'],
  filterKeys: ['companyId', 'brandId', 'categoryId', 'subCategoryId', 'status', 'showOnMarketplace'],
  populate: 'companyId brandId categoryId subCategoryId',
  extractPublicIds: (doc) => [doc.baseUnit?.image?.publicId, ...(doc.packingUnits || []).map((u) => u.image?.publicId)],
  afterRead: (doc, req) => stripProductPurchaseRates(doc, req.user),
  beforeCreate: async (payload, req) => {
    sanitizeInventoryPayload(payload);
    await assertOptionalProductRefs(payload, req);
    if (!payload.skuCode) payload.skuCode = `SKU-${Date.now().toString().slice(-6)}`;
  },
  beforeUpdate: async (payload, existing, req) => {
    sanitizeInventoryPayload(payload);
    await assertOptionalProductRefs(payload, req);
    preserveHiddenProductRates(payload, existing, req.user);
    await applyProductUnitVersionChange({ distributorId: req.distributorId, payload, existingProduct: existing });
  },
  beforeDelete: async (doc, req) => {
    if (await getTenantModel('StockBatch', StockBatch).exists({ distributorId: req.distributorId, productId: doc._id, currentBaseQty: { $gt: 0 } })) {
      throw new AppError('Cannot delete product with active stock batches. Clear stock to 0 first.', 400, 'PRODUCT_HAS_STOCK');
    }
  },
});

export const bulkApplyProductRules = asyncHandler(async (req, res) => {
  const ProductM = getTenantModel('Product', Product);
  const { productIds = [], defaultRules, assignedBookerIds, showOnMarketplace, status } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) throw new AppError('Select at least one product to apply rules.', 400, 'NO_PRODUCTS_SELECTED');
  const updateFields = {};
  if (defaultRules && typeof defaultRules === 'object') for (const [k, v] of Object.entries(defaultRules)) if (v !== undefined) updateFields[`defaultRules.${k}`] = v;
  if (Array.isArray(assignedBookerIds)) updateFields.assignedBookerIds = assignedBookerIds;
  if (typeof showOnMarketplace === 'boolean') updateFields.showOnMarketplace = showOnMarketplace;
  if (status) updateFields.status = status;
  const result = await ProductM.updateMany({ _id: { $in: productIds }, distributorId: req.distributorId }, { $set: updateFields });
  res.status(200).json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
});

export const getInventoryDashboard = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const { Product: ProductM, Company: CompanyM, Brand: BrandM, Category: CatM } = getTenantModels({ Product, Company, Brand, Category });
  const [totalProducts, activeProducts, totalCompanies, totalBrands, totalCategories, brandBreakdown, recentProducts] = await Promise.all([
    ProductM.countDocuments({ distributorId }), ProductM.countDocuments({ distributorId, status: 'ACTIVE' }),
    CompanyM.countDocuments({ distributorId, status: 'ACTIVE' }), BrandM.countDocuments({ distributorId, status: 'ACTIVE' }),
    CatM.countDocuments({ distributorId, level: 'CATEGORY', status: 'ACTIVE' }),
    ProductM.aggregate([
      { $match: { distributorId } }, { $group: { _id: '$brandId', count: { $sum: 1 } } },
      { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      { $project: { brandName: { $ifNull: ['$brand.brandName', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } }, { $limit: 8 },
    ]),
    ProductM.find({ distributorId }).sort({ createdAt: -1 }).limit(5).populate('companyId brandId categoryId', 'companyName brandName name').lean(),
  ]);
  res.status(200).json({
    success: true,
    data: { kpis: { totalProducts, activeProducts, inactiveProducts: totalProducts - activeProducts, totalCompanies, totalBrands, totalCategories }, brandBreakdown, recentProducts: recentProducts.map((p) => stripProductPurchaseRates(p, req.user)) },
  });
});

export const getProductRateList = asyncHandler(async (req, res) => {
  const ProductM = getTenantModel('Product', Product);
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultLimit: 25 });
  const extra = { status: req.query.status || 'ACTIVE' };
  for (const key of ['companyId', 'brandId', 'categoryId']) if (req.query[key]) extra[key] = req.query[key];
  const filter = buildScopedFilter(req, extra, ['skuCode', 'productName', 'barcode'], searchRegex);
  const [products, total] = await Promise.all([
    ProductM.find(filter).sort(sort).skip(skip).limit(limit).populate('companyId brandId categoryId', 'companyName brandName name').lean(),
    ProductM.countDocuments(filter),
  ]);
  const safeProducts = products.map((p) => stripProductPurchaseRates(p, req.user));
  res.status(200).json({ success: true, data: safeProducts, pagination: buildPaginationMeta(total) });
});
