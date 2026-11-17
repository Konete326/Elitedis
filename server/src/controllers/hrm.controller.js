import bcrypt from 'bcryptjs';
import { User, AttendancePayroll, PendingTask, Order, SaleInvoice, Recovery } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { assertNotTargetingSuperAdmin } from '../middlewares/rbacMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { postDoubleEntry } from '../services/accountingPost.service.js';
import { runWithTransaction } from '../services/stockLedger.service.js';

export const listEmployees = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  const isSuperAdmin = req.user.primaryRole === 'SUPER_ADMIN';
  if (req.query.primaryRole) {
    if (!isSuperAdmin && req.query.primaryRole === 'SUPER_ADMIN') {
      return res.status(200).json({ success: true, data: [], pagination: buildPaginationMeta(0) });
    }
    extra.primaryRole = req.query.primaryRole;
  } else if (!isSuperAdmin) {
    extra.primaryRole = { $ne: 'SUPER_ADMIN' };
  }
  if (req.query.status) extra.status = req.query.status;
  if (req.query.linkedWarehouseId) extra.linkedWarehouseId = req.query.linkedWarehouseId;

  const filter = buildScopedFilter(req, extra, ['profileId', 'fullName', 'email', 'phone'], searchRegex);
  const [employees, totalRecords] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -refreshTokenHash')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('linkedWarehouseId', 'warehouseCode warehouseName')
      .lean(),
    User.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: employees, pagination: buildPaginationMeta(totalRecords) });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const { password, email, ...rest } = req.body;
  assertNotTargetingSuperAdmin(req.user, rest.primaryRole);
  if (!password || String(password).length < 6) {
    throw new AppError('Employee password (min 6 characters) is required.', 400, 'INVALID_PASSWORD');
  }
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const exists = await User.exists({ email: normalizedEmail });
  if (exists) throw new AppError('An employee with this email already exists.', 409, 'EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await User.create({
    ...rest,
    distributorId: req.distributorId,
    distributorName: req.user.distributorName || '',
    profileId: rest.profileId || `EMP-${Date.now().toString().slice(-5)}`,
    email: normalizedEmail,
    passwordHash,
  });

  res.status(201).json({ success: true, data: created.toJSON() });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const emp = await User.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!emp) throw new AppError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  assertNotTargetingSuperAdmin(req.user, emp);
  assertNotTargetingSuperAdmin(req.user, req.body?.primaryRole);

  const oldAvatarId = emp.avatar?.publicId;
  const { password, distributorId: _ignore, ...updates } = req.body;
  Object.assign(emp, updates);
  if (password && String(password).length >= 6) {
    emp.passwordHash = await bcrypt.hash(password, 12);
  }
  await emp.save();

  if (oldAvatarId && emp.avatar?.publicId !== oldAvatarId) {
    await destroyImage(oldAvatarId).catch(() => {});
  }
  res.status(200).json({ success: true, data: emp.toJSON() });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new AppError('You cannot delete your own active session account.', 400, 'SELF_DELETE_BLOCKED');
  }
  const emp = await User.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!emp) throw new AppError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  assertNotTargetingSuperAdmin(req.user, emp);

  const oldAvatarId = emp.avatar?.publicId;
  await emp.deleteOne();
  if (oldAvatarId) await destroyImage(oldAvatarId).catch(() => {});

  res.status(200).json({ success: true, message: 'Employee removed successfully.' });
});

