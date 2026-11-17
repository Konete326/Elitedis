import mongoose from 'mongoose';

const { Schema } = mongoose;

const checklistItemSchema = new Schema(
  {
    itemLabel: { type: String, trim: true, default: '' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', default: null },
    zoneId: { type: Schema.Types.ObjectId, default: null },
    areaId: { type: Schema.Types.ObjectId, default: null },
    unitName: { type: String, trim: true, default: '' },
    expectedQty: { type: Number, default: 0, min: 0 },
    verifiedQty: { type: Number, default: 0, min: 0 },
    missingQty: { type: Number, default: 0, min: 0 },
    damagedQty: { type: Number, default: 0, min: 0 },
    isChecked: { type: Boolean, default: false },
    remark: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const pendingTaskSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    taskCode: { type: String, required: true, trim: true, uppercase: true },
    taskType: {
      type: String,
      enum: [
        'DELIVERY_DISPATCH',
        'PAYMENT_RECOVERY',
        'RETURN_PUT_AWAY',
        'WAREHOUSE_TRANSFER',
        'EXPIRY_QUARANTINE',
        'PURCHASE_PUT_AWAY',
        'PHYSICAL_STOCK_COUNT',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['URGENT', 'NORMAL'],
      default: 'NORMAL',
    },
    assignedToId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    referenceModel: { type: String, trim: true, default: '' },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    checklistItems: { type: [checklistItemSchema], default: [] },
    dueAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['FRESH', 'DRAFT', 'PENDING', 'COMPLETE', 'CANCELLED'],
      default: 'FRESH',
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pendingTaskSchema.index({ distributorId: 1, taskCode: 1 }, { unique: true });
pendingTaskSchema.index({ distributorId: 1, assignedToId: 1, status: 1, dueAt: 1 });
pendingTaskSchema.index({ distributorId: 1, taskType: 1, status: 1, createdAt: -1 });
pendingTaskSchema.index({ distributorId: 1, referenceModel: 1, referenceId: 1 });

export const PendingTask =
  mongoose.models.PendingTask ||
  mongoose.model('PendingTask', pendingTaskSchema, 'pending_tasks');
export default PendingTask;
