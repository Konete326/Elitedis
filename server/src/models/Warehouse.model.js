import mongoose from 'mongoose';
import {
  contactPersonSchema,
  dimensionsSchema,
  gpsSchema,
  syncAreaAndVolume,
} from './shared.schemas.js';

const { Schema } = mongoose;

const zoneDimensionsSchema = new Schema(
  {
    sizeUnit: { type: String, enum: ['Inch', 'Feet', 'cm'], default: 'Feet' },
    width: { type: Number, default: 0, min: 0 },
    length: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    totalArea: { type: Number, default: 0, min: 0 },
    totalVolume: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const allowedProductSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    minQtyPacking: { type: Number, default: 0, min: 0 },
    maxQtyPacking: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const areaSchema = new Schema(
  {
    areaCode: { type: String, required: true, trim: true, uppercase: true },
    areaName: { type: String, required: true, trim: true },
    areaType: {
      type: String,
      enum: ['FLOOR', 'RACK', 'WALKED'],
      default: 'FLOOR',
    },
    storagePurpose: {
      type: String,
      enum: ['NORMAL', 'DAMAGE', 'MIX', 'EXPIRY'],
      default: 'NORMAL',
    },
    condition: {
      type: String,
      enum: ['NORMAL', 'FREEZE', 'TEMPERATURE'],
      default: 'NORMAL',
    },
    dimensions: { type: dimensionsSchema, default: () => ({ sizeUnit: 'Feet' }) },
    allowedProducts: { type: [allowedProductSchema], default: [] },
  },
  { _id: true }
);

const zoneSchema = new Schema(
  {
    zoneCode: { type: String, required: true, trim: true, uppercase: true },
    zoneName: { type: String, required: true, trim: true },
    zoneType: {
      type: String,
      enum: ['NORMAL', 'MIX', 'TEMPERATURE', 'COLD_STORE'],
      default: 'NORMAL',
    },
    storageType: {
      type: String,
      enum: ['NORMAL', 'DAMAGE', 'MIX', 'EXPIRY'],
      default: 'NORMAL',
    },
    condition: {
      type: String,
      enum: ['NORMAL', 'FREEZE', 'TEMPERATURE'],
      default: 'NORMAL',
    },
    dimensions: { type: zoneDimensionsSchema, default: () => ({}) },
    areas: { type: [areaSchema], default: [] },
  },
  { _id: true }
);

const warehouseAddressSchema = new Schema(
  {
    country: { type: String, trim: true, default: 'PAKISTAN' },
    province: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    zone: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    fullAddress: { type: String, trim: true, default: '' },
    mapLink: { type: String, trim: true, default: '' },
    gps: { type: gpsSchema, default: () => ({}) },
  },
  { _id: false }
);

const warehouseSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    warehouseCode: { type: String, required: true, trim: true, uppercase: true },
    warehouseName: { type: String, required: true, trim: true },
    warehouseType: {
      type: String,
      enum: ['MAIN', 'SHOP', 'SUB_STORE'],
      default: 'MAIN',
    },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    address: { type: warehouseAddressSchema, default: () => ({}) },
    staffContacts: { type: [contactPersonSchema], default: [] },
    zones: { type: [zoneSchema], default: [] },
    utilizationPct: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

warehouseSchema.pre('save', function () {
  for (const zone of this.zones || []) {
    syncAreaAndVolume(zone.dimensions);
    for (const area of zone.areas || []) {
      syncAreaAndVolume(area.dimensions);
    }
  }
});

warehouseSchema.index({ distributorId: 1, warehouseCode: 1 }, { unique: true });
warehouseSchema.index({ distributorId: 1, warehouseType: 1, status: 1 });
warehouseSchema.index({ distributorId: 1, 'zones.areas.allowedProducts.productId': 1 });

export const Warehouse =
  mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema, 'warehouses');
export default Warehouse;
