import { SaleInvoice as _SaleInvoice, Recovery as _Recovery, Customer as _Customer, PendingTask as _PendingTask, StockMovement as _StockMovement } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { runWithTransaction } from '../services/stockLedger.service.js';
import { postDoubleEntry } from '../services/accountingPost.service.js';
import { checkCustomerCreditAlert } from '../services/automationAlert.service.js';

const m = () => getTenantModels({ SaleInvoice: _SaleInvoice, Recovery: _Recovery, Customer: _Customer, PendingTask: _PendingTask, StockMovement: _StockMovement });

export const listSales = asyncHandler(async (req, res) => {
  const { SaleInvoice } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  for (const key of ['paymentStatus', 'status', 'invoiceMode', 'source', 'customerId', 'salesmanId']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  if (req.query.startDate || req.query.endDate) {
    extra.createdAt = {};
    if (req.query.startDate) extra.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) extra.createdAt.$lte = new Date(req.query.endDate);
  }

  const filter = buildScopedFilter(req, extra, ['invoiceNo', 'walkInCustomerName'], searchRegex);
  const [sales, totalRecords] = await Promise.all([
    SaleInvoice.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'customerCode shopName ownerName locationHierarchy')
      .populate('orderId', 'orderCode')
      .populate('salesmanId', 'fullName profileId')
      .lean(),
    SaleInvoice.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: sales, pagination: buildPaginationMeta(totalRecords) });
});

export const getSaleById = asyncHandler(async (req, res) => {
  const { SaleInvoice } = m();
  const sale = await SaleInvoice.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('customerId')
    .populate('orderId dispatchSheetId')
    .populate('salesmanId', 'fullName profileId phone')
    .populate('lineItems.productId', 'skuCode productName baseUnit packingUnits')
    .lean();
  if (!sale) throw new AppError('Sale invoice not found.', 404, 'SALE_NOT_FOUND');
  res.status(200).json({ success: true, data: sale });
});

export const listRecoveries = asyncHandler(async (req, res) => {
  const { Recovery } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  for (const key of ['status', 'paymentMode', 'customerId', 'collectedById']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  if (req.query.chequeStatus) extra['chequeDetails.chequeStatus'] = req.query.chequeStatus;

  const filter = buildScopedFilter(req, extra, ['recoveryCode'], searchRegex);
  const [recoveries, totalRecords] = await Promise.all([
    Recovery.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'customerCode shopName ownerName')
      .populate('saleInvoiceId', 'invoiceNo balanceDuePkr')
      .populate('collectedById approvedById', 'fullName profileId')
      .lean(),
    Recovery.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: recoveries, pagination: buildPaginationMeta(totalRecords) });
});

export const assignRecoveryTask = asyncHandler(async (req, res) => {
  const { SaleInvoice, PendingTask } = m();
  const { saleInvoiceIds = [], assignedToId, title = 'Payment Recovery Sheet', dueAt = null, priority = 'NORMAL' } = req.body;
  if (!assignedToId || !Array.isArray(saleInvoiceIds) || saleInvoiceIds.length === 0) {
    throw new AppError('assignedToId and saleInvoiceIds are required.', 400, 'INVALID_RECOVERY_ASSIGNMENT');
  }

  const invoices = await SaleInvoice.find({
    _id: { $in: saleInvoiceIds },
    distributorId: req.distributorId,
    balanceDuePkr: { $gt: 0 },
  })
    .populate('customerId', 'shopName')
    .lean();

  if (invoices.length === 0) {
    throw new AppError('No unpaid invoices matched for recovery assignment.', 400, 'NO_UNPAID_INVOICES');
  }

  const task = await PendingTask.create({
    distributorId: req.distributorId,
    taskCode: `REC-${Date.now().toString().slice(-6)}`,
    taskType: 'PAYMENT_RECOVERY',
    title,
    priority,
    assignedToId,
    assignedById: req.user._id,
    referenceModel: 'SaleInvoice',
    referenceId: invoices[0]._id,
    dueAt,
    checklistItems: invoices.map((inv) => ({
      itemLabel: `${inv.invoiceNo} — ${inv.customerId?.shopName || inv.walkInCustomerName || 'Customer'}`,
      expectedQty: inv.balanceDuePkr,
      verifiedQty: 0,
      remark: String(inv._id),
    })),
    status: 'FRESH',
  });

  res.status(201).json({ success: true, data: { task, assignedInvoicesCount: invoices.length } });
});

