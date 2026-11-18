import {
  StockBatch as _StockBatch,
  StockMovement as _StockMovement,
  PendingTask as _PendingTask,
  Product as _Product,
} from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { canViewPurchasePrice, stripBatchPurchaseRates, stripProductPurchaseRates } from '../middlewares/rbacMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import {
  applyBatchConditionAndStatus,
  deriveBatchStatus,
  formatDualUnitQty,
  getDistributorStockPolicy,
  getProductUnitMeta,
  runWithTransaction,
  saveDistributorStockPolicy,
  syncProductUnitVersionLifecycle,
} from '../services/stockLedger.service.js';
import { recordAuditLog } from '../services/accountingPost.service.js';
import { evaluateLowStockAndExpiryAlerts } from '../services/automationAlert.service.js';

const m = () => getTenantModels({ StockBatch: _StockBatch, StockMovement: _StockMovement, PendingTask: _PendingTask, Product: _Product });

export const listStockBatches = asyncHandler(async (req, res) => {
  const { StockBatch } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultSortBy: 'expDate', defaultSortOrder: 'asc' });
  const extra = {};
  for (const key of ['warehouseId', 'zoneId', 'areaId', 'productId', 'condition', 'status']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  if (req.query.expiringWithinDays) {
    const days = Number(req.query.expiringWithinDays) || 90;
    extra.expDate = { $lte: new Date(Date.now() + days * 86400000) };
  }
  const filter = buildScopedFilter(req, extra, ['batchNo'], searchRegex);
  const [batches, totalRecords] = await Promise.all([
    StockBatch.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('productId', 'skuCode productName baseUnit packingUnits unitVersions companyId brandId')
      .populate('warehouseId', 'warehouseCode warehouseName').lean(),
    StockBatch.countDocuments(filter),
  ]);
  const enriched = batches.map((batch) => {
    const meta = getProductUnitMeta(batch.productId, batch.unitName, batch.unitVersionId);
    const conv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : meta.conversionQty;
    const isBaseLabel = batch.unitName && batch.unitName.toLowerCase() === meta.baseUnitName.toLowerCase();
    const packName = batch.unitName && !isBaseLabel ? batch.unitName : meta.packUnitName;
    return stripBatchPurchaseRates(
      {
        ...batch,
        dualUnitCurrent: formatDualUnitQty(batch.currentBaseQty, conv, packName, meta.baseUnitName),
        dualUnitAvailable: formatDualUnitQty(batch.availableBaseQty, conv, packName, meta.baseUnitName),
      },
      req.user
    );
  });
  res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta(totalRecords) });
});

export const getStockPolicy = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await getDistributorStockPolicy(req.distributorId) });
});

export const updateStockPolicy = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await saveDistributorStockPolicy(req.distributorId, req.body) });
});

export const updateBatchStatusAndCondition = asyncHandler(async (req, res) => {
  const { StockBatch } = m();
  const batch = await StockBatch.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('productId', 'baseUnit packingUnits unitVersions');
  if (!batch) throw new AppError('Stock batch not found.', 404, 'BATCH_NOT_FOUND');
  const conv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : getProductUnitMeta(batch.productId, batch.unitName, batch.unitVersionId).conversionQty;
  applyBatchConditionAndStatus(batch, req.body, conv);
  await batch.save();
  res.status(200).json({ success: true, data: stripBatchPurchaseRates(batch.toObject(), req.user) });
});

export const applyStockRules = asyncHandler(async (req, res) => {
  const { StockBatch } = m();
  const { batchIds = [], productId, warehouseId, minStockPack, maxStockPack, expiryAlertDays, status, condition, customConditionLabel } = req.body;
  const filter = { distributorId: req.distributorId };
  if (batchIds.length > 0) filter._id = { $in: batchIds };
  else {
    if (productId) filter.productId = productId;
    if (warehouseId) filter.warehouseId = warehouseId;
  }
  const batches = await StockBatch.find(filter).populate('productId', 'baseUnit packingUnits unitVersions');
  for (const batch of batches) {
    if (minStockPack !== undefined && minStockPack !== '') batch.thresholds.minStockPack = Number(minStockPack) || 0;
    if (maxStockPack !== undefined && maxStockPack !== '') batch.thresholds.maxStockPack = Number(maxStockPack) || 0;
    if (expiryAlertDays !== undefined && expiryAlertDays !== '') batch.thresholds.expiryAlertDays = Number(expiryAlertDays) || 90;
    const conv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : getProductUnitMeta(batch.productId, batch.unitName, batch.unitVersionId).conversionQty;
    applyBatchConditionAndStatus(batch, { status, condition, customConditionLabel }, conv);
    await batch.save();
  }
  await evaluateLowStockAndExpiryAlerts({ distributorId: req.distributorId, warehouseId });
  res.status(200).json({ success: true, data: { updatedCount: batches.length } });
});

