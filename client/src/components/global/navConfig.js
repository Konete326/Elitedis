import {
  LayoutDashboard, Package, Building2, Tag, Layers, Warehouse,
  ArrowLeftRight, Users, MapPin, Compass, ShoppingCart, Receipt,
  SlidersHorizontal, Printer, ClipboardList, Smartphone, UserCheck,
  Landmark, BarChart3, Share2, ShieldCheck,
} from 'lucide-react';

const ADM = ['SUPER_ADMIN', 'ADMIN'];
const WH = [...ADM, 'WAREHOUSE_MANAGER', 'STOREKEEPER'];

export const NAV_GROUPS = [
  {
    key: 'Super Admin',
    items: [
      { to: '/super-admin/distributors', label: 'Distributors (Tenants)', icon: ShieldCheck, roles: ['SUPER_ADMIN'], strictRoleOnly: true },
    ],
  },
  {
    key: 'Inventory & Stock',
    items: [
      { to: '/inventory/products', label: 'Products', icon: Package, roles: WH },
      { to: '/inventory/companies', label: 'Companies', icon: Building2, roles: ADM },
      { to: '/inventory/brands', label: 'Brands', icon: Tag, roles: ADM },
      { to: '/inventory/categories', label: 'Categories', icon: Layers, roles: ADM },
      { to: '/inventory/sub-categories', label: 'Sub-Categories', icon: Layers, roles: ADM },
      { to: '/stock/overview', label: 'Stock Overview', icon: LayoutDashboard, roles: WH, workPart: 'warehouseManager' },
      { to: '/stock/list', label: 'Stock Batches', icon: Package, roles: WH, workPart: 'warehouseManager' },
      { to: '/stock/warehouses', label: 'Warehouses', icon: Warehouse, roles: [...ADM, 'WAREHOUSE_MANAGER'], workPart: 'warehouseManager' },
      { to: '/stock/zones', label: 'Zones', icon: Warehouse, roles: [...ADM, 'WAREHOUSE_MANAGER'], workPart: 'warehouseManager' },
      { to: '/stock/areas', label: 'Storage Areas', icon: MapPin, roles: WH, workPart: 'warehouseManager' },
      { to: '/stock/purchase-receiving', label: 'Purchase Receiving', icon: Package, roles: WH, workPart: 'warehouseManager' },
      { to: '/stock/movements', label: 'Stock Movements', icon: ArrowLeftRight, roles: WH, workPart: 'warehouseManager' },
    ],
  },
  {
    key: 'CRM & Beats',
    items: [
      { to: '/crm/dashboard', label: 'CRM Dashboard', icon: LayoutDashboard, roles: [...ADM, 'BOOKER'] },
      { to: '/crm/customers', label: 'Customers', icon: Users, roles: [...ADM, 'BOOKER', 'SALESMAN', 'ACCOUNTANT'] },
      { to: '/crm/areas-routes', label: 'Areas & Routes', icon: MapPin, roles: [...ADM, 'BOOKER'] },
      { to: '/crm/territories', label: 'Territories', icon: Compass, roles: ADM },
      { to: '/crm/beats', label: 'Beat Plans', icon: ClipboardList, roles: [...ADM, 'BOOKER'], workPart: 'orderBooker' },
    ],
  },
  {
    key: 'Order & Sales',
    items: [
      { to: '/orders/master', label: 'Order Master', icon: ShoppingCart, roles: [...ADM, 'BOOKER', 'WAREHOUSE_MANAGER'] },
      { to: '/orders/create-normal', label: 'Normal Order', icon: ShoppingCart, roles: [...ADM, 'BOOKER'], workPart: 'normalInvoice' },
      { to: '/orders/create-advance', label: 'Advance Order', icon: ShoppingCart, roles: ADM, workPart: 'advanceInvoice' },
      { to: '/orders/operations', label: 'Approval & Dispatch', icon: ClipboardList, roles: [...ADM, 'WAREHOUSE_MANAGER'] },
      { to: '/sales/master', label: 'Sales Master', icon: Receipt, roles: [...ADM, 'ACCOUNTANT', 'POS_OPERATOR', 'SALESMAN'] },
      { to: '/sales/dsr', label: 'Daily Sales Report', icon: BarChart3, roles: [...ADM, 'ACCOUNTANT', 'SALESMAN', 'BOOKER'] },
      { to: '/recovery/assign', label: 'Recovery Assign', icon: Receipt, roles: [...ADM, 'ACCOUNTANT'] },
      { to: '/recovery/ledger', label: 'Recovery Ledger', icon: Receipt, roles: [...ADM, 'ACCOUNTANT', 'SALESMAN', 'BOOKER'] },
    ],
  },
  {
    key: 'Rules & Templates',
    items: [
      { to: '/settings/rules', label: 'Rules & Schemes', icon: SlidersHorizontal, roles: ADM },
      { to: '/settings/stock-policy', label: 'Stock Issue Policy', icon: SlidersHorizontal, roles: [...ADM, 'WAREHOUSE_MANAGER'] },
      { to: '/settings/templates', label: 'Print Templates', icon: Printer, roles: ADM },
      { to: '/settings/automation', label: 'Automation Rules', icon: SlidersHorizontal, roles: ADM },
    ],
  },
  {
    key: 'Pending Tasks',
    items: [
      { to: '/tasks/pending', label: 'My Task Queue', activePrefix: '/tasks/', icon: ClipboardList, roles: [...WH, 'SALESMAN', 'BOOKER'] },
    ],
  },
  {
    key: 'Field Portals',
    items: [
      { to: '/portal/booker', label: 'Booker Portal', icon: Smartphone, roles: ['SUPER_ADMIN', 'BOOKER'], strictRoleOnly: true },
      { to: '/portal/pos', label: 'POS Counter', icon: Smartphone, roles: ['SUPER_ADMIN', 'POS_OPERATOR'], strictRoleOnly: true },
      { to: '/portal/salesman', label: 'Salesman Portal', icon: Smartphone, roles: ['SUPER_ADMIN', 'SALESMAN'], strictRoleOnly: true },
    ],
  },
  {
    key: 'HRM',
    items: [
      { to: '/hrm/employees', label: 'Employees', icon: UserCheck, roles: ADM },
      { to: '/hrm/attendance', label: 'Attendance & Leave', icon: UserCheck, roles: ADM },
      { to: '/hrm/payroll', label: 'Payroll', icon: Landmark, roles: [...ADM, 'ACCOUNTANT'] },
      { to: '/hrm/reports', label: 'Staff Performance', icon: BarChart3, roles: ADM },
    ],
  },
  {
    key: 'ERP Accounts',
    items: [
      { to: '/accounts/movements', label: 'Account Movements', icon: Landmark, roles: [...ADM, 'ACCOUNTANT'] },
      { to: '/accounts/ledgers', label: 'Ledgers & Day Book', icon: Landmark, roles: [...ADM, 'ACCOUNTANT'] },
      { to: '/accounts/statements', label: 'Statements', icon: BarChart3, roles: [...ADM, 'ACCOUNTANT'] },
      { to: '/procurement', label: 'Procurement & PO', icon: Package, roles: [...ADM, 'ACCOUNTANT', 'WAREHOUSE_MANAGER'] },
    ],
  },
  {
    key: 'Reports & Dashboards',
    items: [
      { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, roles: [...ADM, 'WAREHOUSE_MANAGER', 'ACCOUNTANT'] },
      { to: '/reports/center', label: 'Report Center', icon: BarChart3, roles: [...ADM, 'ACCOUNTANT', 'WAREHOUSE_MANAGER'] },
      { to: '/reports/company-share', label: 'Company Share', icon: Share2, roles: [...ADM, 'BOOKER'] },
    ],
  },
];

