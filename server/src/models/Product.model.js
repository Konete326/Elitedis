import mongoose from 'mongoose';
import {
  cloudinaryImageSchema,
  dimensionsSchema,
  syncAreaAndVolume,
} from './shared.schemas.js';

const { Schema } = mongoose;

const baseUnitSchema = new Schema(
  {
    unitName: { type: String, required: true, trim: true, default: 'Piece' },
    weightValue: { type: Number, default: 0, min: 0 },
    weightUnit: { type: String, enum: ['g', 'Kg', 'ml', 'L'], default: 'Kg' },
    weightInKg: { type: Number, default: 0, min: 0 },
    traderPurchaseRate: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
      set: (v) => (v === '' || v === null || v === undefined ? 0 : v),
    },
    wholesaleSaleRate: { type: Number, required: true, default: 0, min: 0 },
    posRetailEndRate: { type: Number, required: true, default: 0, min: 0 },
    image: { type: cloudinaryImageSchema, default: () => ({}) },
  },
  { _id: false }
);

const packingUnitSchema = new Schema(
  {
    unitName: { type: String, required: true, trim: true },
    conversionQty: { type: Number, required: true, min: 1 },
    weightUnit: { type: String, enum: ['Kg', 'g'], default: 'Kg' },
    packingWeightKg: { type: Number, default: 0, min: 0 },
    traderPurchaseRate: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
      set: (v) => (v === '' || v === null || v === undefined ? 0 : v),
    },
    wholesaleSaleRate: { type: Number, default: 0, min: 0 },
    posRetailEndRate: { type: Number, default: 0, min: 0 },
    dimensions: { type: dimensionsSchema, default: () => ({}) },
    image: { type: cloudinaryImageSchema, default: () => ({}) },
    isDefaultStockUnit: { type: Boolean, default: false },
  },
  { _id: true }
);

const unitVersionSchema = new Schema(
  {
    versionNo: { type: Number, required: true, min: 1 },
    unitVersionId: { type: String, required: true, trim: true },
    unitName: { type: String, required: true, trim: true, default: 'Carton' },
    conversionQty: { type: Number, required: true, min: 1 },
    packingWeightKg: { type: Number, default: 0, min: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    versionStatus: {
      type: String,
      enum: ['ACTIVE_DEFAULT', 'COEXISTING', 'DEPLETED'],
      default: 'ACTIVE_DEFAULT',
    },
  },
  { _id: false }
);

const defaultRulesSchema = new Schema(
  {
    taxGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
    discountGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
    schemeGroupId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
    loadingCharge: { type: Number, default: 0, min: 0 },
    retailProfitMarginPkr: { type: Number, default: 0 },
    wholesaleMarginPkr: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    skuCode: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, default: '' },
    productName: { type: String, required: true, trim: true },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      default: null,
      set: (v) => (v === '' ? null : v),
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: false,
      default: null,
      set: (v) => (v === '' ? null : v),
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
      default: null,
      set: (v) => (v === '' ? null : v),
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
      default: null,
      set: (v) => (v === '' ? null : v),
    },
    baseUnit: { type: baseUnitSchema, required: true },
    packingUnits: { type: [packingUnitSchema], default: [] },
    unitVersions: { type: [unitVersionSchema], default: [] },
    posPermission: { type: Boolean, default: true },
    bookingPermission: { type: Boolean, default: true },
    defaultRules: { type: defaultRulesSchema, default: () => ({}) },
    assignedBookerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    showOnMarketplace: { type: Boolean, default: false },
    shortDescription: { type: String, trim: true, default: '' },
    longDescription: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

productSchema.pre('save', function () {
  if (this.baseUnit) {
    const val = Number(this.baseUnit.weightValue) || 0;
    const isSmall = this.baseUnit.weightUnit === 'g' || this.baseUnit.weightUnit === 'ml';
    if (val > 0) {
      this.baseUnit.weightInKg = Number((isSmall ? val / 1000 : val).toFixed(4));
    }
  }
  const baseKg = Number(this.baseUnit?.weightInKg) || 0;
  for (const pack of this.packingUnits || []) {
    if (baseKg > 0 && pack.conversionQty > 0) {
      pack.packingWeightKg = Number((baseKg * pack.conversionQty).toFixed(4));
    }
    syncAreaAndVolume(pack.dimensions);
  }
  if ((!this.unitVersions || this.unitVersions.length === 0) && this.packingUnits?.[0]) {
    const pack0 = this.packingUnits[0];
    this.unitVersions = [
      {
        versionNo: 1,
        unitVersionId: 'UV-1',
        unitName: pack0.unitName || 'Carton',
        conversionQty: Math.max(1, Number(pack0.conversionQty) || 1),
        packingWeightKg: pack0.packingWeightKg || 0,
        effectiveFrom: new Date(),
        versionStatus: 'ACTIVE_DEFAULT',
      },
    ];
  }
});

productSchema.index({ distributorId: 1, skuCode: 1 }, { unique: true });
productSchema.index({ distributorId: 1, barcode: 1 });
productSchema.index({ distributorId: 1, companyId: 1, brandId: 1, categoryId: 1, status: 1 });
productSchema.index({ distributorId: 1, productName: 1 });
productSchema.index({ distributorId: 1, status: 1, createdAt: -1 });

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema, 'products');
export default Product;
