import { AccountLedger as _AccountLedger, Recovery as _Recovery, Customer as _Customer, SaleInvoice as _SaleInvoice } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { CHART_OF_ACCOUNTS, postDoubleEntry } from '../services/accountingPost.service.js';
import { runWithTransaction } from '../services/stockLedger.service.js';
import { checkCustomerCreditAlert, createNotificationIfAbsent } from '../services/automationAlert.service.js';

const m = () => getTenantModels({ AccountLedger: _AccountLedger, Recovery: _Recovery, Customer: _Customer, SaleInvoice: _SaleInvoice });

export const listAccountMovements = asyncHandler(async (req, res) => {
  const { Recovery } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.paymentMode) extra.paymentMode = req.query.paymentMode;

  const filter = buildScopedFilter(req, extra, ['recoveryCode'], searchRegex);
  const [movements, totalRecords] = await Promise.all([
    Recovery.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'customerCode shopName')
      .populate('collectedById approvedById', 'fullName profileId')
      .populate('saleInvoiceId', 'invoiceNo')
      .lean(),
    Recovery.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: movements, pagination: buildPaginationMeta(totalRecords) });
});

export const listCheques = asyncHandler(async (req, res) => {
  const { Recovery } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = { paymentMode: { $in: ['CHEQUE', 'MIXED'] }, 'chequeDetails.amountPkr': { $gt: 0 } };
  if (req.query.chequeStatus) extra['chequeDetails.chequeStatus'] = req.query.chequeStatus;
  const filter = buildScopedFilter(req, extra, ['recoveryCode', 'chequeDetails.chequeNo', 'chequeDetails.bankName'], searchRegex);

  const [cheques, totalRecords] = await Promise.all([
    Recovery.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'customerCode shopName ownerContact')
      .populate('saleInvoiceId', 'invoiceNo')
      .lean(),
    Recovery.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: cheques, pagination: buildPaginationMeta(totalRecords) });
});

async function handleChequeLifecycle(rec, action, req, session) {
  const { Customer, SaleInvoice } = m();
  const amt = Number(rec.chequeDetails?.amountPkr || rec.amountPkr || 0);
  const cur = rec.chequeDetails?.chequeStatus || 'PENDING';
  const opts = session ? { session } : {};

  if (action === 'DEPOSIT_CHEQUE') {
    if (cur !== 'PENDING') throw new AppError(`Cannot deposit cheque in ${cur} status.`, 400, 'INVALID_CHEQUE_STATE');
    rec.chequeDetails.chequeStatus = 'DEPOSITED';
    await rec.save(session ? { session } : undefined);
    return rec;
  }

  if (action === 'CLEAR_CHEQUE') {
    if (!['PENDING', 'DEPOSITED'].includes(cur)) {
      throw new AppError(`Cannot clear cheque in ${cur} status.`, 400, 'INVALID_CHEQUE_STATE');
    }
    rec.chequeDetails.chequeStatus = 'CLEARED';
    rec.status = 'APPROVED';
    rec.approvedById = rec.approvedById || req.user._id;
    rec.approvedAt = rec.approvedAt || new Date();
    await rec.save(session ? { session } : undefined);
    if (amt > 0) {
      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: `CHQ-CLR-${rec.recoveryCode}`,
        voucherType: 'RECOVERY',
        entries: [
          { accountCode: '1020', accountName: 'Bank & Mobile Wallets', accountCategory: 'ASSET', debitPkr: amt, creditPkr: 0, narration: `Cheque cleared (${rec.chequeDetails?.chequeNo || rec.recoveryCode})` },
          { accountCode: '1030', accountName: 'Cheques in Hand', accountCategory: 'ASSET', debitPkr: 0, creditPkr: amt, narration: `Cheque cleared (${rec.recoveryCode})` },
        ],
        referenceModel: 'Recovery',
        referenceId: rec._id,
        preparedById: rec.collectedById,
        approvedById: req.user._id,
        session,
      });
    }
    return rec;
  }

  if (action === 'BOUNCE_CHEQUE') {
    if (cur === 'BOUNCED') throw new AppError('Cheque is already marked bounced.', 400, 'ALREADY_BOUNCED');
    rec.chequeDetails.chequeStatus = 'BOUNCED';
    rec.status = 'BOUNCED';
    await rec.save(session ? { session } : undefined);

    if (rec.customerId && amt > 0) {
      await Customer.findByIdAndUpdate(rec.customerId, { $inc: { 'financialTerms.outstandingBalancePkr': amt } }, opts);
    }
    if (rec.saleInvoiceId && amt > 0) {
      const inv = await SaleInvoice.findById(rec.saleInvoiceId).session(session);
      if (inv) {
        inv.paidAmountPkr = Math.max(0, inv.paidAmountPkr - amt);
        await inv.save(session ? { session } : undefined);
      }
    }
    if (amt > 0) {
      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: `CHQ-BNC-${rec.recoveryCode}`,
        voucherType: 'RECOVERY',
        entries: [
          { accountCode: '1100', accountName: 'Accounts Receivable (Customers)', accountCategory: 'ASSET', partyType: 'CUSTOMER', partyId: rec.customerId, debitPkr: amt, creditPkr: 0, narration: `Cheque bounced reversal (${rec.chequeDetails?.chequeNo || rec.recoveryCode})` },
          { accountCode: '1030', accountName: 'Cheques in Hand', accountCategory: 'ASSET', debitPkr: 0, creditPkr: amt, narration: `Cheque bounced (${rec.recoveryCode})` },
        ],
        referenceModel: 'Recovery',
        referenceId: rec._id,
        preparedById: rec.collectedById,
        approvedById: req.user._id,
        session,
      });
    }
    await createNotificationIfAbsent({
      distributorId: req.distributorId,
      idempotencyKey: `CHQ_BOUNCED:${rec._id}`,
      recipientRole: 'ACCOUNTANT',
      alertCategory: 'CUSTOMER_OVERDUE',
      severity: 'CRITICAL',
      title: `Bounced Cheque: ${rec.chequeDetails?.chequeNo || rec.recoveryCode}`,
      message: `Cheque of PKR ${amt.toLocaleString()} bounced. Customer balance restored.`,
      referenceModel: 'Recovery',
      referenceId: rec._id,
      session,
    });
    return rec;
  }

  return null;
}

