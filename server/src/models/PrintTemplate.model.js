import mongoose from 'mongoose';

const { Schema } = mongoose;

const headerConfigSchema = new Schema(
  {
    showLogo: { type: Boolean, default: true },
    showCompanyName: { type: Boolean, default: true },
    companyTitle: { type: String, trim: true, default: '' },
    showAddress: { type: Boolean, default: true },
    subjectLine: { type: String, trim: true, default: '' },
    fontFamily: { type: String, trim: true, default: 'Inter' },
    dividerStyle: { type: String, trim: true, default: 'SOLID' },
    isItalic: { type: Boolean, default: false },
  },
  { _id: false }
);

const footerConfigSchema = new Schema(
  {
    signature1Label: { type: String, trim: true, default: 'Prepared By' },
    signature2Label: { type: String, trim: true, default: 'Checked By' },
    signature3Label: { type: String, trim: true, default: 'Receiver Sign' },
    showSignLines: { type: Boolean, default: true },
    footerNoteLine: { type: String, trim: true, default: '' },
    showPageNumber: { type: Boolean, default: true },
    showPrintDate: { type: Boolean, default: true },
  },
  { _id: false }
);

const defaultNoteSchema = new Schema(
  {
    noteType: {
      type: String,
      enum: ['DELIVERY', 'TAX', 'INFO', 'CAUTION', 'IMPORTANT'],
      default: 'INFO',
    },
    title: { type: String, trim: true, default: '' },
    text: { type: String, trim: true, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const printTemplateSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    templateCode: { type: String, required: true, trim: true, uppercase: true },
    templateName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: [
        'RETAIL_POS',
        'WHOLESALE_POS',
        'NORMAL_INVOICE',
        'LANDSCAPE_INVOICE',
        'CHILLAN_FINANCE',
        'ADVANCE_INVOICE',
        'DELIVERY_DISPATCH',
        'SALESMAN_SHEET',
        'RECOVERY_SHEET',
        'BOOKING_SHEET',
        'RATE_LIST',
        'PRESENTATION_CATALOG',
        'CREDIT_REPORT',
        'CURRENT_STOCK',
        'STOCK_LEDGER',
        'STOCK_VALUATION',
      ],
      required: true,
    },
    layoutType: {
      type: String,
      enum: ['A4_PORTRAIT', 'A4_LANDSCAPE', 'THERMAL_80MM', 'THERMAL_58MM', 'HALF_A4'],
      default: 'A4_PORTRAIT',
    },
    headerConfig: { type: headerConfigSchema, default: () => ({}) },
    footerConfig: { type: footerConfigSchema, default: () => ({}) },
    defaultNotes: { type: [defaultNoteSchema], default: [] },
    showUrduLabels: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

printTemplateSchema.index({ distributorId: 1, templateCode: 1 }, { unique: true });
printTemplateSchema.index({ distributorId: 1, documentType: 1, isDefault: 1, status: 1 });

export const PrintTemplate =
  mongoose.models.PrintTemplate ||
  mongoose.model('PrintTemplate', printTemplateSchema, 'print_templates');
export default PrintTemplate;
