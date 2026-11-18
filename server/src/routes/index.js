import express from 'express';
import { getDbStatus } from '../config/db.js';
import { destroyImage, uploadImageBuffer } from '../config/cloudinary.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole, requireRoleOrWorkPart } from '../middlewares/rbacMiddleware.js';
import { enforceTenant } from '../middlewares/tenantMiddleware.js';
import { uploadImageMiddleware } from '../middlewares/uploadMiddleware.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';

import * as authCtrl from '../controllers/auth.controller.js';
import * as invCtrl from '../controllers/inventory.controller.js';
import * as whCtrl from '../controllers/warehouse.controller.js';
import * as mvCtrl from '../controllers/movement.controller.js';
import * as prCtrl from '../controllers/purchaseReceiving.controller.js';
import * as crmCtrl from '../controllers/crm.controller.js';
import * as rulesCtrl from '../controllers/rules.controller.js';
import * as orderCtrl from '../controllers/order.controller.js';
import * as srCtrl from '../controllers/salesRecovery.controller.js';
import * as taskCtrl from '../controllers/task.controller.js';
import * as portalCtrl from '../controllers/portals.controller.js';
import * as hrmCtrl from '../controllers/hrm.controller.js';
import * as accCtrl from '../controllers/accounting.controller.js';
import * as dashCtrl from '../controllers/dashboardReport.controller.js';
import * as procCtrl from '../controllers/procurement.controller.js';
import * as superAdminCtrl from '../controllers/superAdmin.controller.js';

const router = express.Router();

// Health check
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'elite-dist-erp-api',
    timestamp: new Date().toISOString(),
    database: getDbStatus(),
  });
});

// Auth routes (/api/v1/auth)
const authRouter = express.Router();
authRouter.post('/login', authCtrl.login);
authRouter.post('/register', authCtrl.register);
authRouter.post('/refresh', authCtrl.refresh);
authRouter.post('/logout', protect, authCtrl.logout);
authRouter.get('/me', protect, authCtrl.getMe);
authRouter.get('/agency-profile', protect, enforceTenant, authCtrl.getAgencyProfile);
authRouter.put('/agency-profile', protect, enforceTenant, requireRole('ADMIN'), authCtrl.updateAgencyProfile);
authRouter.post('/agency-profile/skip', protect, enforceTenant, requireRole('ADMIN'), authCtrl.skipAgencyOnboarding);
router.use('/auth', authRouter);

// Super Admin Platform Control Plane (/api/v1/super-admin)
const superAdminRouter = express.Router();
superAdminRouter.use(protect, requireRole('SUPER_ADMIN'));
superAdminRouter.post('/distributors/test-uri', superAdminCtrl.testDistributorMongoUri);
superAdminRouter.get('/distributors', superAdminCtrl.listDistributors);
superAdminRouter.post('/distributors', superAdminCtrl.createDistributor);
superAdminRouter.put('/distributors/:id', superAdminCtrl.updateDistributor);
superAdminRouter.delete('/distributors/:id', superAdminCtrl.deleteDistributor);
router.use('/super-admin', superAdminRouter);

// Authenticated + Tenant-Scoped APIs
router.use(protect, enforceTenant);

// Cloudinary upload routes (/api/v1/upload)
const uploadRouter = express.Router();
uploadRouter.post(
  '/image',
  uploadImageMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw new AppError('Image file is required.', 400, 'FILE_REQUIRED');
    const folder = req.body?.folder || req.query?.folder || 'general';
    const result = await uploadImageBuffer(req.file.buffer, `${req.distributorId}/${folder}`);
    res.status(201).json({ success: true, data: result });
  })
);
uploadRouter.delete(
  '/image',
  asyncHandler(async (req, res) => {
    const publicId = req.body?.publicId || req.query?.publicId;
    if (!publicId) throw new AppError('publicId is required.', 400, 'PUBLIC_ID_REQUIRED');
    const result = await destroyImage(String(publicId));
    res.status(200).json({ success: true, data: result });
  })
);
router.use('/upload', uploadRouter);

