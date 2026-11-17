import { Customer, Territory, BeatPlan, User, Order, SaleInvoice, Recovery } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';

export const listCustomers = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.customerType) extra.customerType = req.query.customerType;
  if (req.query.visitPosition) extra.visitPosition = req.query.visitPosition;
  if (req.query.status) extra.status = req.query.status;
  if (req.query.paymentCondition) extra['financialTerms.paymentCondition'] = req.query.paymentCondition;
  if (req.query.areaId) extra['locationHierarchy.areaId'] = req.query.areaId;
  if (req.query.routeId) extra['locationHierarchy.routeId'] = req.query.routeId;
  if (req.query.territoryId) extra['commercialAssignments.territoryId'] = req.query.territoryId;
  if (req.query.bookerId) extra['commercialAssignments.assignedBookerIds'] = req.query.bookerId;

  const filter = buildScopedFilter(req, extra, ['customerCode', 'shopName', 'ownerName', 'ownerContact', 'locationHierarchy.pehchanRemarks'], searchRegex);
  const [customers, totalRecords] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('commercialAssignments.assignedBookerIds', 'fullName profileId')
      .populate('commercialAssignments.territoryId', 'territoryCode territoryName').lean(),
    Customer.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: customers, pagination: buildPaginationMeta(totalRecords) });
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('commercialAssignments.assignedBookerIds', 'fullName profileId phone')
    .populate('commercialAssignments.territoryId', 'territoryCode territoryName').lean();
  if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
  const [recentOrders, recentInvoices, recentRecoveries] = await Promise.all([
    Order.find({ distributorId: req.distributorId, customerId: customer._id }).sort({ createdAt: -1 }).limit(5).lean(),
    SaleInvoice.find({ distributorId: req.distributorId, customerId: customer._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Recovery.find({ distributorId: req.distributorId, customerId: customer._id }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  res.status(200).json({ success: true, data: { ...customer, recentOrders, recentInvoices, recentRecoveries } });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    distributorId: req.distributorId,
    customerCode: req.body.customerCode || `CUST-${Date.now().toString().slice(-5)}`,
  };
  if (!payload.shopName || !payload.ownerName || !payload.ownerContact) {
    throw new AppError('Shop Name, Owner Name, and Owner Contact are required to create a Customer.', 400, 'CUSTOMER_FIELDS_REQUIRED');
  }
  if (payload.locationHierarchy) {
    if (payload.locationHierarchy.areaId === '') payload.locationHierarchy.areaId = null;
    if (payload.locationHierarchy.routeId === '') payload.locationHierarchy.routeId = null;
    if (payload.locationHierarchy.areaId) {
      const areaExists = await Territory.exists({ distributorId: req.distributorId, 'areas._id': payload.locationHierarchy.areaId });
      if (!areaExists) throw new AppError('Selected Area was not found. Please create an Area & Route first.', 400, 'PREREQUISITE_AREA_NOT_FOUND');
    }
  }
  if (payload.commercialAssignments?.territoryId === '') payload.commercialAssignments.territoryId = null;
  const created = await Customer.create(payload);
  res.status(201).json({ success: true, data: created });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

  const oldPicId = customer.shopPic?.publicId;
  Object.assign(customer, { ...req.body, distributorId: req.distributorId });
  await customer.save();

  if (oldPicId && customer.shopPic?.publicId !== oldPicId) {
    await destroyImage(oldPicId).catch(() => {});
  }
  res.status(200).json({ success: true, data: customer });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

  const [hasOrders, hasUnpaid] = await Promise.all([
    Order.exists({ distributorId: req.distributorId, customerId: customer._id }),
    SaleInvoice.exists({ distributorId: req.distributorId, customerId: customer._id, balanceDuePkr: { $gt: 0 } }),
  ]);
  if (hasOrders || hasUnpaid) {
    throw new AppError('Cannot delete customer with orders or unpaid invoices. Mark INACTIVE instead.', 400, 'CUSTOMER_IN_USE');
  }

  const oldPicId = customer.shopPic?.publicId;
  await customer.deleteOne();
  if (oldPicId) await destroyImage(oldPicId).catch(() => {});

  res.status(200).json({ success: true, message: 'Customer deleted successfully.' });
});

export const bulkApplyCustomerRules = asyncHandler(async (req, res) => {
  const { customerIds = [], paymentCondition, status, assignedBookerIds, territoryId, taxGroupId, discountGroupId, schemeGroupId } =
    req.body;
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    throw new AppError('Select at least one customer.', 400, 'NO_CUSTOMERS_SELECTED');
  }

  const update = {};
  if (paymentCondition) update['financialTerms.paymentCondition'] = paymentCondition;
  if (status) update.status = status;
  if (Array.isArray(assignedBookerIds)) update['commercialAssignments.assignedBookerIds'] = assignedBookerIds;
  if (territoryId !== undefined) update['commercialAssignments.territoryId'] = territoryId;
  if (taxGroupId !== undefined) update['commercialAssignments.taxGroupId'] = taxGroupId;
  if (discountGroupId !== undefined) update['commercialAssignments.discountGroupId'] = discountGroupId;
  if (schemeGroupId !== undefined) update['commercialAssignments.schemeGroupId'] = schemeGroupId;

  const result = await Customer.updateMany(
    { _id: { $in: customerIds }, distributorId: req.distributorId },
    { $set: update }
  );

  res.status(200).json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
});

export const listTerritories = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.territoryType) extra.territoryType = req.query.territoryType;
  if (req.query.status) extra.status = req.query.status;
  const filter = buildScopedFilter(req, extra, ['territoryCode', 'territoryName'], searchRegex);

  const [territories, totalRecords] = await Promise.all([
    Territory.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('linkedBrandId linkedWarehouseId linkedBookerId', 'brandName warehouseName fullName')
      .lean(),
    Territory.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: territories, pagination: buildPaginationMeta(totalRecords) });
});

