import mongoose from 'mongoose';
import { cloudinaryImageSchema } from './shared.schemas.js';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ['CATEGORY', 'SUB_CATEGORY'],
      required: true,
      default: 'CATEGORY',
    },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    linkedBrandIds: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
    image: { type: cloudinaryImageSchema, default: () => ({}) },
    description: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

categorySchema.index({ distributorId: 1, code: 1, level: 1 }, { unique: true });
categorySchema.index({ distributorId: 1, level: 1, parentCategoryId: 1, status: 1 });
categorySchema.index({ distributorId: 1, companyId: 1, name: 1 });

export const Category =
  mongoose.models.Category || mongoose.model('Category', categorySchema, 'categories');
export default Category;