export const approveAccountMovement = asyncHandler(async (req, res) => {
  const { Recovery } = m();
  const { recoveryId, action = 'APPROVE' } = req.body;
  const targetId = req.params.id || recoveryId;
  if (!targetId) throw new AppError('Recovery / movement ID is required.', 400, 'ID_REQUIRED');

  const updated = await runWithTransaction(async (session) => {
    const rec = await Recovery.findOne({ _id: targetId, distributorId: req.distributorId }).session(session);
    if (!rec) throw new AppError('Recovery movement not found.', 404, 'MOVEMENT_NOT_FOUND');

    const chequeHandled = await handleChequeLifecycle(rec, action, req, session);
    if (chequeHandled) return chequeHandled;

    if (rec.status === 'APPROVED') throw new AppError('Movement is already approved.', 400, 'ALREADY_APPROVED');

    rec.status = 'APPROVED';
    rec.approvedById = req.user._id;
    rec.approvedAt = new Date();
    await rec.save(session ? { session } : undefined);

    const cash = Number(rec.cashAmountPkr) || 0;
    const online = Number(rec.onlineDetails?.amountPkr) || 0;
    const cheque = Number(rec.chequeDetails?.amountPkr) || 0;
    const total = cash + online + cheque || Number(rec.amountPkr) || 0;

    if (total > 0) {
      const entries = [];
      if (cash > 0) entries.push({ accountCode: '1010', accountName: 'Cash in Hand', accountCategory: 'ASSET', debitPkr: cash, creditPkr: 0, narration: `Approved cash ${rec.recoveryCode}` });
      if (online > 0) entries.push({ accountCode: '1020', accountName: 'Bank & Mobile Wallets', accountCategory: 'ASSET', debitPkr: online, creditPkr: 0, narration: `Approved online ${rec.recoveryCode}` });
      if (cheque > 0) entries.push({ accountCode: '1030', accountName: 'Cheques in Hand', accountCategory: 'ASSET', debitPkr: cheque, creditPkr: 0, narration: `Approved cheque ${rec.recoveryCode}` });
      if (entries.length === 0) entries.push({ accountCode: '1010', accountName: 'Cash in Hand', accountCategory: 'ASSET', debitPkr: total, creditPkr: 0, narration: `Approved ${rec.recoveryCode}` });

      entries.push({
        accountCode: '1100',
        accountName: 'Accounts Receivable (Customers)',
        accountCategory: 'ASSET',
        partyType: 'CUSTOMER',
        partyId: rec.customerId,
        debitPkr: 0,
        creditPkr: total,
        narration: `Customer settlement ${rec.recoveryCode}`,
      });

      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: rec.recoveryCode,
        voucherType: 'RECOVERY',
        entries,
        referenceModel: 'Recovery',
        referenceId: rec._id,
        preparedById: rec.collectedById,
        approvedById: req.user._id,
        session,
      });
    }

    return rec;
  });

  if (updated.customerId) await checkCustomerCreditAlert({ distributorId: req.distributorId, customerId: updated.customerId });
  res.status(200).json({ success: true, data: updated });
});

