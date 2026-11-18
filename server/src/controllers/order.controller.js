import {
  Order as _Order,
  CommercialRule as _CommercialRule,
  Customer as _Customer,
  Product as _Product,
  DispatchSheet as _DispatchSheet,
  SaleInvoice as _SaleInvoice,
  PendingTask as _PendingTask,
} from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { calculateTwoLevelInvoice } from '../services/invoiceCalc.service.js';
import { reserveStockForOrder, releaseReservedStock, runWithTransaction } from '../services/stockLedger.service.js';
import { recordAuditLog } from '../services/accountingPost.service.js';
import { createNotificationIfAbsent } from '../services/automationAlert.service.js';

const m = () =>
  getTenantModels({
    Order: _Order,
    CommercialRule: _CommercialRule,
    Customer: _Customer,
    Product: _Product,
    DispatchSheet: _DispatchSheet,
    SaleInvoice: _SaleInvoice,
    PendingTask: _PendingTask,
  });

async function loadRuleMap(distributorId, body = {}) {
  const { CommercialRule } = m();
  const ids = new Set();
  for (const id of [body.grandDiscountRuleId, body.grandChargeRuleId, body.grandTaxRuleId, body.grandSchemeRuleId]) {
    if (id) ids.add(String(id));
  }
  for (const item of body.lineItems || []) {
    for (const id of [item.itemDiscountRuleId, item.itemChargeRuleId, item.itemTaxRuleId, item.schemeRuleId]) {
      if (id) ids.add(String(id));
    }
  }
  if (ids.size === 0) return new Map();
  const rules = await CommercialRule.find({ distributorId, _id: { $in: [...ids] } }).lean();
  return new Map(rules.map((r) => [String(r._id), r]));
}

export const listOrders = asyncHandler(async (req, res) => {
  const { Order } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.status) extra['approvalInfo.status'] = req.query.status;
  for (const key of ['orderMode', 'orderType', 'source', 'customerId', 'bookerId', 'areaId', 'routeId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  if (req.query.startDate || req.query.endDate) {
    extra.createdAt = {};
    if (req.query.startDate) extra.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) extra.createdAt.$lte = new Date(req.query.endDate);
  }
  const filter = buildScopedFilter(req, extra, ['orderCode'], searchRegex);
  const [orders, totalRecords] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'customerCode shopName ownerName locationHierarchy financialTerms')
      .populate('bookerId assignedSalesmanId assignedStorekeeperId', 'fullName profileId')
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: orders, pagination: buildPaginationMeta(totalRecords) });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { Order } = m();
  const order = await Order.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('customerId')
    .populate('bookerId assignedSalesmanId assignedStorekeeperId approvalInfo.approvedById', 'fullName profileId')
    .populate('lineItems.productId', 'skuCode productName baseUnit packingUnits')
    .lean();
  if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  res.status(200).json({ success: true, data: order });
});

export const calculateOrderPreview = asyncHandler(async (req, res) => {
  const ruleMap = await loadRuleMap(req.distributorId, req.body);
  const calculated = calculateTwoLevelInvoice(req.body, { ruleMap });
  res.status(200).json({ success: true, data: calculated });
});