export const updateWorkAssignment = asyncHandler(async (req, res) => {
  const emp = await User.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!emp) throw new AppError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  assertNotTargetingSuperAdmin(req.user, emp);
  assertNotTargetingSuperAdmin(req.user, req.body?.primaryRole);

  const { primaryRole, workParts, linkedWarehouseId, assignedCompanyIds, assignedBrandIds } = req.body;
  if (primaryRole) emp.primaryRole = primaryRole;
  if (workParts && typeof workParts === 'object') {
    emp.workParts = { ...emp.workParts.toObject?.(), ...emp.workParts, ...workParts };
  }
  if (linkedWarehouseId !== undefined) emp.linkedWarehouseId = linkedWarehouseId;
  if (Array.isArray(assignedCompanyIds)) emp.assignedCompanyIds = assignedCompanyIds;
  if (Array.isArray(assignedBrandIds)) emp.assignedBrandIds = assignedBrandIds;

  await emp.save();
  res.status(200).json({ success: true, data: emp.toJSON() });
});

export const listAttendance = asyncHandler(async (req, res) => {
  const { skip, limit, sort, buildPaginationMeta } = buildPaginationQuery(req, { defaultSortBy: 'date' });
  const extra = { recordType: { $in: ['ATTENDANCE', 'LEAVE'] } };
  if (req.query.employeeId) extra.employeeId = req.query.employeeId;
  if (req.query.recordType) extra.recordType = req.query.recordType;
  if (req.query.attendanceStatus) extra.attendanceStatus = req.query.attendanceStatus;

  const filter = buildScopedFilter(req, extra);
  const [records, totalRecords] = await Promise.all([
    AttendancePayroll.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('employeeId approvedById', 'fullName profileId primaryRole')
      .lean(),
    AttendancePayroll.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: records, pagination: buildPaginationMeta(totalRecords) });
});

export const recordAttendanceOrLeave = asyncHandler(async (req, res) => {
  const created = await AttendancePayroll.create({
    ...req.body,
    distributorId: req.distributorId,
    recordType: req.body.recordType || 'ATTENDANCE',
    date: req.body.date ? new Date(req.body.date) : new Date(),
  });
  res.status(201).json({ success: true, data: created });
});

export const listPayroll = asyncHandler(async (req, res) => {
  const { skip, limit, sort, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = { recordType: 'PAYROLL' };
  if (req.query.employeeId) extra.employeeId = req.query.employeeId;
  if (req.query.monthYear) extra.monthYear = req.query.monthYear;
  if (req.query.paymentStatus) extra.paymentStatus = req.query.paymentStatus;

  const filter = buildScopedFilter(req, extra);
  const [records, totalRecords] = await Promise.all([
    AttendancePayroll.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('employeeId approvedById', 'fullName profileId primaryRole basicSalaryPkr commissionPct')
      .lean(),
    AttendancePayroll.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: records, pagination: buildPaginationMeta(totalRecords) });
});

export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
  const { monthYear, employeeId = null } = req.body;
  if (!monthYear) throw new AppError('monthYear (e.g. 2026-11) is required.', 400, 'MONTH_REQUIRED');

  const [year, month] = monthYear.split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, 1);
  const end = new Date(year, month || 1, 1);

  const empFilter = { distributorId: req.distributorId, status: 'ACTIVE' };
  if (employeeId) empFilter._id = employeeId;
  const employees = await User.find(empFilter).lean();

  const createdPayrolls = [];
  for (const emp of employees) {
    const existing = await AttendancePayroll.findOne({
      distributorId: req.distributorId,
      employeeId: emp._id,
      recordType: 'PAYROLL',
      monthYear,
    });
    if (existing) {
      createdPayrolls.push(existing);
      continue;
    }

    const salesAgg = await SaleInvoice.aggregate([
      {
        $match: {
          distributorId: req.distributorId,
          salesmanId: emp._id,
          status: { $ne: 'CANCELLED' },
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$grandSummary.netPayableAmount' } } },
    ]);

    const totalSales = salesAgg[0]?.total || 0;
    const commissionPkr = Number(((totalSales * (emp.commissionPct || 0)) / 100).toFixed(2));

    const payroll = await AttendancePayroll.create({
      distributorId: req.distributorId,
      employeeId: emp._id,
      recordType: 'PAYROLL',
      monthYear,
      basicSalaryPkr: emp.basicSalaryPkr || 0,
      commissionPkr,
      allowancesPkr: Number(req.body.allowancesPkr) || 0,
      deductionsPkr: Number(req.body.deductionsPkr) || 0,
      paymentStatus: 'PENDING',
      approvedById: req.user._id,
    });
    createdPayrolls.push(payroll);
  }

  res.status(201).json({ success: true, data: createdPayrolls });
});

