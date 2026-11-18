import mongoose from 'mongoose';
import { cloudinaryImageSchema } from './shared.schemas.js';

const { Schema } = mongoose;

export const PRIMARY_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'BOOKER',
  'SALESMAN',
  'POS_OPERATOR',
  'WAREHOUSE_MANAGER',
  'STOREKEEPER',
  'ACCOUNTANT',
];

const workPartsSchema = new Schema(
  {
    orderBooker: { type: Boolean, default: false },
    warehouseManager: { type: Boolean, default: false },
    posStore: { type: Boolean, default: false },
    normalInvoice: { type: Boolean, default: false },
    advanceInvoice: { type: Boolean, default: false },
    salesman: { type: Boolean, default: false },
  },
  { _id: false }
);

const permissionsSchema = new Schema(
  {
    purchasePriceVisibility: { type: Boolean, default: false },
    canView: { type: Boolean, default: true },
    canCreate: { type: Boolean, default: true },
    canEdit: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: false },
    canSubmit: { type: Boolean, default: true },
    canApprove: { type: Boolean, default: false },
    canStockMovement: { type: Boolean, default: true },
    canPayment: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    distributorName: { type: String, trim: true, default: '' },
    profileId: { type: String, required: true, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    refreshTokenHash: { type: String, default: null },
    avatar: { type: cloudinaryImageSchema, default: () => ({}) },
    primaryRole: {
      type: String,
      enum: PRIMARY_ROLES,
      required: true,
      default: 'BOOKER',
    },
    workParts: { type: workPartsSchema, default: () => ({}) },
    permissions: { type: permissionsSchema, default: () => ({}) },
    linkedWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    assignedCompanyIds: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    assignedBrandIds: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
    basicSalaryPkr: { type: Number, default: 0, min: 0 },
    commissionPct: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
    },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  }
);

userSchema.index({ distributorId: 1, profileId: 1 }, { unique: true });
userSchema.index({ distributorId: 1, email: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ distributorId: 1, primaryRole: 1, status: 1 });
userSchema.index({ distributorId: 1, fullName: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');
export default User;
