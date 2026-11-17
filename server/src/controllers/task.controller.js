import { PendingTask as _PendingTask, DispatchSheet as _DispatchSheet, StockMovement as _StockMovement, StockBatch as _StockBatch, Product as _Product } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { deriveBatchStatus, getProductUnitMeta, runWithTransaction } from '../services/stockLedger.service.js';
import { recordAuditLog } from '../services/accountingPost.service.js';

const m = () => getTenantModels({ PendingTask: _PendingTask, DispatchSheet: _DispatchSheet, StockMovement: _StockMovement, StockBatch: _StockBatch, Product: _Product });

export const listMyTasks = asyncHandler(async (req, res) => {
  const { PendingTask } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, {
    defaultSortBy: 'dueAt',
    defaultSortOrder: 'asc',
  });

  const extra = {};
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.primaryRole);
  if (!isAdmin || req.query.myOnly === 'true') {
    extra.assignedToId = req.user._id;
  } else if (req.query.assignedToId) {
    extra.assignedToId = req.query.assignedToId;
  }

  for (const key of ['taskType', 'status', 'priority', 'warehouseId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }

  const filter = buildScopedFilter(req, extra, ['taskCode', 'title'], searchRegex);
  const [tasks, totalRecords] = await Promise.all([
    PendingTask.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedToId assignedById', 'fullName profileId primaryRole')
      .populate('warehouseId', 'warehouseCode warehouseName')
      .lean(),
    PendingTask.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: tasks, pagination: buildPaginationMeta(totalRecords) });
});

export const getTaskById = asyncHandler(async (req, res) => {
  const { PendingTask, DispatchSheet, StockMovement } = m();
  const task = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('assignedToId assignedById', 'fullName profileId')
    .populate('warehouseId', 'warehouseCode warehouseName zones')
    .populate('checklistItems.productId', 'skuCode productName baseUnit packingUnits')
    .lean();

  if (!task) throw new AppError('Pending task not found.', 404, 'TASK_NOT_FOUND');

  let referenceDoc = null;
  if (task.referenceModel === 'DispatchSheet' && task.referenceId) {
    referenceDoc = await DispatchSheet.findById(task.referenceId).populate('orderIds salesmanId').lean();
  } else if (task.referenceModel === 'StockMovement' && task.referenceId) {
    referenceDoc = await StockMovement.findById(task.referenceId).populate('items.productId').lean();
  }

  res.status(200).json({ success: true, data: { ...task, referenceDoc } });
});

export const startOrDraftTask = asyncHandler(async (req, res) => {
  const { PendingTask } = m();
  const task = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!task) throw new AppError('Task not found.', 404, 'TASK_NOT_FOUND');

  if (Array.isArray(req.body.checklistItems)) {
    task.checklistItems = req.body.checklistItems;
  }
  task.status = req.body.saveAsDraft ? 'DRAFT' : 'PENDING';
  await task.save();
  res.status(200).json({ success: true, data: task });
});

export const executeDispatchTask = asyncHandler(async (req, res) => {
  const { PendingTask, DispatchSheet } = m();
  const { checklistItems, extraDispatchItems = [], complete = true } = req.body;

  const task = await runWithTransaction(async (session) => {
    const doc = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId }).session(session);
    if (!doc) throw new AppError('Dispatch task not found.', 404, 'TASK_NOT_FOUND');

    if (Array.isArray(checklistItems)) doc.checklistItems = checklistItems;
    doc.status = complete ? 'COMPLETE' : 'DRAFT';
    if (complete) doc.completedAt = new Date();
    await doc.save(session ? { session } : undefined);

    if (doc.referenceModel === 'DispatchSheet' && doc.referenceId) {
      const sheet = await DispatchSheet.findById(doc.referenceId).session(session);
      if (sheet) {
        if (extraDispatchItems.length > 0) {
          sheet.extraDispatchItems.push(...extraDispatchItems);
        }
        if (complete) {
          sheet.status = 'DISPATCHED';
          sheet.dispatchedAt = new Date();
        }
        await sheet.save(session ? { session } : undefined);
      }
    }

    return doc;
  });

  res.status(200).json({ success: true, data: task });
});

