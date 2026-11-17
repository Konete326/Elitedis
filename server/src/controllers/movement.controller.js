import { StockBatch, StockMovement, PendingTask, Product } from '../models/index.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import {
  deriveBatchStatus,
  formatDualUnitQty,
  getProductUnitMeta,
  runWithTransaction,
} from '../services/stockLedger.service.js';
import { recordAuditLog } from '../services/accountingPost.service.js';
import { evaluateLowStockAndExpiryAlerts } from '../services/automationAlert.service.js';

export const listStockBatches = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, {
    defaultSortBy: 'expDate',
    defaultSortOrder: 'asc',
  });
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
    StockBatch.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('productId', 'skuCode productName baseUnit packingUnits companyId brandId')
      .populate('warehouseId', 'warehouseCode warehouseName')
      .lean(),
    StockBatch.countDocuments(filter),
  ]);

  const enriched = batches.map((batch) => {
    const meta = getProductUnitMeta(batch.productId);
    return {
      ...batch,
      dualUnitCurrent: formatDualUnitQty(batch.currentBaseQty, meta.conversionQty, meta.packUnitName, meta.baseUnitName),
      dualUnitAvailable: formatDualUnitQty(
        batch.availableBaseQty,
        meta.conversionQty,
        meta.packUnitName,
        meta.baseUnitName
      ),
    };
  });

  res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta(totalRecords) });
});

export const applyStockRules = asyncHandler(async (req, res) => {
  const { batchIds = [], productId, warehouseId, minStockPack, maxStockPack, expiryAlertDays } = req.body;
  const filter = { distributorId: req.distributorId };
  if (batchIds.length > 0) filter._id = { $in: batchIds };
  else {
    if (productId) filter.productId = productId;
    if (warehouseId) filter.warehouseId = warehouseId;
  }

  const batches = await StockBatch.find(filter).populate('productId', 'packingUnits');
  for (const batch of batches) {
    if (minStockPack !== undefined) batch.thresholds.minStockPack = Number(minStockPack) || 0;
    if (maxStockPack !== undefined) batch.thresholds.maxStockPack = Number(maxStockPack) || 0;
    if (expiryAlertDays !== undefined) batch.thresholds.expiryAlertDays = Number(expiryAlertDays) || 90;
    const conv = batch.productId?.packingUnits?.[0]?.conversionQty || 1;
    batch.status = deriveBatchStatus(batch, conv);
    await batch.save();
  }

  await evaluateLowStockAndExpiryAlerts({ distributorId: req.distributorId, warehouseId });
  res.status(200).json({ success: true, data: { updatedCount: batches.length } });
});

export const getStockValuation = asyncHandler(async (req, res) => {
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
      {
        $group: {
          _id: '$warehouseId',
          valuePkr: { $sum: '$totalStockValuePkr' },
          weightKg: { $sum: '$totalWeightKg' },
          batchesCount: { $sum: 1 },
        },
      },
      { $lookup: { from: 'warehouses', localField: '_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
      { $project: { warehouseName: { $ifNull: ['$warehouse.warehouseName', 'Unknown'] }, valuePkr: 1, weightKg: 1, batchesCount: 1 } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: { summary: totals[0] || {}, byWarehouse },
  });
});

async function applyMovementEffects(movement, distributorId, actorId, session) {
  for (const item of movement.items || []) {
    if (item.lineDecision === 'NON_ACCEPT') continue;
    const product = await Product.findOne({ _id: item.productId, distributorId }).session(session).lean();
    const meta = getProductUnitMeta(product, item.unitName);
    const movedQty = Number(item.movedBaseQty) || (Number(item.movedPackQty) || 0) * meta.conversionQty;

    if (movement.movementType === 'PURCHASE') {
      const targetWh = movement.toWarehouseId || movement.fromWarehouseId;
      if (!targetWh || !item.toZoneId || !item.toAreaId) {
        throw new AppError('Warehouse, Zone, and Area are required to complete purchase put-away.', 400, 'LOCATION_REQUIRED');
      }
      const batchNo = (item.batchNo || `B-${Date.now().toString().slice(-5)}`).toUpperCase();
      let batch = await StockBatch.findOne({
        distributorId,
        batchNo,
        productId: item.productId,
        warehouseId: targetWh,
        areaId: item.toAreaId,
      }).session(session);

      if (!batch) {
        batch = new StockBatch({
          distributorId,
          batchNo,
          productId: item.productId,
          warehouseId: targetWh,
          zoneId: item.toZoneId,
          areaId: item.toAreaId,
          mfgDate: item.mfgDate || null,
          expDate: item.expDate || null,
          purchaseRatePerBase: product?.baseUnit?.traderPurchaseRate || 0,
          currentBaseQty: 0,
          reservedBaseQty: 0,
        });
      }
      batch.currentBaseQty += movedQty;
      batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
      batch.status = deriveBatchStatus(batch, meta.conversionQty);
      await batch.save(session ? { session } : undefined);
    } else if (movement.movementType === 'TRANSFER' || movement.movementType === 'SAME_TRANSFER') {
      const src = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      if (!src || src.availableBaseQty < movedQty) {
        throw new AppError(`Insufficient stock in batch ${item.batchNo || item.batchId}.`, 400, 'INSUFFICIENT_STOCK');
      }
      src.currentBaseQty -= movedQty;
      src.totalWeightKg = Number((src.currentBaseQty * meta.baseWeightKg).toFixed(3));
      src.status = deriveBatchStatus(src, meta.conversionQty);
      await src.save(session ? { session } : undefined);

      const destWh = movement.movementType === 'SAME_TRANSFER' ? movement.fromWarehouseId : movement.toWarehouseId;
      let dest = await StockBatch.findOne({
        distributorId,
        batchNo: src.batchNo,
        productId: src.productId,
        warehouseId: destWh,
        areaId: item.toAreaId,
      }).session(session);
      if (!dest) {
        dest = new StockBatch({
          distributorId,
          batchNo: src.batchNo,
          productId: src.productId,
          warehouseId: destWh,
          zoneId: item.toZoneId,
          areaId: item.toAreaId,
          mfgDate: src.mfgDate,
          expDate: src.expDate,
          purchaseRatePerBase: src.purchaseRatePerBase,
          condition: src.condition,
        });
      }
      dest.currentBaseQty += movedQty;
      dest.totalWeightKg = Number((dest.currentBaseQty * meta.baseWeightKg).toFixed(3));
      dest.status = deriveBatchStatus(dest, meta.conversionQty);
      await dest.save(session ? { session } : undefined);
    } else if (movement.movementType === 'ADJUSTMENT') {
      const batch = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      if (!batch) throw new AppError('Batch not found for adjustment.', 404, 'BATCH_NOT_FOUND');
      const before = batch.currentBaseQty;
      batch.currentBaseQty = Math.max(0, Number(item.physicalCountBaseQty) || 0);
      batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
      batch.status = deriveBatchStatus(batch, meta.conversionQty);
      await batch.save(session ? { session } : undefined);
      await recordAuditLog({
        distributorId,
        actorId,
        module: 'STOCK_ADJUSTMENT',
        action: 'ADJUST_BATCH',
        entityModel: 'StockBatch',
        entityId: batch._id,
        beforeState: { currentBaseQty: before },
        afterState: { currentBaseQty: batch.currentBaseQty, missing: item.missingBaseQty, damaged: item.damagedBaseQty },
        session,
      });
    } else if (movement.movementType === 'EXPIRY_DAMAGE_BACK') {
      const batch = await StockBatch.findOne({ _id: item.batchId, distributorId }).session(session);
      if (!batch || batch.currentBaseQty < movedQty) {
        throw new AppError('Insufficient quarantine stock for supplier return.', 400, 'INSUFFICIENT_STOCK');
      }
      batch.currentBaseQty -= movedQty;
      batch.status = deriveBatchStatus(batch, meta.conversionQty);
      await batch.save(session ? { session } : undefined);
    }
  }
}

export const listMovements = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.includeHidden !== 'true') extra.isHidden = false;
  for (const key of ['movementType', 'status', 'fromWarehouseId', 'toWarehouseId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  const filter = buildScopedFilter(req, extra, ['movementCode', 'taskName'], searchRegex);
  const [movements, totalRecords] = await Promise.all([
    StockMovement.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('fromWarehouseId toWarehouseId', 'warehouseCode warehouseName')
      .populate('preparedById assignedToId', 'fullName profileId')
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: movements, pagination: buildPaginationMeta(totalRecords) });
});

