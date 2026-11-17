import mongoose from 'mongoose';
import {
  createGrandSummarySchema,
  createLineItemSchema,
} from './shared.schemas.js';

const { Schema } = mongoose;

const saleLineItemSchema = createLineItemSchema({
  deliveredQty: { type: Number, default: 0, min: 0 },
  returnedQty: { type: Number, default: 0, min: 0 },
  damagedQty: { type: Number, default: 0, min: 0 },
  unitCostPkr: { type: Number, default: 0, min: 0 },
});

const saleGrandSummarySchema = createGrandSummarySchema({
  totalCostPkr: { type: Number, default: 0, min: 0 },
  grossProfitPkr: { type: Number, default: 0 },
});

const onSpotModificationSchema = new Schema(
  {
    modifiedAt: { type: Date, default: Date.now },
    modifiedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actionType: {
      type: String,
      enum: [
        'QTY_REDUCE',
        'ITEM_CANCEL',
        'RATE_EDIT',
        'EXTRA_ITEM_ADD',
        'EXTRA_RETURN',
        'GRAND_DISCOUNT',
        'ORDER_CANCEL',
      ],
      required: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    deltaQty: { type: Number, default: 0 },
    deltaAmountPkr: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const saleInvoiceSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    invoiceNo: { type: String, required: true, trim: true, uppercase: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    dispatchSheetId: { type: Schema.Types.ObjectId, ref: 'DispatchSheet', default: null },
    invoiceMode: {
      type: String,
      enum: ['NORMAL', 'ADVANCE', 'POS_RETAIL', 'POS_WHOLESALE', 'CUSTOM_SALE'],
      default: 'NORMAL',
    },
    source: {
      type: String,
      enum: ['ADMIN', 'BOOKER', 'POS', 'SALESMAN', 'ONLINE'],
      default: 'ADMIN',
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    walkInCustomerName: { type: String, trim: true, default: '' },
    salesmanId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lineItems: { type: [saleLineItemSchema], default: [] },
    onSpotModifications: { type: [onSpotModificationSchema], default: [] },
    grandSummary: { type: saleGrandSummarySchema, default: () => ({}) },
    paidAmountPkr: { type: Number, default: 0, min: 0 },
    balanceDuePkr: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIAL', 'CREDIT', 'OVERDUE'],
      default: 'CREDIT',
    },
    status: {
      type: String,
      enum: ['ISSUED', 'MODIFIED', 'DELIVERED', 'RETURNED', 'CANCELLED'],
      default: 'ISSUED',
    },
  },
  { timestamps: true }
);

saleInvoiceSchema.pre('save', function () {
  const netPayable = Number(this.grandSummary?.netPayableAmount) || 0;
  const paid = Math.max(0, Number(this.paidAmountPkr) || 0);
  this.paidAmountPkr = paid;
  this.balanceDuePkr = Math.max(0, Number((netPayable - paid).toFixed(2)));

  if (this.paymentStatus !== 'OVERDUE') {
    if (this.balanceDuePkr <= 0 && netPayable > 0) {
      this.paymentStatus = 'PAID';
    } else if (paid > 0 && this.balanceDuePkr > 0) {
      this.paymentStatus = 'PARTIAL';
    } else if (paid === 0 && netPayable > 0) {
      this.paymentStatus = 'CREDIT';
    }
  }
});

saleInvoiceSchema.index({ distributorId: 1, invoiceNo: 1 }, { unique: true });
saleInvoiceSchema.index({ distributorId: 1, customerId: 1, paymentStatus: 1, createdAt: -1 });
saleInvoiceSchema.index({ distributorId: 1, salesmanId: 1, status: 1 });
saleInvoiceSchema.index({ distributorId: 1, invoiceMode: 1, createdAt: -1 });

export const SaleInvoice =
  mongoose.models.SaleInvoice ||
  mongoose.model('SaleInvoice', saleInvoiceSchema, 'sale_invoices');
export default SaleInvoice;
