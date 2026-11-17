import mongoose from 'mongoose';
import { StockBatch } from '../models/StockBatch.model.js';
import { Product } from '../models/Product.model.js';
import { AppError } from '../middlewares/errorMiddleware.js';

/**
 * Executes a callback inside a Mongoose ACID transaction when supported (Atlas Replica Set),
 * falling back cleanly on standalone local mongod instances without replica sets.
 */
export async function runWithTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (err) {
      const msg = String(err?.message || '');
      const isStandaloneTxUnsupported =
        err?.code === 20 ||
        err?.code === 263 ||
        err?.codeName === 'IllegalOperation' ||
        msg.includes('Transaction numbers are only allowed on a replica set') ||
        msg.includes('does not support transactions') ||
        msg.includes('replica set');
      if (isStandaloneTxUnsupported) {
        return await workFn(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

/**
 * Formats base unit quantities into dual Packing : Base display strings (e.g. "100 Carton : 12 Bottle").
 */
export function formatDualUnitQty(totalBaseQty, conversionQty = 1, packUnitName = 'Carton', baseUnitName = 'Pcs') {
  const qty = Math.max(0, Number(totalBaseQty) || 0);
  const conv = Math.max(1, Number(conversionQty) || 1);
  const packQty = conv > 1 ? Math.floor(qty / conv) : 0;
  const baseQty = conv > 1 ? qty % conv : qty;

  return {
    totalBaseQty: qty,
    conversionQty: conv,
    packQty,
    baseQty,
    formatted: conv > 1 ? `${packQty} ${packUnitName} : ${baseQty} ${baseUnitName}` : `${qty} ${baseUnitName}`,
    shortFormatted: conv > 1 ? `${packQty}:${baseQty}` : `0:${qty}`,
  };
}

/**
 * Extracts conversion factor and unit labels from a Product document.
 */
export function getProductUnitMeta(product, unitName) {
  const baseUnitName = product?.baseUnit?.unitName || 'Piece';
  const baseWeightKg = Number(product?.baseUnit?.weightInKg) || 0;
  const packUnits = Array.isArray(product?.packingUnits) ? product.packingUnits : [];

  if (unitName) {
    const matched = packUnits.find((p) => p.unitName?.toLowerCase() === String(unitName).toLowerCase());
    if (matched) {
      return {
        unitName: matched.unitName,
        conversionQty: Math.max(1, Number(matched.conversionQty) || 1),
        packUnitName: matched.unitName,
        baseUnitName,
        baseWeightKg,
      };
    }
  }

  const defaultPack = packUnits.find((p) => p.isDefaultStockUnit) || packUnits[0];
  return {
    unitName: unitName || baseUnitName,
    conversionQty: defaultPack ? Math.max(1, Number(defaultPack.conversionQty) || 1) : 1,
    packUnitName: defaultPack?.unitName || 'Pack',
    baseUnitName,
    baseWeightKg,
  };
}

/**
 * Derives operational StockBatch status from current, reserved, available, and min thresholds.
 */
export function deriveBatchStatus(batch, packConversionQty = 1) {
  const current = Math.max(0, Number(batch.currentBaseQty) || 0);
  const reserved = Math.max(0, Number(batch.reservedBaseQty) || 0);
  const available = Math.max(0, current - reserved);

  if (batch.status === 'BLOCKED' || batch.status === 'QUARANTINED') {
    return batch.status;
  }
  if (current <= 0) {
    return 'OUT';
  }
  const minPack = Number(batch.thresholds?.minStockPack) || 0;
  const minBase = minPack * Math.max(1, packConversionQty);
  if (available <= 0 || (minBase > 0 && available <= minBase)) {
    return 'LOW_WARNING';
  }
  if (reserved > 0 && available === current - reserved && reserved >= current) {
    return 'RESERVED';
  }
  return 'AVAILABLE';
}

/**
 * Zero-Quantity Deletion Guard: Blocks deleting a Warehouse, Zone, or Floor/Rack Area
 * if any StockBatch stored at that location has currentBaseQty > 0.
 */
export async function assertZeroStockBeforeDelete({ distributorId, warehouseId, zoneId = null, areaId = null }) {
  const query = {
    distributorId,
    warehouseId,
    currentBaseQty: { $gt: 0 },
  };
  if (zoneId) query.zoneId = zoneId;
  if (areaId) query.areaId = areaId;

  const stockedBatches = await StockBatch.find(query)
    .select('batchNo productId currentBaseQty')
    .limit(10)
    .lean();

  if (stockedBatches.length > 0) {
    const remainingBaseQty = stockedBatches.reduce((sum, b) => sum + (Number(b.currentBaseQty) || 0), 0);
    throw new AppError(
      'Cannot delete this storage location while it holds stock. Execute a Stock Movement first to bring quantity to 0.',
      400,
      'ZERO_STOCK_GUARD_BLOCKED',
      {
        remainingBaseQty,
        sampleBatches: stockedBatches.map((b) => ({ batchNo: b.batchNo, currentBaseQty: b.currentBaseQty })),
      }
    );
  }
}

async function resolveBaseQtyForLine(distributorId, item) {
  const rawQty = Math.max(0, Number(item.quantity) || 0);
  if (item.conversionQty && Number(item.conversionQty) > 0) {
    return rawQty * Number(item.conversionQty);
  }
  const product = await Product.findOne({ _id: item.productId, distributorId })
    .select('baseUnit packingUnits')
    .lean();
  const meta = getProductUnitMeta(product, item.unitName);
  const isBase = !item.unitName || item.unitName.toLowerCase() === meta.baseUnitName.toLowerCase();
  return rawQty * (isBase ? 1 : meta.conversionQty);
}

/**
 * Atomically reserves stock (availableBaseQty -> reservedBaseQty) when an order is APPROVED.
 */
export async function reserveStockForOrder({ distributorId, lineItems = [], session = null }) {
  const allocations = [];

  for (const item of lineItems) {
    if (!item?.productId) continue;
    const neededBaseQty = await resolveBaseQtyForLine(distributorId, item);
    if (neededBaseQty <= 0) continue;

    if (item.batchId) {
      const batch = await StockBatch.findOne({
        _id: item.batchId,
        distributorId,
        condition: 'NORMAL',
        status: { $in: ['AVAILABLE', 'LOW_WARNING', 'RESERVED'] },
        availableBaseQty: { $gte: neededBaseQty },
      }).session(session);

      if (!batch) {
        throw new AppError(
          `Insufficient available stock in selected batch for ${item.productName || item.productId}.`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      batch.reservedBaseQty += neededBaseQty;
      batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
      batch.status = deriveBatchStatus(batch);
      await batch.save(session ? { session } : undefined);
      allocations.push({ batchId: batch._id, productId: item.productId, baseQty: neededBaseQty });
    } else {
      let remaining = neededBaseQty;
      const candidateBatches = await StockBatch.find({
        distributorId,
        productId: item.productId,
        condition: 'NORMAL',
        status: { $in: ['AVAILABLE', 'LOW_WARNING'] },
        availableBaseQty: { $gt: 0 },
      })
        .sort({ expDate: 1, createdAt: 1 })
        .session(session);

      for (const batch of candidateBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.availableBaseQty);
        batch.reservedBaseQty += take;
        batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
        batch.status = deriveBatchStatus(batch);
        await batch.save(session ? { session } : undefined);
        allocations.push({ batchId: batch._id, productId: item.productId, baseQty: take });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new AppError(
          `Insufficient available stock for ${item.productName || item.productId}. Short by ${remaining} base units.`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }
    }
  }

  return allocations;
}

/**
 * Releases reserved stock back to available stock when an approved order is CANCELLED.
 */
export async function releaseReservedStock({ distributorId, allocations = [], session = null }) {
  for (const alloc of allocations) {
    if (!alloc?.batchId || !alloc?.baseQty) continue;
    const batch = await StockBatch.findOne({ _id: alloc.batchId, distributorId }).session(session);
    if (!batch) continue;
    batch.reservedBaseQty = Math.max(0, batch.reservedBaseQty - Number(alloc.baseQty));
    batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
    batch.status = deriveBatchStatus(batch);
    await batch.save(session ? { session } : undefined);
  }
}

/**
 * Deducts delivered stock from currentBaseQty and reservedBaseQty (or available stock for direct POS/extra sales).
 */
export async function deductDeliveredStock({ distributorId, allocations = [], fromReserved = true, session = null }) {
  for (const alloc of allocations) {
    const qty = Math.max(0, Number(alloc.baseQty) || 0);
    if (!qty) continue;

    let batch = null;
    if (alloc.batchId) {
      batch = await StockBatch.findOne({ _id: alloc.batchId, distributorId }).session(session);
    } else if (alloc.productId) {
      batch = await StockBatch.findOne({
        distributorId,
        productId: alloc.productId,
        condition: 'NORMAL',
        currentBaseQty: { $gte: qty },
      })
        .sort({ expDate: 1, createdAt: 1 })
        .session(session);
    }

    if (!batch) {
      throw new AppError('Stock batch not found for delivery deduction.', 400, 'BATCH_NOT_FOUND');
    }

    if (fromReserved) {
      const releaseAmt = Math.min(batch.reservedBaseQty, qty);
      batch.reservedBaseQty -= releaseAmt;
    }
    batch.currentBaseQty = Math.max(0, batch.currentBaseQty - qty);
    batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
    batch.status = deriveBatchStatus(batch);
    await batch.save(session ? { session } : undefined);
  }
}

export default {
  runWithTransaction,
  formatDualUnitQty,
  getProductUnitMeta,
  deriveBatchStatus,
  assertZeroStockBeforeDelete,
  reserveStockForOrder,
  releaseReservedStock,
  deductDeliveredStock,
};
