import mongoose from 'mongoose';
import { gpsSchema } from './shared.schemas.js';

const { Schema } = mongoose;

const routeSchema = new Schema(
  {
    routeCode: { type: String, required: true, trim: true, uppercase: true },
    routeName: { type: String, required: true, trim: true },
    routeType: { type: String, trim: true, default: 'Main Road' },
    mapLink: { type: String, trim: true, default: '' },
    gps: { type: gpsSchema, default: () => ({}) },
    description: { type: String, trim: true, default: '' },
    isAccepted: { type: Boolean, default: true },
  },
  { _id: true }
);

const territoryAreaSchema = new Schema(
  {
    areaCode: { type: String, required: true, trim: true, uppercase: true },
    areaName: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: '' },
    subDistrict: { type: String, trim: true, default: '' },
    areaType: {
      type: String,
      enum: ['MARKET', 'MALL', 'SHOPS', 'FACTORY'],
      default: 'MARKET',
    },
    mapLink: { type: String, trim: true, default: '' },
    gps: { type: gpsSchema, default: () => ({}) },
    description: { type: String, trim: true, default: '' },
    routes: { type: [routeSchema], default: [] },
  },
  { _id: true }
);

const territorySchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    territoryCode: { type: String, required: true, trim: true, uppercase: true },
    territoryName: { type: String, required: true, trim: true },
    territoryType: {
      type: String,
      enum: ['BRAND_WISE', 'WAREHOUSE_WISE', 'DISTRICT_WISE', 'BOOKER_WISE'],
      default: 'DISTRICT_WISE',
    },
    linkedBrandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
    linkedWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    linkedBookerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    areas: { type: [territoryAreaSchema], default: [] },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

territorySchema.index({ distributorId: 1, territoryCode: 1 }, { unique: true });
territorySchema.index({ distributorId: 1, territoryType: 1, status: 1 });
territorySchema.index({ distributorId: 1, linkedBookerId: 1, linkedBrandId: 1 });

export const Territory =
  mongoose.models.Territory || mongoose.model('Territory', territorySchema, 'territories');
export default Territory;