export const getStockValuation = asyncHandler(async (req, res) => {
  const { StockBatch } = m();
  const match = { distributorId: req.distributorId };
  if (req.query.warehouseId) match.warehouseId = req.query.warehouseId;
  const [totals, byWarehouse] = await Promise.all([
    StockBatch.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalStockValuePkr: { $sum: '$totalStockValuePkr' },
          totalWeightKg: { $sum: '$totalWeightKg' },
          totalCurrentBaseQty: { $sum: '$currentBaseQty' },
          totalReservedBaseQty: { $sum: '$reservedBaseQty' },
          totalAvailableBaseQty: { $sum: '$availableBaseQty' },
          lowWarningCount: { $sum: { $cond: [{ $eq: ['$status', 'LOW_WARNING'] }, 1, 0] } },
          outOfStockCount: { $sum: { $cond: [{ $eq: ['$status', 'OUT'] }, 1, 0] } },
        },
      },
    ]),
    StockBatch.aggregate([
      { $match: match },
      { $group: { _id: '$warehouseId', valuePkr: { $sum: '$totalStockValuePkr' }, weightKg: { $sum: '$totalWeightKg' }, batchesCount: { $sum: 1 } } },
      { $lookup: { from: 'warehouses', localField: '_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
      { $project: { warehouseName: { $ifNull: ['$warehouse.warehouseName', 'Unknown'] }, valuePkr: 1, weightKg: 1, batchesCount: 1 } },
    ]),
  ]);
  const allowCost = canViewPurchasePrice(req.user);
  const summary = allowCost ? (totals[0] || {}) : { ...(totals[0] || {}), totalStockValuePkr: 0 };
  const safeWarehouses = allowCost ? byWarehouse : byWarehouse.map((w) => ({ ...w, valuePkr: 0 }));
  res.status(200).json({ success: true, data: { summary, byWarehouse: safeWarehouses } });
});

function resolvePurchaseRates(raw, item, product, meta, conv, movedQty) {
  let ratePerPack = Number(raw.purchaseRatePerPack) || 0;
  let ratePerBase = Number(raw.purchaseRatePerBase) || 0;
  if (ratePerPack > 0 && ratePerBase <= 0 && conv > 0) ratePerBase = Number((ratePerPack / conv).toFixed(4));
  else if (ratePerBase > 0 && ratePerPack <= 0) ratePerPack = Number((ratePerBase * conv).toFixed(2));
  if (ratePerBase <= 0 && ratePerPack <= 0 && item.totalValuePkr > 0 && movedQty > 0) {
    ratePerBase = Number((Number(item.totalValuePkr) / movedQty).toFixed(4));
    ratePerPack = Number((ratePerBase * conv).toFixed(2));
  }
  if (ratePerBase <= 0 && ratePerPack <= 0) {
    const pPack = (product?.packingUnits || []).find((p) => p.unitName?.toLowerCase() === meta.packUnitName?.toLowerCase()) || product?.packingUnits?.[0];
    const optBase = Number(product?.baseUnit?.traderPurchaseRate) || 0;
    const optPack = Number(pPack?.traderPurchaseRate) || 0;
    if (optBase > 0) {
      ratePerBase = optBase;
      ratePerPack = optPack > 0 ? optPack : Number((optBase * conv).toFixed(2));
    } else if (optPack > 0) {
      ratePerPack = optPack;
      ratePerBase = Number((optPack / conv).toFixed(4));
    }
  }
  return { ratePerBase, ratePerPack };
}

async function saveBatchWeightAndStatus(batch, baseWeightKg, conv, session, depletedProducts = null) {
  batch.totalWeightKg = Number((batch.currentBaseQty * baseWeightKg).toFixed(3));
  batch.status = deriveBatchStatus(batch, conv);
  await batch.save(session ? { session } : undefined);
  if (depletedProducts && batch.currentBaseQty === 0 && batch.productId) depletedProducts.add(String(batch.productId));
}

