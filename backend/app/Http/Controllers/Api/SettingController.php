<?php

namespace App\Http\Controllers\Api;

use App\Models\Setting;
use App\Models\User;
use App\Models\Role;
use App\Models\Person;
use App\Models\AuditLog;
use App\Support\AuditLogCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class SettingController extends Controller
{
    private const SYSTEM_ACCOUNT_ROLES = [
        'super-admin',
        'admin',
        'cashier',
        'inventory-manager',
        'staff-manager',
    ];

    private const ADMIN_MANAGED_ROLES = [
        'cashier',
        'inventory-manager',
        'staff-manager',
    ];
    /**
     * Get all settings grouped by section
     */
    public function index(Request $request)
    {
        try {
            $settings = Setting::all()->groupBy('group');
            
            $formattedSettings = [];
            foreach ($settings as $group => $items) {
                $formattedSettings[$group] = [];
                foreach ($items as $item) {
                    $value = $this->decodeValue($item->value, $item->type);
                    $formattedSettings[$group][$item->key] = $value;
                }
            }
            
            return $this->ok($formattedSettings);
        } catch (\Exception $e) {
            return $this->fail('Failed to load settings: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Get settings for a specific section
     */
    public function getSection(Request $request, string $section)
    {
        try {
            $settings = Setting::where('group', $section)->get();
            
            $result = [];
            foreach ($settings as $item) {
                $result[$item->key] = $this->decodeValue($item->value, $item->type);
            }
            
            return $this->ok($result);
        } catch (\Exception $e) {
            return $this->fail('Failed to load section: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Update a specific section
     */
    public function updateSection(Request $request, string $section)
    {
        try {
            $data = $request->input('data', $request->all());
            
            DB::transaction(function () use ($section, $data) {
                foreach ($data as $key => $value) {
                    $type = $this->detectType($value);
                    $encodedValue = $this->encodeValue($value, $type);
                    
                    Setting::updateOrCreate(
                        ['group' => $section, 'key' => $key],
                        [
                            'value' => $encodedValue,
                            'type' => $type
                        ]
                    );
                }
            });
            
            // Clear cache for this section
            Cache::forget('settings_' . $section);
            
            // Log the action
            $this->logSettingChange($section, $data);
            
            return $this->ok(null, $section . ' settings updated successfully');
        } catch (\Exception $e) {
            return $this->fail('Failed to update settings: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Backward-compatible settings update endpoint used by older clients.
     */
    public function updateCompatibility(Request $request)
    {
        $data = $request->validate([
            'section' => ['required', 'string', 'max:80'],
            'data' => ['required', 'array'],
        ]);

        $sectionRequest = Request::create('', 'PUT', ['data' => $data['data']]);
        $sectionRequest->setUserResolver(fn () => $request->user());

        return $this->updateSection($sectionRequest, $data['section']);
    }

    public function reset(Request $request)
    {
        $validated = $request->validate([
            'section' => 'nullable|in:pricing,delivery,employee,payroll,inventory,security',
        ]);

        $defaults = [
            'pricing' => [
                'base_price_per_head' => 350,
                'package_pricing' => [],
                'seasonal_pricing' => [],
                'discount_rules' => [],
                'tax_settings' => ['tax_percentage' => 12, 'service_charge' => 10, 'is_tax_inclusive' => true],
                'promo_codes' => [],
            ],
            'delivery' => [
                'delivery_zones' => [],
                'free_delivery_threshold' => 10000,
                'pickup_allowed' => true,
                'delivery_time_slots' => ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'],
                'distance_based_fee' => false,
                'fee_per_km' => 50,
                'max_delivery_radius' => 50,
                'vehicle_assignment' => [],
            ],
            'employee' => [
                'grace_period_minutes' => 10,
                'late_deduction_per_minute' => 5,
                'sick_leave_days_per_year' => 15,
                'vacation_leave_days_per_year' => 15,
                'attendance_tracking' => true,
                'performance_rating' => true,
                'skills_tagging' => true,
            ],
            'payroll' => [
                'daily_wage' => 600,
                'hourly_rate' => 75,
                'overtime_rate' => 1.5,
                'auto_generate_payroll' => true,
                'attendance_based' => true,
                'overtime_calculation' => true,
            ],
            'inventory' => [
                'low_stock_threshold' => 10,
                'reorder_level' => 20,
                'ingredient_buffer_percentage' => 5,
                'yield_percentage' => 95,
                'auto_deduct_inventory' => true,
                'stock_report_enabled' => true,
                'expiration_tracking' => false,
            ],
            'security' => [
                'password_min_length' => 8,
                'session_timeout_minutes' => 30,
                'login_attempts_limit' => 5,
                'two_factor_auth' => false,
                'password_encryption' => true,
                'device_login_tracking' => true,
                'activity_alerts' => true,
                'account_lock_duration' => 30,
                'suspicious_activity_threshold' => 5,
            ],
        ];

        $sections = isset($validated['section'])
            ? [$validated['section'] => $defaults[$validated['section']]]
            : $defaults;

        DB::transaction(function () use ($sections) {
            foreach ($sections as $section => $values) {
                Setting::where('group', $section)->delete();
                foreach ($values as $key => $value) {
                    $type = $this->detectType($value);
                    Setting::create([
                        'group' => $section,
                        'key' => $key,
                        'value' => $this->encodeValue($value, $type),
                        'type' => $type,
                    ]);
                }
                Cache::forget('settings_' . $section);
            }
        });

        AuditLog::log('system_settings_updated', 'settings', null, null, [
            'action' => 'reset',
            'sections' => array_keys($sections),
        ]);

        return $this->ok(null, 'Settings reset successfully');
    }

    /**
     * Functional audit log catalog for backend action/module validation.
     */
    public function auditCatalog()
    {
        return $this->ok(AuditLogCatalog::all());
    }

    /**
     * Get audit logs with pagination and filters
     */
    public function getAuditLogs(Request $request)
    {
        try {
            $query = AuditLog::with(['user.person']);

            if (! $this->isSuperAdmin($request->user())) {
                $query->whereNotIn('table_name', ['users', 'roles', 'permissions', 'settings'])
                    ->whereNotIn('action', ['login', 'logout', 'failed_login', 'role_changed', 'user_created', 'user_activated', 'user_deactivated']);
            }
            
            // Apply filters
            if ($request->filled('user_id')) {
                $query->where('user_id', $request->input('user_id'));
            }
            
            if ($request->filled('module')) {
                $query->where('table_name', $request->input('module'));
            }
            
            if ($request->filled('action')) {
                $query->where('action', $request->input('action'));
            }
            
            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->whereBetween('created_at', [
                    $request->input('start_date'),
                    $request->input('end_date')
                ]);
            }
            
            // Search
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('action', 'like', "%{$search}%")
                        ->orWhere('table_name', 'like', "%{$search}%")
                        ->orWhere('old_values', 'like', "%{$search}%")
                        ->orWhere('new_values', 'like', "%{$search}%");
                });
            }
            
            $logs = $query->latest('audit_id')->paginate($request->integer('per_page', 20));
            
            // Format the response
            $formattedLogs = $logs->getCollection()->map(function ($log) {
                return [
                    'audit_id' => $log->audit_id,
                    'user_id' => $log->user_id,
                    'user_name' => $log->user?->person?->full_name ?? 'System',
                    'module' => $log->table_name,
                    'module_group' => AuditLogCatalog::moduleForAction($log->action, $log->table_name),
                    'action' => $log->action,
                    'action_label' => AuditLogCatalog::label($log->action),
                    'description' => $this->formatAuditDescription($log),
                    'old_values' => $log->old_values,
                    'new_values' => $log->new_values,
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent,
                    'created_at' => $log->created_at?->toDateTimeString(),
                ];
            });
            
            return $this->ok([
                'data' => $formattedLogs,
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
            ]);
        } catch (\Exception $e) {
            return $this->fail('Failed to load audit logs: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Get users with roles and permissions
     */
    public function getUsers(Request $request)
    {
        try {
            $query = User::with(['person', 'roles', 'employee.department', 'employee.position']);

            // Admin manages operational accounts only. Super Admin can see every account.
            if (! $this->isSuperAdmin($request->user())) {
                $query->whereHas('roles', fn ($q) => $q->whereIn('slug', self::ADMIN_MANAGED_ROLES));
            }
            
            // Apply filters
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('username', 'like', "%{$search}%")
                        ->orWhereHas('person', function ($p) use ($search) {
                            $p->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            }
            
            if ($request->filled('role')) {
                $role = $request->input('role');
                $query->whereHas('roles', function ($q) use ($role) {
                    $q->where('slug', $role);
                });
            }
            
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }
            
            $users = $query->latest('user_id')->paginate($request->integer('per_page', 10));
            
            // Format response
            $formattedUsers = $users->getCollection()->map(function ($user) {
                return [
                    'id' => $user->user_id,
                    'name' => $user->person?->full_name ?? $user->username,
                    'email' => $user->person?->email,
                    'username' => $user->username,
                    'role' => $user->roles->first()?->slug ?? 'staff',
                    'roles' => $user->roles->pluck('slug')->toArray(),
                    'position' => $user->employee?->position?->title,
                    'department' => $user->employee?->department?->name,
                    'is_active' => (bool) $user->is_active,
                    'employee_code' => $user->employee?->employee_code,
                    'last_login' => $this->formatDateTimeValue($user->last_login_at),
                    'created_at' => $this->formatDateTimeValue($user->created_at),
                    'profile_photo' => $user->person?->profile_photo_url,
                ];
            });
            
            return $this->ok([
                'data' => $formattedUsers,
                'total' => $users->total(),
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
            ]);
        } catch (\Exception $e) {
            return $this->fail('Failed to load users: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Get all roles
     */
    public function getRoles(Request $request)
    {
        try {
            $this->ensureSystemRoles();

            $rolesQuery = Role::with('permissions')->orderBy('name');
            if (! $this->isSuperAdmin($request->user())) {
                $rolesQuery->whereIn('slug', self::ADMIN_MANAGED_ROLES);
            }

            $roles = $rolesQuery->get()->map(function ($role) {
                return [
                    'id' => $role->role_id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                    'description' => $role->description,
                    'is_active' => (bool) $role->is_active,
                    'permissions' => $role->permissions->pluck('slug')->toArray(),
                ];
            });
            
            return $this->ok($roles);
        } catch (\Exception $e) {
            return $this->fail('Failed to load roles: ' . $e->getMessage(), 500);
        }
    }
    
    public function createUser(Request $request)
    {
        $this->ensureSystemRoles();

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:120', 'unique:persons,email'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role_slug' => ['required', 'string', Rule::in($this->assignableRoleSlugs($request->user())), 'exists:roles,slug'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $role = Role::where('slug', $data['role_slug'])->where('is_active', true)->first();
        if (! $role) {
            return $this->fail('The selected role is inactive or unavailable.', 422);
        }

        $user = DB::transaction(function () use ($data, $role) {
            $person = Person::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => strtolower($data['email']),
                'phone' => $data['phone'] ?? null,
            ]);

            $user = User::create([
                'person_id' => $person->person_id,
                'username' => $data['username'],
                'password' => Hash::make($data['password']),
                'is_active' => $data['is_active'] ?? true,
                'email_verified_at' => now(),
            ]);

            $user->roles()->sync([$role->role_id]);

            AuditLog::log('user_created', 'users', $user->user_id, null, [
                'username' => $user->username,
                'email' => $person->email,
                'role' => $role->slug,
                'created_by' => request()->user()?->user_id,
            ]);

            return $user->load(['person', 'roles']);
        });

        return $this->ok($user, 'Account created successfully');
    }

    public function getUser(Request $request, User $user)
    {
        if (! $this->canManageUser($request->user(), $user)) {
            return $this->fail('You cannot view or manage this account.', 403);
        }

        return $this->ok($user->load(['person', 'roles.permissions', 'employee.department', 'employee.position']));
    }

    public function getRole(Request $request, Role $role)
    {
        if (! $this->isSuperAdmin($request->user()) && ! in_array($role->slug, self::ADMIN_MANAGED_ROLES, true)) {
            return $this->fail('You cannot view this role.', 403);
        }

        return $this->ok($role->load('permissions'));
    }

    public function createRole(Request $request)
    {
        if (! $this->isSuperAdmin($request->user())) {
            return $this->fail('Only the Super Admin can create roles.', 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:roles,name'],
            'slug' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:roles,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,permission_id'],
        ]);

        $role = DB::transaction(function () use ($data) {
            $role = Role::create(collect($data)->except('permission_ids')->all());
            if (array_key_exists('permission_ids', $data)) {
                $role->permissions()->sync($data['permission_ids']);
            }
            return $role->load('permissions');
        });

        return $this->ok($role, 'Role created successfully');
    }

    public function updateRole(Request $request, Role $role)
    {
        if (! $this->isSuperAdmin($request->user())) {
            return $this->fail('Only the Super Admin can modify roles and permissions.', 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:50', 'unique:roles,name,' . $role->role_id . ',role_id'],
            'slug' => ['sometimes', 'required', 'string', 'max:50', 'alpha_dash', 'unique:roles,slug,' . $role->role_id . ',role_id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,permission_id'],
        ]);

        DB::transaction(function () use ($role, $data): void {
            $role->update(collect($data)->except('permission_ids')->all());
            if (array_key_exists('permission_ids', $data)) {
                $role->permissions()->sync($data['permission_ids']);
            }
        });

        return $this->ok($role->fresh('permissions'), 'Role updated successfully');
    }

    public function deleteRole(Request $request, Role $role)
    {
        if (! $this->isSuperAdmin($request->user())) {
            return $this->fail('Only the Super Admin can remove roles.', 403);
        }

        if ($role->users()->exists()) {
            return $this->fail('This role is assigned to one or more users and cannot be deleted.', 422);
        }

        $role->permissions()->detach();
        $role->delete();

        return $this->ok(null, 'Role deleted successfully');
    }

    /**
     * Update user role
     */
    public function updateUserRole(Request $request, User $user)
    {
        try {
            if (! $this->canManageUser($request->user(), $user)) {
                return $this->fail('You cannot modify this account.', 403);
            }

            $data = $request->validate([
                'role_slug' => 'required|exists:roles,slug',
            ]);
            
            $role = Role::where('slug', $data['role_slug'])->where('is_active', true)->first();
            
            if (!$role) {
                return $this->fail('Role not found or inactive', 404);
            }

            if (! in_array($role->slug, $this->assignableRoleSlugs($request->user()), true)) {
                return $this->fail('You cannot assign this role.', 403);
            }
            
            $oldRoles = $user->roles()->pluck('slug')->toArray();
            $isOperationalAccount = collect($oldRoles)
                ->map(fn ($slug) => strtolower((string) $slug))
                ->intersect(self::SYSTEM_ACCOUNT_ROLES)
                ->isNotEmpty();

            if ($isOperationalAccount && ! in_array($role->slug, self::SYSTEM_ACCOUNT_ROLES, true)) {
                return $this->fail('Operational Web Admin accounts must use one of the approved system roles.', 422);
            }

            if ((int) $request->user()?->user_id === (int) $user->user_id
                && ! in_array($role->slug, ['admin', 'super-admin'], true)) {
                return $this->fail('You cannot remove your own administrator access.', 422);
            }

            if ($this->isAdministrator($user)
                && ! in_array($role->slug, ['admin', 'super-admin'], true)
                && $this->activeAdministratorCount() <= 1) {
                return $this->fail('At least one active administrator account is required.', 422);
            }

            $user->roles()->sync([$role->role_id]);

            AuditLog::log('role_changed', 'users', $user->user_id, ['roles' => $oldRoles], [
                'roles' => [$role->slug],
                'user_id' => $user->user_id,
                'username' => $user->username,
            ]);

            try {
                app(\App\Services\NotificationService::class)->notifySystemEvent(
                    'role_updated',
                    "User role updated for {$user->username}.",
                    ['user_id' => $user->user_id, 'reference_id' => $user->user_id, 'role' => $role->slug],
                    ['admin']
                );
            } catch (\Throwable $e) {
                // Notification must not block role update.
            }
            
            return $this->ok($user->load('roles'), 'User role updated successfully');
        } catch (\Exception $e) {
            return $this->fail('Failed to update user role: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Toggle user active status
     */
    public function toggleUserActive(Request $request, User $user)
    {
        try {
            if (! $this->canManageUser($request->user(), $user)) {
                return $this->fail('You cannot activate or deactivate this account.', 403);
            }

            if ((int) $request->user()?->user_id === (int) $user->user_id) {
                return $this->fail('You cannot deactivate your own account.', 422);
            }

            if ($user->is_active && $this->isAdministrator($user) && $this->activeAdministratorCount() <= 1) {
                return $this->fail('At least one active administrator account is required.', 422);
            }

            $oldStatus = (bool) $user->is_active;
            $user->update(['is_active' => !$user->is_active]);

            AuditLog::log($user->is_active ? 'user_activated' : 'user_deactivated', 'users', $user->user_id,
                ['is_active' => $oldStatus],
                ['is_active' => (bool) $user->is_active, 'username' => $user->username]
            );
            
            return $this->ok($user, 'User status toggled successfully');
        } catch (\Exception $e) {
            return $this->fail('Failed to toggle user status: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Export audit logs
     */
    public function exportAuditLogs(Request $request)
    {
        try {
            $query = AuditLog::with(['user.person']);

            if (! $this->isSuperAdmin($request->user())) {
                $query->whereNotIn('table_name', ['users', 'roles', 'permissions', 'settings'])
                    ->whereNotIn('action', ['login', 'logout', 'failed_login', 'role_changed', 'user_created', 'user_activated', 'user_deactivated']);
            }
            
            // Apply filters
            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->whereBetween('created_at', [
                    $request->input('start_date'),
                    $request->input('end_date')
                ]);
            }
            
            $logs = $query->latest('audit_id')->get();
            
            // Generate CSV
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="audit_logs_' . now()->format('Y-m-d') . '.csv"',
            ];
            
            $callback = function () use ($logs) {
                $handle = fopen('php://output', 'w');
                
                // Headers
                fputcsv($handle, [
                    'ID', 'User', 'Module', 'Action', 'Description', 
                    'IP Address', 'Device', 'Created At'
                ]);
                
                // Data
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->audit_id,
                        $log->user?->person?->full_name ?? 'System',
                        $log->table_name,
                        $log->action,
                        $this->formatAuditDescription($log),
                        $log->ip_address,
                        $log->user_agent,
                        $log->created_at?->toDateTimeString(),
                    ]);
                }
                
                fclose($handle);
            };
            
            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            return $this->fail('Failed to export audit logs: ' . $e->getMessage(), 500);
        }
    }
    
    // ==================== PRIVATE HELPER METHODS ====================
    
    private function isSuperAdmin(?User $user): bool
    {
        return $user?->roles()->where('is_active', true)->whereIn('slug', ['super-admin', 'super_admin', 'superadmin'])->exists() ?? false;
    }

    private function assignableRoleSlugs(?User $actor): array
    {
        return $this->isSuperAdmin($actor) ? self::SYSTEM_ACCOUNT_ROLES : self::ADMIN_MANAGED_ROLES;
    }

    private function canManageUser(?User $actor, User $target): bool
    {
        if ($this->isSuperAdmin($actor)) {
            return true;
        }

        return $target->roles()->whereIn('slug', self::ADMIN_MANAGED_ROLES)->exists();
    }

    private function formatDateTimeValue($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTimeInterface) {
                return Carbon::instance($value)->toDateTimeString();
            }

            return Carbon::parse((string) $value)->toDateTimeString();
        } catch (\Throwable $e) {
            // Keep the users endpoint available even if a legacy row contains
            // an unexpected date representation.
            return is_scalar($value) ? (string) $value : null;
        }
    }

    private function decodeValue(?string $value, string $type)
    {
        if ($value === null) {
            return null;
        }
        
        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $value,
            'float' => (float) $value,
            'array', 'json' => json_decode($value, true),
            'object' => json_decode($value),
            default => $value,
        };
    }
    
    private function encodeValue($value, string $type): string
    {
        if (is_array($value) || is_object($value)) {
            return json_encode($value);
        }
        
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        
        return (string) $value;
    }
    
    private function detectType($value): string
    {
        if (is_array($value)) {
            return 'array';
        }
        
        if (is_object($value)) {
            return 'object';
        }
        
        if (is_bool($value)) {
            return 'boolean';
        }
        
        if (is_int($value)) {
            return 'integer';
        }
        
        if (is_float($value)) {
            return 'float';
        }
        
        return 'string';
    }
    
    private function logSettingChange(string $section, array $data): void
    {
        $action = match ($section) {
            'pricing' => 'pricing_rules_changed',
            'payroll' => 'payroll_settings_updated',
            'inventory' => 'inventory_settings_updated',
            'notifications' => 'notification_settings_updated',
            'payment' => 'payment_settings_updated',
            default => 'system_settings_updated',
        };

        AuditLog::log(
            $action,
            'settings',
            null,
            null,
            ['section' => $section, 'keys' => array_keys($data)],
            AuditLogCatalog::label($action)
        );
    }
    
    private function ensureSystemRoles(): void
    {
        $roles = [
            ['name' => 'Super Admin', 'slug' => 'super-admin', 'description' => 'System-wide user, role, permission, settings, audit, security, backup, and override authority.'],
            ['name' => 'Administrator', 'slug' => 'admin', 'description' => 'Operational approval and management authority.'],
            ['name' => 'Cashier', 'slug' => 'cashier', 'description' => 'Quotations, booking requests, customers, invoicing, payment collection, receipts, and sales reports.'],
            ['name' => 'Inventory Manager', 'slug' => 'inventory-manager', 'description' => 'Inventory, suppliers, purchase requests, reservations, waste, equipment, and inventory reports.'],
            ['name' => 'People / Staff Manager', 'slug' => 'staff-manager', 'description' => 'Employees, attendance, scheduling, leave, staffing, performance, and payroll preparation.'],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['slug' => $roleData['slug']],
                [
                    'name' => $roleData['name'],
                    'description' => $roleData['description'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function isAdministrator(User $user): bool
    {
        return $user->roles()->whereIn('slug', ['admin', 'super-admin'])->exists();
    }

    private function activeAdministratorCount(): int
    {
        return User::where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->whereIn('slug', ['admin', 'super-admin']))
            ->count();
    }

    private function formatAuditDescription($log): string
    {
        $action = AuditLogCatalog::label($log->action);
        $table = ucfirst(str_replace('_', ' ', $log->table_name));
        
        return "{$action} on {$table}";
    }
}