export const EXTRA_QUICK_ROUTES = [
  { to: '/inventory/products/create', label: 'Add New Product', group: 'Inventory & Stock', roles: ADM },
  { to: '/stock/movements/create', label: 'Create Stock Movement', group: 'Inventory & Stock', roles: WH, workPart: 'warehouseManager' },
];

export const QUICK_ACTIONS = [
  { label: 'Create Order', to: '/orders/create-normal', icon: ShoppingCart, roles: [...ADM, 'BOOKER'], workPart: 'normalInvoice' },
  { label: 'New Movement', to: '/stock/movements/create', icon: ArrowLeftRight, roles: WH, workPart: 'warehouseManager' },
  { label: 'POS Counter', to: '/portal/pos', icon: Smartphone, roles: ['SUPER_ADMIN', 'POS_OPERATOR'], strictRoleOnly: true },
  { label: 'Assign Recovery', to: '/recovery/assign', icon: Receipt, roles: [...ADM, 'ACCOUNTANT'] },
];

export function canAccessNavItem(item, hasRole, hasWorkPart) {
  if (hasRole('SUPER_ADMIN')) return true;
  if (item.strictRoleOnly) return hasRole(...(item.roles || []));
  return (
    hasRole(...(item.roles || [])) ||
    (!hasRole('ADMIN') && Boolean(item.workPart && hasWorkPart?.(item.workPart)))
  );
}
