import mongoose from 'mongoose';
import {
  cloudinaryImageSchema,
  contactPersonSchema,
  socialLinkSchema,
} from './shared.schemas.js';

const { Schema } = mongoose;

const brandSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    brandCode: { type: String, required: true, trim: true, uppercase: true },
    brandName: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    brandType: { type: String, trim: true, default: '' },
    logo: { type: cloudinaryImageSchema, default: () => ({}) },
    coverImage: { type: cloudinaryImageSchema, default: () => ({}) },
    ownerName: { type: String, trim: true, default: '' },
    brandManager: { type: String, trim: true, default: '' },
    salesManager: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    contacts: { type: [contactPersonSchema], default: [] },
    socialLinks: { type: [socialLinkSchema], default: [] },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

brandSchema.index({ distributorId: 1, brandCode: 1 }, { unique: true });
brandSchema.index({ distributorId: 1, companyId: 1, status: 1 });
brandSchema.index({ distributorId: 1, brandName: 1 });

export const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema, 'brands');
export default Brand;
