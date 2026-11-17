import mongoose from 'mongoose';

const { Schema } = mongoose;

const vehicleInfoSchema = new Schema(
  {
    vehicleNo: { type: String, trim: true, uppercase: true, default: '' },
    driverName: { type: String, trim: true, default: '' },
    driverPhone: { type: String, trim: true, default: '' },
    capacityKg: { type: Number, default: 0, min: 0 },
    capacityVolumeCubic: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const extraDispatchItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', default: null },
    unitName: { type: String, required: true, trim: true },
    dispatchedQty: { type: Number, required: true, default: 0, min: 0 },
    soldQty: { type: Number, default: 0, min: 0 },
    returnedQty: { type: Number, default: 0, min: 0 },
    unitRate: { type: Number, default: 0, min: 0 },
    unitWeightKg: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const dispatchSheetSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    dispatchCode: { type: String, required: true, trim: true, uppercase: true },
    salesmanId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storekeeperId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    recoveryPersonId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    vehicleInfo: { type: vehicleInfoSchema, default: () => ({}) },
    orderIds: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    recoveryInvoiceIds: [{ type: Schema.Types.ObjectId, ref: 'SaleInvoice' }],
    extraDispatchItems: { type: [extraDispatchItemSchema], default: [] },
    totalWeightKg: { type: Number, default: 0, min: 0 },
    totalVolumeCubic: { type: Number, default: 0, min: 0 },
    totalLoadValuePkr: { type: Number, default: 0, min: 0 },
    linkedTaskIds: [{ type: Schema.Types.ObjectId, ref: 'PendingTask' }],
    status: {
      type: String,
      enum: ['PLANNED', 'PICKING', 'DISPATCHED', 'IN_TRANSIT', 'SETTLED', 'CANCELLED'],
      default: 'PLANNED',
    },
    dispatchedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dispatchSheetSchema.index({ distributorId: 1, dispatchCode: 1 }, { unique: true });
dispatchSheetSchema.index({ distributorId: 1, salesmanId: 1, status: 1, createdAt: -1 });
dispatchSheetSchema.index({ distributorId: 1, storekeeperId: 1, status: 1 });

export const DispatchSheet =
  mongoose.models.DispatchSheet ||
  mongoose.model('DispatchSheet', dispatchSheetSchema, 'dispatch_sheets');
export default DispatchSheet;