function normalizeTerritoryAreas(areas = []) {
  if (!Array.isArray(areas)) return [];
  const ts = Date.now().toString().slice(-4);
  return areas.map((area, aIdx) => ({
    ...area,
    areaCode: area.areaCode || `AR-${ts}-${aIdx + 1}`,
    routes: Array.isArray(area.routes)
      ? area.routes.map((rt, rIdx) => ({
          ...rt,
          routeCode: rt.routeCode || `RT-${ts}-${aIdx + 1}-${rIdx + 1}`,
        }))
      : [],
  }));
}

export const createTerritory = asyncHandler(async (req, res) => {
  const created = await Territory.create({
    ...req.body,
    areas: normalizeTerritoryAreas(req.body.areas),
    distributorId: req.distributorId,
    territoryCode: req.body.territoryCode || `TER-${Date.now().toString().slice(-5)}`,
  });
  res.status(201).json({ success: true, data: created });
});

export const updateTerritory = asyncHandler(async (req, res) => {
  const payload = { ...req.body, distributorId: req.distributorId };
  if (req.body.areas) payload.areas = normalizeTerritoryAreas(req.body.areas);
  const doc = await Territory.findOneAndUpdate(
    { _id: req.params.id, distributorId: req.distributorId },
    payload,
    { new: true, runValidators: true }
  );
  if (!doc) throw new AppError('Territory not found.', 404, 'TERRITORY_NOT_FOUND');
  res.status(200).json({ success: true, data: doc });
});

export const deleteTerritory = asyncHandler(async (req, res) => {
  const doc = await Territory.findOneAndDelete({ _id: req.params.id, distributorId: req.distributorId });
  if (!doc) throw new AppError('Territory not found.', 404, 'TERRITORY_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Territory deleted successfully.' });
});

export const listAreasAndRoutes = asyncHandler(async (req, res) => {
  const { skip, limit, search, buildPaginationMeta } = buildPaginationQuery(req);
  const territories = await Territory.find({ distributorId: req.distributorId }).lean();
  const q = search.toLowerCase();
  const areas = [];
  const routes = [];

  for (const t of territories) {
    for (const a of t.areas || []) {
      const areaMatch = !q || `${a.areaCode} ${a.areaName} ${a.city} ${a.subDistrict}`.toLowerCase().includes(q);
      if (areaMatch) {
        areas.push({
          ...a,
          territoryId: t._id,
          territoryName: t.territoryName,
          routeCount: a.routes?.length || 0,
        });
      }
      for (const r of a.routes || []) {
        if (!q || `${r.routeCode} ${r.routeName} ${a.areaName}`.toLowerCase().includes(q)) {
          routes.push({
            ...r,
            areaId: a._id,
            areaName: a.areaName,
            territoryId: t._id,
            territoryName: t.territoryName,
          });
        }
      }
    }
  }

  const isRoutes = req.path.includes('routes');
  const list = isRoutes ? routes : areas;
  res.status(200).json({
    success: true,
    data: list.slice(skip, skip + limit),
    pagination: buildPaginationMeta(list.length),
  });
});

