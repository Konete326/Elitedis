import mongoose from 'mongoose';
import { cloudinaryImageSchema } from './shared.schemas.js';

const { Schema } = mongoose;

const businessProfileSchema = new Schema(
  {
    companyTitle: { type: String, trim: true, default: '' },
    tagline: { type: String, trim: true, default: '' },
    logo: { type: cloudinaryImageSchema, default: () => ({}) },
    phonePrimary: { type: String, trim: true, default: '' },
    phoneSecondary: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    website: { type: String, trim: true, default: '' },
    ntn: { type: String, trim: true, default: '' },
    strn: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    fullAddress: { type: String, trim: true, default: '' },
    headerNote: { type: String, trim: true, default: '' },
    footerNote: { type: String, trim: true, default: '' },
    urduHeaderTitle: { type: String, trim: true, default: '' },
    showLogo: { type: Boolean, default: true },
    showUrduLabels: { type: Boolean, default: false },
  },
  { _id: false }
);

const customStockConditionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    mappedSystemCondition: {
      type: String,
      enum: ['FRESH', 'NORMAL', 'DAMAGE', 'EXPIRE'],
      default: 'NORMAL',
    },
  },
  { _id: false }
);

const distributorSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true, uppercase: true },
    distributorName: { type: String, required: true, trim: true },
    ownerName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    whatsappNo: { type: String, trim: true, default: '' },
    mongodbUri: { type: String, trim: true, default: '', select: false },
    businessProfile: { type: businessProfileSchema, default: () => ({}) },
    stockIssuePolicy: { type: String, enum: ['FIFO', 'FEFO', 'MANUAL'], default: 'FEFO' },
    customStockConditions: { type: [customStockConditionSchema], default: [] },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingSkipped: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.mongodbUri;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.mongodbUri;
        return ret;
      },
    },
  }
);

distributorSchema.index({ distributorId: 1 }, { unique: true });
distributorSchema.index({ distributorId: 1, status: 1 });
distributorSchema.index({ status: 1, createdAt: -1 });
distributorSchema.index({ email: 1 });

export const Distributor =
  mongoose.models.Distributor ||
  mongoose.model('Distributor', distributorSchema, 'distributors');
export const DistributorPolicy = Distributor;
export default Distributor;
