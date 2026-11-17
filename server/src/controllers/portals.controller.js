import {
  BeatPlan,
  Customer,
  Product,
  StockBatch,
  Order,
  SaleInvoice,
  DispatchSheet,
  Recovery,
  PendingTask,
} from '../models/index.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { calculateTwoLevelInvoice } from '../services/invoiceCalc.service.js';
import { deductDeliveredStock, runWithTransaction } from '../services/stockLedger.service.js';
import { postDoubleEntry, postSaleVoucher } from '../services/accountingPost.service.js';

export const getBookerBeats = asyncHandler(async (req, res) => {
  const filter = { distributorId: req.distributorId, status: 'ACTIVE' };
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.primaryRole)) {
    filter.assignedBookerId = req.user._id;
  }
  if (req.query.beatDay) filter.beatDay = req.query.beatDay.toUpperCase();

  const beats = await BeatPlan.find(filter)
    .populate('connectedAreas.connectedRoutes.customers.customerId', 'customerCode shopName ownerName ownerContact locationHierarchy financialTerms visitPosition')
    .lean();
  res.status(200).json({ success: true, data: beats });
});

export const getPortalCatalog = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultLimit: 24 });
  const extra = { status: 'ACTIVE' };
  for (const key of ['categoryId', 'subCategoryId', 'brandId', 'companyId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  const filter = buildScopedFilter(req, extra, ['skuCode', 'barcode', 'productName'], searchRegex);

  const [products, totalRecords] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).populate('brandId categoryId', 'brandName name').lean(),
    Product.countDocuments(filter),
  ]);

  const productIds = products.map((p) => p._id);
  const stockAgg = await StockBatch.aggregate([
    { $match: { distributorId: req.distributorId, productId: { $in: productIds }, condition: 'NORMAL' } },
    { $group: { _id: '$productId', availableBaseQty: { $sum: '$availableBaseQty' } } },
  ]);
  const stockMap = new Map(stockAgg.map((s) => [String(s._id), s.availableBaseQty]));

  const enriched = products.map((p) => ({ ...p, availableBaseQty: stockMap.get(String(p._id)) || 0 }));
  res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta(totalRecords) });
});

export const createBookerOrder = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.body.customerId, distributorId: req.distributorId });
  if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

  const calculated = calculateTwoLevelInvoice(req.body);
  const order = await Order.create({
    distributorId: req.distributorId,
    orderCode: `BK-${Date.now().toString().slice(-6)}`,
    orderMode: req.body.orderMode || 'NORMAL',
    orderType: req.body.orderType || 'REGULAR',
    source: 'BOOKER',
    customerId: customer._id,
    bookerId: req.user._id,
    areaId: customer.locationHierarchy?.areaId || null,
    routeId: customer.locationHierarchy?.routeId || null,
    lineItems: calculated.lineItems,
    grandSummary: calculated.grandSummary,
    approvalInfo: { status: 'PENDING' },
  });

  customer.visitPosition = 'ORDERED';
  await customer.save();

  res.status(201).json({ success: true, data: order });
});

export const getBookerHistory = asyncHandler(async (req, res) => {
  const { skip, limit, sort, buildPaginationMeta } = buildPaginationQuery(req);
  const filter = { distributorId: req.distributorId, bookerId: req.user._id };
  const [orders, totalRecords] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit).populate('customerId', 'shopName customerCode').lean(),
    Order.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: orders, pagination: buildPaginationMeta(totalRecords) });
});

