import { Company, Brand, Category, Product, StockBatch } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';

async function safeDestroyImages(publicIds = []) {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];
  await Promise.allSettled(uniqueIds.map((id) => destroyImage(id)));
}

function buildResourceHandlers(config) {
  const {
    Model,
    name,
    searchFields,
    filterKeys = [],
    populate = '',
    defaultSortBy = 'createdAt',
    beforeCreate,
    beforeUpdate,
    beforeDelete,
    extractPublicIds,
  } = config;

  return {
    list: asyncHandler(async (req, res) => {
      const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, {
        defaultSortBy,
      });
      const extra = {};
      if (config.fixedFilter) Object.assign(extra, config.fixedFilter);
      for (const key of filterKeys) {
        if (req.query[key] !== undefined && req.query[key] !== '') {
          extra[key] = req.query[key] === 'true' ? true : req.query[key] === 'false' ? false : req.query[key];
        }
      }
      const filter = buildScopedFilter(req, extra, searchFields, searchRegex);
      const query = Model.find(filter).sort(sort).skip(skip).limit(limit);
      if (populate) query.populate(populate);

      const [records, totalRecords] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
      res.status(200).json({ success: true, data: records, pagination: buildPaginationMeta(totalRecords) });
    }),

    getById: asyncHandler(async (req, res) => {
      const query = Model.findOne({ _id: req.params.id, distributorId: req.distributorId, ...config.fixedFilter });
      if (populate) query.populate(populate);
      const record = await query.lean();
      if (!record) throw new AppError(`${name} not found.`, 404, 'NOT_FOUND');

      let extraStats = null;
      if (name === 'Brand') {
        const [totalProducts, activeProducts] = await Promise.all([
          Product.countDocuments({ distributorId: req.distributorId, brandId: record._id }),
          Product.countDocuments({ distributorId: req.distributorId, brandId: record._id, status: 'ACTIVE' }),
        ]);
        extraStats = { totalProducts, activeProducts, inactiveProducts: totalProducts - activeProducts };
      }

      res.status(200).json({ success: true, data: extraStats ? { ...record, stats: extraStats } : record });
    }),

    create: asyncHandler(async (req, res) => {
      const payload = { ...req.body, distributorId: req.distributorId, ...(config.fixedFilter || {}) };
      if (beforeCreate) await beforeCreate(payload, req);
      const created = await Model.create(payload);
      res.status(201).json({ success: true, data: created });
    }),

    update: asyncHandler(async (req, res) => {
      const existing = await Model.findOne({ _id: req.params.id, distributorId: req.distributorId });
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
      const existing = await Model.findOne({ _id: req.params.id, distributorId: req.distributorId });
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
    if (!payload.companyCode) payload.companyCode = `CMP-${Date.now().toString().slice(-5)}`;
  },
  beforeDelete: async (doc, req) => {
    const [hasBrands, hasProducts] = await Promise.all([
      Brand.exists({ distributorId: req.distributorId, companyId: doc._id }),
      Product.exists({ distributorId: req.distributorId, companyId: doc._id }),
    ]);
    if (hasBrands || hasProducts) {
      throw new AppError('Cannot delete company with linked brands or products.', 400, 'COMPANY_IN_USE');
    }
  },
});

export const brandHandlers = buildResourceHandlers({
  Model: Brand,
  name: 'Brand',
  searchFields: ['brandCode', 'brandName', 'brandType', 'ownerName'],
  filterKeys: ['companyId', 'brandType', 'status'],
  populate: 'companyId',
  extractPublicIds: (doc) => [doc.logo?.publicId, doc.coverImage?.publicId],
  beforeCreate: async (payload) => {
    if (!payload.brandCode) payload.brandCode = `BRD-${Date.now().toString().slice(-5)}`;
  },
  beforeDelete: async (doc, req) => {
    const hasProducts = await Product.exists({ distributorId: req.distributorId, brandId: doc._id });
    if (hasProducts) {
      throw new AppError('Cannot delete brand while products are linked to it.', 400, 'BRAND_IN_USE');
    }
  },
});

const categoryGuard = async (doc, req) => {
  const [hasChildren, hasProducts] = await Promise.all([
    Category.exists({ distributorId: req.distributorId, parentCategoryId: doc._id }),
    Product.exists({ distributorId: req.distributorId, $or: [{ categoryId: doc._id }, { subCategoryId: doc._id }] }),
  ]);
  if (hasChildren || hasProducts) {
    throw new AppError('Cannot delete category with linked sub-categories or products.', 400, 'CATEGORY_IN_USE');
  }
};

