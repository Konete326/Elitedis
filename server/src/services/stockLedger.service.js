import { StockBatch } from '../models/StockBatch.model.js';
import { Product } from '../models/Product.model.js';
import { AppError } from '../middlewares/errorMiddleware.js';
import { getActiveConnection, getTenantModel } from '../config/tenantDb.js';

/**
 * Executes a callback inside a Mongoose ACID transaction when supported (Atlas Replica Set),
 * falling back cleanly on standalone local mongod instances without replica sets.
 */
export async function runWithTransaction(workFn) {
  const conn = getActiveConnection();
  const session = await conn.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (err) {
      const msg = String(err?.message || '');
      const unsupported = err?.code === 20 || err?.code === 263 || err?.codeName === 'IllegalOperation'
        || msg.includes('Transaction numbers are only allowed on a replica set')
        || msg.includes('does not support transactions') || msg.includes('replica set');
      if (unsupported) return await workFn(null);
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

function buildUnitMeta({ unitVersionId, unitName, conversionQty, packUnitName, baseUnitName, baseWeightKg, hasPack = true }) {
  return {
    unitVersionId,
    unitName,
    conversionQty,
    packUnitName,
    baseUnitName,
    baseWeightKg,
    packingSpecification: hasPack ? `1 ${packUnitName} = ${conversionQty} ${baseUnitName}` : `1 ${baseUnitName}`,
  };
}

/**
 * Extracts conversion factor, unit version, and unit labels from a Product document.
 * Priority: unitVersionId match -> ACTIVE_DEFAULT in unitVersions -> packingUnits fallback.
 */
export function getProductUnitMeta(product, unitName, unitVersionId = null) {
  const baseUnitName = product?.baseUnit?.unitName || 'Piece';
  const baseWeightKg = Number(product?.baseUnit?.weightInKg) || 0;
  const packUnits = Array.isArray(product?.packingUnits) ? product.packingUnits : [];
  const unitVersions = Array.isArray(product?.unitVersions) ? product.unitVersions : [];

  const versionMatch = unitVersionId ? unitVersions.find((v) => v.unitVersionId === unitVersionId) : null;
  if (versionMatch) {
    const packName = versionMatch.unitName || 'Carton';
    return buildUnitMeta({
      unitVersionId: versionMatch.unitVersionId,
      unitName: unitName || packName,
      conversionQty: Math.max(1, Number(versionMatch.conversionQty) || 1),
      packUnitName: packName,
      baseUnitName,
      baseWeightKg,
    });
  }

  const activeVersion = unitVersions.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || unitVersions[unitVersions.length - 1] || null;
  if (activeVersion) {
    const altPack = unitName
      && unitName.toLowerCase() !== String(activeVersion.unitName || '').toLowerCase()
      && unitName.toLowerCase() !== baseUnitName.toLowerCase()
      && packUnits.find((p) => p.unitName?.toLowerCase() === String(unitName).toLowerCase());
    if (!altPack) {
      const packName = activeVersion.unitName || 'Carton';
      return buildUnitMeta({
        unitVersionId: activeVersion.unitVersionId || 'UV-1',
        unitName: unitName || packName,
        conversionQty: Math.max(1, Number(activeVersion.conversionQty) || 1),
        packUnitName: packName,
        baseUnitName,
        baseWeightKg,
      });
    }
  }

  const matched = unitName ? packUnits.find((p) => p.unitName?.toLowerCase() === String(unitName).toLowerCase()) : null;
  const defaultPack = matched || packUnits.find((p) => p.isDefaultStockUnit) || packUnits[0];
  return buildUnitMeta({
    unitVersionId: activeVersion?.unitVersionId || 'UV-1',
    unitName: matched ? matched.unitName : unitName || baseUnitName,
    conversionQty: defaultPack ? Math.max(1, Number(defaultPack.conversionQty) || 1) : 1,
    packUnitName: defaultPack?.unitName || 'Pack',
    baseUnitName,
    baseWeightKg,
    hasPack: Boolean(defaultPack),
  });
}

/**
 * Derives operational StockBatch status from current, reserved, available, and min thresholds.
 */
export function deriveBatchStatus(batch, packConversionQty = 1) {
  const current = Math.max(0, Number(batch.currentBaseQty) || 0);
  const reserved = Math.max(0, Number(batch.reservedBaseQty) || 0);
  const available = Math.max(0, current - reserved);
  if (batch.status === 'BLOCKED' || batch.status === 'QUARANTINED') return batch.status;
  if (current <= 0) return 'OUT';
  const minBase = (Number(batch.thresholds?.minStockPack) || 0) * Math.max(1, packConversionQty);
  if (available <= 0 || (minBase > 0 && available <= minBase)) return 'LOW_WARNING';
  if (reserved > 0 && available === current - reserved && reserved >= current) return 'RESERVED';
  return 'AVAILABLE';
}

/**
 * Zero-Quantity Deletion Guard: Blocks deleting a Warehouse, Zone, or Area with currentBaseQty > 0.
 */
export async function assertZeroStockBeforeDelete({ distributorId, warehouseId, zoneId = null, areaId = null }) {
  const query = { distributorId, warehouseId, currentBaseQty: { $gt: 0 } };
  if (zoneId) query.zoneId = zoneId;
  if (areaId) query.areaId = areaId;
  const stocked = await getTenantModel('StockBatch', StockBatch).find(query).select('batchNo productId currentBaseQty').limit(10).lean();
  if (stocked.length > 0) {
    const remainingBaseQty = stocked.reduce((sum, b) => sum + (Number(b.currentBaseQty) || 0), 0);
    throw new AppError(
      'Cannot delete this storage location while it holds stock. Execute a Stock Movement first to bring quantity to 0.',
      400,
      'ZERO_STOCK_GUARD_BLOCKED',
      { remainingBaseQty, sampleBatches: stocked.map((b) => ({ batchNo: b.batchNo, currentBaseQty: b.currentBaseQty })) }
    );
  }
}

function buildVersionStockFilter(distributorId, productId, unitVersionId) {
  return unitVersionId === 'UV-1'
    ? { distributorId, productId, currentBaseQty: { $gt: 0 }, $or: [{ unitVersionId: 'UV-1' }, { unitVersionId: { $exists: false } }] }
    : { distributorId, productId, unitVersionId, currentBaseQty: { $gt: 0 } };
}

/**
 * Transitions COEXISTING unit versions to DEPLETED once no StockBatch holds remaining qty for that version.
 */
export async function syncProductUnitVersionLifecycle({ distributorId, productId, session = null }) {
  if (!distributorId || !productId) return null;
  const ProductM = getTenantModel('Product', Product);
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const product = await ProductM.findOne({ _id: productId, distributorId }).session(session);
  if (!product || !Array.isArray(product.unitVersions) || product.unitVersions.length === 0) return product;

  let changed = false;
  for (const v of product.unitVersions) {
    if (v.versionStatus === 'COEXISTING') {
      const hasStock = await StockBatchM.exists(buildVersionStockFilter(distributorId, productId, v.unitVersionId)).session(session);
      if (!hasStock) {
        v.versionStatus = 'DEPLETED';
        changed = true;
      }
    }
  }
  if (changed) await product.save(session ? { session } : undefined);
  return product;
}

/**
 * Creates a new ACTIVE_DEFAULT unit version when packingUnits[0] changes without mutating existing batches.
 */
export async function applyProductUnitVersionChange({ distributorId, payload, existingProduct, session = null }) {
  if (!Array.isArray(payload?.packingUnits) || payload.packingUnits.length === 0) return;
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const nextPack = payload.packingUnits[0];
  const nextConv = Math.max(1, Number(nextPack.conversionQty) || 1);
  const nextUnit = String(nextPack.unitName || 'Carton').trim() || 'Carton';
  const bu = payload.baseUnit || existingProduct.baseUnit || {};
  const val = Number(bu.weightValue) || 0;
  const baseKg = val > 0 ? Number((bu.weightUnit === 'g' || bu.weightUnit === 'ml' ? val / 1000 : val).toFixed(4)) : Number(bu.weightInKg) || 0;
  const nextPackWt = baseKg > 0 ? Number((baseKg * nextConv).toFixed(4)) : Number(nextPack.packingWeightKg) || 0;

  let versions = Array.isArray(existingProduct.unitVersions)
    ? existingProduct.unitVersions.map((v) => (typeof v.toObject === 'function' ? v.toObject() : { ...v }))
    : [];
  if (versions.length === 0 && existingProduct.packingUnits?.[0]) {
    const old0 = existingProduct.packingUnits[0];
    versions = [{
      versionNo: 1, unitVersionId: 'UV-1', unitName: old0.unitName || 'Carton',
      conversionQty: Math.max(1, Number(old0.conversionQty) || 1), packingWeightKg: old0.packingWeightKg || 0,
      effectiveFrom: existingProduct.createdAt || new Date(), versionStatus: 'ACTIVE_DEFAULT',
    }];
  }

  const active = versions.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || versions[versions.length - 1];
  if (!active) {
    payload.unitVersions = [{ versionNo: 1, unitVersionId: 'UV-1', unitName: nextUnit, conversionQty: nextConv, packingWeightKg: nextPackWt, effectiveFrom: new Date(), versionStatus: 'ACTIVE_DEFAULT' }];
    return;
  }

  const changed = String(active.unitName || '').trim().toLowerCase() !== nextUnit.toLowerCase() || Math.max(1, Number(active.conversionQty) || 1) !== nextConv;
  if (changed) {
    const hasStock = await StockBatchM.exists(buildVersionStockFilter(distributorId, existingProduct._id, active.unitVersionId)).session(session);
    for (const v of versions) {
      if (v.versionStatus === 'ACTIVE_DEFAULT') v.versionStatus = hasStock ? 'COEXISTING' : 'DEPLETED';
    }
    const nextNo = versions.reduce((mx, v) => Math.max(mx, Number(v.versionNo) || 0), 0) + 1;
    versions.push({ versionNo: nextNo, unitVersionId: `UV-${nextNo}`, unitName: nextUnit, conversionQty: nextConv, packingWeightKg: nextPackWt, effectiveFrom: new Date(), versionStatus: 'ACTIVE_DEFAULT' });
  } else if (nextPackWt > 0) {
    active.packingWeightKg = nextPackWt;
  }
  payload.unitVersions = versions;
}

async function resolveBaseQtyForLine(distributorId, item, batch = null, session = null) {
  const rawQty = Math.max(0, Number(item.quantity) || 0);
  if (rawQty <= 0) return 0;
  const ProductM = getTenantModel('Product', Product);
  const product = await ProductM.findOne({ _id: item.productId, distributorId }).select('baseUnit packingUnits unitVersions').session(session).lean();
  const baseName = (product?.baseUnit?.unitName || 'Piece').toLowerCase();
  const unitLower = item.unitName ? String(item.unitName).toLowerCase() : '';
  if (unitLower && unitLower === baseName) return rawQty;

  if (batch) {
    if (!item.unitName && !item.conversionQty && !item.unitVersionId) return rawQty;
    const meta = getProductUnitMeta(product, item.unitName, item.unitVersionId || batch.unitVersionId);
    const conv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : meta.conversionQty;
    return rawQty * conv;
  }
  if (item.conversionQty && Number(item.conversionQty) > 0) return rawQty * Number(item.conversionQty);
  if (!item.unitName && !item.unitVersionId) return rawQty;
  return rawQty * getProductUnitMeta(product, item.unitName, item.unitVersionId).conversionQty;
}

/**
 * Atomically reserves stock (availableBaseQty -> reservedBaseQty) when an order is APPROVED.
 */
export async function reserveStockForOrder({ distributorId, lineItems = [], session = null }) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const allocations = [];

  for (const item of lineItems) {
    if (!item?.productId) continue;

    if (item.batchId) {
      const batch = await StockBatchM.findOne({
        _id: item.batchId,
        distributorId,
        condition: 'NORMAL',
        status: { $in: ['AVAILABLE', 'LOW_WARNING', 'RESERVED'] },
      }).session(session);
      const neededBaseQty = await resolveBaseQtyForLine(distributorId, item, batch, session);
      if (neededBaseQty <= 0) continue;
      if (!batch || batch.availableBaseQty < neededBaseQty) {
        throw new AppError(`Insufficient available stock in selected batch for ${item.productName || item.productId}.`, 400, 'INSUFFICIENT_STOCK');
      }
      batch.reservedBaseQty += neededBaseQty;
      batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
      batch.status = deriveBatchStatus(batch, batch.conversionQty || 1);
      await batch.save(session ? { session } : undefined);
      allocations.push({ batchId: batch._id, productId: item.productId, baseQty: neededBaseQty });
    } else {
      const neededBaseQty = await resolveBaseQtyForLine(distributorId, item, null, session);
      if (neededBaseQty <= 0) continue;
      let remaining = neededBaseQty;
      const candidateBatches = await StockBatchM.find({
        distributorId,
        productId: item.productId,
        condition: 'NORMAL',
        status: { $in: ['AVAILABLE', 'LOW_WARNING'] },
        availableBaseQty: { $gt: 0 },
      }).sort({ expDate: 1, createdAt: 1 }).session(session);

      for (const batch of candidateBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.availableBaseQty);
        batch.reservedBaseQty += take;
        batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
        batch.status = deriveBatchStatus(batch, batch.conversionQty || 1);
        await batch.save(session ? { session } : undefined);
        allocations.push({ batchId: batch._id, productId: item.productId, baseQty: take });
        remaining -= take;
      }
      if (remaining > 0) {
        throw new AppError(`Insufficient available stock for ${item.productName || item.productId}. Short by ${remaining} base units.`, 400, 'INSUFFICIENT_STOCK');
      }
    }
  }
  return allocations;
}

