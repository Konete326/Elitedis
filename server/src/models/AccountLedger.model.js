import mongoose from 'mongoose';

const { Schema } = mongoose;

const accountLedgerSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    voucherNo: { type: String, required: true, trim: true, uppercase: true },
    voucherType: {
      type: String,
      enum: [
        'SALE',
        'PURCHASE',
        'RECOVERY',
        'PAYMENT',
        'EXPENSE',
        'STOCK_ADJUSTMENT',
        'RETURN',
        'PAYROLL',
        'JOURNAL',
      ],
      required: true,
    },
    transactionDate: { type: Date, required: true, default: Date.now },
    accountCode: { type: String, required: true, trim: true, uppercase: true },
    accountName: { type: String, required: true, trim: true },
    accountCategory: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      required: true,
    },
    partyType: {
      type: String,
      enum: ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'INTERNAL', 'NONE'],
      default: 'NONE',
    },
    partyId: { type: Schema.Types.ObjectId, default: null },
    debitPkr: { type: Number, required: true, default: 0, min: 0 },
    creditPkr: { type: Number, required: true, default: 0, min: 0 },
    runningBalancePkr: { type: Number, default: 0 },
    narration: { type: String, trim: true, default: '' },
    referenceModel: { type: String, trim: true, default: '' },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    preparedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REVERSED'],
      default: 'APPROVED',
    },
  },
  { timestamps: true }
);

accountLedgerSchema.index({ distributorId: 1, voucherNo: 1, accountCode: 1 });
accountLedgerSchema.index({
  distributorId: 1,
  accountCategory: 1,
  accountCode: 1,
  transactionDate: -1,
});
accountLedgerSchema.index({ distributorId: 1, partyType: 1, partyId: 1, transactionDate: -1 });
accountLedgerSchema.index({ distributorId: 1, status: 1, transactionDate: -1 });

export const AccountLedger =
  mongoose.models.AccountLedger ||
  mongoose.model('AccountLedger', accountLedgerSchema, 'account_ledgers');
export default AccountLedger;
