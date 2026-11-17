import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
    module: { type: String, required: true, trim: true, immutable: true },
    action: { type: String, required: true, trim: true, immutable: true },
    entityModel: { type: String, trim: true, default: '', immutable: true },
    entityId: { type: Schema.Types.ObjectId, default: null, immutable: true },
    beforeState: { type: Schema.Types.Mixed, default: null, immutable: true },
    afterState: { type: Schema.Types.Mixed, default: null, immutable: true },
    ipAddress: { type: String, trim: true, default: '', immutable: true },
    userAgent: { type: String, trim: true, default: '', immutable: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ distributorId: 1, module: 1, createdAt: -1 });
auditLogSchema.index({ distributorId: 1, actorId: 1, createdAt: -1 });
auditLogSchema.index({ distributorId: 1, entityId: 1, createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
export default AuditLog;