/**
 * Releases reserved stock back to available stock when an approved order is CANCELLED.
 */
export async function releaseReservedStock({ distributorId, allocations = [], session = null }) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  for (const alloc of allocations) {
    if (!alloc?.batchId || !alloc?.baseQty) continue;
    const batch = await StockBatchM.findOne({ _id: alloc.batchId, distributorId }).session(session);
    if (!batch) continue;
    batch.reservedBaseQty = Math.max(0, batch.reservedBaseQty - Number(alloc.baseQty));
    batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
    batch.status = deriveBatchStatus(batch, batch.conversionQty || 1);
    await batch.save(session ? { session } : undefined);
  }
}

/**
 * Deducts delivered stock from currentBaseQty and reservedBaseQty, syncing depleted unit versions.
 */
export async function deductDeliveredStock({ distributorId, allocations = [], fromReserved = true, session = null }) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const depletedProducts = new Set();

  for (const alloc of allocations) {
    let batch = null;
    let qty = alloc.baseQty !== undefined && alloc.baseQty !== null ? Math.max(0, Number(alloc.baseQty) || 0) : 0;

    if (alloc.batchId) {
      batch = await StockBatchM.findOne({ _id: alloc.batchId, distributorId }).session(session);
      if (alloc.baseQty === undefined || alloc.baseQty === null) {
        qty = await resolveBaseQtyForLine(distributorId, alloc, batch, session);
      }
    } else if (alloc.productId) {
      if (alloc.baseQty === undefined || alloc.baseQty === null) {
        qty = await resolveBaseQtyForLine(distributorId, alloc, null, session);
      }
      if (qty > 0) {
        batch = await StockBatchM.findOne({ distributorId, productId: alloc.productId, condition: 'NORMAL', currentBaseQty: { $gte: qty } })
          .sort({ expDate: 1, createdAt: 1 }).session(session);
      }
    }

    if (!qty) continue;
    if (!batch) throw new AppError('Stock batch not found for delivery deduction.', 400, 'BATCH_NOT_FOUND');

    if (fromReserved) batch.reservedBaseQty -= Math.min(batch.reservedBaseQty, qty);
    batch.currentBaseQty = Math.max(0, batch.currentBaseQty - qty);
    batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
    batch.status = deriveBatchStatus(batch, batch.conversionQty || 1);
    await batch.save(session ? { session } : undefined);

    if (batch.currentBaseQty === 0 && batch.productId) {
      depletedProducts.add(String(batch.productId));
    }
  }

  for (const productId of depletedProducts) {
    await syncProductUnitVersionLifecycle({ distributorId, productId, session });
  }
}

export default {
  runWithTransaction, formatDualUnitQty, getProductUnitMeta, deriveBatchStatus,
  assertZeroStockBeforeDelete, syncProductUnitVersionLifecycle, applyProductUnitVersionChange,
  reserveStockForOrder, releaseReservedStock, deductDeliveredStock,
};