export const posCheckout = asyncHandler(async (req, res) => {
  const { customerId = null, walkInCustomerName = 'Walk-in Customer', invoiceMode = 'POS_RETAIL', paidAmountPkr } = req.body;
  const calculated = calculateTwoLevelInvoice(req.body);
  if (calculated.lineItems.length === 0) {
    throw new AppError('Add at least one item to checkout.', 400, 'EMPTY_POS_CART');
  }

  const invoice = await runWithTransaction(async (session) => {
    const allocations = calculated.lineItems.map((li) => ({
      batchId: li.batchId || null,
      productId: li.productId,
      baseQty: (Number(li.quantity) || 0) * (Number(li.conversionQty) || 1),
    }));
    await deductDeliveredStock({ distributorId: req.distributorId, allocations, fromReserved: false, session });

    const paid = paidAmountPkr !== undefined ? Number(paidAmountPkr) : calculated.grandSummary.netPayableAmount;
    const [created] = await SaleInvoice.create(
      [
        {
          distributorId: req.distributorId,
          invoiceNo: `POS-${Date.now().toString().slice(-6)}`,
          invoiceMode,
          source: 'POS',
          customerId,
          walkInCustomerName,
          salesmanId: req.user._id,
          lineItems: calculated.lineItems,
          grandSummary: calculated.grandSummary,
          paidAmountPkr: paid,
          status: 'DELIVERED',
        },
      ],
      session ? { session } : {}
    );

    if (customerId && created.balanceDuePkr > 0) {
      await Customer.findOneAndUpdate(
        { _id: customerId, distributorId: req.distributorId },
        { $inc: { 'financialTerms.outstandingBalancePkr': created.balanceDuePkr } },
        session ? { session } : {}
      );
    }

    await postSaleVoucher({ distributorId: req.distributorId, invoice: created, actorId: req.user._id, session });
    return created;
  });

  res.status(201).json({ success: true, data: invoice });
});

export const getPosHistory = asyncHandler(async (req, res) => {
  const { skip, limit, sort, buildPaginationMeta } = buildPaginationQuery(req);
  const filter = { distributorId: req.distributorId, source: 'POS' };
  const [sales, totalRecords] = await Promise.all([
    SaleInvoice.find(filter).sort(sort).skip(skip).limit(limit).populate('customerId', 'shopName').lean(),
    SaleInvoice.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: sales, pagination: buildPaginationMeta(totalRecords) });
});

export const getSalesmanDeliveryPlan = asyncHandler(async (req, res) => {
  const filter = { distributorId: req.distributorId, status: { $in: ['PLANNED', 'PICKING', 'DISPATCHED', 'IN_TRANSIT'] } };
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.primaryRole)) {
    filter.salesmanId = req.user._id;
  }

  const sheets = await DispatchSheet.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: 'orderIds', populate: { path: 'customerId', select: 'customerCode shopName ownerName ownerContact locationHierarchy financialTerms' } })
    .populate({ path: 'recoveryInvoiceIds', populate: { path: 'customerId', select: 'customerCode shopName ownerContact' } })
    .populate('extraDispatchItems.productId', 'skuCode productName baseUnit packingUnits')
    .lean();

  res.status(200).json({ success: true, data: sheets });
});

