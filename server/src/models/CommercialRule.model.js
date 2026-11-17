import mongoose from 'mongoose';

const { Schema } = mongoose;

const schemeDetailsSchema = new Schema(
  {
    paidProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    paidUnit: { type: String, trim: true, default: '' },
    paidQty: { type: Number, default: 0, min: 0 },
    freeProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    freeUnit: { type: String, trim: true, default: '' },
    freeQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const timelineSchema = new Schema(
  {
    isAllTime: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { _id: false }
);

const commercialRuleSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    ruleCategory: {
      type: String,
      enum: ['TAX', 'DISCOUNT', 'CHARGE', 'SCHEME'],
      required: true,
    },
    level: {
      type: String,
      enum: ['PRODUCT_LEVEL', 'GRAND_LEVEL'],
      required: true,
    },
    ruleName: { type: String, required: true, trim: true },
    calculationMode: {
      type: String,
      enum: [
        'GENERAL_FLAT',
        'GENERAL_AUTO',
        'PERCENTAGE',
        'SLAB_GENERAL',
        'FIX_GENERAL',
        'FIX_PERCENT',
        'ADVANCE_PERCENT',
        'ADVANCE_G',
        'PRODUCT_WISE_SCHEME',
        'SLAB_SCHEME',
        'TARGET_SCHEME',
      ],
      required: true,
    },
    compareBasis: {
      type: String,
      enum: ['NONE', 'RATE', 'QUANTITY', 'WEIGHT_KG', 'AMOUNT_PKR'],
      default: 'NONE',
    },
    thresholdValue: { type: Number, default: 0, min: 0 },
    benefitValue: { type: Number, default: 0, min: 0 },
    schemeDetails: { type: schemeDetailsSchema, default: () => ({}) },
    timeline: { type: timelineSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

commercialRuleSchema.pre('save', function () {
  if (
    this.timeline &&
    !this.timeline.isAllTime &&
    this.timeline.endDate &&
    new Date(this.timeline.endDate) < new Date()
  ) {
    this.status = 'EXPIRED';
  }
});

commercialRuleSchema.index({ distributorId: 1, ruleCategory: 1, level: 1, status: 1 });
commercialRuleSchema.index({ distributorId: 1, ruleName: 1 });
commercialRuleSchema.index({ distributorId: 1, 'timeline.endDate': 1 });

export const CommercialRule =
  mongoose.models.CommercialRule ||
  mongoose.model('CommercialRule', commercialRuleSchema, 'commercial_rules');
export default CommercialRule;
