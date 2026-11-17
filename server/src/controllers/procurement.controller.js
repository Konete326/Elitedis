import { StockMovement, StockBatch, AccountLedger, Product, PendingTask } from '../models/index.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { deriveBatchStatus, getProductUnitMeta, runWithTransaction } from '../services/stockLedger.service.js';
import { postDoubleEntry } from '../services/accountingPost.service.js';

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = { movementType: 'PURCHASE' };
  if (req.query.status) extra.status = req.query.status;
  if (req.query.supplierCompanyId) extra.supplierCompanyId = req.query.supplierCompanyId;
  if (req.query.toWarehouseId) extra.toWarehouseId = req.query.toWarehouseId;

  const filter = buildScopedFilter(req, extra, ['movementCode', 'taskName', 'notes'], searchRegex);
  const [orders, totalRecords] = await Promise.all([
    StockMovement.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('supplierCompanyId', 'companyCode companyName shortName')
      .populate('toWarehouseId', 'warehouseCode warehouseName')
      .populate('preparedById receivedById', 'fullName profileId')
      .populate('items.productId', 'skuCode productName baseUnit packingUnits')
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: orders, pagination: buildPaginationMeta(totalRecords) });
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplierCompanyId, toWarehouseId, items = [], status = 'PENDING', taskName, notes } = req.body;
  if (!toWarehouseId || !Array.isArray(items) || items.length === 0) {
    throw new AppError('toWarehouseId and at least one product item are required.', 400, 'INVALID_PURCHASE_ORDER');
  }

  const enrichedItems = [];
  for (const raw of items) {
    const product = await Product.findOne({ _id: raw.productId, distributorId: req.distributorId }).lean();
    if (!product) throw new AppError('Product not found in purchase item.', 404, 'PRODUCT_NOT_FOUND');
    const meta = getProductUnitMeta(product, raw.unitName);
    const movedPackQty = Number(raw.movedPackQty) || 0;
    const movedBaseQty = Number(raw.movedBaseQty) || movedPackQty * meta.conversionQty;
    const baseRate = Number(raw.unitCostPkr ?? product.baseUnit?.traderPurchaseRate) || 0;
    enrichedItems.push({
      ...raw,
      unitName: raw.unitName || meta.unitName,
      movedPackQty: movedPackQty || Math.ceil(movedBaseQty / meta.conversionQty),
      movedBaseQty,
      totalWeightKg: Number((movedBaseQty * meta.baseWeightKg).toFixed(3)),
      totalValuePkr: Number(raw.totalValuePkr ?? (movedBaseQty * baseRate).toFixed(2)),
    });
  }

  const prefix = status === 'DRAFT' ? 'PR' : 'PO';
  const created = await StockMovement.create({
    distributorId: req.distributorId,
    movementCode: req.body.movementCode || `${prefix}-${Date.now().toString().slice(-6)}`,
    movementType: 'PURCHASE',
    taskName: taskName || (status === 'DRAFT' ? 'Purchase Request' : 'Supplier Purchase Order'),
    supplierCompanyId: supplierCompanyId || null,
    toWarehouseId,
    preparedById: req.user._id,
    assignedToId: req.body.assignedToId || null,
    items: enrichedItems,
    notes: notes || '',
    status: ['DRAFT', 'PENDING', 'APPROVED'].includes(status) ? status : 'PENDING',
  });

  res.status(201).json({ success: true, data: created });
});

export const convertRequestToOrder = asyncHandler(async (req, res) => {
  const po = await StockMovement.findOne({
    _id: req.params.id,
    distributorId: req.distributorId,
    movementType: 'PURCHASE',
  });
  if (!po) throw new AppError('Purchase request not found.', 404, 'PO_NOT_FOUND');
  if (po.status === 'COMPLETED') throw new AppError('Purchase order is already received.', 400, 'ALREADY_RECEIVED');

  if (req.body.supplierCompanyId) po.supplierCompanyId = req.body.supplierCompanyId;
  if (req.body.toWarehouseId) po.toWarehouseId = req.body.toWarehouseId;
  if (Array.isArray(req.body.items) && req.body.items.length > 0) po.items = req.body.items;
  po.status = 'APPROVED';
  po.taskName = req.body.taskName || 'Approved Supplier Purchase Order';
  await po.save();

  res.status(200).json({ success: true, data: po });
});

