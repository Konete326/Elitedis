import {
  Product,
  StockBatch,
  StockMovement,
  Customer,
  Order,
  DispatchSheet,
  SaleInvoice,
  Recovery,
  PendingTask,
  AccountLedger,
  Notification,
} from '../models/index.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery } from '../middlewares/tenantMiddleware.js';
import { evaluateLowStockAndExpiryAlerts } from '../services/automationAlert.service.js';

export const getModuleDashboard = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const slug = String(req.params.moduleSlug || 'executive').toLowerCase();

  const [
    productsTotal,
    productsActive,
    stockAgg,
    ordersPending,
    ordersApproved,
    salesAgg,
    customersTotal,
    tasksPending,
    recoveriesPending,
    unreadAlerts,
  ] = await Promise.all([
    Product.countDocuments({ distributorId }),
    Product.countDocuments({ distributorId, status: 'ACTIVE' }),
    StockBatch.aggregate([
      { $match: { distributorId } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$totalStockValuePkr' },
          totalWeightKg: { $sum: '$totalWeightKg' },
          lowCount: { $sum: { $cond: [{ $eq: ['$status', 'LOW_WARNING'] }, 1, 0] } },
          outCount: { $sum: { $cond: [{ $eq: ['$status', 'OUT'] }, 1, 0] } },
        },
      },
    ]),
    Order.countDocuments({ distributorId, 'approvalInfo.status': 'PENDING' }),
    Order.countDocuments({ distributorId, 'approvalInfo.status': 'APPROVED' }),
    SaleInvoice.aggregate([
      { $match: { distributorId, status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandSummary.netPayableAmount' },
          totalPaid: { $sum: '$paidAmountPkr' },
          totalBalanceDue: { $sum: '$balanceDuePkr' },
          count: { $sum: 1 },
        },
      },
    ]),
    Customer.countDocuments({ distributorId, status: 'ACTIVE' }),
    PendingTask.countDocuments({ distributorId, status: { $in: ['FRESH', 'DRAFT', 'PENDING'] } }),
    Recovery.countDocuments({ distributorId, status: 'PENDING_VERIFICATION' }),
    Notification.countDocuments({ distributorId, isRead: false }),
  ]);

  const stock = stockAgg[0] || { totalValue: 0, totalWeightKg: 0, lowCount: 0, outCount: 0 };
  const sales = salesAgg[0] || { totalSales: 0, totalPaid: 0, totalBalanceDue: 0, count: 0 };

  const [recentOrders, recentTasks, recentMovements] = await Promise.all([
    Order.find({ distributorId }).sort({ createdAt: -1 }).limit(5).populate('customerId', 'shopName').lean(),
    PendingTask.find({ distributorId }).sort({ createdAt: -1 }).limit(5).populate('assignedToId', 'fullName').lean(),
    StockMovement.find({ distributorId, isHidden: false }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      moduleSlug: slug,
      kpis: {
        productsTotal,
        productsActive,
        productsInactive: productsTotal - productsActive,
        stockValuePkr: stock.totalValue,
        stockWeightKg: stock.totalWeightKg,
        lowStockCount: stock.lowCount,
        outOfStockCount: stock.outCount,
        ordersPending,
        ordersApproved,
        totalSalesPkr: sales.totalSales,
        totalCollectedPkr: sales.totalPaid,
        totalReceivablePkr: sales.totalBalanceDue,
        totalInvoices: sales.count,
        customersTotal,
        tasksPending,
        recoveriesPending,
        unreadAlerts,
      },
      recentOrders,
      recentTasks,
      recentMovements,
    },
  });
});