export const createOrder = asyncHandler(async (req, res) => {
  const { Order, Customer, Product } = m();
  const distributorId = req.distributorId;
  if (!req.body.customerId) {
    throw new AppError('Please create and select a Customer first before creating an Order.', 400, 'PREREQUISITE_CUSTOMER_REQUIRED');
  }
  const customer = await Customer.findOne({ _id: req.body.customerId, distributorId }).lean();
  if (!customer) throw new AppError('Selected Customer was not found. Please create a Customer first.', 400, 'PREREQUISITE_CUSTOMER_NOT_FOUND');
  if (customer.status === 'BLOCKED' && !req.body.overrideBlocked) {
    throw new AppError('Customer account is BLOCKED. Admin override required.', 400, 'CUSTOMER_BLOCKED');
  }
  const items = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
  if (items.length === 0) {
    throw new AppError('Please add at least one Product to the order before submitting.', 400, 'PREREQUISITE_PRODUCTS_REQUIRED');
  }
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean).map(String))];
  if ((await Product.countDocuments({ _id: { $in: productIds }, distributorId })) !== productIds.length) {
    throw new AppError('One or more selected Products were not found. Please create a Product first.', 400, 'PREREQUISITE_PRODUCT_NOT_FOUND');
  }

  const ruleMap = await loadRuleMap(distributorId, req.body);
  const calculated = calculateTwoLevelInvoice(req.body, { ruleMap });
  const requestedStatus = req.body.approvalInfo?.status === 'DRAFT' ? 'DRAFT' : 'PENDING';

  const order = await Order.create({
    distributorId,
    orderCode: req.body.orderCode || `ORD-${Date.now().toString().slice(-6)}`,
    orderMode: req.body.orderMode || 'NORMAL',
    orderType: req.body.orderType || 'REGULAR',
    source: req.body.source || (req.user.primaryRole === 'BOOKER' ? 'BOOKER' : 'ADMIN'),
    customerId: customer._id,
    bookerId: req.body.bookerId || req.user._id,
    areaId: req.body.areaId || customer.locationHierarchy?.areaId || null,
    routeId: req.body.routeId || customer.locationHierarchy?.routeId || null,
    lineItems: calculated.lineItems,
    grandSummary: calculated.grandSummary,
    invoiceStyle: req.body.invoiceStyle || {},
    approvalInfo: { status: requestedStatus },
    assignedSalesmanId: req.body.assignedSalesmanId || null,
    assignedStorekeeperId: req.body.assignedStorekeeperId || null,
  });

  if (requestedStatus === 'PENDING') {
    await createNotificationIfAbsent({
      distributorId,
      idempotencyKey: `ORDER_PENDING:${order._id}`,
      recipientRole: 'ADMIN',
      alertCategory: 'PENDING_ORDER_APPROVAL',
      severity: 'INFO',
      title: `Pending Order: ${order.orderCode}`,
      message: `${customer.shopName} order (${calculated.grandSummary.netPayableAmount} PKR) awaits approval.`,
      referenceModel: 'Order',
      referenceId: order._id,
    });
  }
  res.status(201).json({ success: true, data: order });
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { Order } = m();
  const order = await Order.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  if (!['DRAFT', 'PENDING'].includes(order.approvalInfo?.status)) {
    throw new AppError('Only DRAFT or PENDING orders can be edited directly.', 400, 'ORDER_LOCKED');
  }
  const ruleMap = await loadRuleMap(req.distributorId, req.body);
  const calculated = calculateTwoLevelInvoice(req.body, { ruleMap });
  order.lineItems = calculated.lineItems;
  order.grandSummary = calculated.grandSummary;
  if (req.body.invoiceStyle) order.invoiceStyle = req.body.invoiceStyle;
  if (req.body.orderType) order.orderType = req.body.orderType;
  if (req.body.approvalInfo?.status) order.approvalInfo.status = req.body.approvalInfo.status;
  await order.save();
  res.status(200).json({ success: true, data: order });
});

export const approveOrdersBatch = asyncHandler(async (req, res) => {
  const { Order } = m();
  const { orderIds = [], stockIssuePolicy = null } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new AppError('Select at least one pending order to approve.', 400, 'NO_ORDERS_SELECTED');
  }

  const approvedOrders = await runWithTransaction(async (session) => {
    const orders = await Order.find({
      _id: { $in: orderIds },
      distributorId: req.distributorId,
      'approvalInfo.status': { $in: ['PENDING', 'DRAFT'] },
    }).session(session);
    if (orders.length === 0) throw new AppError('No eligible pending orders found for approval.', 400, 'NO_PENDING_ORDERS');

    for (const order of orders) {
      const allocations = await reserveStockForOrder({
        distributorId: req.distributorId,
        lineItems: order.lineItems,
        policyOverride: stockIssuePolicy,
        session,
      });
      order.stockIssuePolicyApplied = allocations.policyApplied || 'FEFO';
      order.approvalInfo.status = 'APPROVED';
      order.approvalInfo.approvedById = req.user._id;
      order.approvalInfo.approvedAt = new Date();
      await order.save(session ? { session } : undefined);
      await recordAuditLog({
        distributorId: req.distributorId,
        actorId: req.user._id,
        module: 'ORDERS',
        action: 'APPROVE_ORDER',
        entityModel: 'Order',
        entityId: order._id,
        afterState: { orderCode: order.orderCode, netPayable: order.grandSummary?.netPayableAmount, stockIssuePolicyApplied: order.stockIssuePolicyApplied },
        session,
      });
    }
    return orders;
  });

  res.status(200).json({ success: true, data: { approvedCount: approvedOrders.length, orders: approvedOrders } });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { Order } = m();
  const order = await runWithTransaction(async (session) => {
    const doc = await Order.findOne({ _id: req.params.id, distributorId: req.distributorId }).session(session);
    if (!doc) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    if (['COMPLETED', 'CANCELLED'].includes(doc.approvalInfo.status)) {
      throw new AppError(`Cannot cancel an order in ${doc.approvalInfo.status} status.`, 400, 'ORDER_INVALID_STATE');
    }
    if (['APPROVED', 'DELIVERY_ASSIGNED'].includes(doc.approvalInfo.status)) {
      const allocations = (doc.lineItems || []).map((li) => ({
        batchId: li.batchId,
        productId: li.productId,
        baseQty: (Number(li.quantity) || 0) * (Number(li.conversionQty) || 1),
      }));
      await releaseReservedStock({ distributorId: req.distributorId, allocations, session });
    }
    doc.approvalInfo.status = 'CANCELLED';
    doc.approvalInfo.cancelReason = req.body.reason || 'Cancelled by operator';
    await doc.save(session ? { session } : undefined);
    return doc;
  });
  res.status(200).json({ success: true, data: order });
});