export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const received = await runWithTransaction(async (session) => {
    const po = await StockMovement.findOne({
      _id: req.params.id,
      distributorId: req.distributorId,
      movementType: 'PURCHASE',
    }).session(session);
    if (!po) throw new AppError('Purchase order not found.', 404, 'PO_NOT_FOUND');
    if (po.status === 'COMPLETED') throw new AppError('Purchase order already received.', 400, 'ALREADY_RECEIVED');

    const { zoneId: fallbackZoneId, areaId: fallbackAreaId } = req.body || {};
    let totalPurchasePkr = 0;

    for (const item of po.items || []) {
      const targetZoneId = item.toZoneId || fallbackZoneId;
      const targetAreaId = item.toAreaId || fallbackAreaId;
      if (!po.toWarehouseId || !targetZoneId || !targetAreaId) {
        throw new AppError('Warehouse, Zone, and Area are required to receive goods.', 400, 'LOCATION_REQUIRED');
      }
      item.toZoneId = targetZoneId;
      item.toAreaId = targetAreaId;

      const product = await Product.findOne({ _id: item.productId, distributorId: req.distributorId })
        .session(session)
        .lean();
      const meta = getProductUnitMeta(product, item.unitName);
      const qty = Number(item.movedBaseQty) || 0;
      const batchNo = (item.batchNo || `B-${po.movementCode}-${Date.now().toString().slice(-3)}`).toUpperCase();
      item.batchNo = batchNo;

      let batch = await StockBatch.findOne({
        distributorId: req.distributorId,
        batchNo,
        productId: item.productId,
        warehouseId: po.toWarehouseId,
        areaId: targetAreaId,
      }).session(session);

      const ratePerBase = qty > 0 && item.totalValuePkr > 0
        ? Number((item.totalValuePkr / qty).toFixed(2))
        : Number(product?.baseUnit?.traderPurchaseRate || 0);

      if (!batch) {
        batch = new StockBatch({
          distributorId: req.distributorId,
          batchNo,
          productId: item.productId,
          warehouseId: po.toWarehouseId,
          zoneId: targetZoneId,
          areaId: targetAreaId,
          mfgDate: item.mfgDate || null,
          expDate: item.expDate || null,
          purchaseRatePerBase: ratePerBase,
          currentBaseQty: 0,
          reservedBaseQty: 0,
        });
      }
      batch.currentBaseQty += qty;
      batch.purchaseRatePerBase = ratePerBase;
      batch.totalWeightKg = Number((batch.currentBaseQty * meta.baseWeightKg).toFixed(3));
      batch.status = deriveBatchStatus(batch, meta.conversionQty);
      await batch.save(session ? { session } : undefined);

      totalPurchasePkr += item.totalValuePkr > 0 ? item.totalValuePkr : qty * ratePerBase;
    }

    po.status = 'COMPLETED';
    po.receivedById = req.user._id;
    po.completedAt = new Date();
    await po.save(session ? { session } : undefined);

    if (po.linkedTaskId) {
      await PendingTask.findByIdAndUpdate(
        po.linkedTaskId,
        { status: 'COMPLETE', completedAt: new Date() },
        session ? { session } : {}
      );
    }

    if (totalPurchasePkr > 0) {
      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: `PUR-${po.movementCode}`,
        voucherType: 'PURCHASE',
        entries: [
          { accountCode: '1200', accountName: 'Inventory Stock', accountCategory: 'ASSET', debitPkr: totalPurchasePkr, creditPkr: 0, narration: `Goods received ${po.movementCode}` },
          { accountCode: '2010', accountName: 'Accounts Payable (Suppliers)', accountCategory: 'LIABILITY', partyType: 'SUPPLIER', partyId: po.supplierCompanyId || null, debitPkr: 0, creditPkr: totalPurchasePkr, narration: `Supplier payable ${po.movementCode}` },
        ],
        referenceModel: 'StockMovement',
        referenceId: po._id,
        preparedById: po.preparedById || req.user._id,
        approvedById: req.user._id,
        session,
      });
    }

    return po;
  });

  res.status(200).json({ success: true, data: received });
});

