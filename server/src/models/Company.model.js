import mongoose from 'mongoose';
import {
  cloudinaryImageSchema,
  contactPersonSchema,
  gpsSchema,
  paymentAccountSchema,
  socialLinkSchema,
} from './shared.schemas.js';

const { Schema } = mongoose;

const companyAddressSchema = new Schema(
  {
    country: { type: String, trim: true, default: 'PAKISTAN' },
    province: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    zone: { type: String, trim: true, default: '' },
    streetAddress: { type: String, trim: true, default: '' },
    mapLink: { type: String, trim: true, default: '' },
    gps: { type: gpsSchema, default: () => ({}) },
  },
  { _id: false }
);

const companySchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    companyCode: { type: String, required: true, trim: true, uppercase: true },
    companyName: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    logo: { type: cloudinaryImageSchema, default: () => ({}) },
    ownerName: { type: String, trim: true, default: '' },
    supplierName: { type: String, trim: true, default: '' },
    accountantName: { type: String, trim: true, default: '' },
    businessType: {
      type: String,
      enum: ['MANUFACTURER', 'IMPORTER', 'DISTRIBUTOR', 'SUPPLIER'],
      default: 'MANUFACTURER',
    },
    industryType: { type: String, trim: true, default: '' },
    establishYear: { type: Number, default: null },
    ntn: { type: String, trim: true, default: '' },
    registrationNo: { type: String, trim: true, default: '' },
    copyrightText: { type: String, trim: true, default: '' },
    address: { type: companyAddressSchema, default: () => ({}) },
    contacts: { type: [contactPersonSchema], default: [] },
    socialLinks: { type: [socialLinkSchema], default: [] },
    bankAccounts: { type: [paymentAccountSchema], default: [] },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

companySchema.index({ distributorId: 1, companyCode: 1 }, { unique: true });
companySchema.index({ distributorId: 1, companyName: 1 });
companySchema.index({ distributorId: 1, status: 1, createdAt: -1 });

export const Company =
  mongoose.models.Company || mongoose.model('Company', companySchema, 'companies');
export default Company;
