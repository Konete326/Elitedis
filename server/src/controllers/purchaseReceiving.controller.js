import {
  Company as _Company,
  Product as _Product,
  StockBatch as _StockBatch,
  StockMovement as _StockMovement,
  Warehouse as _Warehouse,
} from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { canViewPurchasePrice } from '../middlewares/rbacMiddleware.js';
import { runWithTransaction } from '../services/stockLedger.service.js';
import { evaluateLowStockAndExpiryAlerts } from '../services/automationAlert.service.js';
import {
  buildDiscrepancyAlerts,
  buildPurchaseMovementResult,
  executePurchaseReturn,
  executeSegregatedPurchasePutAway,
  normalizePurchaseItem,
  sanitizePurchaseResultForUser,
} from '../services/purchaseReceiving.service.js';

const m = () =>
  getTenantModels({
    Company: _Company,
    Product: _Product,
    StockBatch: _StockBatch,
    StockMovement: _StockMovement,
    Warehouse: _Warehouse,
  });

function resolveRatesInline(raw, item, product, meta, conv, movedQty) {
  let ratePerPack = Number(raw.purchaseRatePerPack ?? item.purchaseRatePerPack) || 0;
  let ratePerBase = Number(raw.purchaseRatePerBase ?? item.purchaseRatePerBase) || 0;
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

export const createPurchaseReceiving = asyncHandler(async (req, res) => {
  const { Company, Product, StockMovement, Warehouse } = m();
  const distributorId = req.distributorId;
  const actorId = req.user._id;
  const { idempotencyKey, toWarehouseId, supplierCompanyId, taskName, notes, items = [] } = req.body;

  if (idempotencyKey) {
    const existing = await StockMovement.findOne({ distributorId, idempotencyKey }).lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        idempotentReplay: true,
        data: {
          movement: existing,
          discrepancyAlerts: existing.discrepancyAlerts || [],
          purchaseResult: sanitizePurchaseResultForUser(existing.purchaseResult, req.user),
        },
      });
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one purchase receiving line is required.', 400, 'ITEMS_REQUIRED');
  }

  const normalizedItems = items.map((it) => normalizePurchaseItem(it));
  const discrepancyAlerts = buildDiscrepancyAlerts(normalizedItems);
  const movementCode = req.body.movementCode || `PR-${Date.now().toString().slice(-6)}`;

  const payload = await runWithTransaction(async (session) => {
    const [created] = await StockMovement.create(
      [{
        distributorId,
        movementCode,
        idempotencyKey: idempotencyKey || null,
        movementType: 'PURCHASE',
        receivingStage: 'PURCHASE_MOVEMENT_RESULT',
        taskName: taskName || `Purchase Receiving (${movementCode})`,
        toWarehouseId: toWarehouseId || null,
        supplierCompanyId: supplierCompanyId || null,
        preparedById: actorId,
        receivedById: actorId,
        items: normalizedItems,
        discrepancyAlerts,
        notes: notes || '',
        status: 'COMPLETED',
        completedAt: new Date(),
      }],
      session ? { session } : {}
    );

    const placedBatches = [];
    let firstProduct = null;
    let firstRateBase = 0;
    let firstRatePack = 0;

    for (let i = 0; i < created.items.length; i++) {
      const item = created.items[i];
      const raw = items[i] || {};
      const product = await Product.findOne({ _id: item.productId, distributorId }).session(session).lean();
      if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
      if (!firstProduct) firstProduct = product;
      const putAway = await executeSegregatedPurchasePutAway({
        movement: created,
        item,
        raw,
        product,
        distributorId,
        session,
        resolveRatesFn: resolveRatesInline,
      });
      if (i === 0) {
        firstRateBase = putAway.ratePerBase;
        firstRatePack = putAway.ratePerPack;
      }
      placedBatches.push(...putAway.placedBatches);
    }

    const [company, warehouse] = await Promise.all([
      supplierCompanyId ? Company.findOne({ _id: supplierCompanyId, distributorId }).lean() : null,
      toWarehouseId ? Warehouse.findOne({ _id: toWarehouseId, distributorId }).lean() : null,
    ]);

    const fullResult = buildPurchaseMovementResult({
      movement: created,
      primaryItem: created.items[0],
      product: firstProduct,
      company,
      warehouse,
      placedBatches,
      discrepancyAlerts,
      ratePerBase: firstRateBase,
      ratePerPack: firstRatePack,
      operatorName: req.user?.fullName || req.user?.email || 'Operator',
    });

    created.purchaseResult = fullResult;
    await created.save(session ? { session } : undefined);
    return { movement: created.toObject(), placedBatches, discrepancyAlerts, purchaseResult: fullResult };
  });

  await evaluateLowStockAndExpiryAlerts({ distributorId, actorId });
  res.status(201).json({
    success: true,
    data: {
      ...payload,
      purchaseResult: sanitizePurchaseResultForUser(payload.purchaseResult, req.user),
    },
  });
});