export const payPayroll = asyncHandler(async (req, res) => {
  const payroll = await runWithTransaction(async (session) => {
    const doc = await AttendancePayroll.findOne({
      _id: req.params.id,
      distributorId: req.distributorId,
      recordType: 'PAYROLL',
    }).session(session);
    if (!doc) throw new AppError('Payroll record not found.', 404, 'PAYROLL_NOT_FOUND');
    if (doc.paymentStatus === 'PAID') throw new AppError('Payroll already paid.', 400, 'ALREADY_PAID');

    doc.paymentStatus = 'PAID';
    doc.approvedById = req.user._id;
    await doc.save(session ? { session } : undefined);

    if (doc.netPayablePkr > 0) {
      await postDoubleEntry({
        distributorId: req.distributorId,
        voucherNo: `PAY-${doc.monthYear}-${doc._id.toString().slice(-4)}`,
        voucherType: 'PAYROLL',
        entries: [
          {
            accountCode: '5050',
            accountName: 'Salaries & Commission Expense',
            accountCategory: 'EXPENSE',
            partyType: 'EMPLOYEE',
            partyId: doc.employeeId,
            debitPkr: doc.netPayablePkr,
            creditPkr: 0,
            narration: `Payroll ${doc.monthYear}`,
          },
          {
            accountCode: '1010',
            accountName: 'Cash in Hand',
            accountCategory: 'ASSET',
            debitPkr: 0,
            creditPkr: doc.netPayablePkr,
            narration: `Salary disbursement ${doc.monthYear}`,
          },
        ],
        referenceModel: 'AttendancePayroll',
        referenceId: doc._id,
        preparedById: req.user._id,
        approvedById: req.user._id,
        session,
      });
    }

    return doc;
  });

  res.status(200).json({ success: true, data: payroll });
});

export const getEmployeePerformanceReport = asyncHandler(async (req, res) => {
  const distributorId = req.distributorId;
  const empFilter = req.user.primaryRole === 'SUPER_ADMIN' ? { distributorId } : { distributorId, primaryRole: { $ne: 'SUPER_ADMIN' } };
  const [employees, taskStats, orderStats, recoveryStats] = await Promise.all([
    User.find(empFilter).select('profileId fullName primaryRole status').lean(),
    PendingTask.aggregate([
      { $match: { distributorId } },
      {
        $group: {
          _id: '$assignedToId',
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETE'] }, 1, 0] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { distributorId } },
      { $group: { _id: '$bookerId', bookedOrders: { $sum: 1 }, bookedValuePkr: { $sum: '$grandSummary.netPayableAmount' } } },
    ]),
    Recovery.aggregate([
      { $match: { distributorId, status: 'APPROVED' } },
      { $group: { _id: '$collectedById', recoveredPkr: { $sum: '$amountPkr' } } },
    ]),
  ]);

  const tMap = new Map(taskStats.map((x) => [String(x._id), x]));
  const oMap = new Map(orderStats.map((x) => [String(x._id), x]));
  const rMap = new Map(recoveryStats.map((x) => [String(x._id), x]));

  const report = employees.map((e) => {
    const id = String(e._id);
    return {
      ...e,
      tasks: tMap.get(id) || { totalTasks: 0, completedTasks: 0 },
      orders: oMap.get(id) || { bookedOrders: 0, bookedValuePkr: 0 },
      recoveries: rMap.get(id) || { recoveredPkr: 0 },
    };
  });

  res.status(200).json({ success: true, data: report });
});