async function applyMovementEffects(movement, distributorId, actorId, session, rawItems = null) {
  const { StockBatch, Product } = m();
  const depletedProducts = new Set();

  for (let idx = 0; idx < (movement.items || []).length; idx++) {
    const item = movement.items[idx];
    const raw = rawItems?.[idx] || item;
    if (item.lineDecision === 'NON_ACCEPT') continue;
    const product = await Product.findOne({ _id: item.productId, distributorId }).session(session).lean();

    if (movement.movementType === 'PURCHASE') {
      const targetWh = movement.toWarehouseId || movement.fromWarehouseId;
      if (!targetWh || !item.toZoneId || !item.toAreaId) {
        throw new AppError('Warehouse, Zone, and Area are required to complete purchase put-away.', 400, 'LOCATION_REQUIRED');
      }
      const meta = getProductUnitMeta(product, raw.unitName || item.unitName, raw.unitVersionId || item.unitVersionId);
      const conv = Math.max(1, Number(raw.conversionQty) || meta.conversionQty || 1);
      const movedQty = Number(item.movedBaseQty) || (Number(item.movedPackQty) || 0) * conv;
      const batchNo = (item.batchNo || `B-${Date.now().toString().slice(-5)}`).toUpperCase();
      const { ratePerBase, ratePerPack } = resolvePurchaseRates(raw, item, product, meta, conv, movedQty);
      const isBaseUnit = (raw.unitName || item.unitName || '').toLowerCase() === meta.baseUnitName.toLowerCase();
      const batchUnitName = !isBaseUnit && (raw.unitName || item.unitName) ? (raw.unitName || item.unitName) : (conv > 1 ? meta.packUnitName : meta.baseUnitName);

      let batch = await StockBatch.findOne({ distributorId, batchNo, productId: item.productId, warehouseId: targetWh, areaId: item.toAreaId }).session(session);
      if (!batch) {
        batch = new StockBatch({
          distributorId, batchNo, productId: item.productId, warehouseId: targetWh, zoneId: item.toZoneId, areaId: item.toAreaId,
          purchaseDate: raw.purchaseDate ? new Date(raw.purchaseDate) : (movement.createdAt || new Date()),
          mfgDate: item.mfgDate || null, expDate: item.expDate || null,
          unitVersionId: raw.unitVersionId || meta.unitVersionId || 'UV-1', unitName: batchUnitName,
          packingSpecification: raw.packingSpecification || meta.packingSpecification || '', conversionQty: conv,
          purchaseRatePerBase: ratePerBase, purchaseRatePerPack: ratePerPack,
          condition: raw.condition || item.condition || 'FRESH',
          customConditionLabel: raw.customConditionLabel || item.customConditionLabel || '',
        });
      } else {
        if (ratePerBase > 0 || ratePerPack > 0) Object.assign(batch, { purchaseRatePerBase: ratePerBase, purchaseRatePerPack: ratePerPack });
        if (raw.condition || item.condition) batch.condition = raw.condition || item.condition;
        if (raw.customConditionLabel || item.customConditionLabel) batch.customConditionLabel = raw.customConditionLabel || item.customConditionLabel;
      }
      batch.currentBaseQty += movedQty;
      await saveBatchWeightAndStatus(batch, meta.baseWeightKg, batch.conversionQty || conv, session);
    } else if (movement.movementType === 'TRANSFER' || movement.movementType === 'SAME_TRANSFER') {
      const src = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      const srcMeta = getProductUnitMeta(product, item.unitName || src?.unitName, src?.unitVersionId);
      const srcConv = Number(src?.conversionQty) > 1 ? Number(src.conversionQty) : srcMeta.conversionQty;
      const movedQty = Number(item.movedBaseQty) || (Number(item.movedPackQty) || 0) * srcConv;
      if (!src || src.availableBaseQty < movedQty) throw new AppError(`Insufficient stock in batch ${item.batchNo || item.batchId}.`, 400, 'INSUFFICIENT_STOCK');
      src.currentBaseQty -= movedQty;
      await saveBatchWeightAndStatus(src, srcMeta.baseWeightKg, src.conversionQty || srcConv, session, depletedProducts);

      const destWh = movement.movementType === 'SAME_TRANSFER' ? movement.fromWarehouseId : movement.toWarehouseId;
      let dest = await StockBatch.findOne({ distributorId, batchNo: src.batchNo, productId: src.productId, warehouseId: destWh, areaId: item.toAreaId }).session(session);
      if (!dest) {
        dest = new StockBatch({
          distributorId, batchNo: src.batchNo, productId: src.productId, warehouseId: destWh, zoneId: item.toZoneId, areaId: item.toAreaId,
          purchaseDate: src.purchaseDate || src.createdAt || new Date(), mfgDate: src.mfgDate, expDate: src.expDate,
          unitVersionId: src.unitVersionId || 'UV-1', unitName: src.unitName || srcMeta.packUnitName || 'Carton',
          packingSpecification: src.packingSpecification || srcMeta.packingSpecification || '',
          conversionQty: src.conversionQty || srcConv || 1,
          purchaseRatePerBase: src.purchaseRatePerBase || 0, purchaseRatePerPack: src.purchaseRatePerPack || 0,
          condition: src.condition, customConditionLabel: src.customConditionLabel || '',
        });
      }
      dest.currentBaseQty += movedQty;
      await saveBatchWeightAndStatus(dest, srcMeta.baseWeightKg, dest.conversionQty || srcConv, session);
    } else if (movement.movementType === 'ADJUSTMENT') {
      const batch = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      if (!batch) throw new AppError('Batch not found for adjustment.', 404, 'BATCH_NOT_FOUND');
      const batchMeta = getProductUnitMeta(product, item.unitName || batch.unitName, batch.unitVersionId);
      const batchConv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : batchMeta.conversionQty;
      const before = batch.currentBaseQty;
      batch.currentBaseQty = Math.max(0, Number(item.physicalCountBaseQty) || 0);
      await saveBatchWeightAndStatus(batch, batchMeta.baseWeightKg, batchConv, session, depletedProducts);
      await recordAuditLog({
        distributorId, actorId, module: 'STOCK_ADJUSTMENT', action: 'ADJUST_BATCH', entityModel: 'StockBatch', entityId: batch._id,
        beforeState: { currentBaseQty: before }, afterState: { currentBaseQty: batch.currentBaseQty, missing: item.missingBaseQty, damaged: item.damagedBaseQty }, session,
      });
    } else if (movement.movementType === 'EXPIRY_DAMAGE_BACK') {
      const batch = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      const batchMeta = getProductUnitMeta(product, item.unitName || batch?.unitName, batch?.unitVersionId);
      const batchConv = Number(batch?.conversionQty) > 1 ? Number(batch.conversionQty) : batchMeta.conversionQty;
      const movedQty = Number(item.movedBaseQty) || (Number(item.movedPackQty) || 0) * batchConv;
      if (!batch || batch.currentBaseQty < movedQty) throw new AppError('Insufficient quarantine stock for supplier return.', 400, 'INSUFFICIENT_STOCK');
      batch.currentBaseQty -= movedQty;
      await saveBatchWeightAndStatus(batch, batchMeta.baseWeightKg, batchConv, session, depletedProducts);
    }
  }
  for (const productId of depletedProducts) await syncProductUnitVersionLifecycle({ distributorId, productId, session });
}