export const updateChequeStatus = asyncHandler(async (req, res, next) => {
  const statusMap = { DEPOSITED: 'DEPOSIT_CHEQUE', CLEARED: 'CLEAR_CHEQUE', BOUNCED: 'BOUNCE_CHEQUE' };
  const mappedAction = statusMap[String(req.body.status || '').toUpperCase()];
  if (!mappedAction) throw new AppError('Invalid cheque status. Use DEPOSITED, CLEARED, or BOUNCED.', 400, 'INVALID_STATUS');
  req.body.action = mappedAction;
  return approveAccountMovement(req, res, next);
});

export const listLedgers = asyncHandler(async (req, res) => {
  const { AccountLedger } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req, { defaultSortBy: 'transactionDate' });
  const extra = {};
  for (const key of ['voucherType', 'accountCode', 'accountCategory', 'partyType', 'partyId', 'status']) {
    if (req.query[key]) extra[key] = req.query[key];
  }
  if (req.query.startDate || req.query.endDate) {
    extra.transactionDate = {};
    if (req.query.startDate) extra.transactionDate.$gte = new Date(req.query.startDate);
    if (req.query.endDate) extra.transactionDate.$lte = new Date(req.query.endDate);
  }
  const filter = buildScopedFilter(req, extra, ['voucherNo', 'accountName', 'narration'], searchRegex);
  const [entries, totalRecords] = await Promise.all([
    AccountLedger.find(filter).sort(sort).skip(skip).limit(limit).populate('preparedById approvedById', 'fullName').lean(),
    AccountLedger.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: entries,
    chartOfAccounts: Object.values(CHART_OF_ACCOUNTS),
    pagination: buildPaginationMeta(totalRecords),
  });
});

export const createManualJournal = asyncHandler(async (req, res) => {
  const { voucherNo, voucherType = 'JOURNAL', transactionDate, entries = [] } = req.body;
  const posted = await runWithTransaction((session) =>
    postDoubleEntry({
      distributorId: req.distributorId,
      voucherNo,
      voucherType,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      entries,
      preparedById: req.user._id,
      approvedById: req.user._id,
      audit: { module: 'ACCOUNTING', action: 'MANUAL_JOURNAL' },
      session,
    })
  );
  res.status(201).json({ success: true, data: posted });
});

export const getTrialBalance = asyncHandler(async (req, res) => {
  const { AccountLedger } = m();
  const rows = await AccountLedger.aggregate([
    { $match: { distributorId: req.distributorId, status: 'APPROVED' } },
    { $group: { _id: { accountCode: '$accountCode', accountName: '$accountName', accountCategory: '$accountCategory' }, debitPkr: { $sum: '$debitPkr' }, creditPkr: { $sum: '$creditPkr' } } },
    { $sort: { '_id.accountCode': 1 } },
  ]);
  const formatted = rows.map((r) => ({ ...r._id, debitPkr: r.debitPkr, creditPkr: r.creditPkr }));
  const totalDebits = formatted.reduce((s, r) => s + r.debitPkr, 0);
  const totalCredits = formatted.reduce((s, r) => s + r.creditPkr, 0);
  res.status(200).json({ success: true, data: { rows: formatted, totalDebits, totalCredits, isBalanced: Math.abs(totalDebits - totalCredits) < 0.01 } });
});

