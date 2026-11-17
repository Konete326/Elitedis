import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { StockBatch } from '../models/StockBatch.model.js';
import { StockMovement } from '../models/StockMovement.model.js';
import { Customer } from '../models/Customer.model.js';

const DEFAULT_RULES = [
  {
    ruleKey: 'LOW_STOCK_AUTO_PURCHASE',
    ruleName: 'Low Stock Auto-Purchase Requirement',
    triggerEvent: 'LOW_STOCK',
    actionType: 'CREATE_PURCHASE_DRAFT',
    thresholdValue: 0,
    isEnabled: true,
    description: 'Flags low stock batches and creates one idempotent Purchase Requirement draft.',
  },
  {
    ruleKey: 'EXPIRY_WINDOW_WARNING',
    ruleName: 'Batch Expiry Window Alert',
    triggerEvent: 'EXPIRY_WINDOW',
    actionType: 'NOTIFY_WAREHOUSE',
    thresholdValue: 90,
    isEnabled: true,
    description: 'Fires expiry notifications when batch expiry falls within threshold days.',
  },
  {
    ruleKey: 'CUSTOMER_CREDIT_LIMIT',
    ruleName: 'Customer Credit Limit Overdue Alert',
    triggerEvent: 'CREDIT_EXCEEDED',
    actionType: 'NOTIFY_ADMIN',
    thresholdValue: 100,
    isEnabled: true,
    description: 'Notifies admin when customer balance exceeds credit limit.',
  },
  {
    ruleKey: 'BOUNCED_CHEQUE_ALERT',
    ruleName: 'Bounced Cheque Critical Alert',
    triggerEvent: 'CHEQUE_BOUNCED',
    actionType: 'NOTIFY_ACCOUNTS',
    thresholdValue: 0,
    isEnabled: true,
    description: 'Alerts accounts and restores customer balance when a cheque bounces.',
  },
];

function getAutomationCol() {
  if (!mongoose.connection?.db) throw new Error('Database is not connected.');
  return mongoose.connection.db.collection('automation_rules');
}

export async function listAutomationRules(distributorId) {
  const col = getAutomationCol();
  const count = await col.countDocuments({ distributorId });
  if (count === 0) {
    const now = new Date();
    for (const def of DEFAULT_RULES) {
      await col.updateOne(
        { distributorId, ruleKey: def.ruleKey },
        { $setOnInsert: { ...def, distributorId, createdAt: now, updatedAt: now } },
        { upsert: true }
      );
    }
  }
  return col.find({ distributorId }).sort({ createdAt: 1 }).toArray();
}