function mountCrud(parentRouter, path, handlers) {
  parentRouter.get(path, handlers.list);
  parentRouter.get(`${path}/:id`, handlers.getById);
  parentRouter.post(path, handlers.create);
  parentRouter.put(`${path}/:id`, handlers.update);
  parentRouter.patch(`${path}/:id`, handlers.update);
  parentRouter.delete(`${path}/:id`, handlers.remove);
}

// Inventory routes (/api/v1/inventory)
const invRouter = express.Router();
invRouter.get('/dashboard', invCtrl.getInventoryDashboard);
invRouter.get('/products/rate-list', invCtrl.getProductRateList);
invRouter.post('/products/bulk-rules', requireRole('ADMIN'), invCtrl.bulkApplyProductRules);
mountCrud(invRouter, '/companies', invCtrl.companyHandlers);
mountCrud(invRouter, '/brands', invCtrl.brandHandlers);
mountCrud(invRouter, '/categories', invCtrl.categoryHandlers);
mountCrud(invRouter, '/sub-categories', invCtrl.subCategoryHandlers);
mountCrud(invRouter, '/products', invCtrl.productHandlers);
router.use('/inventory', invRouter);

// Warehouse routes (/api/v1/warehouses)
const whRouter = express.Router();
whRouter.get('/dashboard', whCtrl.getWarehouseDashboardMetrics);
whRouter.get('/zones', whCtrl.listAllZones);
whRouter.get('/areas', whCtrl.listAllAreas);
whRouter.get('/', whCtrl.listWarehouses);
whRouter.get('/:id', whCtrl.getWarehouseById);
whRouter.post('/', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.createWarehouse);
whRouter.put('/:id', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.updateWarehouse);
whRouter.delete('/:id', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.deleteWarehouse);
whRouter.post('/:warehouseId/zones', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.addZone);
whRouter.put('/:warehouseId/zones/:zoneId', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.updateZone);
whRouter.delete('/:warehouseId/zones/:zoneId', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.deleteZone);
whRouter.post('/:warehouseId/zones/:zoneId/areas', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.addArea);
whRouter.put('/:warehouseId/zones/:zoneId/areas/:areaId', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.updateArea);
whRouter.delete('/:warehouseId/zones/:zoneId/areas/:areaId', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), whCtrl.deleteArea);
router.use('/warehouses', whRouter);

