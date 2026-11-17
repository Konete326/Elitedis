import mongoose from 'mongoose';
import {
  createGrandSummarySchema,
  createLineItemSchema,
} from './shared.schemas.js';

const { Schema } = mongoose;

const orderLineItemSchema = createLineItemSchema();
const orderGrandSummarySchema = createGrandSummarySchema();

const invoiceStyleSchema = new Schema(
  {
    layoutType: {
      type: String,
      enum: [
        'CHILLAN_FINANCE',
        'DETAILED_LANDSCAPE',
        'ADVANCE_INVOICE',
        'EXPIRY_BATCH_CHILLAN',
        'POS_RETAIL',
      ],
      default: 'CHILLAN_FINANCE',
    },
    originalAndDuplicate: { type: Boolean, default: false },
    selectedNotes: [{ type: String, trim: true }],
  },
  { _id: false }
);

const approvalInfoSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING',
        'APPROVED',
        'DELIVERY_ASSIGNED',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    orderCode: { type: String, required: true, trim: true, uppercase: true },
    orderMode: {
      type: String,
      enum: ['NORMAL', 'ADVANCE', 'POS'],
      default: 'NORMAL',
    },
    orderType: {
      type: String,
      enum: ['REGULAR', 'URGENT', 'SPECIAL', 'DISPATCH', 'CUSTOM_SALE'],
      default: 'REGULAR',
    },
    source: {
      type: String,
      enum: ['ONLINE', 'BOOKER', 'ADMIN', 'POS', 'WHATSAPP'],
      default: 'ADMIN',
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    bookerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    areaId: { type: Schema.Types.ObjectId, default: null },
    routeId: { type: Schema.Types.ObjectId, default: null },
    lineItems: { type: [orderLineItemSchema], default: [] },
    grandSummary: { type: orderGrandSummarySchema, default: () => ({}) },
    invoiceStyle: { type: invoiceStyleSchema, default: () => ({}) },
    approvalInfo: { type: approvalInfoSchema, default: () => ({}) },
    assignedSalesmanId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedStorekeeperId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dispatchSheetId: { type: Schema.Types.ObjectId, ref: 'DispatchSheet', default: null },
  },
  { timestamps: true }
);

orderSchema.index({ distributorId: 1, orderCode: 1 }, { unique: true });
orderSchema.index({ distributorId: 1, 'approvalInfo.status': 1, createdAt: -1 });
orderSchema.index({ distributorId: 1, customerId: 1, bookerId: 1 });
orderSchema.index({ distributorId: 1, source: 1, orderMode: 1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema, 'orders');
export default Order;
