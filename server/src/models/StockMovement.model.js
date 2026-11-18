import mongoose from 'mongoose';

const { Schema } = mongoose;

const movementItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', default: null },
    batchNo: { type: String, trim: true, uppercase: true, default: '' },
    fromZoneId: { type: Schema.Types.ObjectId, default: null },
    fromAreaId: { type: Schema.Types.ObjectId, default: null },
    toZoneId: { type: Schema.Types.ObjectId, default: null },
    toAreaId: { type: Schema.Types.ObjectId, default: null },
    mfgDate: { type: Date, default: null },
    expDate: { type: Date, default: null },
    unitName: { type: String, trim: true, default: '' },
    systemBaseQty: { type: Number, default: 0, min: 0 },
    previousErpBaseQty: { type: Number, default: 0, min: 0 },
    physicalCountBaseQty: { type: Number, default: 0, min: 0 },
    differenceBaseQty: { type: Number, default: 0 },
    updatedBalanceBaseQty: { type: Number, default: 0, min: 0 },
    missingBaseQty: { type: Number, default: 0, min: 0 },
    damagedBaseQty: { type: Number, default: 0, min: 0 },
    movedPackQty: { type: Number, default: 0, min: 0 },
    movedBaseQty: { type: Number, default: 0, min: 0 },
    totalWeightKg: { type: Number, default: 0, min: 0 },
    totalValuePkr: { type: Number, default: 0, min: 0 },
    lineDecision: {
      type: String,
      enum: ['ACCEPT', 'NON_ACCEPT'],
      default: 'ACCEPT',
    },
  },
  { _id: true }
);

const stockMovementSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    movementCode: { type: String, required: true, trim: true, uppercase: true },
    movementType: {
      type: String,
      enum: [
        'TRANSFER',
        'SAME_TRANSFER',
        'ADJUSTMENT',
        'PURCHASE',
        'EXPIRY_DAMAGE_BACK',
        'DELIVERY_OUT',
        'CUSTOMER_RETURN',
      ],
      required: true,
    },
    taskName: { type: String, trim: true, default: '' },
    fromWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    preparedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dispatchedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    items: { type: [movementItemSchema], default: [] },
    linkedTaskId: { type: Schema.Types.ObjectId, ref: 'PendingTask', default: null },
    notes: { type: String, trim: true, default: '' },
    isHidden: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

stockMovementSchema.index({ distributorId: 1, movementCode: 1 }, { unique: true });
stockMovementSchema.index({ distributorId: 1, movementType: 1, status: 1, createdAt: -1 });
stockMovementSchema.index({ distributorId: 1, fromWarehouseId: 1, toWarehouseId: 1 });
stockMovementSchema.index({ distributorId: 1, isHidden: 1, createdAt: -1 });

export const StockMovement =
  mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema, 'stock_movements');
export default StockMovement;
