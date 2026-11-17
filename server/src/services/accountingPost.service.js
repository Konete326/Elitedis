import { AccountLedger } from '../models/AccountLedger.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { AppError } from '../middlewares/errorMiddleware.js';

export const CHART_OF_ACCOUNTS = Object.freeze({
  CASH_IN_HAND: { code: '1010', name: 'Cash in Hand', category: 'ASSET' },
  BANK_WALLET: { code: '1020', name: 'Bank & Mobile Wallets', category: 'ASSET' },
  CHEQUES_IN_HAND: { code: '1030', name: 'Cheques in Hand', category: 'ASSET' },
  ACCOUNTS_RECEIVABLE: { code: '1100', name: 'Accounts Receivable (Customers)', category: 'ASSET' },
  INVENTORY_STOCK: { code: '1200', name: 'Inventory Stock', category: 'ASSET' },
  ACCOUNTS_PAYABLE: { code: '2010', name: 'Accounts Payable (Suppliers)', category: 'LIABILITY' },
  GST_PAYABLE: { code: '2020', name: 'Sales Tax / GST Payable', category: 'LIABILITY' },
  SALARIES_PAYABLE: { code: '2030', name: 'Salaries & Commissions Payable', category: 'LIABILITY' },
  OWNER_EQUITY: { code: '3010', name: 'Distributor Equity', category: 'EQUITY' },
  SALES_REVENUE: { code: '4010', name: 'Wholesale & Retail Sales', category: 'REVENUE' },
  SALES_RETURNS: { code: '4020', name: 'Sales Returns & Allowances', category: 'REVENUE' },
  COGS: { code: '5010', name: 'Cost of Goods Sold', category: 'EXPENSE' },
  DISCOUNTS_ALLOWED: { code: '5020', name: 'Trade Discounts Allowed', category: 'EXPENSE' },
  TRIP_EXPENSES: { code: '5030', name: 'Delivery & Trip Expenses', category: 'EXPENSE' },
  STOCK_DAMAGE_LOSS: { code: '5040', name: 'Stock Damage & Shortage Loss', category: 'EXPENSE' },
  SALARIES_EXPENSE: { code: '5050', name: 'Salaries & Commission Expense', category: 'EXPENSE' },
});

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Writes an immutable audit log entry for stock, order, or financial mutations.
 */
export async function recordAuditLog({
  distributorId,
  actorId = null,
  module,
  action,
  entityModel = '',
  entityId = null,
  beforeState = null,
  afterState = null,
  ipAddress = '',
  userAgent = '',
  session = null,
}) {
  const [created] = await AuditLog.create(
    [
      {
        distributorId,
        actorId,
        module,
        action,
        entityModel,
        entityId,
        beforeState,
        afterState,
        ipAddress,
        userAgent,
      },
    ],
    session ? { session } : {}
  );
  return created;
}

/**
 * Atomically posts a balanced double-entry journal voucher to AccountLedger and optionally logs an AuditLog.
 */
export async function postDoubleEntry({
  distributorId,
  voucherNo,
  voucherType,
  transactionDate = new Date(),
  entries = [],
  referenceModel = '',
  referenceId = null,
  preparedById = null,
  approvedById = null,
  status = 'APPROVED',
  audit = null,
  session = null,
}) {
  const normalizedEntries = entries
    .map((e) => ({
      ...e,
      debitPkr: round2(e.debitPkr || 0),
      creditPkr: round2(e.creditPkr || 0),
    }))
    .filter((e) => e.debitPkr > 0 || e.creditPkr > 0);

  if (normalizedEntries.length < 2) {
    throw new AppError('Double-entry voucher requires at least two non-zero lines.', 400, 'INVALID_JOURNAL_ENTRIES');
  }

  const totalDebit = round2(normalizedEntries.reduce((sum, e) => sum + e.debitPkr, 0));
  const totalCredit = round2(normalizedEntries.reduce((sum, e) => sum + e.creditPkr, 0));

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new AppError(
      `Unbalanced double-entry voucher (${voucherNo}): Debits (${totalDebit}) !== Credits (${totalCredit}).`,
      400,
      'UNBALANCED_JOURNAL'
    );
  }

  const generatedVoucherNo =
    voucherNo || `VCH-${voucherType.slice(0, 3)}-${Date.now().toString().slice(-7)}`;

  const docs = [];
  for (const line of normalizedEntries) {
    const prev = await AccountLedger.findOne({ distributorId, accountCode: line.accountCode, status: 'APPROVED' })
      .sort({ transactionDate: -1, createdAt: -1 })
      .select('runningBalancePkr')
      .session(session)
      .lean();

    const prevBal = Number(prev?.runningBalancePkr) || 0;
    const isDebitNormal = line.accountCategory === 'ASSET' || line.accountCategory === 'EXPENSE';
    const delta = isDebitNormal ? line.debitPkr - line.creditPkr : line.creditPkr - line.debitPkr;

    docs.push({
      distributorId,
      voucherNo: generatedVoucherNo,
      voucherType,
      transactionDate,
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountCategory: line.accountCategory,
      partyType: line.partyType || 'NONE',
      partyId: line.partyId || null,
      debitPkr: line.debitPkr,
      creditPkr: line.creditPkr,
      runningBalancePkr: round2(prevBal + delta),
      narration: line.narration || '',
      referenceModel,
      referenceId,
      preparedById,
      approvedById,
      status,
    });
  }

  const inserted = await AccountLedger.insertMany(docs, session ? { session } : {});

  if (audit) {
    await recordAuditLog({
      distributorId,
      actorId: approvedById || preparedById,
      module: audit.module || 'ACCOUNTING',
      action: audit.action || voucherType,
      entityModel: referenceModel || 'AccountLedger',
      entityId: referenceId || inserted[0]?._id,
      beforeState: audit.beforeState || null,
      afterState: audit.afterState || { voucherNo: generatedVoucherNo, totalDebit, totalCredit },
      ipAddress: audit.ipAddress || '',
      session,
    });
  }

  return { voucherNo: generatedVoucherNo, entries: inserted, totalDebit, totalCredit };
}

