import mongoose from 'mongoose';
import { cloudinaryImageSchema } from './shared.schemas.js';

const { Schema } = mongoose;

const onlineDetailsSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'OTHER', ''],
      default: '',
    },
    transactionId: { type: String, trim: true, default: '' },
    amountPkr: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const chequeDetailsSchema = new Schema(
  {
    chequeNo: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    dueDate: { type: Date, default: null },
    amountPkr: { type: Number, default: 0, min: 0 },
    chequeStatus: {
      type: String,
      enum: ['PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const tripExpenseSchema = new Schema(
  {
    category: {
      type: String,
      enum: ['GAS_PETROL', 'MAINTENANCE_WORK', 'REFRESHMENT_ENJOYMENT', 'OTHER'],
      default: 'GAS_PETROL',
    },
    amountPkr: { type: Number, default: 0, min: 0 },
    remark: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const extraReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batchNo: { type: String, trim: true, uppercase: true, default: '' },
    unitName: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 0, min: 0 },
    ratePkr: { type: Number, default: 0, min: 0 },
    totalAmountPkr: { type: Number, default: 0, min: 0 },
    condition: {
      type: String,
      enum: ['NORMAL', 'DAMAGE', 'EXPIRE'],
      default: 'DAMAGE',
    },
    mfgDate: { type: Date, default: null },
    expDate: { type: Date, default: null },
    remark: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const recoverySchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    recoveryCode: { type: String, required: true, trim: true, uppercase: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    saleInvoiceId: { type: Schema.Types.ObjectId, ref: 'SaleInvoice', default: null },
    collectedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMode: {
      type: String,
      enum: ['CASH', 'ONLINE', 'CHEQUE', 'MIXED'],
      required: true,
    },
    amountPkr: { type: Number, required: true, default: 0, min: 0 },
    cashAmountPkr: { type: Number, default: 0, min: 0 },
    onlineDetails: { type: onlineDetailsSchema, default: () => ({}) },
    chequeDetails: { type: chequeDetailsSchema, default: () => ({}) },
    receiptImage: { type: cloudinaryImageSchema, default: () => ({}) },
    tripExpenses: { type: [tripExpenseSchema], default: [] },
    extraReturnItems: { type: [extraReturnItemSchema], default: [] },
    linkedTaskId: { type: Schema.Types.ObjectId, ref: 'PendingTask', default: null },
    status: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'BOUNCED'],
      default: 'PENDING_VERIFICATION',
    },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recoverySchema.index({ distributorId: 1, recoveryCode: 1 }, { unique: true });
recoverySchema.index({ distributorId: 1, customerId: 1, status: 1, createdAt: -1 });
recoverySchema.index({ distributorId: 1, collectedById: 1, paymentMode: 1 });
recoverySchema.index({
  distributorId: 1,
  'chequeDetails.chequeStatus': 1,
  'chequeDetails.dueDate': 1,
});

export const Recovery =
  mongoose.models.Recovery || mongoose.model('Recovery', recoverySchema, 'recoveries');
export default Recovery;
