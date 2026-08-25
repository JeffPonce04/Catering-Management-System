import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import AppLayout from '../../components/layout/AppLayout';
import ProtectedRoute from '../../components/common/ProtectedRoute';
import {
  ADMIN_ROLES,
  BILLING_ROLES,
  BOOKING_ROLES,
  CUSTOMER_ROLES,
  DASHBOARD_ROLES,
  HEAD_CHEF_ROLES,
  INVENTORY_ROLES,
  PAYROLL_PREPARATION_ROLES,
  REPORT_ROLES,
  SETTINGS_ROLES,
  STAFF_ROLES,
  getDefaultRouteForUser,
} from '../../utils/roleRoutes';
import { useAuth } from '../../contexts/AuthContext';
import styles from './AppRouter.module.css';

const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage'));
const CashierPage = lazy(() => import('../../features/cashier/pages/CashierPage'));
const ReportsAnalyticsPage = lazy(() => import('../../features/reports/pages/ReportsAnalyticsPage'));
const InventoryPage = lazy(() => import('../../features/inventory/pages/InventoryPage'));
const MenuManagementPage = lazy(() => import('../../features/menu/pages/MenuManagementPage'));
const OrdersManagementPage = lazy(() => import('../../features/orders/pages/OrdersManagementPage'));
const EventsManagementPage = lazy(() => import('../../features/events/pages/EventsManagementPage'));
const PaymentPage = lazy(() => import('../../features/billing/pages/PaymentPage'));
const BookingQuotationManagementPage = lazy(() => import('../../features/bookings/pages/BookingQuotationManagementPage'));
const CustomerManagementPage = lazy(() => import('../../features/customers/pages/CustomerManagementPage'));
const SettingsPage = lazy(() => import('../../features/settings/pages/SettingsPage'));
const NotificationsPage = lazy(() => import('../../features/notifications/pages/NotificationsPage'));
const StaffDirectoryPage = lazy(() => import('../../features/staff/pages/StaffDirectoryPage'));
const StaffSchedulingPage = lazy(() => import('../../features/staff/pages/StaffSchedulingPage'));
const StaffAttendancePage = lazy(() => import('../../features/staff/pages/StaffAttendancePage'));
const StaffPayrollPage = lazy(() => import('../../features/staff/pages/StaffPayrollPage'));
const StockLevels = lazy(() => import('../../features/inventory/pages/StockLevels'));
const Movements = lazy(() => import('../../features/inventory/pages/Movements'));
const PurchaseRequests = lazy(() => import('../../features/inventory/pages/PurchaseRequests'));
const SupplierManagement = lazy(() => import('../../features/inventory/pages/SupplierManagement'));
const WasteManagement = lazy(() => import('../../features/inventory/pages/Waste'));
const ReservationManagement = lazy(() => import('../../features/inventory/pages/ReservationManagement'));
const MaintenanceManagement = lazy(() => import('../../features/inventory/pages/MaintenanceManagement'));
const IngredientsManagement = lazy(() => import('../../features/inventory/pages/IngredientsManagement'));
const EquipmentManagement = lazy(() => import('../../features/inventory/pages/EquipmentManagement'));
const OrderEvents = lazy(() => import('../../features/orders/pages/OrdersEventspage'));

const LoadingScreen = () => (
  <div className={styles.loadingScreen}>
    <FaSpinner className="cms-spinner" />
    <span className={styles.loadingText}>Loading...</span>
  </div>
);

const ProtectedPage = ({ children, allowedRoles }) => (
  <ProtectedRoute allowedRoles={allowedRoles} redirectUnauthorized>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const RoleHomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return <Navigate to={isAuthenticated ? getDefaultRouteForUser(user) : '/login'} replace />;
};

const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleHomeRedirect />} />

        <Route path="/dashboard" element={<ProtectedPage allowedRoles={DASHBOARD_ROLES}><DashboardPage /></ProtectedPage>} />
        <Route path="/cashierpage" element={<ProtectedPage allowedRoles={BOOKING_ROLES}><CashierPage /></ProtectedPage>} />
        <Route path="/reports" element={<ProtectedPage allowedRoles={REPORT_ROLES}><ReportsAnalyticsPage /></ProtectedPage>} />

        <Route path="/inventory" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><InventoryPage /></ProtectedPage>} />
        <Route path="/stocklevels" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><StockLevels /></ProtectedPage>} />
        <Route path="/movements" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><Movements /></ProtectedPage>} />
        <Route path="/purchaseRequests" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><PurchaseRequests /></ProtectedPage>} />
        <Route path="/supplierManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><SupplierManagement /></ProtectedPage>} />
        <Route path="/wasteManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><WasteManagement /></ProtectedPage>} />
        <Route path="/reservationManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><ReservationManagement /></ProtectedPage>} />
        <Route path="/maintenanceManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><MaintenanceManagement /></ProtectedPage>} />
        <Route path="/ingredientsManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><IngredientsManagement /></ProtectedPage>} />
        <Route path="/equipmentManagement" element={<ProtectedPage allowedRoles={INVENTORY_ROLES}><EquipmentManagement /></ProtectedPage>} />

        <Route path="/menu" element={<ProtectedPage allowedRoles={[...ADMIN_ROLES, ...HEAD_CHEF_ROLES]}><MenuManagementPage /></ProtectedPage>} />
        <Route path="/orders&events" element={<ProtectedPage allowedRoles={ADMIN_ROLES}><OrderEvents /></ProtectedPage>} />
        <Route path="/orders&events/orders" element={<ProtectedPage allowedRoles={ADMIN_ROLES}><OrdersManagementPage /></ProtectedPage>} />
        <Route path="/orders&events/events" element={<ProtectedPage allowedRoles={ADMIN_ROLES}><EventsManagementPage /></ProtectedPage>} />

        <Route path="/billing" element={<ProtectedPage allowedRoles={BILLING_ROLES}><PaymentPage /></ProtectedPage>} />
        <Route path="/booking" element={<ProtectedPage allowedRoles={BOOKING_ROLES}><BookingQuotationManagementPage /></ProtectedPage>} />
        <Route path="/customer-feedback" element={<ProtectedPage allowedRoles={CUSTOMER_ROLES}><CustomerManagementPage /></ProtectedPage>} />

        <Route path="/staff" element={<ProtectedPage allowedRoles={STAFF_ROLES}><StaffDirectoryPage /></ProtectedPage>} />
        <Route path="/staff/directory" element={<ProtectedPage allowedRoles={STAFF_ROLES}><StaffDirectoryPage /></ProtectedPage>} />
        <Route path="/staff/attendance" element={<ProtectedPage allowedRoles={STAFF_ROLES}><StaffAttendancePage /></ProtectedPage>} />
        <Route path="/staff/payroll" element={<ProtectedPage allowedRoles={PAYROLL_PREPARATION_ROLES}><StaffPayrollPage /></ProtectedPage>} />
        <Route path="/staff/schedule" element={<ProtectedPage allowedRoles={STAFF_ROLES}><StaffSchedulingPage /></ProtectedPage>} />

        <Route path="/settings" element={<ProtectedPage allowedRoles={SETTINGS_ROLES}><SettingsPage /></ProtectedPage>} />
        <Route path="/notifications" element={<ProtectedPage allowedRoles={DASHBOARD_ROLES}><NotificationsPage /></ProtectedPage>} />
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