function sanitizeMovementCost(movement, user) {
  if (!movement || canViewPurchasePrice(user)) return movement;
  const clone = { ...movement };
  if (Array.isArray(clone.items)) {
    clone.items = clone.items.map((it) => {
      const next = { ...it };
      if (clone.movementType === 'PURCHASE') delete next.totalValuePkr;
      if (next.productId && typeof next.productId === 'object' && next.productId._bsontype !== 'ObjectId') {
        next.productId = stripProductPurchaseRates(next.productId, user);
      }
      return next;
    });
  }
  return clone;
}

export const listMovements = asyncHandler(async (req, res) => {
  const { StockMovement } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.includeHidden !== 'true') extra.isHidden = false;
  for (const key of ['movementType', 'status', 'fromWarehouseId', 'toWarehouseId']) if (req.query[key]) extra[key] = req.query[key];
  const filter = buildScopedFilter(req, extra, ['movementCode', 'taskName'], searchRegex);
  const [movements, totalRecords] = await Promise.all([
    StockMovement.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('fromWarehouseId toWarehouseId', 'warehouseCode warehouseName')
      .populate('preparedById assignedToId', 'fullName profileId').lean(),
    StockMovement.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: movements.map((mv) => sanitizeMovementCost(mv, req.user)), pagination: buildPaginationMeta(totalRecords) });
});

export const getMovementById = asyncHandler(async (req, res) => {
  const { StockMovement } = m();
  const movement = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('fromWarehouseId toWarehouseId', 'warehouseCode warehouseName')
    .populate('preparedById assignedToId dispatchedById receivedById', 'fullName profileId')
    .populate('items.productId', 'skuCode productName baseUnit packingUnits unitVersions').lean();
  if (!movement) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');
  res.status(200).json({ success: true, data: sanitizeMovementCost(movement, req.user) });
});

