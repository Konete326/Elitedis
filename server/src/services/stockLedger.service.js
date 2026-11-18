import { StockBatch } from '../models/StockBatch.model.js';
import { Product } from '../models/Product.model.js';
import { Distributor } from '../models/Distributor.model.js';
import { AppError } from '../middlewares/errorMiddleware.js';
import { getActiveConnection, getTenantModel } from '../config/tenantDb.js';
import { assertZeroStockBeforeDelete } from './warehouseGuard.service.js';

export { assertZeroStockBeforeDelete };

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
    totalBaseQty: qty, conversionQty: conv, packQty, baseQty,
    formatted: conv > 1 ? `${packQty} ${packUnitName} : ${baseQty} ${baseUnitName}` : `${qty} ${baseUnitName}`,
    shortFormatted: conv > 1 ? `${packQty}:${baseQty}` : `0:${qty}`,
  };
}

function buildUnitMeta(unitVersionId, unitName, conv, packUnitName, baseUnitName, baseWeightKg, hasPack = true) {
  return {
    unitVersionId, unitName, conversionQty: conv, packUnitName, baseUnitName, baseWeightKg,
    packingSpecification: hasPack ? `1 ${packUnitName} = ${conv} ${baseUnitName}` : `1 ${baseUnitName}`,
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

  const verMatch = unitVersionId ? unitVersions.find((v) => v.unitVersionId === unitVersionId) : null;
  if (verMatch) {
    const pack = verMatch.unitName || 'Carton';
    return buildUnitMeta(verMatch.unitVersionId, unitName || pack, Math.max(1, Number(verMatch.conversionQty) || 1), pack, baseUnitName, baseWeightKg);
  }

  const activeVer = unitVersions.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || unitVersions[unitVersions.length - 1] || null;
  const altPack = unitName && activeVer
    && unitName.toLowerCase() !== String(activeVer.unitName || '').toLowerCase()
    && unitName.toLowerCase() !== baseUnitName.toLowerCase()
    && packUnits.find((p) => p.unitName?.toLowerCase() === String(unitName).toLowerCase());
  if (activeVer && !altPack) {
    const pack = activeVer.unitName || 'Carton';
    return buildUnitMeta(activeVer.unitVersionId || 'UV-1', unitName || pack, Math.max(1, Number(activeVer.conversionQty) || 1), pack, baseUnitName, baseWeightKg);
  }

  const matched = unitName ? packUnits.find((p) => p.unitName?.toLowerCase() === String(unitName).toLowerCase()) : null;
  const defPack = matched || packUnits.find((p) => p.isDefaultStockUnit) || packUnits[0];
  return buildUnitMeta(
    activeVer?.unitVersionId || 'UV-1',
    matched ? matched.unitName : unitName || baseUnitName,
    defPack ? Math.max(1, Number(defPack.conversionQty) || 1) : 1,
    defPack?.unitName || 'Pack',
    baseUnitName,
    baseWeightKg,
    Boolean(defPack)
  );
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

const VALID_BATCH_CONDITIONS = new Set(['FRESH', 'NORMAL', 'DAMAGE', 'EXPIRE', 'DAMAGE_EXPIRE']);
const VALID_BATCH_STATUSES = new Set(['NORMAL', 'AVAILABLE', 'RESERVED', 'LOW', 'WARNING', 'LOW_WARNING', 'OUT', 'BLOCKED', 'QUARANTINED']);

export function applyBatchConditionAndStatus(batch, { status, condition, customConditionLabel } = {}, conv = 1) {
  if (condition !== undefined && condition !== '') {
    if (!VALID_BATCH_CONDITIONS.has(condition)) throw new AppError('Invalid stock condition.', 400, 'INVALID_CONDITION');
    batch.condition = condition;
  }
  if (customConditionLabel !== undefined) batch.customConditionLabel = String(customConditionLabel || '').trim();
  if (status === 'UNBLOCK') {
    batch.status = 'AVAILABLE';
    batch.status = deriveBatchStatus(batch, conv);
  } else if (status !== undefined && status !== '') {
    if (!VALID_BATCH_STATUSES.has(status)) throw new AppError('Invalid stock status.', 400, 'INVALID_STATUS');
    batch.status = status;
  } else {
    batch.status = deriveBatchStatus(batch, conv);
  }
}

function buildVersionStockFilter(distributorId, productId, unitVersionId) {
  return unitVersionId === 'UV-1'
    ? { distributorId, productId, currentBaseQty: { $gt: 0 }, $or: [{ unitVersionId: 'UV-1' }, { unitVersionId: { $exists: false } }] }
    : { distributorId, productId, unitVersionId, currentBaseQty: { $gt: 0 } };
}

async function commitBatchState(batch, session) {
  batch.availableBaseQty = Math.max(0, batch.currentBaseQty - batch.reservedBaseQty);
  batch.status = deriveBatchStatus(batch, batch.conversionQty || 1);
  await batch.save(session ? { session } : undefined);
}

/**
 * Transitions COEXISTING unit versions to DEPLETED once no StockBatch holds remaining qty for that version.
 */
export async function syncProductUnitVersionLifecycle({ distributorId, productId, session = null }) {
  if (!distributorId || !productId) return null;
  const ProductM = getTenantModel('Product', Product);
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const product = await ProductM.findOne({ _id: productId, distributorId }).session(session);
  if (!product?.unitVersions?.length) return product;
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

  let versions = Array.isArray(existingProduct.unitVersions) ? existingProduct.unitVersions.map((v) => v.toObject?.() || { ...v }) : [];
  if (versions.length === 0 && existingProduct.packingUnits?.[0]) {
    const old0 = existingProduct.packingUnits[0];
    versions = [{ versionNo: 1, unitVersionId: 'UV-1', unitName: old0.unitName || 'Carton', conversionQty: Math.max(1, Number(old0.conversionQty) || 1), packingWeightKg: old0.packingWeightKg || 0, effectiveFrom: existingProduct.createdAt || new Date(), versionStatus: 'ACTIVE_DEFAULT' }];
  }
  const active = versions.find((v) => v.versionStatus === 'ACTIVE_DEFAULT') || versions[versions.length - 1];
  if (!active) {
    payload.unitVersions = [{ versionNo: 1, unitVersionId: 'UV-1', unitName: nextUnit, conversionQty: nextConv, packingWeightKg: nextPackWt, effectiveFrom: new Date(), versionStatus: 'ACTIVE_DEFAULT' }];
    return;
  }
  const changed = String(active.unitName || '').trim().toLowerCase() !== nextUnit.toLowerCase() || Math.max(1, Number(active.conversionQty) || 1) !== nextConv;
  if (changed) {
    const hasStock = await StockBatchM.exists(buildVersionStockFilter(distributorId, existingProduct._id, active.unitVersionId)).session(session);
    for (const v of versions) if (v.versionStatus === 'ACTIVE_DEFAULT') v.versionStatus = hasStock ? 'COEXISTING' : 'DEPLETED';
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
  const product = await getTenantModel('Product', Product).findOne({ _id: item.productId, distributorId }).select('baseUnit packingUnits unitVersions').session(session).lean();
  const baseName = (product?.baseUnit?.unitName || 'Piece').toLowerCase();
  const unitLower = item.unitName ? String(item.unitName).toLowerCase() : '';
  if (unitLower && unitLower === baseName) return rawQty;
  if (batch) {
    if (!item.unitName && !item.conversionQty && !item.unitVersionId) return rawQty;
    const meta = getProductUnitMeta(product, item.unitName, item.unitVersionId || batch.unitVersionId);
    return rawQty * (Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : meta.conversionQty);
  }
  if (item.conversionQty && Number(item.conversionQty) > 0) return rawQty * Number(item.conversionQty);
  if (!item.unitName && !item.unitVersionId) return rawQty;
  return rawQty * getProductUnitMeta(product, item.unitName, item.unitVersionId).conversionQty;
}

/**
 * Reads distributor stock issue policy (FIFO/FEFO/MANUAL) and custom supplementary conditions.
 */
export async function getDistributorStockPolicy(distributorId, session = null) {
  const query = Distributor.findOne({ distributorId }).select('stockIssuePolicy customStockConditions');
  if (session && session.client === Distributor.db?.client) query.session(session);
  const dist = await query.lean();
  return { stockIssuePolicy: dist?.stockIssuePolicy || 'FEFO', customStockConditions: Array.isArray(dist?.customStockConditions) ? dist.customStockConditions : [] };
}

export async function saveDistributorStockPolicy(distributorId, { stockIssuePolicy, customStockConditions } = {}) {
  const updates = {};
  if (stockIssuePolicy !== undefined) {
    if (!['FIFO', 'FEFO', 'MANUAL'].includes(stockIssuePolicy)) throw new AppError('Invalid stock issue policy. Choose FIFO, FEFO, or MANUAL.', 400, 'INVALID_STOCK_POLICY');
    updates.stockIssuePolicy = stockIssuePolicy;
  }
  if (Array.isArray(customStockConditions)) {
    const allowed = new Set(['FRESH', 'NORMAL', 'DAMAGE', 'EXPIRE']);
    updates.customStockConditions = customStockConditions
      .filter((c) => String(c?.label || '').trim())
      .map((c) => ({ label: String(c.label).trim(), mappedSystemCondition: allowed.has(c.mappedSystemCondition) ? c.mappedSystemCondition : 'NORMAL' }));
  }
  const dist = await Distributor.findOneAndUpdate({ distributorId }, { $set: updates }, { new: true }).select('stockIssuePolicy customStockConditions').lean();
  if (!dist) throw new AppError('Distributor profile not found.', 404, 'DISTRIBUTOR_NOT_FOUND');
  return { stockIssuePolicy: dist.stockIssuePolicy || 'FEFO', customStockConditions: dist.customStockConditions || [] };
}

/**
 * Sorts candidate batches deterministically by policy: FIFO (purchaseDate ASC) or FEFO (expDate ASC nulls-last).
 */
export function sortBatchesByPolicy(batches = [], policy = 'FEFO') {
  return [...batches].sort((a, b) => {
    if (policy !== 'FIFO') {
      const expA = a.expDate ? new Date(a.expDate).getTime() : Number.POSITIVE_INFINITY;
      const expB = b.expDate ? new Date(b.expDate).getTime() : Number.POSITIVE_INFINITY;
      if (expA !== expB) return expA - expB;
    }
    const pA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
    const pB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
    return pA !== pB ? pA - pB : new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

/**
 * Atomically reserves stock (availableBaseQty -> reservedBaseQty) per active policy when an order is APPROVED.
 */
export async function reserveStockForOrder({ distributorId, lineItems = [], policyOverride = null, session = null }) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const activePolicy = ['FIFO', 'FEFO', 'MANUAL'].includes(policyOverride) ? policyOverride : (await getDistributorStockPolicy(distributorId, session)).stockIssuePolicy;
  const allocations = [];

  for (const item of lineItems) {
    if (!item?.productId) continue;
    if (item.batchId) {
      const batch = await StockBatchM.findOne({ _id: item.batchId, distributorId }).session(session);
      if (!batch) throw new AppError(`Stock batch not found for ${item.productName || item.productId}.`, 400, 'BATCH_NOT_FOUND');
      if (batch.status === 'BLOCKED' || batch.status === 'QUARANTINED' || !['FRESH', 'NORMAL'].includes(batch.condition)) {
        throw new AppError('Selected batch is Blocked, Quarantined, Damaged, or Expired and cannot be allocated.', 400, 'BATCH_BLOCKED_OR_INELIGIBLE');
      }
      const needed = await resolveBaseQtyForLine(distributorId, item, batch, session);
      if (needed <= 0) continue;
      if (batch.availableBaseQty < needed) throw new AppError(`Insufficient available stock in selected batch for ${item.productName || item.productId}.`, 400, 'INSUFFICIENT_STOCK');
      batch.reservedBaseQty += needed;
      await commitBatchState(batch, session);
      allocations.push({ batchId: batch._id, productId: item.productId, baseQty: needed });
    } else {
      const needed = await resolveBaseQtyForLine(distributorId, item, null, session);
      if (needed <= 0) continue;
      let remaining = needed;
      const query = StockBatchM.find({
        distributorId, productId: item.productId, condition: { $in: ['FRESH', 'NORMAL'] },
        status: { $nin: ['BLOCKED', 'QUARANTINED', 'OUT'] }, availableBaseQty: { $gt: 0 },
        $or: [{ expDate: null }, { expDate: { $gt: new Date() } }],
      });
      if (activePolicy === 'FIFO' && typeof query.sort === 'function') query.sort({ purchaseDate: 1, createdAt: 1 });
      for (const batch of sortBatchesByPolicy(await query.session(session), activePolicy)) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.availableBaseQty);
        batch.reservedBaseQty += take;
        await commitBatchState(batch, session);
        if (!item.batchId) item.batchId = batch._id;
        allocations.push({ batchId: batch._id, productId: item.productId, baseQty: take });
        remaining -= take;
      }
      if (remaining > 0) throw new AppError(`Insufficient available stock for ${item.productName || item.productId}. Short by ${remaining} base units.`, 400, 'INSUFFICIENT_STOCK');
    }
  }
  allocations.policyApplied = activePolicy;
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
    await commitBatchState(batch, session);
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
      if (alloc.baseQty === undefined || alloc.baseQty === null) qty = await resolveBaseQtyForLine(distributorId, alloc, batch, session);
    } else if (alloc.productId) {
      if (alloc.baseQty === undefined || alloc.baseQty === null) qty = await resolveBaseQtyForLine(distributorId, alloc, null, session);
      if (qty > 0) {
        batch = await StockBatchM.findOne({
          distributorId, productId: alloc.productId, condition: { $in: ['FRESH', 'NORMAL'] },
          status: { $nin: ['BLOCKED', 'QUARANTINED'] }, currentBaseQty: { $gte: qty },
        }).sort({ expDate: 1, createdAt: 1 }).session(session);
      }
    }
    if (!qty) continue;
    if (!batch) throw new AppError('Stock batch not found for delivery deduction.', 400, 'BATCH_NOT_FOUND');
    if (fromReserved) batch.reservedBaseQty -= Math.min(batch.reservedBaseQty, qty);
    batch.currentBaseQty = Math.max(0, batch.currentBaseQty - qty);
    await commitBatchState(batch, session);
    if (batch.currentBaseQty === 0 && batch.productId) depletedProducts.add(String(batch.productId));
  }
  for (const productId of depletedProducts) await syncProductUnitVersionLifecycle({ distributorId, productId, session });
}

export default {
  runWithTransaction, formatDualUnitQty, getProductUnitMeta, deriveBatchStatus, applyBatchConditionAndStatus,
  assertZeroStockBeforeDelete, syncProductUnitVersionLifecycle, applyProductUnitVersionChange,
  getDistributorStockPolicy, saveDistributorStockPolicy, sortBatchesByPolicy,
  reserveStockForOrder, releaseReservedStock, deductDeliveredStock,
};
