import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/global';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import ProtectedRoute from './ProtectedRoute';

import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ExecutiveDashboardPage from '../pages/dashboards/ExecutiveDashboardPage';

import ProductsPage from '../pages/inventory/ProductsPage';
import CreateProductPage from '../pages/inventory/CreateProductPage';
import CompaniesPage from '../pages/inventory/CompaniesPage';
import BrandsPage from '../pages/inventory/BrandsPage';
import CategoriesPage from '../pages/inventory/CategoriesPage';
import SubCategoriesPage from '../pages/inventory/SubCategoriesPage';

import StockOverviewPage from '../pages/stock/StockOverviewPage';
import StockListPage from '../pages/stock/StockListPage';
import WarehousesPage from '../pages/stock/WarehousesPage';
import ZonesPage from '../pages/stock/ZonesPage';
import AreasPage from '../pages/stock/AreasPage';
import MovementsPage from '../pages/stock/MovementsPage';
import CreateMovementPage from '../pages/stock/CreateMovementPage';

import CrmDashboardPage from '../pages/crm/CrmDashboardPage';
import CustomersPage from '../pages/crm/CustomersPage';
import AreasRoutesPage from '../pages/crm/AreasRoutesPage';
import TerritoriesPage from '../pages/crm/TerritoriesPage';
import BeatsPage from '../pages/crm/BeatsPage';

import OrdersMasterPage from '../pages/orders/OrdersMasterPage';
import CreateNormalOrderPage from '../pages/orders/CreateNormalOrderPage';
import CreateAdvanceOrderPage from '../pages/orders/CreateAdvanceOrderPage';
import OrderOperationsPage from '../pages/orders/OrderOperationsPage';

import SalesMasterPage from '../pages/sales/SalesMasterPage';
import DailySalesReportPage from '../pages/sales/DailySalesReportPage';
import RecoveryAssignPage from '../pages/sales/RecoveryAssignPage';
import RecoveryLedgerPage from '../pages/sales/RecoveryLedgerPage';

import RulesPage from '../pages/settings/RulesPage';
import TemplatesPage from '../pages/settings/TemplatesPage';
import AutomationRulesPage from '../pages/settings/AutomationRulesPage';
import StockPolicyPage from '../pages/settings/StockPolicyPage';

import PendingTasksPage from '../pages/tasks/PendingTasksPage';
import ExecuteTaskPage from '../pages/tasks/ExecuteTaskPage';

import BookerPortalPage from '../pages/portals/BookerPortalPage';
import PosPortalPage from '../pages/portals/PosPortalPage';
import SalesmanPortalPage from '../pages/portals/SalesmanPortalPage';

import EmployeesPage from '../pages/hrm/EmployeesPage';
import AttendancePage from '../pages/hrm/AttendancePage';
import PayrollPage from '../pages/hrm/PayrollPage';
import HrmReportsPage from '../pages/hrm/HrmReportsPage';

import AccountMovementsPage from '../pages/accounts/AccountMovementsPage';
import AccountLedgersPage from '../pages/accounts/AccountLedgersPage';
import FinancialStatementsPage from '../pages/accounts/FinancialStatementsPage';

import ReportsCenterPage from '../pages/reports/ReportsCenterPage';
import CompanySharePage from '../pages/reports/CompanySharePage';
import ProcurementPage from '../pages/procurement/ProcurementPage';
import DistributorsPage from '../pages/super-admin/DistributorsPage';
import NotFound404 from '../pages/errors/NotFound404';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

function RoleHomeRedirect() {
  const { isAuthenticated, isLoading, getRoleHomeRoute } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <Navigate to={getRoleHomeRoute()} replace />;
}