// Stock & Movement routes (/api/v1/stocks)
const stockRouter = express.Router();
stockRouter.get('/policy', mvCtrl.getStockPolicy);
stockRouter.put('/policy', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.updateStockPolicy);
stockRouter.patch('/policy', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.updateStockPolicy);
stockRouter.get('/batches', mvCtrl.listStockBatches);
stockRouter.patch('/batches/:id/status-condition', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.updateBatchStatusAndCondition);
stockRouter.post('/rules', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.applyStockRules);
stockRouter.get('/valuation', mvCtrl.getStockValuation);
stockRouter.get('/movements', mvCtrl.listMovements);
stockRouter.get('/movements/:id', mvCtrl.getMovementById);
stockRouter.post('/movements', mvCtrl.createMovement);
stockRouter.post('/purchase-receiving', requireRole('ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), prCtrl.createPurchaseReceiving);
stockRouter.get('/purchase-receiving/:id/result', prCtrl.getPurchaseReceivingResult);
stockRouter.post('/purchase-returns', requireRole('ADMIN', 'WAREHOUSE_MANAGER', 'STOREKEEPER'), prCtrl.createPurchaseReturn);
stockRouter.patch('/movements/:id/approve', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.approveMovement);
stockRouter.patch('/movements/:id/toggle-hide', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), mvCtrl.toggleHideMovement);
router.use('/stocks', stockRouter);

// CRM routes (/api/v1/crm)
const crmRouter = express.Router();
crmRouter.post('/customers/bulk-rules', requireRole('ADMIN'), crmCtrl.bulkApplyCustomerRules);
crmRouter.get('/customers', crmCtrl.listCustomers);
crmRouter.get('/customers/:id', crmCtrl.getCustomerById);
crmRouter.post('/customers', crmCtrl.createCustomer);
crmRouter.put('/customers/:id', crmCtrl.updateCustomer);
crmRouter.delete('/customers/:id', requireRole('ADMIN'), crmCtrl.deleteCustomer);
crmRouter.get('/areas', crmCtrl.listAreasAndRoutes);
crmRouter.post('/areas', crmCtrl.addAreaToTerritory);
crmRouter.get('/routes', crmCtrl.listAreasAndRoutes);
crmRouter.post('/routes', crmCtrl.addRouteToArea);
crmRouter.get('/territories', crmCtrl.listTerritories);
crmRouter.post('/territories', requireRole('ADMIN'), crmCtrl.createTerritory);
crmRouter.put('/territories/:id', requireRole('ADMIN'), crmCtrl.updateTerritory);
crmRouter.delete('/territories/:id', requireRole('ADMIN'), crmCtrl.deleteTerritory);
crmRouter.get('/beats', crmCtrl.listBeatPlans);
crmRouter.post('/beats', requireRole('ADMIN'), crmCtrl.createBeatPlan);
crmRouter.put('/beats/:id', requireRole('ADMIN'), crmCtrl.updateBeatPlan);
crmRouter.post('/beats/:id/duplicate', requireRole('ADMIN'), crmCtrl.duplicateBeatPlan);
crmRouter.delete('/beats/:id', requireRole('ADMIN'), crmCtrl.deleteBeatPlan);
router.use('/crm', crmRouter);

// Commercial Rules & Templates (/api/v1/rules)
const rulesRouter = express.Router();
for (const [slug, cat] of [['/taxes', 'TAX'], ['/discounts', 'DISCOUNT'], ['/charges', 'CHARGE'], ['/schemes', 'SCHEME']]) {
  rulesRouter.get(slug, rulesCtrl.listRules(cat));
  rulesRouter.post(slug, requireRole('ADMIN'), rulesCtrl.createRule(cat));
  rulesRouter.put(`${slug}/:id`, requireRole('ADMIN'), rulesCtrl.updateRule);
  rulesRouter.delete(`${slug}/:id`, requireRole('ADMIN'), rulesCtrl.deleteRule);
}
rulesRouter.get('/templates', rulesCtrl.listTemplates);
rulesRouter.post('/templates', requireRole('ADMIN'), rulesCtrl.createTemplate);
rulesRouter.put('/templates/:id', requireRole('ADMIN'), rulesCtrl.updateTemplate);
rulesRouter.delete('/templates/:id', requireRole('ADMIN'), rulesCtrl.deleteTemplate);
rulesRouter.get('/automation', rulesCtrl.getAutomationRules);
rulesRouter.post('/automation/evaluate', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), rulesCtrl.triggerAutomationEvaluation);
rulesRouter.post('/automation', requireRole('ADMIN'), rulesCtrl.saveAutomationRule);
rulesRouter.put('/automation/:id', requireRole('ADMIN'), rulesCtrl.saveAutomationRule);
rulesRouter.patch('/automation/:id/toggle', requireRole('ADMIN'), rulesCtrl.flipAutomationRule);
rulesRouter.delete('/automation/:id', requireRole('ADMIN'), rulesCtrl.removeAutomationRule);
rulesRouter.get('/', rulesCtrl.listRules(null));
rulesRouter.post('/', requireRole('ADMIN'), rulesCtrl.createRule(null));
rulesRouter.put('/:id', requireRole('ADMIN'), rulesCtrl.updateRule);
rulesRouter.delete('/:id', requireRole('ADMIN'), rulesCtrl.deleteRule);
router.use('/rules', rulesRouter);