export const collectRecovery = asyncHandler(async (req, res) => {
  const { Recovery, SaleInvoice, Customer } = m();
  const {
    customerId,
    saleInvoiceId = null,
    paymentMode = 'CASH',
    cashAmountPkr = 0,
    onlineDetails = {},
    chequeDetails = {},
    receiptImage = {},
    tripExpenses = [],
    extraReturnItems = [],
    linkedTaskId = null,
    autoApprove = false,
  } = req.body;

  const onlineAmt = Number(onlineDetails?.amountPkr) || 0;
  const chequeAmt = Number(chequeDetails?.amountPkr) || 0;
  const cashAmt = Number(cashAmountPkr) || 0;
  const returnAmt = (extraReturnItems || []).reduce((s, r) => s + (Number(r.totalAmountPkr) || 0), 0);
  const totalAmountPkr = cashAmt + onlineAmt + chequeAmt;

  if (totalAmountPkr <= 0 && returnAmt <= 0) {
    throw new AppError('Collection amount or return value must be greater than zero.', 400, 'INVALID_COLLECTION');
  }

  const isAutoApprove = Boolean(autoApprove) && ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(req.user.primaryRole);

  const recovery = await runWithTransaction(async (session) => {
    const [created] = await Recovery.create(
      [
        {
          distributorId: req.distributorId,
          recoveryCode: `RCV-${Date.now().toString().slice(-6)}`,
          customerId,
          saleInvoiceId,
          collectedById: req.user._id,
          paymentMode,
          amountPkr: totalAmountPkr,
          cashAmountPkr: cashAmt,
          onlineDetails,
          chequeDetails,
          receiptImage,
          tripExpenses,
          extraReturnItems,
          linkedTaskId,
          status: isAutoApprove ? 'APPROVED' : 'PENDING_VERIFICATION',
          approvedById: isAutoApprove ? req.user._id : null,
          approvedAt: isAutoApprove ? new Date() : null,
        },
      ],
      session ? { session } : {}
    );

    if (saleInvoiceId && totalAmountPkr + returnAmt > 0) {
      const inv = await SaleInvoice.findOne({ _id: saleInvoiceId, distributorId: req.distributorId }).session(session);
      if (inv) {
        inv.paidAmountPkr += totalAmountPkr + returnAmt;
        await inv.save(session ? { session } : undefined);
      }
    }

    if (customerId && totalAmountPkr + returnAmt > 0) {
      await Customer.findOneAndUpdate(
        { _id: customerId, distributorId: req.distributorId },
        { $inc: { 'financialTerms.outstandingBalancePkr': -(totalAmountPkr + returnAmt) } },
        session ? { session } : {}
      );
    }

    if (isAutoApprove && totalAmountPkr > 0) {
      const entries = [];
      if (cashAmt > 0) {
        entries.push({ accountCode: '1010', accountName: 'Cash in Hand', accountCategory: 'ASSET', debitPkr: cashAmt, creditPkr: 0, narration: `Cash recovery ${created.recoveryCode}` });
      }
      if (onlineAmt > 0) {
        entries.push({ accountCode: '1020', accountName: 'Bank & Mobile Wallets', accountCategory: 'ASSET', debitPkr: onlineAmt, creditPkr: 0, narration: `Online recovery ${created.recoveryCode}` });
      }
      if (chequeAmt > 0) {
        entries.push({ accountCode: '1030', accountName: 'Cheques in Hand', accountCategory: 'ASSET', debitPkr: chequeAmt, creditPkr: 0, narration: `Cheque recovery ${created.recoveryCode}` });
      }
      entries.push({
        accountCode: '1100',
        accountName: 'Accounts Receivable (Customers)',
        accountCategory: 'ASSET',
        partyType: 'CUSTOMER',
        partyId: customerId,
        debitPkr: 0,
        creditPkr: totalAmountPkr,
        narration: `Customer recovery ${created.recoveryCode}`,
      });
      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: created.recoveryCode,
        voucherType: 'RECOVERY',
        entries,
        referenceModel: 'Recovery',
        referenceId: created._id,
        preparedById: req.user._id,
        approvedById: req.user._id,
        session,
      });
    }

    return created;
  });

  if (customerId) await checkCustomerCreditAlert({ distributorId: req.distributorId, customerId });
  res.status(201).json({ success: true, data: recovery });
});

