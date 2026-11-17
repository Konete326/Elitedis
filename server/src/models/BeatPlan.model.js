import mongoose from 'mongoose';

const { Schema } = mongoose;

const beatCustomerSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerType: {
      type: String,
      enum: ['WHOLESALER', 'RETAILER'],
      default: 'RETAILER',
    },
    decision: {
      type: String,
      enum: ['ACCEPT', 'NON_ACCEPT'],
      default: 'ACCEPT',
    },
  },
  { _id: false }
);

const connectedRouteSchema = new Schema(
  {
    routeId: { type: Schema.Types.ObjectId, required: true },
    routeName: { type: String, trim: true, default: '' },
    customers: { type: [beatCustomerSchema], default: [] },
  },
  { _id: false }
);

const connectedAreaSchema = new Schema(
  {
    areaId: { type: Schema.Types.ObjectId, required: true },
    areaName: { type: String, trim: true, default: '' },
    connectedRoutes: { type: [connectedRouteSchema], default: [] },
  },
  { _id: false }
);

const beatPlanSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    beatCode: { type: String, required: true, trim: true, uppercase: true },
    beatName: { type: String, required: true, trim: true },
    beatDay: {
      type: String,
      enum: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ],
      required: true,
    },
    assignedBookerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    connectedAreas: { type: [connectedAreaSchema], default: [] },
    totalWholesalers: { type: Number, default: 0, min: 0 },
    totalRetailers: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

beatPlanSchema.pre('save', function () {
  let wholesalers = 0;
  let retailers = 0;
  for (const area of this.connectedAreas || []) {
    for (const route of area.connectedRoutes || []) {
      for (const entry of route.customers || []) {
        if (entry.decision !== 'ACCEPT') continue;
        if (entry.customerType === 'WHOLESALER') wholesalers += 1;
        else retailers += 1;
      }
    }
  }
  this.totalWholesalers = wholesalers;
  this.totalRetailers = retailers;
});

beatPlanSchema.index({ distributorId: 1, beatCode: 1 }, { unique: true });
beatPlanSchema.index({ distributorId: 1, assignedBookerId: 1, beatDay: 1, status: 1 });
beatPlanSchema.index({ distributorId: 1, beatName: 1 });

export const BeatPlan =
  mongoose.models.BeatPlan || mongoose.model('BeatPlan', beatPlanSchema, 'beat_plans');
export default BeatPlan;