export const createMovement = asyncHandler(async (req, res) => {
  const { StockMovement, PendingTask } = m();
  const distributorId = req.distributorId;
  const actorId = req.user._id;
  const movementCode = req.body.movementCode || `MV-${Date.now().toString().slice(-6)}`;
  const status = req.body.status || 'PENDING';
  const normalizedItems = Array.isArray(req.body.items)
    ? req.body.items.map((it) => {
        if (req.body.movementType !== 'PURCHASE' || (it.totalValuePkr && Number(it.totalValuePkr) > 0)) return it;
        const qty = Number(it.movedBaseQty) || 0;
        const packQty = Number(it.movedPackQty) || 0;
        const conv = Math.max(1, Number(it.conversionQty) || 1);
        const val = Number(it.purchaseRatePerBase) > 0 && qty > 0
          ? Number((Number(it.purchaseRatePerBase) * qty).toFixed(2))
          : Number(it.purchaseRatePerPack) > 0
            ? (packQty > 0 ? Number((Number(it.purchaseRatePerPack) * packQty).toFixed(2)) : (qty > 0 ? Number(((Number(it.purchaseRatePerPack) / conv) * qty).toFixed(2)) : 0))
            : 0;
        return val > 0 ? { ...it, totalValuePkr: val } : it;
      })
    : [];

  const movement = await runWithTransaction(async (session) => {
    const [created] = await StockMovement.create([{ ...req.body, items: normalizedItems, distributorId, movementCode, preparedById: actorId, status }], session ? { session } : {});
    if (status === 'COMPLETED' || status === 'APPROVED') {
      await applyMovementEffects(created, distributorId, actorId, session, req.body.items);
      created.completedAt = new Date();
      await created.save(session ? { session } : undefined);
    } else if (req.body.assignedToId) {
      const taskTypeMap = { TRANSFER: 'WAREHOUSE_TRANSFER', SAME_TRANSFER: 'WAREHOUSE_TRANSFER', PURCHASE: 'PURCHASE_PUT_AWAY', ADJUSTMENT: 'PHYSICAL_STOCK_COUNT', EXPIRY_DAMAGE_BACK: 'EXPIRY_QUARANTINE' };
      const [task] = await PendingTask.create([{
        distributorId, taskCode: `TSK-${Date.now().toString().slice(-6)}`, taskType: taskTypeMap[created.movementType] || 'WAREHOUSE_TRANSFER',
        title: created.taskName || `${created.movementType} (${created.movementCode})`, assignedToId: req.body.assignedToId, assignedById: actorId,
        warehouseId: created.fromWarehouseId || created.toWarehouseId, referenceModel: 'StockMovement', referenceId: created._id, status: 'FRESH',
      }], session ? { session } : {});
      created.linkedTaskId = task._id;
      await created.save(session ? { session } : undefined);
    }
    return created;
  });

  await evaluateLowStockAndExpiryAlerts({ distributorId, actorId });
  res.status(201).json({ success: true, data: sanitizeMovementCost(movement.toObject(), req.user) });
});

export const approveMovement = asyncHandler(async (req, res) => {
  const { StockMovement } = m();
  const movement = await runWithTransaction(async (session) => {
    const doc = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId }).session(session);
    if (!doc) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');
    if (doc.status === 'COMPLETED') throw new AppError('Movement is already completed.', 400, 'ALREADY_COMPLETED');
    await applyMovementEffects(doc, req.distributorId, req.user._id, session);
    doc.status = 'COMPLETED';
    doc.completedAt = new Date();
    await doc.save(session ? { session } : undefined);
    return doc;
  });
  await evaluateLowStockAndExpiryAlerts({ distributorId: req.distributorId, actorId: req.user._id });
  res.status(200).json({ success: true, data: movement });
});

export const toggleHideMovement = asyncHandler(async (req, res) => {
  const { StockMovement } = m();
  const movement = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!movement) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');
  movement.isHidden = !movement.isHidden;
  await movement.save();
  res.status(200).json({ success: true, data: movement });
});

export default {
  getStockPolicy, updateStockPolicy, updateBatchStatusAndCondition, listStockBatches,
  applyStockRules, getStockValuation, listMovements, getMovementById,
  createMovement, approveMovement, toggleHideMovement,
};