export const createDeliveryPlan = asyncHandler(async (req, res) => {
  const { Order, Customer, DispatchSheet, SaleInvoice, PendingTask } = m();
  const { orderIds = [], recoveryInvoiceIds = [], salesmanId, storekeeperId = null, recoveryPersonId = null, vehicleInfo = {}, extraDispatchItems = [] } = req.body;
  if (!salesmanId || orderIds.length === 0) {
    throw new AppError('Please select a Salesman and at least one Approved Order before creating a Delivery Plan.', 400, 'INVALID_DELIVERY_PLAN');
  }

  const result = await runWithTransaction(async (session) => {
    const orders = await Order.find({ _id: { $in: orderIds }, distributorId: req.distributorId, 'approvalInfo.status': 'APPROVED' }).session(session);
    if (orders.length === 0) throw new AppError('No APPROVED orders found for delivery planning.', 400, 'NO_APPROVED_ORDERS');

    const totalWeightKg = orders.reduce((s, o) => s + (o.grandSummary?.totalWeightKg || 0), 0);
    const totalVolumeCubic = orders.reduce((s, o) => s + (o.grandSummary?.totalVolumeCubic || 0), 0);
    const totalLoadValuePkr = orders.reduce((s, o) => s + (o.grandSummary?.netPayableAmount || 0), 0);
    const opts = session ? { session } : {};

    const [dispatchSheet] = await DispatchSheet.create([{
      distributorId: req.distributorId, dispatchCode: `DSP-${Date.now().toString().slice(-6)}`,
      salesmanId, storekeeperId, recoveryPersonId: recoveryPersonId || salesmanId, vehicleInfo,
      orderIds: orders.map((o) => o._id), recoveryInvoiceIds, extraDispatchItems,
      totalWeightKg: Number(totalWeightKg.toFixed(3)), totalVolumeCubic: Number(totalVolumeCubic.toFixed(3)),
      totalLoadValuePkr: Number(totalLoadValuePkr.toFixed(2)), status: 'PLANNED',
    }], opts);

    const invoices = [], checklistItems = [];
    for (const order of orders) {
      const [inv] = await SaleInvoice.create([{
        distributorId: req.distributorId, invoiceNo: `INV-${order.orderCode}-${Date.now().toString().slice(-4)}`,
        orderId: order._id, dispatchSheetId: dispatchSheet._id, invoiceMode: order.orderMode === 'ADVANCE' ? 'ADVANCE' : 'NORMAL',
        source: order.source === 'BOOKER' ? 'BOOKER' : 'ADMIN', customerId: order.customerId, salesmanId,
        lineItems: order.lineItems, grandSummary: order.grandSummary, paidAmountPkr: 0, paymentStatus: 'CREDIT', status: 'ISSUED',
      }], opts);
      invoices.push(inv);
      if (order.customerId && inv.balanceDuePkr > 0) {
        await Customer.findByIdAndUpdate(order.customerId, { $inc: { 'financialTerms.outstandingBalancePkr': inv.balanceDuePkr } }, opts);
      }
      order.approvalInfo.status = 'DELIVERY_ASSIGNED';
      order.assignedSalesmanId = salesmanId;
      order.assignedStorekeeperId = storekeeperId;
      order.dispatchSheetId = dispatchSheet._id;
      await order.save(session ? { session } : undefined);
      for (const li of order.lineItems || []) {
        checklistItems.push({ productId: li.productId, batchId: li.batchId, unitName: li.unitName, expectedQty: li.quantity, verifiedQty: li.quantity });
      }
    }

    const createdTasks = [];
    if (storekeeperId) {
      const [dt] = await PendingTask.create([{
        distributorId: req.distributorId, taskCode: `DSP-T-${Date.now().toString().slice(-5)}`, taskType: 'DELIVERY_DISPATCH',
        title: `Dispatch Picking (${dispatchSheet.dispatchCode})`, assignedToId: storekeeperId, assignedById: req.user._id,
        referenceModel: 'DispatchSheet', referenceId: dispatchSheet._id, checklistItems, status: 'FRESH',
      }], opts);
      createdTasks.push(dt);
    }
    if (recoveryInvoiceIds.length > 0) {
      const [rt] = await PendingTask.create([{
        distributorId: req.distributorId, taskCode: `REC-T-${Date.now().toString().slice(-5)}`, taskType: 'PAYMENT_RECOVERY',
        title: `Route Recovery (${dispatchSheet.dispatchCode})`, assignedToId: recoveryPersonId || salesmanId, assignedById: req.user._id,
        referenceModel: 'DispatchSheet', referenceId: dispatchSheet._id, status: 'FRESH',
      }], opts);
      createdTasks.push(rt);
    }
    dispatchSheet.linkedTaskIds = createdTasks.map((t) => t._id);
    await dispatchSheet.save(session ? { session } : undefined);
    return { dispatchSheet, invoices, createdTasks };
  });

  res.status(201).json({ success: true, data: result });
});

export default { listOrders, getOrderById, calculateOrderPreview, createOrder, updateOrder, approveOrdersBatch, cancelOrder, createDeliveryPlan };
