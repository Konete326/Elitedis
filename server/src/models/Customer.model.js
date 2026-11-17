import mongoose from 'mongoose';
import {
  cloudinaryImageSchema,
  contactPersonSchema,
  gpsSchema,
  paymentAccountSchema,
} from './shared.schemas.js';

const { Schema } = mongoose;

const locationHierarchySchema = new Schema(
  {
    city: { type: String, trim: true, default: '' },
    townOrZone: { type: String, trim: true, default: '' },
    areaId: { type: Schema.Types.ObjectId, default: null },
    areaName: { type: String, trim: true, default: '' },
    routeId: { type: Schema.Types.ObjectId, default: null },
    routeName: { type: String, trim: true, default: '' },
    street: { type: String, trim: true, default: '' },
    pehchanRemarks: { type: String, trim: true, default: '' },
    mapLink: { type: String, trim: true, default: '' },
    gps: { type: gpsSchema, default: () => ({}) },
  },
  { _id: false }
);

const financialTermsSchema = new Schema(
  {
    paymentCondition: {
      type: String,
      enum: ['PAID_CASH', 'ALLOW_CREDIT', 'ADVANCE'],
      default: 'PAID_CASH',
    },
    creditLimitPkr: { type: Number, default: 0, min: 0 },
    creditDays: { type: Number, default: 0, min: 0 },
    outstandingBalancePkr: { type: Number, default: 0 },
  },
  { _id: false }
);

const commercialAssignmentsSchema = new Schema(
  {
    assignedBookerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    territoryId: { type: Schema.Types.ObjectId, ref: 'Territory', default: null },
    taxGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
    discountGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
    schemeGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
  },
  { _id: false }
);

const customerSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    customerCode: { type: String, required: true, trim: true, uppercase: true },
    shopName: { type: String, required: true, trim: true },
    shopPic: { type: cloudinaryImageSchema, default: () => ({}) },
    ownerName: { type: String, required: true, trim: true },
    ownerContact: { type: String, required: true, trim: true },
    customerType: {
      type: String,
      enum: ['WHOLESALER', 'RETAILER', 'SUB_DISTRIBUTOR', 'POS_WALKIN'],
      default: 'RETAILER',
    },
    shopCategory: { type: String, trim: true, default: 'General' },
    ntn: { type: String, trim: true, default: '' },
    registrationNo: { type: String, trim: true, default: '' },
    locationHierarchy: { type: locationHierarchySchema, default: () => ({}) },
    contacts: { type: [contactPersonSchema], default: [] },
    paymentAccounts: { type: [paymentAccountSchema], default: [] },
    financialTerms: { type: financialTermsSchema, default: () => ({}) },
    commercialAssignments: { type: commercialAssignmentsSchema, default: () => ({}) },
    visitPosition: {
      type: String,
      enum: ['NORMAL', 'VISITED', 'ORDERED', 'DELIVERED'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

customerSchema.index({ distributorId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ distributorId: 1, customerType: 1, status: 1 });
customerSchema.index({
  distributorId: 1,
  'locationHierarchy.areaId': 1,
  'locationHierarchy.routeId': 1,
});
customerSchema.index({ distributorId: 1, shopName: 1, ownerContact: 1 });

export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema, 'customers');
export default Customer;