export const listSupplierPayments = asyncHandler(async (req, res) => {
  const { skip, limit, sort, buildPaginationMeta } = buildPaginationQuery(req, { defaultSortBy: 'transactionDate' });
  const extra = { voucherType: 'PAYMENT', partyType: 'SUPPLIER', accountCode: '2010' };
  if (req.query.supplierCompanyId) extra.partyId = req.query.supplierCompanyId;
  const filter = buildScopedFilter(req, extra);

  const [payments, totalRecords] = await Promise.all([
    AccountLedger.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AccountLedger.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: payments, pagination: buildPaginationMeta(totalRecords) });
});

export const recordSupplierPayment = asyncHandler(async (req, res) => {
  const { supplierCompanyId, amountPkr, paymentMode = 'CASH', narration = '' } = req.body;
  const amount = Number(amountPkr) || 0;
  if (!supplierCompanyId || amount <= 0) {
    throw new AppError('supplierCompanyId and positive amountPkr are required.', 400, 'INVALID_SUPPLIER_PAYMENT');
  }

  const creditAcc = paymentMode === 'CASH'
    ? { accountCode: '1010', accountName: 'Cash in Hand' }
    : { accountCode: '1020', accountName: 'Bank & Mobile Wallets' };

  const posted = await runWithTransaction((session) =>
    postDoubleEntry({
      distributorId: req.distributorId,
      voucherNo: `SPAY-${Date.now().toString().slice(-6)}`,
      voucherType: 'PAYMENT',
      entries: [
        { accountCode: '2010', accountName: 'Accounts Payable (Suppliers)', accountCategory: 'LIABILITY', partyType: 'SUPPLIER', partyId: supplierCompanyId, debitPkr: amount, creditPkr: 0, narration: narration || 'Supplier payment' },
        { ...creditAcc, accountCategory: 'ASSET', partyType: 'SUPPLIER', partyId: supplierCompanyId, debitPkr: 0, creditPkr: amount, narration: narration || `Supplier payment (${paymentMode})` },
      ],
      referenceModel: 'Company',
      referenceId: supplierCompanyId,
      preparedById: req.user._id,
      approvedById: req.user._id,
      session,
    })
  );

  res.status(201).json({ success: true, data: posted });
});

export const getProcurementSummary = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const [draftCount, openCount, completedCount, payableAgg] = await Promise.all([
    StockMovement.countDocuments({ distributorId, movementType: 'PURCHASE', status: 'DRAFT' }),
    StockMovement.countDocuments({ distributorId, movementType: 'PURCHASE', status: { $in: ['PENDING', 'APPROVED'] } }),
    StockMovement.countDocuments({ distributorId, movementType: 'PURCHASE', status: 'COMPLETED' }),
    AccountLedger.aggregate([
      { $match: { distributorId, accountCode: '2010', status: 'APPROVED' } },
      { $group: { _id: null, totalCredits: { $sum: '$creditPkr' }, totalDebits: { $sum: '$debitPkr' } } },
    ]),
  ]);
  const ap = payableAgg[0] || { totalCredits: 0, totalDebits: 0 };

  res.status(200).json({
    success: true,
    data: {
      draftRequestsCount: draftCount,
      openOrdersCount: openCount,
      completedOrdersCount: completedCount,
      totalPurchasedPkr: Number((ap.totalCredits || 0).toFixed(2)),
      totalPaidPkr: Number((ap.totalDebits || 0).toFixed(2)),
      outstandingPayablePkr: Number(Math.max(0, (ap.totalCredits || 0) - (ap.totalDebits || 0)).toFixed(2)),
    },
  });
});
