import mongoose from 'mongoose';

const { Schema } = mongoose;

export const cloudinaryImageSchema = new Schema(
  {
    url: { type: String, trim: true, default: '' },
    publicId: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const gpsSchema = new Schema(
  {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

export const contactPersonSchema = new Schema(
  {
    personName: { type: String, required: true, trim: true },
    role: { type: String, trim: true, default: '' },
    contactNo: { type: String, required: true, trim: true },
    channelType: {
      type: String,
      enum: ['WHATSAPP', 'PHONE', 'LANDLINE'],
      default: 'PHONE',
    },
    purpose: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

export const socialLinkSchema = new Schema(
  {
    platform: { type: String, required: true, trim: true },
    pageName: { type: String, trim: true, default: '' },
    purposeType: { type: String, trim: true, default: '' },
    url: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

export const paymentAccountSchema = new Schema(
  {
    accountType: {
      type: String,
      enum: ['BANK', 'EASYPAISA', 'JAZZCASH'],
      default: 'BANK',
    },
    providerName: { type: String, required: true, trim: true },
    accountTitle: { type: String, required: true, trim: true },
    accountNo: { type: String, required: true, trim: true },
    ibanOrRef: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

export const dimensionsSchema = new Schema(
  {
    sizeUnit: { type: String, enum: ['Inch', 'Feet', 'cm'], default: 'Inch' },
    width: { type: Number, default: 0, min: 0 },
    length: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    areaSq: { type: Number, default: 0, min: 0 },
    volumeCubic: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Computes rectangular area (W * L) and volume (W * L * H) for dimensions sub-documents.
 * @param {object} dims
 */
export function syncAreaAndVolume(dims) {
  if (!dims) return;
  const w = Number(dims.width) || 0;
  const l = Number(dims.length) || 0;
  const h = Number(dims.height) || 0;
  const area = Number((w * l).toFixed(4));
  const volume = Number((w * l * h).toFixed(4));
  if ('areaSq' in dims || dims.areaSq !== undefined) dims.areaSq = area;
  if ('totalArea' in dims || dims.totalArea !== undefined) dims.totalArea = area;
  if ('volumeCubic' in dims || dims.volumeCubic !== undefined) dims.volumeCubic = volume;
  if ('totalVolume' in dims || dims.totalVolume !== undefined) dims.totalVolume = volume;
}

/**
 * Builds Level-1 invoice line item sub-schema shared by Order and SaleInvoice.
 * @param {object} extraFields
 */
export function createLineItemSchema(extraFields = {}) {
  return new Schema(
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
      batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch', default: null },
      productName: { type: String, trim: true, default: '' },
      skuCode: { type: String, trim: true, uppercase: true, default: '' },
      unitName: { type: String, required: true, trim: true },
      conversionQty: { type: Number, default: 1, min: 1 },
      unitWeightKg: { type: Number, default: 0, min: 0 },
      unitVolumeCubic: { type: Number, default: 0, min: 0 },
      baseRate: { type: Number, default: 0, min: 0 },
      customSaleRate: { type: Number, default: null, min: 0 },
      effectiveDiscountPct: { type: Number, default: 0, min: 0 },
      quantity: { type: Number, required: true, default: 0, min: 0 },
      grossRateTotal: { type: Number, default: 0, min: 0 },
      totalWeightKg: { type: Number, default: 0, min: 0 },
      itemDiscountRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      itemDiscountAmount: { type: Number, default: 0, min: 0 },
      itemChargeRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      itemChargeAmount: { type: Number, default: 0, min: 0 },
      itemTaxRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      itemTaxAmount: { type: Number, default: 0, min: 0 },
      schemeRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      isFreeSchemeRow: { type: Boolean, default: false },
      netLineAmount: { type: Number, default: 0, min: 0 },
      ...extraFields,
    },
    { _id: true }
  );
}

/**
 * Builds Level-2 invoice grand summary sub-schema shared by Order and SaleInvoice.
 * @param {object} extraFields
 */
export function createGrandSummarySchema(extraFields = {}) {
  return new Schema(
    {
      totalItems: { type: Number, default: 0, min: 0 },
      totalRows: { type: Number, default: 0, min: 0 },
      totalQuantity: { type: Number, default: 0, min: 0 },
      totalWeightKg: { type: Number, default: 0, min: 0 },
      totalVolumeCubic: { type: Number, default: 0, min: 0 },
      grossAmount: { type: Number, default: 0, min: 0 },
      totalItemDiscounts: { type: Number, default: 0, min: 0 },
      totalItemCharges: { type: Number, default: 0, min: 0 },
      totalItemTaxes: { type: Number, default: 0, min: 0 },
      subtotalAfterItems: { type: Number, default: 0, min: 0 },
      grandDiscountRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      grandDiscountAmount: { type: Number, default: 0, min: 0 },
      grandChargeRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      grandChargeAmount: { type: Number, default: 0, min: 0 },
      grandTaxRuleId: { type: Schema.Types.ObjectId, ref: 'CommercialRule', default: null },
      grandTaxAmount: { type: Number, default: 0, min: 0 },
      netPayableAmount: { type: Number, default: 0, min: 0 },
      ...extraFields,
    },
    { _id: false }
  );
}