/**
 * Convenience helper: posts Sale Invoice revenue, tax, and AR/Cash entries.
 */
export async function postSaleVoucher({ distributorId, invoice, actorId, session = null }) {
  const net = round2(invoice.grandSummary?.netPayableAmount || 0);
  const tax = round2(
    (invoice.grandSummary?.grandTaxAmount || 0) +
      (invoice.lineItems || []).reduce((s, li) => s + (li.itemTaxAmount || 0), 0)
  );
  const revenue = round2(Math.max(0, net - tax));
  if (net <= 0) return null;

  const paid = round2(invoice.paidAmountPkr || 0);
  const creditPart = round2(Math.max(0, net - paid));

  const entries = [];
  if (paid > 0) {
    entries.push({
      accountCode: CHART_OF_ACCOUNTS.CASH_IN_HAND.code,
      accountName: CHART_OF_ACCOUNTS.CASH_IN_HAND.name,
      accountCategory: 'ASSET',
      partyType: invoice.customerId ? 'CUSTOMER' : 'NONE',
      partyId: invoice.customerId || null,
      debitPkr: paid,
      creditPkr: 0,
      narration: `Cash received on Invoice ${invoice.invoiceNo}`,
    });
  }
  if (creditPart > 0) {
    entries.push({
      accountCode: CHART_OF_ACCOUNTS.ACCOUNTS_RECEIVABLE.code,
      accountName: CHART_OF_ACCOUNTS.ACCOUNTS_RECEIVABLE.name,
      accountCategory: 'ASSET',
      partyType: invoice.customerId ? 'CUSTOMER' : 'NONE',
      partyId: invoice.customerId || null,
      debitPkr: creditPart,
      creditPkr: 0,
      narration: `Credit receivable on Invoice ${invoice.invoiceNo}`,
    });
  }
  if (revenue > 0) {
    entries.push({
      accountCode: CHART_OF_ACCOUNTS.SALES_REVENUE.code,
      accountName: CHART_OF_ACCOUNTS.SALES_REVENUE.name,
      accountCategory: 'REVENUE',
      partyType: invoice.customerId ? 'CUSTOMER' : 'NONE',
      partyId: invoice.customerId || null,
      debitPkr: 0,
      creditPkr: revenue,
      narration: `Sales revenue for Invoice ${invoice.invoiceNo}`,
    });
  }
  if (tax > 0) {
    entries.push({
      accountCode: CHART_OF_ACCOUNTS.GST_PAYABLE.code,
      accountName: CHART_OF_ACCOUNTS.GST_PAYABLE.name,
      accountCategory: 'LIABILITY',
      debitPkr: 0,
      creditPkr: tax,
      narration: `GST payable on Invoice ${invoice.invoiceNo}`,
    });
  }

  return postDoubleEntry({
    distributorId,
    voucherNo: `INV-${invoice.invoiceNo}`,
    voucherType: 'SALE',
    entries,
    referenceModel: 'SaleInvoice',
    referenceId: invoice._id,
    preparedById: actorId,
    approvedById: actorId,
    session,
  });
}

export default { CHART_OF_ACCOUNTS, recordAuditLog, postDoubleEntry, postSaleVoucher };