export async function upsertAutomationRule(distributorId, payload = {}, ruleId = null) {
  const col = getAutomationCol();
  const now = new Date();
  if (ruleId) {
    const oid = new mongoose.Types.ObjectId(ruleId);
    const { _id: _ign, distributorId: _d, ...updates } = payload;
    await col.updateOne({ _id: oid, distributorId }, { $set: { ...updates, updatedAt: now } });
    return col.findOne({ _id: oid, distributorId });
  }
  const doc = {
    distributorId,
    ruleKey: (payload.ruleKey || `AUTO_${Date.now().toString().slice(-5)}`).toUpperCase(),
    ruleName: payload.ruleName || 'Custom Automation Rule',
    triggerEvent: payload.triggerEvent || 'LOW_STOCK',
    actionType: payload.actionType || 'NOTIFY_ADMIN',
    thresholdValue: Number(payload.thresholdValue) || 0,
    isEnabled: payload.isEnabled !== false,
    description: payload.description || '',
    createdAt: now,
    updatedAt: now,
  };
  const res = await col.insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function toggleAutomationRule(distributorId, ruleId) {
  const col = getAutomationCol();
  const oid = new mongoose.Types.ObjectId(ruleId);
  const existing = await col.findOne({ _id: oid, distributorId });
  if (!existing) return null;
  await col.updateOne({ _id: oid, distributorId }, { $set: { isEnabled: !existing.isEnabled, updatedAt: new Date() } });
  return col.findOne({ _id: oid, distributorId });
}

export async function deleteAutomationRule(distributorId, ruleId) {
  const col = getAutomationCol();
  const oid = new mongoose.Types.ObjectId(ruleId);
  const res = await col.deleteOne({ _id: oid, distributorId });
  return res.deletedCount > 0;
}

/**
 * Creates a Notification idempotently so duplicate triggers never spam users.
 */
export async function createNotificationIfAbsent({
  distributorId,
  idempotencyKey = '',
  recipientUserId = null,
  recipientRole = 'ADMIN',
  alertCategory,
  severity = 'INFO',
  title,
  message,
  referenceModel = '',
  referenceId = null,
  session = null,
}) {
  if (idempotencyKey) {
    const exists = await Notification.exists({ distributorId, idempotencyKey }).session(session);
    if (exists) return null;
  }

  const [created] = await Notification.create(
    [
      {
        distributorId,
        idempotencyKey,
        recipientUserId,
        recipientRole,
        alertCategory,
        severity,
        title,
        message,
        referenceModel,
        referenceId,
      },
    ],
    session ? { session } : {}
  );
  return created;
}

/**
 * Evaluates Low Stock, Expiry Windows, and idempotently drafts Auto-Purchase Requirements.
 */
export async function evaluateLowStockAndExpiryAlerts({
  distributorId,
  warehouseId = null,
  actorId = null,
  createAutoPurchaseDraft = true,
  session = null,
}) {
  const now = new Date();
  let autoPurchaseEnabled = createAutoPurchaseDraft;
  if (mongoose.connection?.db) {
    const rules = await listAutomationRules(distributorId);
    const prRule = rules.find((r) => r.ruleKey === 'LOW_STOCK_AUTO_PURCHASE');
    if (prRule && prRule.isEnabled === false) autoPurchaseEnabled = false;
  }

  const batchFilter = { distributorId };
  if (warehouseId) batchFilter.warehouseId = warehouseId;

  const batches = await StockBatch.find(batchFilter)
    .populate('productId', 'skuCode productName companyId baseUnit packingUnits')
    .session(session)
    .lean();

  const generatedAlerts = [];
  const purchaseDraftItems = [];

  for (const batch of batches) {
    const product = batch.productId;
    if (!product) continue;

    const minPack = Number(batch.thresholds?.minStockPack) || 0;
    const maxPack = Number(batch.thresholds?.maxStockPack) || minPack * 2 || 20;
    const packConv = Math.max(1, Number(product.packingUnits?.[0]?.conversionQty) || 1);
    const minBase = minPack * packConv;

    const isLowOrOut =
      batch.status === 'OUT' ||
      batch.status === 'LOW_WARNING' ||
      (minBase > 0 && batch.availableBaseQty <= minBase);

    if (isLowOrOut && batch.condition === 'NORMAL') {
      const alertKey = `LOW_STOCK:${batch._id}:${batch.status}`;
      const alert = await createNotificationIfAbsent({
        distributorId,
        idempotencyKey: alertKey,
        recipientRole: 'WAREHOUSE_MANAGER',
        alertCategory: 'LOW_STOCK',
        severity: batch.currentBaseQty <= 0 ? 'CRITICAL' : 'WARNING',
        title: `Low Stock: ${product.productName}`,
        message: `${product.skuCode} (${batch.batchNo}) has ${batch.availableBaseQty} base units available.`,
        referenceModel: 'StockBatch',
        referenceId: batch._id,
        session,
      });
      if (alert) generatedAlerts.push(alert);

      const shortfallBase = Math.max(packConv, maxPack * packConv - batch.availableBaseQty);
      purchaseDraftItems.push({
        productId: product._id,
        supplierCompanyId: product.companyId || null,
        warehouseId: batch.warehouseId,
        zoneId: batch.zoneId,
        areaId: batch.areaId,
        movedBaseQty: shortfallBase,
        movedPackQty: Math.ceil(shortfallBase / packConv),
        unitName: product.packingUnits?.[0]?.unitName || product.baseUnit?.unitName || 'Piece',
      });
    }

    if (batch.expDate && batch.currentBaseQty > 0) {
      const alertDays = Number(batch.thresholds?.expiryAlertDays) || 90;
      const windowCutoff = new Date(now.getTime() + alertDays * 86400000);
      if (new Date(batch.expDate) <= windowCutoff) {
        const isExpired = new Date(batch.expDate) <= now;
        const expKey = `EXPIRY:${batch._id}:${isExpired ? 'EXPIRED' : 'NEAR'}`;
        const expAlert = await createNotificationIfAbsent({
          distributorId,
          idempotencyKey: expKey,
          recipientRole: 'WAREHOUSE_MANAGER',
          alertCategory: 'EXPIRY_WARNING',
          severity: isExpired ? 'CRITICAL' : 'WARNING',
          title: `${isExpired ? 'Expired' : 'Near Expiry'} Batch: ${batch.batchNo}`,
          message: `${product.productName} expires on ${new Date(batch.expDate).toISOString().slice(0, 10)}.`,
          referenceModel: 'StockBatch',
          referenceId: batch._id,
          session,
        });
        if (expAlert) generatedAlerts.push(expAlert);
      }
    }
  }

  let draftedPurchase = null;
  if (autoPurchaseEnabled && purchaseDraftItems.length > 0) {
    const activePurchaseMovements = await StockMovement.find({
      distributorId,
      movementType: 'PURCHASE',
      status: { $in: ['DRAFT', 'PENDING', 'APPROVED'] },
    })
      .select('items.productId')
      .session(session)
      .lean();

    const alreadyQueuedProducts = new Set(
      activePurchaseMovements.flatMap((m) => (m.items || []).map((i) => String(i.productId)))
    );

    const seenNew = new Set();
    const newItems = purchaseDraftItems.filter((item) => {
      const pid = String(item.productId);
      if (alreadyQueuedProducts.has(pid) || seenNew.has(pid)) return false;
      seenNew.add(pid);
      return true;
    });

    if (newItems.length > 0) {
      const [draft] = await StockMovement.create(
        [
          {
            distributorId,
            movementCode: `APR-${Date.now().toString().slice(-6)}`,
            movementType: 'PURCHASE',
            taskName: 'Auto-Generated Purchase Requirement',
            toWarehouseId: newItems[0].warehouseId,
            supplierCompanyId: newItems[0].supplierCompanyId,
            preparedById: actorId,
            items: newItems.map((i) => ({
              productId: i.productId,
              toZoneId: i.zoneId,
              toAreaId: i.areaId,
              unitName: i.unitName,
              movedPackQty: i.movedPackQty,
              movedBaseQty: i.movedBaseQty,
            })),
            status: 'DRAFT',
            notes: 'Generated automatically from Low Stock threshold alert.',
          },
        ],
        session ? { session } : {}
      );
      draftedPurchase = draft;

      await createNotificationIfAbsent({
        distributorId,
        idempotencyKey: `AUTO_PURCHASE:${draft._id}`,
        recipientRole: 'ADMIN',
        alertCategory: 'AUTO_PURCHASE_DRAFT',
        severity: 'INFO',
        title: `Auto Purchase Draft Ready (${draft.movementCode})`,
        message: `${newItems.length} low-stock SKU(s) queued in Purchase Requirement draft.`,
        referenceModel: 'StockMovement',
        referenceId: draft._id,
        session,
      });
    }
  }

  return { generatedAlertsCount: generatedAlerts.length, draftedPurchase };
}

/**
 * Evaluates customer credit limit exceedance and emits an overdue/credit alert.
 */
export async function checkCustomerCreditAlert({ distributorId, customerId, session = null }) {
  if (!customerId) return null;
  const customer = await Customer.findOne({ _id: customerId, distributorId }).session(session).lean();
  if (!customer) return null;

  const limit = Number(customer.financialTerms?.creditLimitPkr) || 0;
  const outstanding = Number(customer.financialTerms?.outstandingBalancePkr) || 0;
  if (limit > 0 && outstanding > limit) {
    return createNotificationIfAbsent({
      distributorId,
      idempotencyKey: `CUST_OVERDUE:${customer._id}:${Math.floor(outstanding)}`,
      recipientRole: 'ADMIN',
      alertCategory: 'CUSTOMER_OVERDUE',
      severity: 'WARNING',
      title: `Credit Limit Exceeded: ${customer.shopName}`,
      message: `Outstanding PKR ${outstanding.toLocaleString()} exceeds limit PKR ${limit.toLocaleString()}.`,
      referenceModel: 'Customer',
      referenceId: customer._id,
      session,
    });
  }
  return null;
}

export default {
  listAutomationRules,
  upsertAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  createNotificationIfAbsent,
  evaluateLowStockAndExpiryAlerts,
  checkCustomerCreditAlert,
};