export const getProfitAndLoss = asyncHandler(async (req, res) => {
  const { AccountLedger } = m();
  const rows = await AccountLedger.aggregate([
    { $match: { distributorId: req.distributorId, status: 'APPROVED', accountCategory: { $in: ['REVENUE', 'EXPENSE'] } } },
    { $group: { _id: { accountCode: '$accountCode', accountName: '$accountName', accountCategory: '$accountCategory' }, debitPkr: { $sum: '$debitPkr' }, creditPkr: { $sum: '$creditPkr' } } },
  ]);
  const revenueAccounts = [], expenseAccounts = [];
  let totalRevenue = 0, totalExpenses = 0;
  for (const r of rows) {
    if (r._id.accountCategory === 'REVENUE') {
      const net = r.creditPkr - r.debitPkr;
      revenueAccounts.push({ ...r._id, amountPkr: net });
      totalRevenue += net;
    } else {
      const net = r.debitPkr - r.creditPkr;
      expenseAccounts.push({ ...r._id, amountPkr: net });
      totalExpenses += net;
    }
  }
  res.status(200).json({ success: true, data: { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses, netProfitPkr: Number((totalRevenue - totalExpenses).toFixed(2)) } });
});

export const getBalanceSheet = asyncHandler(async (req, res) => {
  const { AccountLedger } = m();
  const rows = await AccountLedger.aggregate([
    { $match: { distributorId: req.distributorId, status: 'APPROVED' } },
    { $group: { _id: { accountCode: '$accountCode', accountName: '$accountName', accountCategory: '$accountCategory' }, debitPkr: { $sum: '$debitPkr' }, creditPkr: { $sum: '$creditPkr' } } },
  ]);
  const buckets = { ASSET: [], LIABILITY: [], EQUITY: [] };
  let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, retainedNetProfit = 0;
  for (const r of rows) {
    const cat = r._id.accountCategory;
    if (cat === 'ASSET') { const v = r.debitPkr - r.creditPkr; buckets.ASSET.push({ ...r._id, amountPkr: v }); totalAssets += v; }
    else if (cat === 'LIABILITY') { const v = r.creditPkr - r.debitPkr; buckets.LIABILITY.push({ ...r._id, amountPkr: v }); totalLiabilities += v; }
    else if (cat === 'EQUITY') { const v = r.creditPkr - r.debitPkr; buckets.EQUITY.push({ ...r._id, amountPkr: v }); totalEquity += v; }
    else if (cat === 'REVENUE') retainedNetProfit += r.creditPkr - r.debitPkr;
    else if (cat === 'EXPENSE') retainedNetProfit -= r.debitPkr - r.creditPkr;
  }
  res.status(200).json({
    success: true,
    data: {
      assets: buckets.ASSET,
      liabilities: buckets.LIABILITY,
      equity: [...buckets.EQUITY, { accountCode: '3999', accountName: 'Current Period Net Profit', amountPkr: retainedNetProfit }],
      totalAssets: Number(totalAssets.toFixed(2)),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      totalEquityAndProfit: Number((totalEquity + retainedNetProfit).toFixed(2)),
    },
  });
});

export const getCashFlow = asyncHandler(async (req, res) => {
  const { AccountLedger } = m();
  const cashFlows = await AccountLedger.aggregate([
    { $match: { distributorId: req.distributorId, status: 'APPROVED', accountCode: { $in: ['1010', '1020', '1030'] } } },
    { $group: { _id: '$voucherType', inflowPkr: { $sum: '$debitPkr' }, outflowPkr: { $sum: '$creditPkr' } } },
  ]);
  const totalInflow = cashFlows.reduce((s, c) => s + c.inflowPkr, 0);
  const totalOutflow = cashFlows.reduce((s, c) => s + c.outflowPkr, 0);
  res.status(200).json({ success: true, data: { breakdown: cashFlows, totalInflow, totalOutflow, netCashFlowPkr: Number((totalInflow - totalOutflow).toFixed(2)) } });
});
