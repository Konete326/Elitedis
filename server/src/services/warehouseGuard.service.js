import { StockBatch, PendingTask, Warehouse, User } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError } from '../middlewares/errorMiddleware.js';

const ZERO_STOCK_STEPS = [
  '1. Transfer or adjust remaining stock batches to 0',
  '2. Resolve or close open Pending Tasks for this storage location',
  '3. Confirm zero balance across all batches',
  '4. Retry deletion',
];

/**
 * 4-Step Zero-Stock & PendingTask Deletion Guard (PRD §7.9, AC-05):
 * Blocks deleting a Warehouse, Zone, or Storage Area if any StockBatch holds currentBaseQty > 0
 * or if any open PendingTask references the target storage location.
 */
export async function assertZeroStockBeforeDelete({
  distributorId,
  warehouseId,
  zoneId = null,
  areaId = null,
  entityLabel = 'storage location',
}) {
  const { StockBatch: StockBatchM, PendingTask: PendingTaskM } = getTenantModels({
    StockBatch,
    PendingTask,
  });

  const batchQuery = { distributorId, warehouseId, currentBaseQty: { $gt: 0 } };
  if (zoneId) batchQuery.zoneId = zoneId;
  if (areaId) batchQuery.areaId = areaId;

  const stockedBatches = await StockBatchM.find(batchQuery)
    .select('batchNo productId currentBaseQty')
    .lean();
  const batchCount = stockedBatches.length;
  const remainingBaseQty = stockedBatches.reduce((sum, b) => sum + (Number(b.currentBaseQty) || 0), 0);

  const taskQuery = { distributorId, status: { $in: ['FRESH', 'DRAFT', 'PENDING'] } };
  if (areaId) {
    taskQuery.$or = [{ areaId }, { 'metadata.areaId': areaId }, { 'checklistItems.areaId': areaId }];
  } else if (zoneId) {
    taskQuery.$or = [{ zoneId }, { 'metadata.zoneId': zoneId }, { 'checklistItems.zoneId': zoneId }];
  } else if (warehouseId) {
    taskQuery.$or = [{ warehouseId }, { 'metadata.warehouseId': warehouseId }];
  }
  const openTaskCount = await PendingTaskM.countDocuments(taskQuery);

  if (remainingBaseQty > 0 || openTaskCount > 0) {
    throw new AppError(
      `Cannot delete ${entityLabel}: ${remainingBaseQty} base units across ${batchCount} batch(es) and ${openTaskCount} open task(s) must be cleared first.`,
      400,
      'ZERO_STOCK_GUARD_BLOCKED',
      {
        batchCount,
        remainingBaseQty,
        openTaskCount,
        sampleBatches: stockedBatches.slice(0, 10).map((b) => ({
          batchNo: b.batchNo,
          currentBaseQty: b.currentBaseQty,
        })),
        steps: ZERO_STOCK_STEPS,
      }
    );
  }
}

/**
 * Computes all 8 Warehouse Dashboard KPIs (PRD §7.2) with strict purchase price RBAC masking.
 */
export async function computeWarehouseDashboardMetrics(distributorId, canSeePurchasePrice = false) {
  const { Warehouse: WarehouseM, StockBatch: StockBatchM } = getTenantModels({
    Warehouse,
    StockBatch,
  });

  const [warehouses, batches, assignedStaffCount] = await Promise.all([
    WarehouseM.find({ distributorId }).select('zones utilizationPct status').lean(),
    StockBatchM.find({ distributorId })
      .select(
        'areaId currentBaseQty reservedBaseQty availableBaseQty conversionQty purchaseRatePerBase purchaseRatePerPack totalStockValuePkr status thresholds'
      )
      .lean(),
    User.countDocuments({
      distributorId,
      status: 'ACTIVE',
      $or: [
        { primaryRole: { $in: ['WAREHOUSE_MANAGER', 'STOREKEEPER'] } },
        { 'workParts.warehouseManager': true },
        { linkedWarehouseId: { $ne: null } },
      ],
    }),
  ]);

  let zonesCount = 0;
  let storageAreasCount = 0;
  let configuredMaxUnits = 0;
  for (const wh of warehouses) {
    const zones = Array.isArray(wh.zones) ? wh.zones : [];
    zonesCount += zones.length;
    for (const z of zones) {
      const areas = Array.isArray(z.areas) ? z.areas : [];
      storageAreasCount += areas.length;
      for (const a of areas) {
        for (const ap of a.allowedProducts || []) {
          configuredMaxUnits += Math.max(0, Number(ap.maxQtyPacking) || 0);
        }
      }
    }
  }

  let availableStockBaseQty = 0;
  let totalBatches = 0;
  let totalStockValue = 0;
  let lowStockAlertsCount = 0;
  let totalPackEquivalent = 0;
  const occupiedAreaIds = new Set();
  const excludedStatuses = new Set(['BLOCKED', 'QUARANTINED', 'OUT']);
  const lowStatuses = new Set(['LOW', 'WARNING', 'LOW_WARNING', 'OUT']);

  for (const b of batches) {
    const current = Math.max(0, Number(b.currentBaseQty) || 0);
    const reserved = Math.max(0, Number(b.reservedBaseQty) || 0);
    const avail = Math.max(0, current - reserved);
    const conv = Math.max(1, Number(b.conversionQty) || 1);

    if (current > 0) {
      totalBatches += 1;
      totalPackEquivalent += current / conv;
      if (b.areaId) occupiedAreaIds.add(String(b.areaId));
    }

    if (!excludedStatuses.has(b.status) && current > 0) {
      availableStockBaseQty += avail;
    }

    const minThreshold = (Number(b.thresholds?.minStockPack) || 0) * conv;
    if (lowStatuses.has(b.status) || (minThreshold > 0 && current <= minThreshold)) {
      lowStockAlertsCount += 1;
    }

    if (canSeePurchasePrice && current > 0) {
      const ratePerBase =
        Number(b.purchaseRatePerBase) > 0
          ? Number(b.purchaseRatePerBase)
          : Number(b.purchaseRatePerPack) > 0
            ? Number(b.purchaseRatePerPack) / conv
            : 0;
      totalStockValue += ratePerBase > 0 ? current * ratePerBase : Number(b.totalStockValuePkr) || 0;
    }
  }

  let storageUtilizationPct = 0;
  if (storageAreasCount > 0) {
    const rawPct =
      configuredMaxUnits > 0
        ? (totalPackEquivalent / configuredMaxUnits) * 100
        : (occupiedAreaIds.size / storageAreasCount) * 100;
    storageUtilizationPct = Math.min(100, Math.max(0, Math.round(rawPct)));
  }

  return {
    availableStockBaseQty,
    totalBatches,
    stockValuePkr: canSeePurchasePrice ? Number(totalStockValue.toFixed(2)) : null,
    assignedStaffCount,
    lowStockAlertsCount,
    storageUtilizationPct,
    warehousesAndZonesCount: {
      warehouses: warehouses.length,
      zones: zonesCount,
      total: warehouses.length + zonesCount,
    },
    storageAreasCount,
  };
}

export default { assertZeroStockBeforeDelete, computeWarehouseDashboardMetrics };
