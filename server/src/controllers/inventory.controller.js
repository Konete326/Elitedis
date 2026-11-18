import { Company, Brand, Category, Product, StockBatch } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { getTenantModel, getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';

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
  const { Model, name, searchFields, filterKeys = [], populate = '', defaultSortBy = 'createdAt', beforeCreate, beforeUpdate, beforeDelete, extractPublicIds } = config;

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
      res.status(200).json({ success: true, data: records, pagination: buildPaginationMeta(totalRecords) });
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
      res.status(200).json({ success: true, data: extraStats ? { ...record, stats: extraStats } : record });
    }),

    create: asyncHandler(async (req, res) => {
      const M = getTenantModel(Model.modelName, Model);
      const payload = { ...req.body, distributorId: req.distributorId, ...(config.fixedFilter || {}) };
      if (beforeCreate) await beforeCreate(payload, req);
      const created = await M.create(payload);
      res.status(201).json({ success: true, data: created });
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
      res.status(200).json({ success: true, data: existing });
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
    if (!payload.code) payload.code = `CAT-${Date.now().toString().slice(-5)}`;
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
  beforeDelete: categoryGuard,
});

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
    if (payload.parentCategoryId && !(await getTenantModel('Category', Category).exists({ _id: payload.parentCategoryId, distributorId: req.distributorId, level: 'CATEGORY' }))) {
      throw new AppError('Parent Category was not found.', 400, 'PREREQUISITE_CATEGORY_NOT_FOUND');
    }
    if (!payload.code) payload.code = `SUB-${Date.now().toString().slice(-5)}`;
  },
  beforeUpdate: async (payload, _existing, req) => {
    sanitizeInventoryPayload(payload);
    if ('companyId' in payload) payload.companyId = nullIfEmpty(payload.companyId);
    if ('parentCategoryId' in payload) {
      payload.parentCategoryId = nullIfEmpty(payload.parentCategoryId);
      if (payload.parentCategoryId && !(await getTenantModel('Category', Category).exists({ _id: payload.parentCategoryId, distributorId: req.distributorId, level: 'CATEGORY' }))) {
        throw new AppError('Parent Category was not found.', 400, 'PREREQUISITE_CATEGORY_NOT_FOUND');
      }
    }
  },
  beforeDelete: categoryGuard,
});

async function assertOptionalProductRefs(payload, req) {
  const { Company: CompanyM, Brand: BrandM, Category: CatM } = getTenantModels({ Company, Brand, Category });
  for (const field of ['companyId', 'brandId', 'categoryId', 'subCategoryId']) {
    if (field in payload) payload[field] = nullIfEmpty(payload[field]);
  }
  if (payload.companyId && !(await CompanyM.exists({ _id: payload.companyId, distributorId: req.distributorId }))) {
    throw new AppError('Selected Company was not found.', 400, 'PREREQUISITE_COMPANY_NOT_FOUND');
  }
  if (payload.brandId && !(await BrandM.exists({ _id: payload.brandId, distributorId: req.distributorId }))) {
    throw new AppError('Selected Brand was not found.', 400, 'PREREQUISITE_BRAND_NOT_FOUND');
  }
  if (payload.categoryId && !(await CatM.exists({ _id: payload.categoryId, distributorId: req.distributorId, level: 'CATEGORY' }))) {
    throw new AppError('Selected Category was not found.', 400, 'PREREQUISITE_CATEGORY_NOT_FOUND');
  }
  if (payload.subCategoryId && !(await CatM.exists({ _id: payload.subCategoryId, distributorId: req.distributorId, level: 'SUB_CATEGORY' }))) {
    throw new AppError('Selected Sub-Category was not found.', 400, 'PREREQUISITE_SUBCATEGORY_NOT_FOUND');
  }
}

export const productHandlers = buildResourceHandlers({
  Model: Product,
  name: 'Product',
  searchFields: ['skuCode', 'barcode', 'productName'],
  filterKeys: ['companyId', 'brandId', 'categoryId', 'subCategoryId', 'status', 'showOnMarketplace'],
  populate: 'companyId brandId categoryId subCategoryId',
  extractPublicIds: (doc) => [doc.baseUnit?.image?.publicId, ...(doc.packingUnits || []).map((u) => u.image?.publicId)],
  beforeCreate: async (payload, req) => {
    sanitizeInventoryPayload(payload);
    await assertOptionalProductRefs(payload, req);
    if (!payload.skuCode) payload.skuCode = `SKU-${Date.now().toString().slice(-6)}`;
  },
  beforeUpdate: async (payload, _existing, req) => {
    sanitizeInventoryPayload(payload);
    await assertOptionalProductRefs(payload, req);
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
  if (defaultRules && typeof defaultRules === 'object') {
    for (const [k, v] of Object.entries(defaultRules)) if (v !== undefined) updateFields[`defaultRules.${k}`] = v;
  }
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
    ProductM.countDocuments({ distributorId }),
    ProductM.countDocuments({ distributorId, status: 'ACTIVE' }),
    CompanyM.countDocuments({ distributorId, status: 'ACTIVE' }),
    BrandM.countDocuments({ distributorId, status: 'ACTIVE' }),
    CatM.countDocuments({ distributorId, level: 'CATEGORY', status: 'ACTIVE' }),
    ProductM.aggregate([
      { $match: { distributorId } },
      { $group: { _id: '$brandId', count: { $sum: 1 } } },
      { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      { $project: { brandName: { $ifNull: ['$brand.brandName', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    ProductM.find({ distributorId }).sort({ createdAt: -1 }).limit(5).populate('companyId brandId categoryId', 'companyName brandName name').lean(),
  ]);
  res.status(200).json({
    success: true,
    data: { kpis: { totalProducts, activeProducts, inactiveProducts: totalProducts - activeProducts, totalCompanies, totalBrands, totalCategories }, brandBreakdown, recentProducts },
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
  res.status(200).json({ success: true, data: products, pagination: buildPaginationMeta(total) });
});
