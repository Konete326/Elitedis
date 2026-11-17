import { Warehouse as _Warehouse, StockBatch as _StockBatch } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import { assertZeroStockBeforeDelete } from '../services/stockLedger.service.js';

const m = () => getTenantModels({ Warehouse: _Warehouse, StockBatch: _StockBatch });

export const listWarehouses = asyncHandler(async (req, res) => {
  const { Warehouse, StockBatch } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.warehouseType) extra.warehouseType = req.query.warehouseType;
  if (req.query.status) extra.status = req.query.status;

  const filter = buildScopedFilter(req, extra, ['warehouseCode', 'warehouseName', 'address.city'], searchRegex);

  const [warehouses, totalRecords, stockStats] = await Promise.all([
    Warehouse.find(filter).sort(sort).skip(skip).limit(limit).populate('managerId', 'fullName phone email').lean(),
    Warehouse.countDocuments(filter),
    StockBatch.aggregate([
      { $match: { distributorId: req.distributorId } },
      {
        $group: {
          _id: '$warehouseId',
          totalBatches: { $sum: 1 },
          totalBaseQty: { $sum: '$currentBaseQty' },
          totalStockValuePkr: { $sum: '$totalStockValuePkr' },
          lowStockCount: { $sum: { $cond: [{ $in: ['$status', ['LOW_WARNING', 'OUT']] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const statMap = new Map(stockStats.map((s) => [String(s._id), s]));
  const enriched = warehouses.map((wh) => ({
    ...wh,
    zoneCount: wh.zones?.length || 0,
    areaCount: (wh.zones || []).reduce((acc, z) => acc + (z.areas?.length || 0), 0),
    stockStats: statMap.get(String(wh._id)) || {
      totalBatches: 0,
      totalBaseQty: 0,
      totalStockValuePkr: 0,
      lowStockCount: 0,
    },
  }));

  res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta(totalRecords) });
});

export const getWarehouseById = asyncHandler(async (req, res) => {
  const { Warehouse, StockBatch } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.id, distributorId: req.distributorId })
    .populate('managerId', 'fullName phone email')
    .populate('zones.areas.allowedProducts.productId', 'skuCode productName')
    .lean();

  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');

  const batches = await StockBatch.find({ distributorId: req.distributorId, warehouseId: warehouse._id })
    .select('batchNo productId currentBaseQty availableBaseQty totalStockValuePkr status condition')
    .lean();

  res.status(200).json({ success: true, data: { ...warehouse, batches } });
});

export const createWarehouse = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const payload = {
    ...req.body,
    distributorId: req.distributorId,
    warehouseCode: req.body.warehouseCode || `WH-${Date.now().toString().slice(-5)}`,
  };
  const created = await Warehouse.create(payload);
  res.status(201).json({ success: true, data: created });
});

export const updateWarehouse = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');
  Object.assign(warehouse, { ...req.body, distributorId: req.distributorId });
  await warehouse.save();
  res.status(200).json({ success: true, data: warehouse });
});

export const deleteWarehouse = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');

  await assertZeroStockBeforeDelete({ distributorId: req.distributorId, warehouseId: warehouse._id });
  await warehouse.deleteOne();
  res.status(200).json({ success: true, message: 'Warehouse deleted successfully.' });
});

export const listAllZones = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const { page, limit, skip, search, buildPaginationMeta } = buildPaginationQuery(req);
  const whFilter = { distributorId: req.distributorId };
  if (req.query.warehouseId) whFilter._id = req.query.warehouseId;

  const warehouses = await Warehouse.find(whFilter).lean();
  const q = search.toLowerCase();
  const rows = [];

  for (const wh of warehouses) {
    for (const z of wh.zones || []) {
      if (q && !`${z.zoneCode} ${z.zoneName} ${wh.warehouseName}`.toLowerCase().includes(q)) continue;
      rows.push({
        ...z,
        warehouseId: wh._id,
        warehouseCode: wh.warehouseCode,
        warehouseName: wh.warehouseName,
        areaCount: z.areas?.length || 0,
      });
    }
  }

  const paged = rows.slice(skip, skip + limit);
  res.status(200).json({ success: true, data: paged, pagination: buildPaginationMeta(rows.length), page });
});

export const addZone = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Please create a Warehouse first before adding a Zone.', 404, 'PREREQUISITE_WAREHOUSE_NOT_FOUND');

  warehouse.zones.push({
    ...req.body,
    zoneCode: req.body.zoneCode || `ZN-${(warehouse.zones.length + 1).toString().padStart(2, '0')}`,
  });
  await warehouse.save();
  res.status(201).json({ success: true, data: warehouse.zones[warehouse.zones.length - 1] });
});

