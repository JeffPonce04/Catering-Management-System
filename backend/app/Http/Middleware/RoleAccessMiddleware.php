<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleAccessMiddleware
{
    private const ROLE_ALIASES = [
        'super_admin' => 'super-admin',
        'superadmin' => 'super-admin',
        'administrator' => 'admin',
        'owner' => 'admin',
        'finance' => 'cashier',
        'finance-staff' => 'cashier',
        'finance_staff' => 'cashier',
        'people-manager' => 'staff-manager',
        'people_manager' => 'staff-manager',
        'staff_manager' => 'staff-manager',
        'inventory_manager' => 'inventory-manager',
        'head_chef' => 'head-chef',
    ];

    private const CONTROLLED_ROLES = [
        'super-admin',
        'admin',
        'cashier',
        'inventory-manager',
        'staff-manager',
        // Kept only so existing installations using this legacy role do not break.
        'head-chef',
    ];

    private const NON_ADMIN_PORTAL_ROLES = [
        'customer',
        'employee',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }

        $roles = $user->roles()
            ->where('is_active', true)
            ->pluck('slug')
            ->map(fn ($role) => $this->normalizeRole((string) $role))
            ->unique()
            ->values()
            ->all();

        $controlledRoles = array_values(array_intersect($roles, self::CONTROLLED_ROLES));

        // Preserve the existing customer and employee portals, but never let an
        // unknown/custom role bypass the operational authorization matrix.
        if ($controlledRoles === []) {
            $unexpectedRoles = array_values(array_diff($roles, self::NON_ADMIN_PORTAL_ROLES));
            if ($unexpectedRoles === []) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'Forbidden. This role has no authorized operational module.',
            ], 403);
        }

        $path = $this->relativeApiPath($request);
        $method = strtoupper($request->method());

        if (in_array('super-admin', $controlledRoles, true)) {
            return $next($request);
        }

        if ($this->isSharedAccountEndpoint($path, $method)) {
            return $next($request);
        }

        foreach ($controlledRoles as $role) {
            if ($this->roleCanAccess($role, $path, $method)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Forbidden. Your assigned role cannot perform this action.',
            'required_module' => $this->moduleForPath($path),
        ], 403);
    }

    private function roleCanAccess(string $role, string $path, string $method): bool
    {
        return match ($role) {
            'admin' => $this->adminCanAccess($path, $method),
            'cashier' => $this->cashierCanAccess($path, $method),
            'inventory-manager' => $this->inventoryManagerCanAccess($path, $method),
            'staff-manager' => $this->staffManagerCanAccess($path, $method),
            'head-chef' => $this->headChefCanAccess($path, $method),
            default => false,
        };
    }

    private function adminCanAccess(string $path, string $method): bool
    {
        // Role design and system-wide configuration are Super Admin responsibilities.
        if ($this->startsWithAny($path, ['roles']) && $method !== 'GET') {
            return false;
        }

        if ($this->startsWithAny($path, ['settings'])) {
            return false;
        }

        return true;
    }

    private function cashierCanAccess(string $path, string $method): bool
    {
        if ($this->cashierDashboardCanAccess($path, $method)) {
            return true;
        }

        // Company identity used on invoices and receipts; no configuration write access.
        if ($method === 'GET' && $path === 'settings/business') {
            return true;
        }

        if ($method === 'GET' && $this->startsWithAny($path, [
            'bookings', 'bookings-statistics', 'booking-calendar', 'calendar-events',
            'quotations', 'customers', 'customer-messages', 'invoices', 'debts',
            'payments', 'deposits', 'financial-reports/sales', 'reports/sales',
            'menu-items', 'packages', 'promotions', 'meal-categories', 'event-types',
            'delivery-zones',
        ])) {
            return true;
        }

        // Cashiers create and revise quotations, but approval/rejection/deletion belongs to Admin.
        if ($this->matches($path, '#^quotations(?:/[^/]+)?$#') && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return true;
        }
        if ($method === 'POST' && $this->matches($path, '#^quotations/[^/]+/send$#')) {
            return true;
        }

        // Cashiers create booking requests and may update pending requests. Status-sensitive
        // restrictions are additionally enforced in the controller.
        if ($this->matches($path, '#^bookings(?:/[^/]+)?$#') && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return true;
        }
        if ($method === 'POST' && $this->matches($path, '#^bookings/[^/]+/(record-payment|request-reschedule)$#')) {
            return true;
        }

        // Customer registration and ordinary profile maintenance.
        if ($this->matches($path, '#^customers(?:/[^/]+)?$#') && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return true;
        }
        if ($method === 'POST' && $this->matches($path, '#^customers/[^/]+/send-email$#')) {
            return true;
        }
        if ($method === 'POST' && $path === 'customer-messages') {
            return true;
        }

        // Invoice creation/update/reminders and payment collection. Destructive or approval
        // actions (refund, verify, reject, confirmed-payment deletion) remain Admin-only.
        if ($this->matches($path, '#^invoices(?:/[^/]+)?$#') && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return true;
        }
        if ($method === 'POST' && $this->matches($path, '#^invoices/[^/]+/reminder$#')) {
            return true;
        }
        if ($method === 'POST' && in_array($path, ['payments', 'payments/mobile', 'deposits/send-reminders'], true)) {
            return true;
        }

        return false;
    }

    private function inventoryManagerCanAccess(string $path, string $method): bool
    {
        if ($this->inventoryDashboardCanAccess($path, $method)) {
            return true;
        }

        if ($method === 'GET' && $this->startsWithAny($path, [
            'inventory', 'inventory-history', 'ingredients', 'products', 'equipment',
            'suppliers', 'shopping-list', 'reports/inventory', 'bookings', 'events',
        ])) {
            return true;
        }

        // Inventory operations, stock movement, receiving, reservations, waste and maintenance.
        if ($this->startsWithAny($path, [
            'inventory', 'inventory-history', 'ingredients', 'products', 'equipment',
            'suppliers', 'shopping-list',
        ]) && in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            // An Inventory Manager may create/update a request but may not approve/reject it.
            // The controller validates status transitions and ownership as a second layer.
            return true;
        }

        // Booking ingredient requirements are part of inventory preparation.
        if ($method === 'POST' && $this->matches(
            $path,
            '#^bookings/[^/]+/ingredients-mark-(?:purchased|all-purchased)$#'
        )) {
            return true;
        }

        // Confirmed event requirements are read-only; equipment-specific event actions are allowed.
        if ($this->matches($path, '#^events/[^/]+/equipment(?:/.*)?$#')
            && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return true;
        }
        if ($method === 'POST' && $this->matches($path, '#^events/[^/]+/return-equipment$#')) {
            return true;
        }

        return false;
    }

    private function staffManagerCanAccess(string $path, string $method): bool
    {
        if ($this->staffDashboardCanAccess($path, $method)) {
            return true;
        }

        if ($this->startsWithAny($path, [
            'employees', 'departments', 'positions', 'salary-grades', 'schedules',
            'attendance', 'daily-attendance', 'employee-requests', 'leave-requests',
            'shift-types',
        ])) {
            return true;
        }

        if ($method === 'GET' && $this->startsWithAny($path, [
            'payroll', 'payslips', 'reports/payroll', 'events', 'event-calendar',
        ])) {
            return true;
        }

        // Payroll preparation is permitted, while final approval/payment/destructive lifecycle
        // actions are blocked here and in the user interface.
        if ($method === 'POST' && in_array($path, ['payroll/preview', 'payroll/process', 'payroll/bulk-deductions'], true)) {
            return true;
        }
        if ($method === 'PUT' && $this->matches($path, '#^payroll/[^/]+$#')) {
            return true;
        }
        if ($method === 'POST' && in_array($path, [
            'attendance/generate-summary',
            'attendance/save-summary-to-payroll',
            'attendance/save-all-summaries-to-payroll',
        ], true)) {
            return true;
        }

        // Staff assignment and work-status updates for catering events.
        if ($this->matches($path, '#^events/[^/]+/staff(?:/[^/]+(?:/status)?)?$#')
            && in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return true;
        }

        return false;
    }

    private function headChefCanAccess(string $path, string $method): bool
    {
        if ($this->isDashboardRead($path, $method)) {
            return true;
        }

        if ($this->startsWithAny($path, [
            'menu-items', 'menu-statistics', 'meal-categories', 'recipes', 'ingredients', 'products',
        ])) {
            return true;
        }

        return $method === 'GET' && $this->startsWithAny($path, ['packages', 'promotions', 'event-types']);
    }

    private function cashierDashboardCanAccess(string $path, string $method): bool
    {
        return $method === 'GET' && in_array($path, [
            'dashboard', 'dashboard/stats', 'dashboard/charts', 'dashboard/monthly-summary',
            'dashboard/recent-bookings', 'dashboard/upcoming-events', 'dashboard/revenue-chart',
            'dashboard/event-distribution',
        ], true);
    }

    private function inventoryDashboardCanAccess(string $path, string $method): bool
    {
        return $method === 'GET' && in_array($path, [
            'dashboard', 'dashboard/stats', 'dashboard/charts', 'dashboard/monthly-summary',
            'dashboard/upcoming-events', 'dashboard/low-stock',
        ], true);
    }

    private function staffDashboardCanAccess(string $path, string $method): bool
    {
        return $method === 'GET' && in_array($path, [
            'dashboard', 'dashboard/stats', 'dashboard/charts', 'dashboard/monthly-summary',
            'dashboard/upcoming-events', 'dashboard/today-attendance',
        ], true);
    }

    private function isDashboardRead(string $path, string $method): bool
    {
        return $method === 'GET' && $this->startsWithAny($path, ['dashboard']);
    }

    private function isSharedAccountEndpoint(string $path, string $method): bool
    {
        if ($this->startsWithAny($path, ['auth'])) {
            return true;
        }

        // All roles may manage their own notifications. Creating a notification for
        // another user is a system-wide action reserved for Super Admin.
        if ($this->startsWithAny($path, ['notifications'])) {
            return ! ($path === 'notifications' && $method === 'POST');
        }

        return false;
    }

    private function moduleForPath(string $path): string
    {
        return match (true) {
            $this->startsWithAny($path, ['users', 'roles']) => 'user-and-role-management',
            $this->startsWithAny($path, ['settings', 'audit-logs']) => 'system-administration',
            $this->startsWithAny($path, ['bookings', 'booking-calendar', 'quotations', 'calendar-events']) => 'orders-and-events',
            $this->startsWithAny($path, ['payments', 'invoices', 'deposits', 'financial-reports']) => 'billing-and-payments',
            $this->startsWithAny($path, ['customers', 'customer-messages']) => 'customer-management',
            $this->startsWithAny($path, ['inventory', 'inventory-history', 'ingredients', 'products', 'equipment', 'suppliers', 'shopping-list']) => 'inventory-management',
            $this->startsWithAny($path, ['employees', 'departments', 'positions', 'salary-grades', 'schedules', 'attendance', 'daily-attendance', 'employee-requests', 'leave-requests', 'shift-types']) => 'people-and-staff-management',
            $this->startsWithAny($path, ['payroll', 'payslips']) => 'payroll',
            $this->startsWithAny($path, ['reports']) => 'reports',
            default => 'administrator-only',
        };
    }

    private function relativeApiPath(Request $request): string
    {
        $path = trim($request->path(), '/');
        return preg_replace('#^api/v1/?#', '', $path) ?? $path;
    }

    private function startsWithAny(string $path, array $prefixes): bool
    {
        foreach ($prefixes as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return true;
            }
        }

        return false;
    }

    private function matches(string $path, string $pattern): bool
    {
        return preg_match($pattern, $path) === 1;
    }

    private function normalizeRole(string $role): string
    {
        $normalized = strtolower(trim($role));
        return self::ROLE_ALIASES[$normalized] ?? str_replace('_', '-', $normalized);
    }
}
