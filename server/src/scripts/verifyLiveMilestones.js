import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedSuperAdmin } from '../config/seedSuperAdmin.js';
import { destroyImage } from '../config/cloudinary.js';
import { app } from '../server.js';
import * as models from '../models/index.js';

const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let baseUrl = '';
let passed = 0;
let testDistributorId = '';
const testPublicIds = [];

async function api(method, path, body = null, token = null) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function step(label, fn) {
  const res = await fn();
  passed += 1;
  console.log(`[PASS ${String(passed).padStart(2, '0')}] ${label}`);
  return res;
}

async function cleanupTestTenant() {
  if (!testDistributorId) return;
  const filter = { distributorId: testDistributorId };
  const allModels = Object.values(models).filter((m) => m && typeof m.deleteMany === 'function');
  await Promise.all(allModels.map((M) => M.deleteMany(filter)));
  if (mongoose.connection?.db) await mongoose.connection.db.collection('automation_rules').deleteMany(filter);
  await Promise.allSettled(testPublicIds.map((pid) => destroyImage(pid)));
}

async function run() {
  let httpServer = null;
  try {
    await connectDB({ throwOnError: true });
    await seedSuperAdmin();
    httpServer = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

    await step('M1.1 Health check reports Atlas connected', async () => {
      const r = await api('GET', '/health');
      assert.equal(r.status, 200);
      assert.equal(r.json.database.connected, true);
    });

    const superTokens = await step('M1.2 Super Admin login, refresh rotation & /auth/me', async () => {
      const login = await api('POST', '/auth/login', { email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD });
      assert.equal(login.status, 200);
      const ref = await api('POST', '/auth/refresh', { refreshToken: login.json.data.refreshToken });
      assert.equal(ref.status, 200);
      const me = await api('GET', '/auth/me', null, ref.json.data.accessToken);
      assert.equal(me.status, 200);
      assert.equal(me.json.data.primaryRole, 'SUPER_ADMIN');
      return ref.json.data;
    });

    const adminAuth = await step('M1.3 Isolated test distributor registration', async () => {
      const reg = await api('POST', '/auth/register', {
        fullName: 'Live Verify Admin',
        email: `verify.${Date.now()}@elitedist.test`,
        phone: '03001112233',
        password: 'VerifyAdmin@2026!',
        distributorName: 'Verify Dist Agency',
        distributorCode: 'VFY',
      });
      assert.equal(reg.status, 201);
      testDistributorId = reg.json.data.user.distributorId;
      return reg.json.data;
    });
    const tok = adminAuth.accessToken;

    await step('M1.4 Cloudinary live image upload & destroy', async () => {
      const form = new FormData();
      form.append('folder', 'verify_test');
      form.append('image', new Blob([Buffer.from(PNG_1X1_B64, 'base64')], { type: 'image/png' }), 'test.png');
      const up = await api('POST', '/upload/image', form, tok);
      assert.equal(up.status, 201);
      assert.ok(up.json.data.url.startsWith('https://'));
      testPublicIds.push(up.json.data.publicId);
      assert.equal((await api('DELETE', `/upload/image?publicId=${encodeURIComponent(up.json.data.publicId)}`, null, tok)).status, 200);
    });

    const inv = await step('M2 Inventory Master, multi-unit math, bulk rules, tenant guard & dashboard', async () => {
      const cmp = await api('POST', '/inventory/companies', { companyName: 'Green Chemicals Verify', shortName: 'GCV' }, tok);
      assert.equal(cmp.status, 201);
      assert.equal((await api('GET', `/inventory/companies/${cmp.json.data._id}`, null, superTokens.accessToken)).status, 404);
      const brd = await api('POST', '/inventory/brands', { brandName: 'SURAJ VERIFY', companyId: cmp.json.data._id }, tok);
      const cat = await api('POST', '/inventory/categories', { name: 'Detergent', companyId: cmp.json.data._id, linkedBrandIds: [brd.json.data._id] }, tok);
      const sub = await api('POST', '/inventory/sub-categories', { name: 'Powder', parentCategoryId: cat.json.data._id, companyId: cmp.json.data._id }, tok);
      const prod = await api('POST', '/inventory/products', {
        productName: 'Suraj 500g Verify',
        companyId: cmp.json.data._id,
        brandId: brd.json.data._id,
        categoryId: cat.json.data._id,
        subCategoryId: sub.json.data._id,
        baseUnit: { unitName: 'Packet', weightValue: 0.5, weightUnit: 'Kg', traderPurchaseRate: 90, wholesaleSaleRate: 110, posRetailEndRate: 120 },
        packingUnits: [{ unitName: 'Carton', conversionQty: 24, traderPurchaseRate: 2160, wholesaleSaleRate: 2640, posRetailEndRate: 2880, dimensions: { sizeUnit: 'Inch', width: 10, length: 12, height: 8 }, isDefaultStockUnit: true }],
      }, tok);
      assert.equal(prod.status, 201);
      assert.equal(prod.json.data.packingUnits[0].packingWeightKg, 12);
      assert.equal(prod.json.data.packingUnits[0].dimensions.volumeCubic, 960);
      assert.equal((await api('POST', '/inventory/products/bulk-rules', { productIds: [prod.json.data._id], showOnMarketplace: true }, tok)).status, 200);
      assert.equal((await api('GET', '/inventory/dashboard', null, tok)).status, 200);
      return { company: cmp.json.data, brand: brd.json.data, product: prod.json.data };
    });

    const wh = await step('M3 Warehouse/Zone/Area, Purchase Batch, Zero-Stock Delete Guard & Same Transfer', async () => {
      const w = await api('POST', '/warehouses', { warehouseName: 'Orangi Main Verify' }, tok);
      const z = await api('POST', `/warehouses/${w.json.data._id}/zones`, { zoneName: 'Main Plot' }, tok);
      const a1 = await api('POST', `/warehouses/${w.json.data._id}/zones/${z.json.data._id}/areas`, { areaName: 'Floor 1' }, tok);
      const a2 = await api('POST', `/warehouses/${w.json.data._id}/zones/${z.json.data._id}/areas`, { areaName: 'Floor 2' }, tok);
      const pur = await api('POST', '/stocks/movements', {
        movementType: 'PURCHASE',
        toWarehouseId: w.json.data._id,
        supplierCompanyId: inv.company._id,
        status: 'COMPLETED',
        items: [{ productId: inv.product._id, batchNo: 'B-VFY-01', toZoneId: z.json.data._id, toAreaId: a1.json.data._id, unitName: 'Carton', movedPackQty: 5, movedBaseQty: 120, expDate: new Date(Date.now() + 20 * 86400000) }],
      }, tok);
      assert.equal(pur.status, 201);
      const blockedDel = await api('DELETE', `/warehouses/${w.json.data._id}/zones/${z.json.data._id}/areas/${a1.json.data._id}`, null, tok);
      assert.equal(blockedDel.status, 400);
      assert.equal(blockedDel.json.code, 'ZERO_STOCK_GUARD_BLOCKED');
      const batches = await api('GET', '/stocks/batches', null, tok);
      assert.equal(batches.json.data[0].currentBaseQty, 120);
      const trf = await api('POST', '/stocks/movements', {
        movementType: 'SAME_TRANSFER',
        fromWarehouseId: w.json.data._id,
        status: 'COMPLETED',
        items: [{ productId: inv.product._id, batchId: batches.json.data[0]._id, fromZoneId: z.json.data._id, fromAreaId: a1.json.data._id, toZoneId: z.json.data._id, toAreaId: a2.json.data._id, unitName: 'Packet', movedBaseQty: 24 }],
      }, tok);
      assert.equal(trf.status, 201);
      assert.equal((await api('GET', '/stocks/valuation', null, tok)).json.data.summary.totalCurrentBaseQty, 120);
      return { warehouse: w.json.data, zone: z.json.data, area1: a1.json.data, area2: a2.json.data, batch: batches.json.data[0] };
    });

    const staff = await step('M4 Employee RBAC 403, Territory/Route, Customer & BeatPlan duplication', async () => {
      const emp = await api('POST', '/hrm/employees', {
        fullName: 'Verify Booker', email: `booker.${Date.now()}@elitedist.test`, phone: '03112223344', password: 'BookerPass@2026',
        primaryRole: 'BOOKER', workParts: { orderBooker: true, salesman: true, posStore: true }, basicSalaryPkr: 30000, commissionPct: 2,
      }, tok);
      assert.equal(emp.status, 201);
      const bLogin = await api('POST', '/auth/login', { email: emp.json.data.email, password: 'BookerPass@2026' });
      assert.equal((await api('POST', '/inventory/products/bulk-rules', { productIds: [inv.product._id] }, bLogin.json.data.accessToken)).status, 403);
      const ter = await api('POST', '/crm/territories', { territoryName: 'Orangi Verify', linkedBookerId: emp.json.data._id, areas: [{ areaName: 'Qasba Colony', city: 'Karachi', routes: [{ routeName: 'Jamsheed Pump Road' }] }] }, tok);
      assert.equal(ter.status, 201);
      const areaId = ter.json.data.areas[0]._id;
      const routeId = ter.json.data.areas[0].routes[0]._id;
      const cust = await api('POST', '/crm/customers', {
        shopName: 'Lucky Verify Store', ownerName: 'Imtiaz Verify', ownerContact: '03219998877', customerType: 'WHOLESALER',
        locationHierarchy: { city: 'Karachi', townOrZone: 'Orangi', areaId, routeId, pehchanRemarks: 'Near Pump' },
        financialTerms: { paymentCondition: 'ALLOW_CREDIT', creditLimitPkr: 50000 },
      }, tok);
      assert.equal(cust.status, 201);
      const beat = await api('POST', '/crm/beats', {
        beatName: 'Monday Verify Beat', beatDay: 'MONDAY', assignedBookerId: emp.json.data._id,
        connectedAreas: [{ areaId, areaName: 'Qasba Colony', connectedRoutes: [{ routeId, routeName: 'Jamsheed Pump Road', customers: [{ customerId: cust.json.data._id, customerType: 'WHOLESALER', decision: 'ACCEPT' }] }] }],
      }, tok);
      assert.equal(beat.status, 201);
      assert.equal((await api('POST', `/crm/beats/${beat.json.data._id}/duplicate`, { beatDay: 'TUESDAY' }, tok)).status, 201);
      return { booker: emp.json.data, bookerToken: bLogin.json.data.accessToken, customer: cust.json.data };
    });

    const orderFlow = await step('M5 & M6 Rules, 2-level preview, Order Approval Reservation, Delivery Plan & DSR', async () => {
      const tax = await api('POST', '/rules/taxes', { ruleName: 'GST 5%', level: 'PRODUCT_LEVEL', calculationMode: 'PERCENTAGE', benefitValue: 5 }, tok);
      const sch = await api('POST', '/rules/schemes', { ruleName: '10 Per 1 Free', level: 'PRODUCT_LEVEL', calculationMode: 'PRODUCT_WISE_SCHEME', schemeDetails: { paidProductId: inv.product._id, paidQty: 10, freeProductId: inv.product._id, freeQty: 1, freeUnit: 'Packet' } }, tok);
      assert.equal((await api('POST', '/rules/templates', { templateName: 'Verify Chillan', documentType: 'CHILLAN_FINANCE', isDefault: true }, tok)).status, 201);
      const prev = await api('POST', '/orders/calculate-preview', {
        lineItems: [{ productId: inv.product._id, productName: inv.product.productName, unitName: 'Packet', conversionQty: 1, unitWeightKg: 0.5, baseRate: 1450, customSaleRate: 1300, quantity: 10, itemTaxRuleId: tax.json.data._id, schemeRuleId: sch.json.data._id }],
      }, tok);
      assert.equal(prev.json.data.lineItems[1].isFreeSchemeRow, true);
      assert.equal(prev.json.data.lineItems[0].itemDiscountAmount, 1500);
      const ord = await api('POST', '/orders', {
        customerId: staff.customer._id,
        lineItems: [{ productId: inv.product._id, batchId: wh.batch._id, productName: inv.product.productName, unitName: 'Packet', conversionQty: 1, unitWeightKg: 0.5, baseRate: 110, quantity: 10 }],
      }, tok);
      assert.equal((await api('PATCH', '/orders/approve-batch', { orderIds: [ord.json.data._id] }, tok)).status, 200);
      const bAfter = await api('GET', `/stocks/batches?warehouseId=${wh.warehouse._id}`, null, tok);
      assert.ok(bAfter.json.data.some((b) => b.reservedBaseQty === 10));
      const plan = await api('POST', '/orders/delivery-plan', { orderIds: [ord.json.data._id], salesmanId: staff.booker._id, storekeeperId: staff.booker._id, vehicleInfo: { vehicleNo: 'KHI-2026' } }, tok);
      assert.equal(plan.status, 201);
      const dsr = await api('GET', '/sales-recovery/dsr', null, tok);
      assert.equal(dsr.status, 200);
      assert.ok(dsr.json.data.summary.bookedOrdersCount >= 1);
      return { order: ord.json.data, plan: plan.json.data };
    });

    await step('M7 & M8 Tasks dispatch + Booker, POS & Salesman portals', async () => {
      const tasks = await api('GET', '/tasks/my-tasks?all=true', null, tok);
      const dispTask = tasks.json.data.find((t) => t.taskType === 'DELIVERY_DISPATCH');
      assert.ok(dispTask);
      assert.equal((await api('PATCH', `/tasks/${dispTask._id}/dispatch`, { complete: true }, tok)).status, 200);
      assert.equal((await api('POST', '/portals/booker/orders', { customerId: staff.customer._id, lineItems: [{ productId: inv.product._id, unitName: 'Packet', conversionQty: 1, baseRate: 110, quantity: 2 }] }, staff.bookerToken)).status, 201);
      assert.equal((await api('POST', '/portals/pos/checkout', { walkInCustomerName: 'Walk-in Verify', lineItems: [{ productId: inv.product._id, batchId: wh.batch._id, unitName: 'Packet', conversionQty: 1, baseRate: 120, quantity: 2 }] }, staff.bookerToken)).status, 201);
      assert.equal((await api('POST', '/portals/salesman/deal', { saleInvoiceId: orderFlow.plan.invoices[0]._id, dispatchSheetId: orderFlow.plan.dispatchSheet._id, payment: { paymentMode: 'CASH', cashAmountPkr: 500 }, tripExpenses: [{ category: 'GAS_PETROL', amountPkr: 100, remark: 'Fuel' }] }, staff.bookerToken)).status, 200);
    });

    await step('M9 HRM, Procurement, Cheque Lifecycle & Balanced Accounting Statements', async () => {
      assert.equal((await api('POST', '/hrm/attendance', { employeeId: staff.booker._id, attendanceStatus: 'PRESENT' }, tok)).status, 201);
      const payGen = await api('POST', '/hrm/payroll/generate', { monthYear: '2026-11', employeeId: staff.booker._id }, tok);
      assert.equal((await api('PATCH', `/hrm/payroll/${payGen.json.data[0]._id}/pay`, {}, tok)).status, 200);
      const po = await api('POST', '/procurement/orders', { supplierCompanyId: inv.company._id, toWarehouseId: wh.warehouse._id, items: [{ productId: inv.product._id, unitName: 'Carton', movedPackQty: 1, movedBaseQty: 24, toZoneId: wh.zone._id, toAreaId: wh.area2._id }] }, tok);
      assert.equal((await api('PATCH', `/procurement/orders/${po.json.data._id}/receive`, {}, tok)).status, 200);
      assert.equal((await api('POST', '/procurement/payments', { supplierCompanyId: inv.company._id, amountPkr: 1000, paymentMode: 'CASH' }, tok)).status, 201);

      const chq1 = await api('POST', '/sales-recovery/recovery-collect', { customerId: staff.customer._id, saleInvoiceId: orderFlow.plan.invoices[0]._id, paymentMode: 'CHEQUE', chequeDetails: { chequeNo: 'CHQ-VFY-1', bankName: 'HBL', amountPkr: 300 } }, tok);
      assert.equal((await api('PATCH', `/accounts/cheques/${chq1.json.data._id}/status`, { status: 'DEPOSITED' }, tok)).status, 200);
      assert.equal((await api('PATCH', `/accounts/cheques/${chq1.json.data._id}/status`, { status: 'BOUNCED' }, tok)).status, 200);
      const chq2 = await api('POST', '/sales-recovery/recovery-collect', { customerId: staff.customer._id, saleInvoiceId: orderFlow.plan.invoices[0]._id, paymentMode: 'CHEQUE', chequeDetails: { chequeNo: 'CHQ-VFY-2', bankName: 'Meezan', amountPkr: 200 } }, tok);
      assert.equal((await api('PATCH', `/accounts/cheques/${chq2.json.data._id}/status`, { status: 'CLEARED' }, tok)).status, 200);

      const tb = await api('GET', '/accounts/trial-balance', null, tok);
      assert.equal(tb.status, 200);
      assert.equal(tb.json.data.isBalanced, true);
      assert.equal((await api('GET', '/accounts/profit-loss', null, tok)).status, 200);
      assert.equal((await api('GET', '/accounts/balance-sheet', null, tok)).status, 200);
      assert.equal((await api('GET', '/accounts/cash-flow', null, tok)).status, 200);
    });

    await step('M10 Dashboards, Company-share isolation, Automation rules & idempotent sweep', async () => {
      assert.equal((await api('GET', '/dashboards-reports/dashboards/executive', null, tok)).status, 200);
      assert.equal((await api('GET', `/dashboards-reports/reports/company-share?companyId=${inv.company._id}`, null, tok)).status, 200);
      assert.equal((await api('GET', '/rules/automation', null, tok)).status, 200);
      await api('POST', '/stocks/rules', { batchIds: [wh.batch._id], minStockPack: 500, maxStockPack: 1000, expiryAlertDays: 90 }, tok);
      const sw1 = await api('POST', '/rules/automation/evaluate', {}, tok);
      const sw2 = await api('POST', '/rules/automation/evaluate', {}, tok);
      assert.equal(sw1.status, 200);
      assert.equal(sw2.status, 200);
      assert.equal(sw2.json.data.draftedPurchase, null);
    });

    console.log(`\nALL ${passed} LIVE MILESTONE CHECKS PASSED!`);
  } finally {
    await cleanupTestTenant().catch((e) => console.error('[CLEANUP WARN]', e.message));
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await disconnectDB();
  }
}

run().catch((err) => {
  console.error('[VERIFY LIVE FAILED]', err);
  process.exit(1);
});