export const recordExtraReturn = asyncHandler(async (req, res) => {
  const { StockMovement, PendingTask, SaleInvoice } = m();
  const { customerId, saleInvoiceId = null, items = [], warehouseId = null, assignedStorekeeperId = null } = req.body;
  if (!customerId || items.length === 0) {
    throw new AppError('customerId and returned items are required.', 400, 'INVALID_RETURN');
  }

  const returnMovement = await runWithTransaction(async (session) => {
    const [movement] = await StockMovement.create(
      [
        {
          distributorId: req.distributorId,
          movementCode: `RET-${Date.now().toString().slice(-6)}`,
          movementType: 'CUSTOMER_RETURN',
          taskName: 'Customer Return Put-Away',
          toWarehouseId: warehouseId,
          preparedById: req.user._id,
          assignedToId: assignedStorekeeperId,
          items: items.map((i) => ({
            productId: i.productId,
            batchNo: i.batchNo || '',
            unitName: i.unitName || 'Piece',
            movedBaseQty: Number(i.quantity) || 0,
            totalValuePkr: Number(i.totalAmountPkr) || 0,
            mfgDate: i.mfgDate || null,
            expDate: i.expDate || null,
          })),
          status: 'PENDING',
        },
      ],
      session ? { session } : {}
    );

    if (assignedStorekeeperId) {
      await PendingTask.create(
        [
          {
            distributorId: req.distributorId,
            taskCode: `PUT-${Date.now().toString().slice(-5)}`,
            taskType: 'RETURN_PUT_AWAY',
            title: `Return Put-Away (${movement.movementCode})`,
            assignedToId: assignedStorekeeperId,
            assignedById: req.user._id,
            warehouseId,
            referenceModel: 'StockMovement',
            referenceId: movement._id,
            checklistItems: items.map((i) => ({
              productId: i.productId,
              unitName: i.unitName || 'Piece',
              expectedQty: Number(i.quantity) || 0,
              verifiedQty: 0,
              remark: i.condition || 'NORMAL',
            })),
            status: 'FRESH',
          },
        ],
        session ? { session } : {}
      );
    }

    if (saleInvoiceId) {
      const creditTotal = items.reduce((s, i) => s + (Number(i.totalAmountPkr) || 0), 0);
      await SaleInvoice.findOneAndUpdate(
        { _id: saleInvoiceId, distributorId: req.distributorId },
        {
          $push: {
            onSpotModifications: {
              modifiedById: req.user._id,
              actionType: 'EXTRA_RETURN',
              deltaAmountPkr: -creditTotal,
              reason: 'Customer extra return logged',
            },
          },
        },
        session ? { session } : {}
      );
    }

    return movement;
  });

  res.status(201).json({ success: true, data: returnMovement });
});

export default {
  listSales,
  getSaleById,
  listRecoveries,
  assignRecoveryTask,
  collectRecovery,
  recordExtraReturn,
};