export const createPurchaseReturn = asyncHandler(async (req, res) => {
  const { Product, StockMovement } = m();
  const distributorId = req.distributorId;
  const actorId = req.user._id;
  const { idempotencyKey, batchId, productId, supplierCompanyId, returnQtyBase, returnReason, sourceMovementId } = req.body;

  if (idempotencyKey) {
    const existing = await StockMovement.findOne({ distributorId, idempotencyKey }).lean();
    if (existing) return res.status(200).json({ success: true, idempotentReplay: true, data: existing });
  }

  const qty = Number(returnQtyBase) || 0;
  if (!batchId || qty <= 0) {
    throw new AppError('Source batch and positive return quantity are required.', 400, 'INVALID_RETURN_PAYLOAD');
  }

  const movementCode = req.body.movementCode || `PRN-${Date.now().toString().slice(-6)}`;
  const result = await runWithTransaction(async (session) => {
    const product = productId ? await Product.findOne({ _id: productId, distributorId }).session(session).lean() : null;
    const depletedProducts = new Set();
    const [created] = await StockMovement.create(
      [{
        distributorId,
        movementCode,
        idempotencyKey: idempotencyKey || null,
        movementType: 'PURCHASE_RETURN',
        taskName: `Purchase Return (${movementCode})`,
        supplierCompanyId: supplierCompanyId || product?.companyId || null,
        preparedById: actorId,
        notes: returnReason || 'Purchase Return to Principal Company',
        items: [{
          productId: productId || req.body.productId,
          batchId,
          movedBaseQty: qty,
          sourceMovementId: sourceMovementId || null,
          returnReason: returnReason || '',
          lineDecision: 'ACCEPT',
        }],
        status: 'COMPLETED',
        completedAt: new Date(),
      }],
      session ? { session } : {}
    );

    const ret = await executePurchaseReturn({
      movement: created,
      item: created.items[0],
      product,
      distributorId,
      actorId,
      session,
      depletedProducts,
    });
    await created.save(session ? { session } : undefined);
    return { movement: created.toObject(), returnSummary: ret };
  });

  await evaluateLowStockAndExpiryAlerts({ distributorId, actorId });
  const safeData = canViewPurchasePrice(req.user)
    ? result
    : { ...result, returnSummary: { ...result.returnSummary, payableReductionPkr: null } };
  res.status(201).json({ success: true, data: safeData });
});

export const getPurchaseReceivingResult = asyncHandler(async (req, res) => {
  const { StockMovement } = m();
  const movement = await StockMovement.findOne({ _id: req.params.id, distributorId: req.distributorId }).lean();
  if (!movement) throw new AppError('Purchase movement not found.', 404, 'MOVEMENT_NOT_FOUND');
  res.status(200).json({
    success: true,
    data: {
      movementId: movement._id,
      movementCode: movement.movementCode,
      discrepancyAlerts: movement.discrepancyAlerts || [],
      purchaseResult: sanitizePurchaseResultForUser(movement.purchaseResult, req.user),
    },
  });
});

export default { createPurchaseReceiving, createPurchaseReturn, getPurchaseReceivingResult };