// Orders (/api/v1/orders)
const orderRouter = express.Router();
orderRouter.get('/', orderCtrl.listOrders);
orderRouter.post('/calculate-preview', orderCtrl.calculateOrderPreview);
orderRouter.post('/', orderCtrl.createOrder);
orderRouter.patch('/approve-batch', requireRole('ADMIN'), orderCtrl.approveOrdersBatch);
orderRouter.post('/delivery-plan', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), orderCtrl.createDeliveryPlan);
orderRouter.get('/:id', orderCtrl.getOrderById);
orderRouter.put('/:id', orderCtrl.updateOrder);
orderRouter.patch('/:id', orderCtrl.updateOrder);
orderRouter.patch('/:id/cancel', orderCtrl.cancelOrder);
router.use('/orders', orderRouter);

// Sales & Recovery (/api/v1/sales-recovery)
const srRouter = express.Router();
srRouter.get('/dsr', dashCtrl.getDailySalesReport);
srRouter.get('/sales', srCtrl.listSales);
srRouter.get('/sales/:id', srCtrl.getSaleById);
srRouter.get('/recoveries', srCtrl.listRecoveries);
srRouter.post('/recovery-assign', requireRole('ADMIN', 'ACCOUNTANT'), srCtrl.assignRecoveryTask);
srRouter.post('/recovery-collect', srCtrl.collectRecovery);
srRouter.post('/extra-return', srCtrl.recordExtraReturn);
router.use('/sales-recovery', srRouter);

// Procurement (/api/v1/procurement)
const procRouter = express.Router();
procRouter.get('/summary', procCtrl.getProcurementSummary);
procRouter.get('/requests', procCtrl.listPurchaseOrders);
procRouter.post('/requests', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), procCtrl.createPurchaseOrder);
procRouter.get('/orders', procCtrl.listPurchaseOrders);
procRouter.post('/orders', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), procCtrl.createPurchaseOrder);
procRouter.patch('/orders/:id/convert', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), procCtrl.convertRequestToOrder);
procRouter.patch('/orders/:id/receive', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), procCtrl.receivePurchaseOrder);
procRouter.get('/payments', procCtrl.listSupplierPayments);
procRouter.post('/payments', requireRole('ADMIN', 'ACCOUNTANT'), procCtrl.recordSupplierPayment);
procRouter.get('/', procCtrl.listPurchaseOrders);
router.use('/procurement', procRouter);

// Pending Tasks (/api/v1/tasks)
const taskRouter = express.Router();
taskRouter.get('/my-tasks', taskCtrl.listMyTasks);
taskRouter.get('/:id', taskCtrl.getTaskById);
taskRouter.patch('/:id/start', taskCtrl.startOrDraftTask);
taskRouter.patch('/:id/dispatch', taskCtrl.executeDispatchTask);
taskRouter.patch('/:id/put-away', taskCtrl.executePutAwayTask);
taskRouter.patch('/:id/stock-count', taskCtrl.executeStockCountTask);
taskRouter.patch('/:id/complete', taskCtrl.completeTask);
taskRouter.patch('/:id/cancel', taskCtrl.cancelTask);
router.use('/tasks', taskRouter);