export const getMovementById = asyncHandler(async (req, res) => {
  const movement = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('fromWarehouseId toWarehouseId', 'warehouseCode warehouseName')
    .populate('preparedById assignedToId dispatchedById receivedById', 'fullName profileId')
    .populate('items.productId', 'skuCode productName baseUnit packingUnits')
    .lean();
  if (!movement) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');
  res.status(200).json({ success: true, data: movement });
});

export const createMovement = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const actorId = req.user._id;
  const movementCode = req.body.movementCode || `MV-${Date.now().toString().slice(-6)}`;
  const status = req.body.status || 'PENDING';

  const movement = await runWithTransaction(async (session) => {
    const [created] = await StockMovement.create(
      [{ ...req.body, distributorId, movementCode, preparedById: actorId, status }],
      session ? { session } : {}
    );

    if (status === 'COMPLETED' || status === 'APPROVED') {
      await applyMovementEffects(created, distributorId, actorId, session);
      created.completedAt = new Date();
      await created.save(session ? { session } : undefined);
    } else if (req.body.assignedToId) {
      const taskTypeMap = {
        TRANSFER: 'WAREHOUSE_TRANSFER',
        SAME_TRANSFER: 'WAREHOUSE_TRANSFER',
        PURCHASE: 'PURCHASE_PUT_AWAY',
        ADJUSTMENT: 'PHYSICAL_STOCK_COUNT',
        EXPIRY_DAMAGE_BACK: 'EXPIRY_QUARANTINE',
      };
      const [task] = await PendingTask.create(
        [
          {
            distributorId,
            taskCode: `TSK-${Date.now().toString().slice(-6)}`,
            taskType: taskTypeMap[created.movementType] || 'WAREHOUSE_TRANSFER',
            title: created.taskName || `${created.movementType} (${created.movementCode})`,
            assignedToId: req.body.assignedToId,
            assignedById: actorId,
            warehouseId: created.fromWarehouseId || created.toWarehouseId,
            referenceModel: 'StockMovement',
            referenceId: created._id,
            status: 'FRESH',
          },
        ],
        session ? { session } : {}
      );
      created.linkedTaskId = task._id;
      await created.save(session ? { session } : undefined);
    }

    return created;
  });

  await evaluateLowStockAndExpiryAlerts({ distributorId, actorId });
  res.status(201).json({ success: true, data: movement });
});

export const approveMovement = asyncHandler(async (req, res) => {
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
  const movement = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!movement) throw new AppError('Stock movement not found.', 404, 'MOVEMENT_NOT_FOUND');
  movement.isHidden = !movement.isHidden;
  await movement.save();
  res.status(200).json({ success: true, data: movement });
});

export default {
  listStockBatches,
  applyStockRules,
  getStockValuation,
  listMovements,
  getMovementById,
  createMovement,
  approveMovement,
  toggleHideMovement,
};