export const categoryHandlers = buildResourceHandlers({
  Model: Category,
  name: 'Category',
  fixedFilter: { level: 'CATEGORY' },
  searchFields: ['code', 'name'],
  filterKeys: ['companyId', 'status'],
  populate: 'companyId linkedBrandIds',
  extractPublicIds: (doc) => [doc.image?.publicId],
  beforeCreate: async (payload) => {
    if (!payload.code) payload.code = `CAT-${Date.now().toString().slice(-5)}`;
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
  beforeCreate: async (payload) => {
    if (!payload.code) payload.code = `SUB-${Date.now().toString().slice(-5)}`;
  },
  beforeDelete: categoryGuard,
});

export const productHandlers = buildResourceHandlers({
  Model: Product,
  name: 'Product',
  searchFields: ['skuCode', 'barcode', 'productName'],
  filterKeys: ['companyId', 'brandId', 'categoryId', 'subCategoryId', 'status', 'showOnMarketplace'],
  populate: 'companyId brandId categoryId subCategoryId',
  extractPublicIds: (doc) => [
    doc.baseUnit?.image?.publicId,
    ...(doc.packingUnits || []).map((u) => u.image?.publicId),
  ],
  beforeCreate: async (payload) => {
    if (!payload.skuCode) payload.skuCode = `SKU-${Date.now().toString().slice(-6)}`;
  },
  beforeDelete: async (doc, req) => {
    const hasStock = await StockBatch.exists({
      distributorId: req.distributorId,
      productId: doc._id,
      currentBaseQty: { $gt: 0 },
    });
    if (hasStock) {
      throw new AppError('Cannot delete product with active stock batches. Clear stock to 0 first.', 400, 'PRODUCT_HAS_STOCK');
    }
  },
});

export const bulkApplyProductRules = asyncHandler(async (req, res) => {
  const { productIds = [], defaultRules, assignedBookerIds, showOnMarketplace, status } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new AppError('Select at least one product to apply rules.', 400, 'NO_PRODUCTS_SELECTED');
  }

  const updateFields = {};
  if (defaultRules && typeof defaultRules === 'object') {
    for (const [k, v] of Object.entries(defaultRules)) {
      if (v !== undefined) updateFields[`defaultRules.${k}`] = v;
    }
  }
  if (Array.isArray(assignedBookerIds)) updateFields.assignedBookerIds = assignedBookerIds;
  if (typeof showOnMarketplace === 'boolean') updateFields.showOnMarketplace = showOnMarketplace;
  if (status) updateFields.status = status;

  const result = await Product.updateMany(
    { _id: { $in: productIds }, distributorId: req.distributorId },
    { $set: updateFields }
  );

  res.status(200).json({
    success: true,
    data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount },
  });
});

export const getInventoryDashboard = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const [totalProducts, activeProducts, totalCompanies, totalBrands, totalCategories, brandBreakdown, recentProducts] =
    await Promise.all([
      Product.countDocuments({ distributorId }),
      Product.countDocuments({ distributorId, status: 'ACTIVE' }),
      Company.countDocuments({ distributorId, status: 'ACTIVE' }),
      Brand.countDocuments({ distributorId, status: 'ACTIVE' }),
      Category.countDocuments({ distributorId, level: 'CATEGORY', status: 'ACTIVE' }),
      Product.aggregate([
        { $match: { distributorId } },
        { $group: { _id: '$brandId', count: { $sum: 1 } } },
        { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $project: { brandName: { $ifNull: ['$brand.brandName', 'Unassigned'] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Product.find({ distributorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('companyId brandId categoryId', 'companyName brandName name')
        .lean(),
    ]);

  res.status(200).json({
    success: true,
    data: {
      kpis: {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        totalCompanies,
        totalBrands,
        totalCategories,
      },
      brandBreakdown,
      recentProducts,
    },
  });
});

export const getProductRateList = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultLimit: 25 });
  const extra = { status: req.query.status || 'ACTIVE' };
  for (const key of ['companyId', 'brandId', 'categoryId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  const filter = buildScopedFilter(req, extra, ['skuCode', 'productName', 'barcode'], searchRegex);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('companyId brandId categoryId', 'companyName brandName name')
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: products, pagination: buildPaginationMeta(total) });
});
