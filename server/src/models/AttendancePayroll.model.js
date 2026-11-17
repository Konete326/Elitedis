import mongoose from 'mongoose';

const { Schema } = mongoose;

const attendancePayrollSchema = new Schema(
  {
    distributorId: { type: String, required: true, trim: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordType: {
      type: String,
      enum: ['ATTENDANCE', 'LEAVE', 'PAYROLL'],
      required: true,
    },
    date: { type: Date, default: null },
    monthYear: { type: String, trim: true, default: '' },
    attendanceStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'LATE', 'NONE'],
      default: 'NONE',
    },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    basicSalaryPkr: { type: Number, default: 0, min: 0 },
    commissionPkr: { type: Number, default: 0, min: 0 },
    allowancesPkr: { type: Number, default: 0, min: 0 },
    deductionsPkr: { type: Number, default: 0, min: 0 },
    netPayablePkr: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'PARTIAL', 'NOT_APPLICABLE'],
      default: 'NOT_APPLICABLE',
    },
    remarks: { type: String, trim: true, default: '' },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

attendancePayrollSchema.pre('save', function () {
  if (this.recordType === 'PAYROLL') {
    const gross =
      (Number(this.basicSalaryPkr) || 0) +
      (Number(this.commissionPkr) || 0) +
      (Number(this.allowancesPkr) || 0);
    const ded = Number(this.deductionsPkr) || 0;
    this.netPayablePkr = Number((gross - ded).toFixed(2));
  }
});

attendancePayrollSchema.index({ distributorId: 1, employeeId: 1, recordType: 1, date: -1 });
attendancePayrollSchema.index({ distributorId: 1, employeeId: 1, recordType: 1, monthYear: 1 });
attendancePayrollSchema.index({ distributorId: 1, paymentStatus: 1, monthYear: 1 });

export const AttendancePayroll =
  mongoose.models.AttendancePayroll ||
  mongoose.model('AttendancePayroll', attendancePayrollSchema, 'attendance_payrolls');
export default AttendancePayroll;
