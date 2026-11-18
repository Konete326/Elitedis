import { StockBatch } from '../models/index.js';
import { getTenantModel } from '../config/tenantDb.js';
import { AppError } from '../middlewares/errorMiddleware.js';
import { canViewPurchasePrice } from '../middlewares/rbacMiddleware.js';
import { recordAuditLog } from './accountingPost.service.js';
import { deriveBatchStatus, getProductUnitMeta, syncProductUnitVersionLifecycle } from './stockLedger.service.js';

const sameDateDay = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
};

export function normalizePurchaseItem(raw = {}) {
  const conv = Math.max(1, Number(raw.conversionQty) || 1);
  const movedFallback = Number(raw.movedBaseQty) || (Number(raw.movedPackQty) || 0) * conv;
  const expectedBaseQty = raw.expectedBaseQty !== undefined ? Math.max(0, Number(raw.expectedBaseQty) || 0) : movedFallback;
  const hasSegregated = raw.normalBaseQty !== undefined || raw.damagedBaseQty !== undefined || raw.expiredBaseQty !== undefined;
  const normalBaseQty = hasSegregated ? Math.max(0, Number(raw.normalBaseQty) || 0) : (raw.receivedBaseQty !== undefined ? Math.max(0, Number(raw.receivedBaseQty) || 0) : movedFallback);
  const damagedBaseQty = hasSegregated ? Math.max(0, Number(raw.damagedBaseQty) || 0) : 0;
  const expiredBaseQty = hasSegregated ? Math.max(0, Number(raw.expiredBaseQty) || 0) : 0;
  const segTotal = normalBaseQty + damagedBaseQty + expiredBaseQty;
  const receivedBaseQty = raw.receivedBaseQty !== undefined ? Math.max(0, Number(raw.receivedBaseQty) || 0) : segTotal;

  if (hasSegregated && receivedBaseQty > 0 && segTotal !== receivedBaseQty) {
    throw new AppError(
      `Segregated quantities (Normal ${normalBaseQty} + Damaged ${damagedBaseQty} + Expired ${expiredBaseQty} = ${segTotal}) must equal Received Qty (${receivedBaseQty}).`,
      400,
      'SEGREGATED_QTY_MISMATCH'
    );
  }

  const expectedMfgDate = raw.expectedMfgDate || raw.mfgDate || null;
  const expectedExpDate = raw.expectedExpDate || raw.expDate || null;
  const receivedMfgDate = raw.receivedMfgDate || raw.mfgDate || expectedMfgDate || null;
  const receivedExpDate = raw.receivedExpDate || raw.expDate || expectedExpDate || null;
  const mfgMismatch = Boolean(expectedMfgDate && receivedMfgDate && !sameDateDay(expectedMfgDate, receivedMfgDate));
  const expMismatch = Boolean(expectedExpDate && receivedExpDate && !sameDateDay(expectedExpDate, receivedExpDate));

  return {
    ...raw,
    conversionQty: conv,
    expectedBaseQty,
    receivedBaseQty,
    normalBaseQty,
    damagedBaseQty,
    expiredBaseQty,
    movedBaseQty: receivedBaseQty,
    differenceBaseQty: receivedBaseQty - expectedBaseQty,
    expectedMfgDate,
    expectedExpDate,
    receivedMfgDate,
    receivedExpDate,
    mfgDate: receivedMfgDate,
    expDate: receivedExpDate,
    mfgMismatch,
    expMismatch,
    toZoneId: raw.toZoneId || raw.normalZoneId || raw.damagedZoneId || raw.expiredZoneId || null,
    toAreaId: raw.toAreaId || raw.normalAreaId || raw.damagedAreaId || raw.expiredAreaId || null,
  };
}

export function buildDiscrepancyAlerts(items = []) {
  const alerts = [];
  items.forEach((it, idx) => {
    const exp = Number(it.expectedBaseQty) || 0;
    const rec = Number(it.receivedBaseQty) || 0;
    if (exp > 0 && rec < exp) {
      alerts.push({
        lineIndex: idx,
        productId: it.productId,
        batchNo: it.batchNo,
        type: 'QTY_SHORTAGE',
        severity: 'warning',
        expected: exp,
        received: rec,
        message: `Quantity shortage on ${it.batchNo || 'batch'}: expected ${exp}, received ${rec} (-${exp - rec}).`,
      });
    } else if (exp > 0 && rec > exp) {
      alerts.push({
        lineIndex: idx,
        productId: it.productId,
        batchNo: it.batchNo,
        type: 'QTY_EXCESS',
        severity: 'info',
        expected: exp,
        received: rec,
        message: `Quantity excess on ${it.batchNo || 'batch'}: expected ${exp}, received ${rec} (+${rec - exp}).`,
      });
    }
    if (it.mfgMismatch) {
      alerts.push({
        lineIndex: idx,
        productId: it.productId,
        batchNo: it.batchNo,
        type: 'MFG_MISMATCH',
        severity: 'warning',
        expected: it.expectedMfgDate,
        received: it.receivedMfgDate,
        message: `MFG date mismatch on ${it.batchNo || 'batch'}: expected ${String(it.expectedMfgDate).slice(0, 10)}, received ${String(it.receivedMfgDate).slice(0, 10)}.`,
      });
    }
    if (it.expMismatch) {
      alerts.push({
        lineIndex: idx,
        productId: it.productId,
        batchNo: it.batchNo,
        type: 'EXP_MISMATCH',
        severity: 'danger',
        expected: it.expectedExpDate,
        received: it.receivedExpDate,
        message: `EXP date mismatch on ${it.batchNo || 'batch'}: expected ${String(it.expectedExpDate).slice(0, 10)}, received ${String(it.receivedExpDate).slice(0, 10)}.`,
      });
    }
  });
  return alerts;
}