// Dedicated Mobile Portals (/api/v1/portals)
// Strict isolation: ADMIN requires explicit workParts; only SUPER_ADMIN has universal override
const portalRouter = express.Router();
portalRouter.get('/booker/beats', requireRoleOrWorkPart(['BOOKER'], ['orderBooker']), portalCtrl.getBookerBeats);
portalRouter.get('/booker/catalog', requireRoleOrWorkPart(['BOOKER'], ['orderBooker']), portalCtrl.getPortalCatalog);
portalRouter.post('/booker/orders', requireRoleOrWorkPart(['BOOKER'], ['orderBooker']), portalCtrl.createBookerOrder);
portalRouter.get('/booker/history', requireRoleOrWorkPart(['BOOKER'], ['orderBooker']), portalCtrl.getBookerHistory);
portalRouter.get('/pos/catalog', requireRoleOrWorkPart(['POS_OPERATOR'], ['posStore']), portalCtrl.getPortalCatalog);
portalRouter.post('/pos/checkout', requireRoleOrWorkPart(['POS_OPERATOR'], ['posStore']), portalCtrl.posCheckout);
portalRouter.get('/pos/history', requireRoleOrWorkPart(['POS_OPERATOR'], ['posStore']), portalCtrl.getPosHistory);
portalRouter.get('/salesman/delivery-plan', requireRoleOrWorkPart(['SALESMAN'], ['salesman']), portalCtrl.getSalesmanDeliveryPlan);
portalRouter.post('/salesman/deal', requireRoleOrWorkPart(['SALESMAN'], ['salesman']), portalCtrl.executeSalesmanDeal);
router.use('/portals', portalRouter);

// HRM (/api/v1/hrm)
const hrmRouter = express.Router();
hrmRouter.get('/employees', hrmCtrl.listEmployees);
hrmRouter.post('/employees', requireRole('ADMIN'), hrmCtrl.createEmployee);
hrmRouter.put('/employees/:id', requireRole('ADMIN'), hrmCtrl.updateEmployee);
hrmRouter.delete('/employees/:id', requireRole('ADMIN'), hrmCtrl.deleteEmployee);
hrmRouter.patch('/work-assignments/:id', requireRole('ADMIN'), hrmCtrl.updateWorkAssignment);
hrmRouter.get('/attendance', hrmCtrl.listAttendance);
hrmRouter.post('/attendance', hrmCtrl.recordAttendanceOrLeave);
hrmRouter.get('/payroll', hrmCtrl.listPayroll);
hrmRouter.post('/payroll/generate', requireRole('ADMIN', 'ACCOUNTANT'), hrmCtrl.generateMonthlyPayroll);
hrmRouter.patch('/payroll/:id/pay', requireRole('ADMIN', 'ACCOUNTANT'), hrmCtrl.payPayroll);
hrmRouter.get('/reports', hrmCtrl.getEmployeePerformanceReport);
router.use('/hrm', hrmRouter);

// Accounting (/api/v1/accounts)
const accRouter = express.Router();
accRouter.get('/movements', accCtrl.listAccountMovements);
accRouter.get('/cheques', accCtrl.listCheques);
accRouter.patch('/cheques/:id/status', requireRole('ADMIN', 'ACCOUNTANT'), accCtrl.updateChequeStatus);
accRouter.patch('/approve', requireRole('ADMIN', 'ACCOUNTANT'), accCtrl.approveAccountMovement);
accRouter.patch('/approve/:id', requireRole('ADMIN', 'ACCOUNTANT'), accCtrl.approveAccountMovement);
accRouter.get('/ledgers', accCtrl.listLedgers);
accRouter.post('/ledgers/journal', requireRole('ADMIN', 'ACCOUNTANT'), accCtrl.createManualJournal);
accRouter.get('/trial-balance', accCtrl.getTrialBalance);
accRouter.get('/profit-loss', accCtrl.getProfitAndLoss);
accRouter.get('/balance-sheet', accCtrl.getBalanceSheet);
accRouter.get('/cash-flow', accCtrl.getCashFlow);
router.use('/accounts', accRouter);

// Dashboards, Reports & Alerts (/api/v1/dashboards-reports)
const drRouter = express.Router();
drRouter.get('/dashboards/:moduleSlug', dashCtrl.getModuleDashboard);
drRouter.get('/reports/:reportSlug', dashCtrl.getReport);
drRouter.get('/notifications', dashCtrl.listNotifications);
drRouter.patch('/notifications/:id/read', dashCtrl.markNotificationRead);
drRouter.post('/notifications/evaluate', dashCtrl.runAutomationSweep);
router.use('/dashboards-reports', drRouter);

export default router;
