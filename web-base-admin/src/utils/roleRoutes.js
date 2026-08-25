export const SUPER_ADMIN_ROLES = [
  'super_admin',
  'superadmin',
  'super-admin',
];

export const OPERATIONAL_ADMIN_ROLES = [
  'admin',
  'administrator',
  'owner',
];

// Backward-compatible name used throughout the current frontend.
// It represents both Super Admin and Admin unless a stricter constant is used.
export const ADMIN_ROLES = [
  ...SUPER_ADMIN_ROLES,
  ...OPERATIONAL_ADMIN_ROLES,
];

export const CASHIER_ROLES = ['cashier', 'finance_staff', 'finance-staff'];
export const STAFF_MANAGER_ROLES = ['staff_manager', 'staff-manager', 'people_manager', 'people-manager'];
export const INVENTORY_MANAGER_ROLES = ['inventory_manager', 'inventory-manager'];

// Retained only for legacy accounts so existing deployments do not break.
export const HEAD_CHEF_ROLES = ['head_chef', 'head-chef'];

export const SYSTEM_ROLES = [
  ...ADMIN_ROLES,
  ...CASHIER_ROLES,
  ...INVENTORY_MANAGER_ROLES,
  ...STAFF_MANAGER_ROLES,
];

export const DASHBOARD_ROLES = SYSTEM_ROLES;
export const BOOKING_ROLES = [...ADMIN_ROLES, ...CASHIER_ROLES];
export const BILLING_ROLES = [...ADMIN_ROLES, ...CASHIER_ROLES];
export const CUSTOMER_ROLES = [...ADMIN_ROLES, ...CASHIER_ROLES];
export const INVENTORY_ROLES = [...ADMIN_ROLES, ...INVENTORY_MANAGER_ROLES];
export const STAFF_ROLES = [...ADMIN_ROLES, ...STAFF_MANAGER_ROLES];
export const PAYROLL_PREPARATION_ROLES = [...ADMIN_ROLES, ...STAFF_MANAGER_ROLES];
export const REPORT_ROLES = [...ADMIN_ROLES, ...CASHIER_ROLES];
export const SETTINGS_ROLES = ADMIN_ROLES;

export const ROLE_HOME = {
  super_admin: '/dashboard',
  superadmin: '/dashboard',
  admin: '/dashboard',
  administrator: '/dashboard',
  owner: '/dashboard',
  cashier: '/dashboard',
  finance_staff: '/dashboard',
  inventory_manager: '/dashboard',
  staff_manager: '/dashboard',
  people_manager: '/dashboard',
  head_chef: '/menu',
  employee: '/staff/schedule',
  staff: '/staff/schedule',
  customer: '/booking',
};

const ROLE_PRIORITY = [
  ...SUPER_ADMIN_ROLES,
  ...OPERATIONAL_ADMIN_ROLES,
  ...CASHIER_ROLES,
  ...INVENTORY_MANAGER_ROLES,
  ...STAFF_MANAGER_ROLES,
  ...HEAD_CHEF_ROLES,
  'employee',
  'staff',
  'customer',
];

const inventoryPath = (path) => [
  '/inventory',
  '/stocklevels',
  '/movements',
  '/purchaseRequests',
  '/supplierManagement',
  '/wasteManagement',
  '/reservationManagement',
  '/maintenanceManagement',
  '/ingredientsManagement',
  '/equipmentManagement',
].includes(path);

const PATH_ROLE_RULES = [
  { test: (path) => path === '/dashboard', roles: DASHBOARD_ROLES },
  { test: (path) => path === '/reports', roles: REPORT_ROLES },
  { test: (path) => path === '/settings', roles: SETTINGS_ROLES },
  { test: (path) => path === '/billing', roles: BILLING_ROLES },
  { test: (path) => path === '/customer-feedback', roles: CUSTOMER_ROLES },
  { test: (path) => path === '/cashierpage', roles: BOOKING_ROLES },
  { test: (path) => path === '/booking', roles: BOOKING_ROLES },
  { test: (path) => path.startsWith('/orders&events'), roles: ADMIN_ROLES },
  { test: (path) => path === '/menu', roles: [...ADMIN_ROLES, ...HEAD_CHEF_ROLES] },
  { test: inventoryPath, roles: INVENTORY_ROLES },
  { test: (path) => path === '/staff/payroll', roles: PAYROLL_PREPARATION_ROLES },
  { test: (path) => path === '/staff' || path.startsWith('/staff/'), roles: STAFF_ROLES },
  { test: (path) => path === '/notifications', roles: SYSTEM_ROLES },
];

export const normalizeRoleName = (role) => {
  const raw = typeof role === 'object' && role !== null
    ? (role.name || role.slug || role.role || role.title || '')
    : role;

  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
};

export const getUserRoles = (user) => {
  const roleValues = [
    user?.primary_role,
    user?.role,
    user?.role_name,
    user?.type,
    user?.user_type,
    user?.data?.user?.primary_role,
    user?.data?.user?.role,
    user?.user?.primary_role,
    user?.user?.role,
  ];

  if (Array.isArray(user?.roles)) {
    user.roles.forEach((role) => {
      if (typeof role === 'string') roleValues.push(role);
      else roleValues.push(role?.name || role?.slug || role?.role || role?.title);
    });
  }

  return [...new Set(roleValues.map(normalizeRoleName).filter(Boolean))];
};

export const hasAllowedRole = (user, allowedRoles = []) => {
  const allowed = allowedRoles.map(normalizeRoleName).filter(Boolean);
  if (allowed.length === 0) return true;

  const userRoles = getUserRoles(user);
  return userRoles.some((role) => allowed.includes(role));
};

export const isSuperAdmin = (user) => hasAllowedRole(user, SUPER_ADMIN_ROLES);
export const isOperationalAdmin = (user) => hasAllowedRole(user, OPERATIONAL_ADMIN_ROLES);
export const isCashier = (user) => hasAllowedRole(user, CASHIER_ROLES);
export const isInventoryManager = (user) => hasAllowedRole(user, INVENTORY_MANAGER_ROLES);
export const isStaffManager = (user) => hasAllowedRole(user, STAFF_MANAGER_ROLES);

export const canAccessPath = (user, path) => {
  const rule = PATH_ROLE_RULES.find(({ test }) => test(path));
  if (!rule || rule.roles.length === 0) return true;
  return hasAllowedRole(user, rule.roles);
};

export const getAllowedRolesForPath = (path) => {
  const rule = PATH_ROLE_RULES.find(({ test }) => test(path));
  return rule?.roles || [];
};

export const getDefaultRouteForUser = (user) => {
  const roles = getUserRoles(user);
  const matchedRole = ROLE_PRIORITY.find(
    (role) => roles.includes(normalizeRoleName(role)) && ROLE_HOME[normalizeRoleName(role)],
  );
  return ROLE_HOME[normalizeRoleName(matchedRole)] || '/dashboard';
};