export async function executeSegregatedPurchasePutAway({
  movement,
  item,
  raw,
  product,
  distributorId,
  session,
  resolveRatesFn,
}) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const targetWh = movement.toWarehouseId || movement.fromWarehouseId;
  const meta = getProductUnitMeta(product, raw.unitName || item.unitName, raw.unitVersionId || item.unitVersionId);
  const conv = Math.max(1, Number(raw.conversionQty || item.conversionQty) || meta.conversionQty || 1);
  const totalMoved = Number(item.receivedBaseQty || item.movedBaseQty) || (Number(item.movedPackQty) || 0) * conv;
  const batchNo = (item.batchNo || `B-${Date.now().toString().slice(-5)}`).toUpperCase();
  const { ratePerBase, ratePerPack } = resolveRatesFn(raw, item, product, meta, conv, totalMoved);
  const isBaseUnit = (raw.unitName || item.unitName || '').toLowerCase() === meta.baseUnitName.toLowerCase();
  const batchUnitName = !isBaseUnit && (raw.unitName || item.unitName) ? (raw.unitName || item.unitName) : (conv > 1 ? meta.packUnitName : meta.baseUnitName);

  const buckets = [
    { key: 'NORMAL', qty: Number(item.normalBaseQty) || 0, condition: raw.condition || item.condition || 'FRESH', zoneId: item.normalZoneId || item.toZoneId, areaId: item.normalAreaId || item.toAreaId },
    { key: 'DAMAGED', qty: Number(item.damagedBaseQty) || 0, condition: 'DAMAGE', zoneId: item.damagedZoneId || item.toZoneId, areaId: item.damagedAreaId || item.toAreaId },
    { key: 'EXPIRED', qty: Number(item.expiredBaseQty) || 0, condition: 'EXPIRE', zoneId: item.expiredZoneId || item.toZoneId, areaId: item.expiredAreaId || item.toAreaId },
  ].filter((b) => b.qty > 0);

  if (buckets.length === 0 && totalMoved > 0) {
    buckets.push({ key: 'NORMAL', qty: totalMoved, condition: raw.condition || 'FRESH', zoneId: item.toZoneId, areaId: item.toAreaId });
  }

  const placedBatches = [];
  for (const bucket of buckets) {
    if (!targetWh || !bucket.zoneId || !bucket.areaId) {
      throw new AppError(`Warehouse, Zone, and Area are required for ${bucket.key} put-away.`, 400, 'LOCATION_REQUIRED');
    }
    let batch = await StockBatchM.findOne({
      distributorId,
      batchNo,
      productId: item.productId,
      warehouseId: targetWh,
      areaId: bucket.areaId,
      condition: bucket.condition,
    }).session(session);

    if (!batch) {
      batch = new StockBatchM({
        distributorId,
        batchNo,
        productId: item.productId,
        warehouseId: targetWh,
        zoneId: bucket.zoneId,
        areaId: bucket.areaId,
        purchaseDate: raw.purchaseDate ? new Date(raw.purchaseDate) : (movement.createdAt || new Date()),
        mfgDate: item.receivedMfgDate || item.mfgDate || null,
        expDate: item.receivedExpDate || item.expDate || null,
        unitVersionId: raw.unitVersionId || item.unitVersionId || meta.unitVersionId || 'UV-1',
        unitName: batchUnitName,
        packingSpecification: raw.packingSpecification || meta.packingSpecification || '',
        conversionQty: conv,
        purchaseRatePerBase: ratePerBase,
        purchaseRatePerPack: ratePerPack,
        condition: bucket.condition,
        customConditionLabel: raw.customConditionLabel || item.customConditionLabel || '',
      });
    } else if (ratePerBase > 0 || ratePerPack > 0) {
      Object.assign(batch, { purchaseRatePerBase: ratePerBase, purchaseRatePerPack: ratePerPack });
    }
    batch.currentBaseQty += bucket.qty;
    batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
    batch.status = deriveBatchStatus(batch, batch.conversionQty || conv);
    await batch.save(session ? { session } : undefined);
    placedBatches.push({
      batchId: batch._id,
      batchNo: batch.batchNo,
      bucket: bucket.key,
      condition: batch.condition,
      qtyBase: bucket.qty,
      zoneId: bucket.zoneId,
      areaId: bucket.areaId,
      status: batch.status,
    });
  }
  return { placedBatches, ratePerBase, ratePerPack, conv, batchUnitName, meta };
}

