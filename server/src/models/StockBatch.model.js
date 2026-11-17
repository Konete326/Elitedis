import mongoose from 'mongoose';

const { Schema } = mongoose;

const thresholdsSchema = new Schema(
  {
    minStockPack: { type: Number, default: 0, min: 0 },
    maxStockPack: { type: Number, default: 0, min: 0 },
    expiryAlertDays: { type: Number, default: 90, min: 0 },
  },
  { _id: false }
);

const stockBatchSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    batchNo: { type: String, required: true, trim: true, uppercase: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    zoneId: { type: Schema.Types.ObjectId, required: true },
    areaId: { type: Schema.Types.ObjectId, required: true },
    mfgDate: { type: Date, default: null },
    expDate: { type: Date, default: null },
    purchaseRatePerBase: { type: Number, default: 0, min: 0 },
    purchaseRatePerPack: { type: Number, default: 0, min: 0 },
    currentBaseQty: { type: Number, required: true, default: 0, min: 0 },
    reservedBaseQty: { type: Number, required: true, default: 0, min: 0 },
    availableBaseQty: { type: Number, required: true, default: 0, min: 0 },
    totalWeightKg: { type: Number, default: 0, min: 0 },
    totalStockValuePkr: { type: Number, default: 0, min: 0 },
    condition: {
      type: String,
      enum: ['NORMAL', 'DAMAGE', 'EXPIRE', 'DAMAGE_EXPIRE'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'LOW_WARNING', 'OUT', 'BLOCKED', 'QUARANTINED'],
      default: 'AVAILABLE',
    },
    thresholds: { type: thresholdsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

stockBatchSchema.pre('save', function () {
  const current = Math.max(0, Number(this.currentBaseQty) || 0);
  const reserved = Math.max(0, Number(this.reservedBaseQty) || 0);
  this.currentBaseQty = current;
  this.reservedBaseQty = reserved;
  this.availableBaseQty = Math.max(0, current - reserved);

  if (
    this.purchaseRatePerBase > 0 &&
    (this.isModified('currentBaseQty') || this.isModified('purchaseRatePerBase'))
  ) {
    this.totalStockValuePkr = Number((current * this.purchaseRatePerBase).toFixed(2));
  }

  if (current <= 0 && this.status !== 'BLOCKED' && this.status !== 'QUARANTINED') {
    this.status = 'OUT';
  }
});

stockBatchSchema.index(
  { distributorId: 1, batchNo: 1, productId: 1, warehouseId: 1, areaId: 1 },
  { unique: true }
);
stockBatchSchema.index({ distributorId: 1, productId: 1, status: 1, expDate: 1 });
stockBatchSchema.index({ distributorId: 1, warehouseId: 1, zoneId: 1, areaId: 1 });
stockBatchSchema.index({ distributorId: 1, condition: 1, status: 1 });

export const StockBatch =
  mongoose.models.StockBatch || mongoose.model('StockBatch', stockBatchSchema, 'stock_batches');
export default StockBatch;