export const addAreaToTerritory = asyncHandler(async (req, res) => {
  const { territoryId, ...areaData } = req.body;
  let territory = territoryId
    ? await Territory.findOne({ _id: territoryId, distributorId: req.distributorId })
    : await Territory.findOne({ distributorId: req.distributorId });

  if (!territory) {
    territory = await Territory.create({
      distributorId: req.distributorId,
      territoryCode: `TER-${Date.now().toString().slice(-4)}`,
      territoryName: areaData.subDistrict || 'Default Territory',
      territoryType: 'DISTRICT_WISE',
      areas: [],
    });
  }

  territory.areas.push({
    ...areaData,
    areaCode: areaData.areaCode || `AR-${Date.now().toString().slice(-4)}`,
  });
  await territory.save();
  res.status(201).json({ success: true, data: territory.areas[territory.areas.length - 1] });
});

export const addRouteToArea = asyncHandler(async (req, res) => {
  const { territoryId, areaId, ...routeData } = req.body;
  if (!areaId) throw new AppError('Please create or select an Area first before adding a Route.', 400, 'PREREQUISITE_AREA_REQUIRED');
  const territory = await Territory.findOne({
    distributorId: req.distributorId,
    ...(territoryId ? { _id: territoryId } : { 'areas._id': areaId }),
  });
  if (!territory) throw new AppError('Parent Area was not found. Please create an Area first in CRM Areas & Routes.', 404, 'PREREQUISITE_AREA_NOT_FOUND');

  const area = territory.areas.id(areaId);
  if (!area) throw new AppError('Area not found. Please create an Area first.', 404, 'PREREQUISITE_AREA_NOT_FOUND');

  area.routes.push({
    ...routeData,
    routeCode: routeData.routeCode || `RT-${Date.now().toString().slice(-4)}`,
  });
  await territory.save();
  res.status(201).json({ success: true, data: area.routes[area.routes.length - 1] });
});

export const listBeatPlans = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.beatDay) extra.beatDay = req.query.beatDay;
  if (req.query.assignedBookerId) extra.assignedBookerId = req.query.assignedBookerId;
  if (req.query.status) extra.status = req.query.status;

  const filter = buildScopedFilter(req, extra, ['beatCode', 'beatName'], searchRegex);
  const [beats, totalRecords] = await Promise.all([
    BeatPlan.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedBookerId', 'fullName profileId phone')
      .lean(),
    BeatPlan.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: beats, pagination: buildPaginationMeta(totalRecords) });
});

export const createBeatPlan = asyncHandler(async (req, res) => {
  if (!req.body.assignedBookerId) {
    throw new AppError('Please create or select an Order Booker employee first before creating a Beat Plan.', 400, 'PREREQUISITE_BOOKER_REQUIRED');
  }
  if (!(await User.exists({ _id: req.body.assignedBookerId, distributorId: req.distributorId }))) {
    throw new AppError('Assigned Order Booker was not found. Please create an employee first.', 400, 'PREREQUISITE_BOOKER_NOT_FOUND');
  }
  const created = await BeatPlan.create({
    ...req.body,
    distributorId: req.distributorId,
    beatCode: req.body.beatCode || `BAT-${Date.now().toString().slice(-5)}`,
  });
  res.status(201).json({ success: true, data: created });
});

export const updateBeatPlan = asyncHandler(async (req, res) => {
  const beat = await BeatPlan.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!beat) throw new AppError('Beat plan not found.', 404, 'BEAT_NOT_FOUND');
  Object.assign(beat, { ...req.body, distributorId: req.distributorId });
  await beat.save();
  res.status(200).json({ success: true, data: beat });
});

export const duplicateBeatPlan = asyncHandler(async (req, res) => {
  const source = await BeatPlan.findOne({ _id: req.params.id, distributorId: req.distributorId }).lean();
  if (!source) throw new AppError('Source beat plan not found.', 404, 'BEAT_NOT_FOUND');

  const cloned = await BeatPlan.create({
    distributorId: req.distributorId,
    beatCode: req.body.beatCode || `${source.beatCode}-CPY-${Date.now().toString().slice(-3)}`,
    beatName: req.body.beatName || `${source.beatName} (Copy)`,
    beatDay: req.body.beatDay || source.beatDay,
    assignedBookerId: req.body.assignedBookerId || source.assignedBookerId,
    connectedAreas: source.connectedAreas || [],
    status: 'ACTIVE',
  });

  res.status(201).json({ success: true, data: cloned });
});

export const deleteBeatPlan = asyncHandler(async (req, res) => {
  const deleted = await BeatPlan.findOneAndDelete({ _id: req.params.id, distributorId: req.distributorId });
  if (!deleted) throw new AppError('Beat plan not found.', 404, 'BEAT_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Beat plan deleted successfully.' });
});