export const getReport = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const slug = String(req.params.reportSlug || '').toLowerCase();
  const { skip, limit, buildPaginationMeta } = buildPaginationQuery(req, { defaultLimit: 25 });
  const dateFilter = {};
  if (req.query.startDate) dateFilter.$gte = new Date(req.query.startDate);
  if (req.query.endDate) dateFilter.$lte = new Date(req.query.endDate);

  const createdRange = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  if (['daily-sales', 'weekly-sales', 'monthly-sales', 'yearly-sales', 'tax', 'product-profitability', 'customer-profitability'].includes(slug)) {
    const filter = { distributorId, status: { $ne: 'CANCELLED' }, ...createdRange };
    if (req.query.customerId) filter.customerId = req.query.customerId;
    const [rows, total] = await Promise.all([
      SaleInvoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customerId', 'shopName customerCode').lean(),
      SaleInvoice.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
  }

  if (slug === 'company-share') {
    if (!req.query.companyId) {
      throw new AppError('companyId is required for strict company-isolated sharing.', 400, 'COMPANY_ID_REQUIRED');
    }
    const products = await Product.find({ distributorId, companyId: req.query.companyId }).select('skuCode productName baseUnit status').lean();
    const productIds = products.map((p) => p._id);
    const batches = await StockBatch.find({ distributorId, productId: { $in: productIds } })
      .populate('productId', 'skuCode productName')
      .populate('warehouseId', 'warehouseName')
      .lean();
    return res.status(200).json({ success: true, reportSlug: slug, data: { products, batches } });
  }

  if (slug === 'batch-stock' || slug === 'expiry') {
    const filter = { distributorId };
    if (slug === 'expiry') filter.expDate = { $lte: new Date(Date.now() + 90 * 86400000) };
    const [rows, total] = await Promise.all([
      StockBatch.find(filter).sort({ expDate: 1 }).skip(skip).limit(limit).populate('productId warehouseId', 'skuCode productName warehouseName').lean(),
      StockBatch.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
  }

  if (slug === 'stock-movement' || slug === 'purchase') {
    const filter = { distributorId, ...createdRange, ...(slug === 'purchase' ? { movementType: 'PURCHASE' } : {}) };
    const [rows, total] = await Promise.all([
      StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StockMovement.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
  }

  if (slug === 'recovery' || slug === 'expense') {
    const filter = { distributorId, ...createdRange };
    const [rows, total] = await Promise.all([
      Recovery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customerId collectedById', 'shopName fullName').lean(),
      Recovery.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
  }

  if (slug === 'employee-task') {
    const [rows, total] = await Promise.all([
      PendingTask.find({ distributorId, ...createdRange }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('assignedToId', 'fullName profileId').lean(),
      PendingTask.countDocuments({ distributorId, ...createdRange }),
    ]);
    return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
  }

  // Fallback for financial/ledger reports (customer-ledger, supplier-ledger, cash-flow, profit-loss, company-performance)
  const [rows, total] = await Promise.all([
    AccountLedger.find({ distributorId, status: 'APPROVED' }).sort({ transactionDate: -1 }).skip(skip).limit(limit).lean(),
    AccountLedger.countDocuments({ distributorId, status: 'APPROVED' }),
  ]);
  return res.status(200).json({ success: true, reportSlug: slug, data: rows, pagination: buildPaginationMeta(total) });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const { skip, limit, buildPaginationMeta } = buildPaginationQuery(req, { defaultLimit: 15 });
  const filter = { distributorId: req.distributorId };
  if (req.query.unreadOnly === 'true') filter.isRead = false;

  const [alerts, totalRecords, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ distributorId: req.distributorId, isRead: false }),
  ]);

  res.status(200).json({ success: true, data: alerts, unreadCount, pagination: buildPaginationMeta(totalRecords) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  if (req.params.id === 'all') {
    await Notification.updateMany(
      { distributorId: req.distributorId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return res.status(200).json({ success: true, message: 'All alerts marked as read.' });
  }

  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.id, distributorId: req.distributorId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!updated) throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  return res.status(200).json({ success: true, data: updated });
});

export const runAutomationSweep = asyncHandler(async (req, res) => {
  const result = await evaluateLowStockAndExpiryAlerts({
    distributorId: req.distributorId,
    actorId: req.user._id,
  });
  res.status(200).json({ success: true, data: result });
});

export const getDailySalesReport = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const now = new Date();
  const startDate = req.query.startDate
    ? new Date(req.query.startDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const endDate = req.query.endDate
    ? new Date(req.query.endDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  const dateRange = { $gte: startDate, $lte: endDate };
  const [orders, dispatches, invoices, recoveries, byBrand] = await Promise.all([
    Order.find({ distributorId, createdAt: dateRange })
      .populate('bookerId', 'fullName profileId')
      .select('orderCode source approvalInfo.status grandSummary.netPayableAmount bookerId')
      .lean(),
    DispatchSheet.find({ distributorId, createdAt: dateRange })
      .populate('salesmanId', 'fullName profileId')
      .select('dispatchCode salesmanId totalWeightKg totalVolumeCubic totalLoadValuePkr status')
      .lean(),
    SaleInvoice.find({ distributorId, createdAt: dateRange, status: { $ne: 'CANCELLED' } })
      .populate('customerId', 'shopName customerCode')
      .populate('salesmanId', 'fullName profileId')
      .lean(),
    Recovery.find({ distributorId, createdAt: dateRange }).lean(),
    SaleInvoice.aggregate([
      { $match: { distributorId, createdAt: dateRange, status: { $ne: 'CANCELLED' } } },
      { $unwind: '$lineItems' },
      { $lookup: { from: 'products', localField: 'lineItems.productId', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'brands', localField: 'prod.brandId', foreignField: '_id', as: 'brand' } },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$brand.brandName', 'Unbranded'] },
          totalQty: { $sum: '$lineItems.quantity' },
          totalAmountPkr: { $sum: '$lineItems.netLineAmount' },
        },
      },
      { $sort: { totalAmountPkr: -1 } },
    ]),
  ]);

  const approvedOrders = orders.filter((o) => ['APPROVED', 'DELIVERY_ASSIGNED', 'COMPLETED'].includes(o.approvalInfo?.status));
  const spotReturnsPkr = invoices.reduce(
    (s, inv) => s + (inv.onSpotModifications || []).reduce((m, mod) => m + Math.abs(Math.min(0, mod.deltaAmountPkr || 0)), 0),
    0
  );
  const cashRecoveredPkr = recoveries.reduce((s, r) => s + (r.cashAmountPkr || 0), 0);
  const onlineRecoveredPkr = recoveries.reduce((s, r) => s + (r.onlineDetails?.amountPkr || 0), 0);
  const chequeRecoveredPkr = recoveries.reduce((s, r) => s + (r.chequeDetails?.amountPkr || 0), 0);
  const tripExpensesPkr = recoveries.reduce(
    (s, r) => s + (r.tripExpenses || []).reduce((t, e) => t + (e.amountPkr || 0), 0),
    0
  );

  res.status(200).json({
    success: true,
    data: {
      dateRange: { startDate, endDate },
      summary: {
        bookedOrdersCount: orders.length,
        bookedOrdersValuePkr: orders.reduce((s, o) => s + (o.grandSummary?.netPayableAmount || 0), 0),
        approvedOrdersCount: approvedOrders.length,
        dispatchedSheetsCount: dispatches.length,
        dispatchedLoadValuePkr: dispatches.reduce((s, d) => s + (d.totalLoadValuePkr || 0), 0),
        dispatchedWeightKg: dispatches.reduce((s, d) => s + (d.totalWeightKg || 0), 0),
        deliveredInvoicesCount: invoices.length,
        deliveredSalesPkr: invoices.reduce((s, i) => s + (i.grandSummary?.netPayableAmount || 0), 0),
        spotReturnsPkr,
        cashRecoveredPkr,
        onlineRecoveredPkr,
        chequeRecoveredPkr,
        totalRecoveredPkr: cashRecoveredPkr + onlineRecoveredPkr + chequeRecoveredPkr,
        tripExpensesPkr,
      },
      byBrand: byBrand.map((b) => ({ brandName: b._id, totalQty: b.totalQty, totalAmountPkr: b.totalAmountPkr })),
      recentInvoices: invoices.slice(0, 10),
    },
  });
});

export default {
  getModuleDashboard,
  getReport,
  listNotifications,
  markNotificationRead,
  runAutomationSweep,
  getDailySalesReport,
};
