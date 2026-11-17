import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    recipientRole: { type: String, trim: true, default: '' },
    alertCategory: {
      type: String,
      enum: [
        'LOW_STOCK',
        'EXPIRY_WARNING',
        'PENDING_ORDER_APPROVAL',
        'CUSTOMER_OVERDUE',
        'SUPPLIER_DUE',
        'TASK_DEADLINE',
        'INVOICE_MODIFIED',
        'AUTO_PURCHASE_DRAFT',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    referenceModel: { type: String, trim: true, default: '' },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    idempotencyKey: { type: String, trim: true, default: '' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ distributorId: 1, recipientUserId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ distributorId: 1, alertCategory: 1, severity: 1, createdAt: -1 });
notificationSchema.index({ distributorId: 1, idempotencyKey: 1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema, 'notifications');
export default Notification;