export async function executePurchaseReturn({ movement, item, product, distributorId, actorId, session, depletedProducts }) {
  const StockBatchM = getTenantModel('StockBatch', StockBatch);
  const batch = await StockBatchM.findOne({ _id: item.batchId, distributorId }).session(session);
  if (!batch) throw new AppError('Source batch not found for purchase return.', 404, 'BATCH_NOT_FOUND');
  const meta = getProductUnitMeta(product, item.unitName || batch.unitName, batch.unitVersionId);
  const conv = Number(batch.conversionQty) > 1 ? Number(batch.conversionQty) : meta.conversionQty;
  const movedQty = Number(item.movedBaseQty) || (Number(item.movedPackQty) || 0) * conv;
  if (movedQty <= 0) throw new AppError('Return quantity must be greater than zero.', 400, 'INVALID_RETURN_QTY');
  if (batch.availableBaseQty < movedQty) {
    throw new AppError(`Insufficient available stock in batch ${batch.batchNo} (${batch.availableBaseQty} available).`, 400, 'INSUFFICIENT_STOCK');
  }
  const beforeQty = batch.currentBaseQty;
  batch.currentBaseQty -= movedQty;
  batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
  batch.status = deriveBatchStatus(batch, conv);
  await batch.save(session ? { session } : undefined);
  if (depletedProducts && batch.currentBaseQty === 0 && batch.productId) depletedProducts.add(String(batch.productId));

  item.totalValuePkr = Number((movedQty * (Number(batch.purchaseRatePerBase) || 0)).toFixed(2));
  await recordAuditLog({
    distributorId,
    actorId,
    module: 'PURCHASE_RETURN',
    action: 'RETURN_TO_COMPANY',
    entityModel: 'StockBatch',
    entityId: batch._id,
    beforeState: { currentBaseQty: beforeQty, companyId: movement.supplierCompanyId },
    afterState: { currentBaseQty: batch.currentBaseQty, returnedBaseQty: movedQty, payableReductionPkr: item.totalValuePkr, reason: item.returnReason || movement.notes },
    session,
  });
  await syncProductUnitVersionLifecycle({ distributorId, productId: batch.productId, session });
  return { batch, returnedBaseQty: movedQty, payableReductionPkr: item.totalValuePkr };
}

export function buildPurchaseMovementResult({
  movement,
  primaryItem,
  product,
  company,
  warehouse,
  placedBatches = [],
  discrepancyAlerts = [],
  ratePerBase = 0,
  ratePerPack = 0,
  operatorName = '',
}) {
  const totalWeightKg = Number(((Number(primaryItem?.receivedBaseQty) || 0) * (Number(product?.baseUnit?.weightKg) || 0)).toFixed(3));
  const purchaseValue = Number(((Number(primaryItem?.receivedBaseQty) || 0) * ratePerBase).toFixed(2));
  return {
    movementId: movement._id,
    movementCode: movement.movementCode,
    movementType: movement.movementType,
    receivingStage: 'PURCHASE_MOVEMENT_RESULT',
    companyName: company?.companyName || 'Direct / Unassigned',
    warehouseName: warehouse?.warehouseName || 'Warehouse',
    productCode: product?.skuCode || '',
    productName: product?.productName || '',
    batchNo: primaryItem?.batchNo || '',
    unitName: primaryItem?.unitName || '',
    conversionQty: primaryItem?.conversionQty || 1,
    dispatchQty: primaryItem?.expectedBaseQty || 0,
    receivedQty: primaryItem?.receivedBaseQty || 0,
    differenceQty: (primaryItem?.receivedBaseQty || 0) - (primaryItem?.expectedBaseQty || 0),
    purchaseQty: (primaryItem?.normalBaseQty || 0) + (primaryItem?.damagedBaseQty || 0) + (primaryItem?.expiredBaseQty || 0),
    normalQty: primaryItem?.normalBaseQty || 0,
    damagedQty: primaryItem?.damagedBaseQty || 0,
    expiredQty: primaryItem?.expiredBaseQty || 0,
    totalWeightKg,
    baseValue: ratePerBase,
    packValue: ratePerPack,
    purchaseValue,
    expectedMfgDate: primaryItem?.expectedMfgDate || null,
    receivedMfgDate: primaryItem?.receivedMfgDate || null,
    expectedExpDate: primaryItem?.expectedExpDate || null,
    receivedExpDate: primaryItem?.receivedExpDate || null,
    discrepancyAlerts,
    placedBatches,
    operatorName,
    status: movement.status,
    completedAt: movement.completedAt || new Date(),
  };
}

export function sanitizePurchaseResultForUser(result, user) {
  if (!result || canViewPurchasePrice(user)) return result;
  return { ...result, baseValue: null, packValue: null, purchaseValue: null };
}