export const updateZone = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found. Please create a Warehouse first.', 404, 'PREREQUISITE_WAREHOUSE_NOT_FOUND');

  const zone = warehouse.zones.id(req.params.zoneId);
  if (!zone) throw new AppError('Zone not found. Please create a Zone first.', 404, 'PREREQUISITE_ZONE_NOT_FOUND');
  Object.assign(zone, req.body);
  await warehouse.save();
  res.status(200).json({ success: true, data: zone });
});

export const deleteZone = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');

  const zone = warehouse.zones.id(req.params.zoneId);
  if (!zone) throw new AppError('Zone not found.', 404, 'ZONE_NOT_FOUND');

  await assertZeroStockBeforeDelete({ distributorId: req.distributorId, warehouseId: warehouse._id, zoneId: zone._id });

  zone.deleteOne();
  await warehouse.save();
  res.status(200).json({ success: true, message: 'Zone deleted successfully.' });
});

export const listAllAreas = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const { limit, skip, search, buildPaginationMeta } = buildPaginationQuery(req);
  const whFilter = { distributorId: req.distributorId };
  if (req.query.warehouseId) whFilter._id = req.query.warehouseId;

  const warehouses = await Warehouse.find(whFilter)
    .populate('zones.areas.allowedProducts.productId', 'skuCode productName')
    .lean();
  const q = search.toLowerCase();
  const rows = [];

  for (const wh of warehouses) {
    for (const z of wh.zones || []) {
      if (req.query.zoneId && String(z._id) !== String(req.query.zoneId)) continue;
      for (const a of z.areas || []) {
        if (q && !`${a.areaCode} ${a.areaName} ${z.zoneName} ${wh.warehouseName}`.toLowerCase().includes(q)) continue;
        rows.push({ ...a, warehouseId: wh._id, warehouseName: wh.warehouseName, zoneId: z._id, zoneName: z.zoneName });
      }
    }
  }

  res.status(200).json({ success: true, data: rows.slice(skip, skip + limit), pagination: buildPaginationMeta(rows.length) });
});

export const addArea = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Please create a Warehouse first before adding a Floor/Rack Area.', 404, 'PREREQUISITE_WAREHOUSE_NOT_FOUND');

  const zone = warehouse.zones.id(req.params.zoneId);
  if (!zone) throw new AppError('Please create a Zone inside this warehouse first before adding an Area.', 404, 'PREREQUISITE_ZONE_NOT_FOUND');

  zone.areas.push({
    ...req.body,
    areaCode: req.body.areaCode || `AR-${(zone.areas.length + 1).toString().padStart(2, '0')}`,
  });
  await warehouse.save();
  res.status(201).json({ success: true, data: zone.areas[zone.areas.length - 1] });
});

export const updateArea = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');
  const zone = warehouse.zones.id(req.params.zoneId);
  if (!zone) throw new AppError('Zone not found.', 404, 'ZONE_NOT_FOUND');
  const area = zone.areas.id(req.params.areaId);
  if (!area) throw new AppError('Area not found.', 404, 'AREA_NOT_FOUND');

  Object.assign(area, req.body);
  await warehouse.save();
  res.status(200).json({ success: true, data: area });
});

export const deleteArea = asyncHandler(async (req, res) => {
  const { Warehouse } = m();
  const warehouse = await Warehouse.findOne({ _id: req.params.warehouseId, distributorId: req.distributorId });
  if (!warehouse) throw new AppError('Warehouse not found.', 404, 'WAREHOUSE_NOT_FOUND');
  const zone = warehouse.zones.id(req.params.zoneId);
  if (!zone) throw new AppError('Zone not found.', 404, 'ZONE_NOT_FOUND');
  const area = zone.areas.id(req.params.areaId);
  if (!area) throw new AppError('Area not found.', 404, 'AREA_NOT_FOUND');

  await assertZeroStockBeforeDelete({ distributorId: req.distributorId, warehouseId: warehouse._id, zoneId: zone._id, areaId: area._id });

  area.deleteOne();
  await warehouse.save();
  res.status(200).json({ success: true, message: 'Floor/Rack area deleted successfully.' });
});

export default {
  listWarehouses, getWarehouseById, createWarehouse, updateWarehouse, deleteWarehouse,
  listAllZones, addZone, updateZone, deleteZone, listAllAreas, addArea, updateArea, deleteArea,
};