export const executePutAwayTask = asyncHandler(async (req, res) => {
  const { PendingTask, Product, StockBatch, StockMovement } = m();
  const { placements = [], complete = true } = req.body;

  const task = await runWithTransaction(async (session) => {
    const doc = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId }).session(session);
    if (!doc) throw new AppError('Put-away task not found.', 404, 'TASK_NOT_FOUND');

    for (const p of placements) {
      const qty = Math.max(0, Number(p.baseQty) || 0);
      if (!qty || !p.warehouseId || !p.zoneId || !p.areaId || !p.productId) continue;

      const product = await Product.findOne({ _id: p.productId, distributorId: req.distributorId }).session(session).lean();
      const meta = getProductUnitMeta(product, p.unitName);
      const batchNo = (p.batchNo || `RET-${Date.now().toString().slice(-5)}`).toUpperCase();

      let batch = await StockBatch.findOne({
        distributorId: req.distributorId,
        batchNo,
        productId: p.productId,
        warehouseId: p.warehouseId,
        areaId: p.areaId,
      }).session(session);

      if (!batch) {
        batch = new StockBatch({
          distributorId: req.distributorId,
          batchNo,
          productId: p.productId,
          warehouseId: p.warehouseId,
          zoneId: p.zoneId,
          areaId: p.areaId,
          mfgDate: p.mfgDate || null,
          expDate: p.expDate || null,
          condition: p.condition || 'NORMAL',
          status: p.condition === 'EXPIRE' || p.condition === 'DAMAGE_EXPIRE' ? 'QUARANTINED' : 'AVAILABLE',
        });
      }

      if (p.sourceBatchId) {
        const src = await StockBatch.findOne({ _id: p.sourceBatchId, distributorId: req.distributorId }).session(session);
        if (src) {
          src.currentBaseQty = Math.max(0, src.currentBaseQty - qty);
          src.status = deriveBatchStatus(src, meta.conversionQty);
          await src.save(session ? { session } : undefined);
        }
      }

      batch.currentBaseQty += qty;
      batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
      if (p.condition) batch.condition = p.condition;
      batch.status =
        batch.condition === 'EXPIRE' || batch.condition === 'DAMAGE_EXPIRE'
          ? 'QUARANTINED'
          : deriveBatchStatus(batch, meta.conversionQty);
      await batch.save(session ? { session } : undefined);
    }

    if (doc.referenceModel === 'StockMovement' && doc.referenceId && complete) {
      await StockMovement.findByIdAndUpdate(
        doc.referenceId,
        { status: 'COMPLETED', completedAt: new Date(), receivedById: req.user._id },
        session ? { session } : {}
      );
    }

    doc.status = complete ? 'COMPLETE' : 'DRAFT';
    if (complete) doc.completedAt = new Date();
    await doc.save(session ? { session } : undefined);
    return doc;
  });

  res.status(200).json({ success: true, data: task });
});

export const executeStockCountTask = asyncHandler(async (req, res) => {
  const { PendingTask, StockBatch } = m();
  const { counts = [], complete = true } = req.body;

  const task = await runWithTransaction(async (session) => {
    const doc = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId }).session(session);
    if (!doc) throw new AppError('Stock count task not found.', 404, 'TASK_NOT_FOUND');

    for (const c of counts) {
      const batch = await StockBatch.findOne({ _id: c.batchId, distributorId: req.distributorId }).session(session);
      if (!batch) continue;
      const prevQty = batch.currentBaseQty;
      const physicalQty = Math.max(0, Number(c.physicalCountBaseQty) || 0);
      batch.currentBaseQty = physicalQty;
      batch.status = deriveBatchStatus(batch);
      await batch.save(session ? { session } : undefined);

      await recordAuditLog({
        distributorId: req.distributorId,
        actorId: req.user._id,
        module: 'PHYSICAL_STOCK_COUNT',
        action: 'RECONCILE_COUNT',
        entityModel: 'StockBatch',
        entityId: batch._id,
        beforeState: { currentBaseQty: prevQty },
        afterState: { currentBaseQty: physicalQty, missingQty: c.missingQty || 0, damagedQty: c.damagedQty || 0 },
        session,
      });
    }

    doc.status = complete ? 'COMPLETE' : 'DRAFT';
    if (complete) doc.completedAt = new Date();
    await doc.save(session ? { session } : undefined);
    return doc;
  });

  res.status(200).json({ success: true, data: task });
});

export const completeTask = asyncHandler(async (req, res) => {
  const { PendingTask } = m();
  const task = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!task) throw new AppError('Task not found.', 404, 'TASK_NOT_FOUND');

  if (Array.isArray(req.body.checklistItems)) task.checklistItems = req.body.checklistItems;
  task.status = 'COMPLETE';
  task.completedAt = new Date();
  await task.save();

  res.status(200).json({ success: true, data: task });
});

export const cancelTask = asyncHandler(async (req, res) => {
  const { PendingTask } = m();
  const task = await PendingTask.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!task) throw new AppError('Task not found.', 404, 'TASK_NOT_FOUND');
  if (!['FRESH', 'DRAFT', 'PENDING'].includes(task.status)) {
    throw new AppError(`Cannot cancel a task that is already ${task.status}.`, 400, 'TASK_INVALID_STATE');
  }

  task.status = 'CANCELLED';
  await task.save();

  await recordAuditLog({
    distributorId: req.distributorId,
    actorId: req.user._id,
    module: 'TASKS',
    action: 'CANCEL_TASK',
    entityModel: 'PendingTask',
    entityId: task._id,
    afterState: { taskCode: task.taskCode, reason: req.body?.reason || '' },
  });

  res.status(200).json({ success: true, data: task });
});

export default {
  listMyTasks,
  getTaskById,
  startOrDraftTask,
  executeDispatchTask,
  executePutAwayTask,
  executeStockCountTask,
  completeTask,
  cancelTask,
};