function AuthenticatedShell() {
  const { user, isAuthenticated } = useAuth();
  const notifQuery = useQuery({
    queryKey: ['topbar-notifications', user?.distributorId],
    queryFn: async () => (await apiClient.get('/dashboards-reports/notifications', { params: { limit: 10 } })).data?.data || [],
    enabled: Boolean(isAuthenticated),
    staleTime: 60 * 1000,
  });

  return <AppShell notifications={notifQuery.data || []} />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/" element={<RoleHomeRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedShell />}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'ACCOUNTANT']}>
                <ExecutiveDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/dashboard"
            element={
              <ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']}>
                <ExecutiveDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventory/products"
            element={
              <ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']}>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/products/create"
            element={
              <ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']}>
                <CreateProductPage />
              </ProtectedRoute>
            }
          />
          <Route path="/inventory/companies" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><CompaniesPage /></ProtectedRoute>} />
          <Route path="/inventory/brands" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><BrandsPage /></ProtectedRoute>} />
          <Route path="/inventory/categories" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><CategoriesPage /></ProtectedRoute>} />
          <Route path="/inventory/sub-categories" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><SubCategoriesPage /></ProtectedRoute>} />

          <Route path="/stock/overview" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']} requiredWorkPart="warehouseManager"><StockOverviewPage /></ProtectedRoute>} />
          <Route path="/stock/list" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']} requiredWorkPart="warehouseManager"><StockListPage /></ProtectedRoute>} />
          <Route path="/stock/warehouses" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER']} requiredWorkPart="warehouseManager"><WarehousesPage /></ProtectedRoute>} />
          <Route path="/stock/zones" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER']} requiredWorkPart="warehouseManager"><ZonesPage /></ProtectedRoute>} />
          <Route path="/stock/areas" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']} requiredWorkPart="warehouseManager"><AreasPage /></ProtectedRoute>} />
          <Route path="/stock/movements" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']} requiredWorkPart="warehouseManager"><MovementsPage /></ProtectedRoute>} />
          <Route path="/stock/movements/create" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER']} requiredWorkPart="warehouseManager"><CreateMovementPage /></ProtectedRoute>} />

          <Route path="/crm/dashboard" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER']}><CrmDashboardPage /></ProtectedRoute>} />
          <Route path="/crm/customers" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER', 'SALESMAN', 'ACCOUNTANT']}><CustomersPage /></ProtectedRoute>} />
          <Route path="/crm/areas-routes" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER']}><AreasRoutesPage /></ProtectedRoute>} />
          <Route path="/crm/territories" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><TerritoriesPage /></ProtectedRoute>} />
          <Route path="/crm/beats" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER']} requiredWorkPart="orderBooker"><BeatsPage /></ProtectedRoute>} />

          <Route path="/orders/master" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER', 'WAREHOUSE_MANAGER']}><OrdersMasterPage /></ProtectedRoute>} />
          <Route path="/orders/create-normal" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER']} requiredWorkPart="normalInvoice"><CreateNormalOrderPage /></ProtectedRoute>} />
          <Route path="/orders/create-advance" element={<ProtectedRoute allowedRoles={ADMIN_ROLES} requiredWorkPart="advanceInvoice"><CreateAdvanceOrderPage /></ProtectedRoute>} />
          <Route path="/orders/operations" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER']}><OrderOperationsPage /></ProtectedRoute>} />

          <Route path="/sales/master" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT', 'POS_OPERATOR', 'SALESMAN']}><SalesMasterPage /></ProtectedRoute>} />
          <Route path="/sales/dsr" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT', 'SALESMAN', 'BOOKER']}><DailySalesReportPage /></ProtectedRoute>} />
          <Route path="/recovery/assign" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT']}><RecoveryAssignPage /></ProtectedRoute>} />
          <Route path="/recovery/ledger" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT', 'SALESMAN', 'BOOKER']}><RecoveryLedgerPage /></ProtectedRoute>} />

          <Route path="/settings/rules" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><RulesPage /></ProtectedRoute>} />
          <Route path="/settings/templates" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><TemplatesPage /></ProtectedRoute>} />
          <Route path="/settings/automation" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><AutomationRulesPage /></ProtectedRoute>} />
          <Route path="/settings/stock-policy" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER']}><StockPolicyPage /></ProtectedRoute>} />

          <Route path="/tasks/pending" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER', 'SALESMAN', 'BOOKER']}><PendingTasksPage /></ProtectedRoute>} />
          <Route path="/tasks/execute/:taskId" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'WAREHOUSE_MANAGER', 'STOREKEEPER', 'SALESMAN', 'BOOKER']}><ExecuteTaskPage /></ProtectedRoute>} />

          <Route path="/portal/booker" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BOOKER']} requiredWorkPart="orderBooker"><BookerPortalPage /></ProtectedRoute>} />
          <Route path="/portal/pos" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_OPERATOR']} requiredWorkPart="posStore"><PosPortalPage /></ProtectedRoute>} />
          <Route path="/portal/salesman" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SALESMAN']} requiredWorkPart="salesman"><SalesmanPortalPage /></ProtectedRoute>} />

          <Route path="/hrm/employees" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><EmployeesPage /></ProtectedRoute>} />
          <Route path="/hrm/attendance" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><AttendancePage /></ProtectedRoute>} />
          <Route path="/hrm/payroll" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT']}><PayrollPage /></ProtectedRoute>} />
          <Route path="/hrm/reports" element={<ProtectedRoute allowedRoles={ADMIN_ROLES}><HrmReportsPage /></ProtectedRoute>} />

          <Route path="/accounts/movements" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT']}><AccountMovementsPage /></ProtectedRoute>} />
          <Route path="/accounts/ledgers" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT']}><AccountLedgersPage /></ProtectedRoute>} />
          <Route path="/accounts/statements" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT']}><FinancialStatementsPage /></ProtectedRoute>} />
          <Route path="/procurement" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT', 'WAREHOUSE_MANAGER']}><ProcurementPage /></ProtectedRoute>} />

          <Route path="/reports/center" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'ACCOUNTANT', 'WAREHOUSE_MANAGER']}><ReportsCenterPage /></ProtectedRoute>} />
          <Route path="/reports/company-share" element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, 'BOOKER']}><CompanySharePage /></ProtectedRoute>} />

          <Route path="/super-admin/distributors" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><DistributorsPage /></ProtectedRoute>} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound404 />} />
    </Routes>
  );
}