export const executeSalesmanDeal = asyncHandler(async (req, res) => {
  const {
    saleInvoiceId,
    dispatchSheetId = null,
    onSpotModifications = [],
    updatedLineItems = null,
    extraGrandDiscountPkr = 0,
    payment = {},
    tripExpenses = [],
    extraReturnItems = [],
    cancelEntireOrder = false,
    cancelReason = '',
  } = req.body;

  const result = await runWithTransaction(async (session) => {
    const invoice = await SaleInvoice.findOne({ _id: saleInvoiceId, distributorId: req.distributorId }).session(session);
    if (!invoice) throw new AppError('Sale invoice not found.', 404, 'INVOICE_NOT_FOUND');

    if (cancelEntireOrder) {
      invoice.status = 'CANCELLED';
      invoice.onSpotModifications.push({ modifiedById: req.user._id, actionType: 'ORDER_CANCEL', reason: cancelReason || 'Cancelled on spot' });
      await invoice.save(session ? { session } : undefined);
      return { invoice, recovery: null };
    }

    if (Array.isArray(updatedLineItems)) {
      const recalc = calculateTwoLevelInvoice({ lineItems: updatedLineItems, extraGrandDiscountPkr });
      invoice.lineItems = recalc.lineItems;
      invoice.grandSummary = recalc.grandSummary;
    }
    if (onSpotModifications.length > 0) {
      invoice.onSpotModifications.push(...onSpotModifications.map((m) => ({ ...m, modifiedById: req.user._id })));
    }

    const allocations = (invoice.lineItems || []).map((li) => ({
      batchId: li.batchId,
      productId: li.productId,
      baseQty: (Number(li.quantity) || 0) * (Number(li.conversionQty) || 1),
    }));
    await deductDeliveredStock({ distributorId: req.distributorId, allocations, fromReserved: true, session });

    const paidNow = Number(payment.cashAmountPkr || 0) + Number(payment.onlineAmountPkr || 0) + Number(payment.chequeAmountPkr || 0);
    invoice.paidAmountPkr += paidNow;
    invoice.status = 'DELIVERED';
    await invoice.save(session ? { session } : undefined);

    if (invoice.customerId && paidNow > 0) {
      await Customer.findOneAndUpdate(
        { _id: invoice.customerId, distributorId: req.distributorId },
        { $inc: { 'financialTerms.outstandingBalancePkr': -paidNow } },
        session ? { session } : {}
      );
    }

    if (invoice.orderId) {
      await Order.findByIdAndUpdate(invoice.orderId, { 'approvalInfo.status': 'COMPLETED' }, session ? { session } : {});
    }

    let recovery = null;
    if (paidNow > 0 || tripExpenses.length > 0 || extraReturnItems.length > 0) {
      const [rec] = await Recovery.create(
        [
          {
            distributorId: req.distributorId,
            recoveryCode: `SR-${Date.now().toString().slice(-6)}`,
            customerId: invoice.customerId,
            saleInvoiceId: invoice._id,
            collectedById: req.user._id,
            paymentMode: payment.paymentMode || 'CASH',
            amountPkr: paidNow,
            cashAmountPkr: Number(payment.cashAmountPkr || 0),
            onlineDetails: payment.onlineDetails || {},
            chequeDetails: payment.chequeDetails || {},
            tripExpenses,
            extraReturnItems,
            status: 'PENDING_VERIFICATION',
          },
        ],
        session ? { session } : {}
      );
      recovery = rec;
    }

    if (dispatchSheetId && extraReturnItems.length > 0) {
      await PendingTask.create(
        [
          {
            distributorId: req.distributorId,
            taskCode: `SRT-${Date.now().toString().slice(-5)}`,
            taskType: 'RETURN_PUT_AWAY',
            title: `Salesman Return Put-Away (${invoice.invoiceNo})`,
            assignedToId: req.user._id,
            assignedById: req.user._id,
            referenceModel: 'DispatchSheet',
            referenceId: dispatchSheetId,
            status: 'FRESH',
          },
        ],
        session ? { session } : {}
      );
    }

    await postSaleVoucher({ distributorId: req.distributorId, invoice, actorId: req.user._id, session });
    if (tripExpenses.length > 0) {
      const expTotal = tripExpenses.reduce((s, e) => s + (Number(e.amountPkr) || 0), 0);
      if (expTotal > 0) {
        await postDoubleEntry({
          distributorId: req.distributorId,
          voucherNo: `EXP-${invoice.invoiceNo}`,
          voucherType: 'EXPENSE',
          entries: [
            { accountCode: '5030', accountName: 'Delivery & Trip Expenses', accountCategory: 'EXPENSE', debitPkr: expTotal, creditPkr: 0, narration: `Trip expenses (${invoice.invoiceNo})` },
            { accountCode: '1010', accountName: 'Cash in Hand', accountCategory: 'ASSET', debitPkr: 0, creditPkr: expTotal, narration: `Cash paid for trip expenses` },
          ],
          referenceModel: 'SaleInvoice',
          referenceId: invoice._id,
          preparedById: req.user._id,
          approvedById: req.user._id,
          session,
        });
      }
    }

    return { invoice, recovery };
  });

  res.status(200).json({ success: true, data: result });
});

export default {
  getBookerBeats,
  getPortalCatalog,
  createBookerOrder,
  getBookerHistory,
  posCheckout,
  getPosHistory,
  getSalesmanDeliveryPlan,
  executeSalesmanDeal,
};
