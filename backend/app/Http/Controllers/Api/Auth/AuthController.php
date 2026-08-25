<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Api\Controller;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Person;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Models\AuditLog;
use App\Services\NotificationService;
use App\Mail\OTPMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Login for customers, employees, and admin users
     * Supports both web and mobile clients
     */
    public function login(Request $request)
    {
        $validator = validator($request->all(), [
            'email' => 'nullable|string',
            'username' => 'nullable|string',
            'userId' => 'nullable|string',
            'user_id' => 'nullable|string',
            'emailOrUsername' => 'nullable|string',
            'password' => 'required|string',
            'role' => 'nullable|string|in:customer,employee,admin,cashier,head-chef,staff-manager,inventory-manager',
            'otp_code' => 'nullable|string|size:6',
            'require_otp' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = $request->input('emailOrUsername') 
            ?? $request->input('email') 
            ?? $request->input('username') 
            ?? $request->input('userId') 
            ?? $request->input('user_id');

        if (empty($identifier)) {
            return response()->json([
                'success' => false,
                'message' => 'Email or username is required'
            ], 422);
        }

        $user = User::with(['person', 'roles', 'customer', 'employee'])
            ->where('username', $identifier)
            ->orWhereHas('person', function ($query) use ($identifier) {
                $query->where('email', $identifier);
            })
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            $this->recordFailedLogin($identifier, $request);
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Account is inactive. Please contact support.'
            ], 403);
        }

        $requestedRole = $request->input('role');
        $userRole = $this->primaryRole($user);
        $isAdmin = in_array($userRole, ['admin', 'super-admin'], true);
        $isCashier = $userRole === 'cashier';
        $role = $requestedRole ?: $userRole;

        // Skip role-specific checks for admin users
        if (!$isAdmin) {
            if ($role === 'customer' && !$user->customer) {
                return response()->json([
                    'success' => false,
                    'message' => 'No customer account found for this user'
                ], 401);
            }

            if ($role === 'employee' && !$user->employee) {
                return response()->json([
                    'success' => false,
                    'message' => 'No employee account found for this user'
                ], 401);
            }

            if ($role === 'cashier' && !$isCashier) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized - Cashier access required'
                ], 403);
            }

            if (in_array($role, ['head-chef', 'staff-manager', 'inventory-manager'], true)
                && $role !== $userRole) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized - Assigned role does not match the requested access'
                ], 403);
            }

            if ($role === 'admin' && !$isAdmin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized - Admin access required'
                ], 403);
            }
        }

        if ($request->boolean('require_otp')) {
            $otpResult = $this->verifyOrSendLoginOtp($user, (string) $request->input('otp_code', ''));

            if ($otpResult !== true) {
                return $otpResult;
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        $user->update(['last_login_at' => now()]);
        $this->recordLogin($user, $request);
        $user->load(['person', 'roles', 'customer', 'employee']);

        return $this->ok([
            'token' => $token,
            'user' => $this->payload($user),
            'role' => $userRole === 'super-admin' ? 'admin' : $userRole,
        ], 'Login successful');
    }

    /**
     * Admin login - dedicated endpoint for admin users
     */
    public function adminLogin(Request $request)
    {
        $validator = validator($request->all(), [
            'email' => 'nullable|string',
            'username' => 'nullable|string',
            'userId' => 'nullable|string',
            'user_id' => 'nullable|string',
            'emailOrUsername' => 'nullable|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = $request->input('emailOrUsername') 
            ?? $request->input('email') 
            ?? $request->input('username') 
            ?? $request->input('userId') 
            ?? $request->input('user_id');

        if (empty($identifier)) {
            return response()->json([
                'success' => false,
                'message' => 'Email or username is required'
            ], 422);
        }

        $user = User::with(['person', 'roles', 'customer', 'employee'])
            ->where('username', $identifier)
            ->orWhereHas('person', function ($query) use ($identifier) {
                $query->where('email', $identifier);
            })
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            $this->recordFailedLogin($identifier, $request);
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Account is inactive. Please contact support.'
            ], 403);
        }

        // Check if user has admin role
        if (!$user->roles->contains(fn ($role) => in_array($role->slug, ['admin', 'super-admin'], true))) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - Admin access required'
            ], 403);
        }

        $token = $user->createToken('admin-token')->plainTextToken;
        $user->update(['last_login_at' => now()]);
        $this->recordLogin($user, $request);
        $user->load(['person', 'roles']);

        return $this->ok([
            'token' => $token,
            'user' => $this->payload($user),
            'role' => 'admin',
        ], 'Admin login successful');
    }

    /**
     * Employee login
     */
    public function employeeLogin(Request $request)
    {
        $validator = validator($request->all(), [
            'employee_code' => 'nullable|string',
            'username' => 'nullable|string',
            'userId' => 'nullable|string',
            'user_id' => 'nullable|string',
            'email' => 'nullable|string',
            'emailOrUsername' => 'nullable|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = $request->input('employee_code') 
            ?? $request->input('emailOrUsername')
            ?? $request->input('email')
            ?? $request->input('username') 
            ?? $request->input('userId') 
            ?? $request->input('user_id');

        if (empty($identifier)) {
            return response()->json([
                'success' => false,
                'message' => 'Employee code, email, or username is required'
            ], 422);
        }

        // Try to find by employee code first
        $employee = Employee::with(['user.person', 'user.roles', 'person', 'department', 'position'])
            ->where('employee_code', $identifier)
            ->first();

        // If not found by employee code, try by username or email
        if (!$employee) {
            $employee = Employee::with(['user.person', 'user.roles', 'person', 'department', 'position'])
                ->whereHas('user', function ($query) use ($identifier) {
                    $query->where('username', $identifier)
                        ->orWhereHas('person', function ($q) use ($identifier) {
                            $q->where('email', $identifier);
                        });
                })
                ->first();
        }

        $user = $employee?->user;

        if (!$employee || !$user || !$user->is_active || !Hash::check($request->password, $user->password)) {
            $this->recordFailedLogin($identifier, $request);
            return response()->json([
                'success' => false,
                'message' => 'Invalid employee credentials'
            ], 401);
        }

        $user->update(['last_login_at' => now()]);
        $this->recordLogin($user, $request);
        $token = $user->createToken('employee-token')->plainTextToken;

        return $this->ok([
            'token' => $token,
            'employee' => $employee,
            'user' => $this->payload($user),
            'role' => 'employee',
        ], 'Employee login successful');
    }

    /**
     * Register new customer
     */
    public function registerCustomer(Request $request)
    {
        $validator = validator($request->all(), [
            'first_name' => 'required|string|max:80',
            'last_name' => 'required|string|max:80',
            'email' => 'required|email|max:120|unique:persons,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        return DB::transaction(function () use ($request) {
            $person = Person::create([
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'phone' => $request->phone ?? null,
                'address_line_1' => $request->address ?? null,
                'country' => 'Philippines',
            ]);

            $user = User::create([
                'person_id' => $person->person_id,
                'username' => $request->email,
                'password' => Hash::make($request->password),
                'is_active' => true,
            ]);

            $role = Role::where('slug', 'customer')->first();
            if ($role) {
                $user->roles()->sync([$role->role_id]);
            }

            $customer = Customer::create([
                'person_id' => $person->person_id,
                'user_id' => $user->user_id,
                'customer_code' => 'CUS-' . str_pad($user->user_id, 5, '0', STR_PAD_LEFT),
                'is_active' => true,
            ]);

            $token = $user->createToken('auth_token')->plainTextToken;

            return $this->ok([
                'token' => $token,
                'user' => $this->payload($user->load(['person', 'roles', 'customer'])),
                'customer' => $customer,
                'role' => 'customer',
            ], 'Customer registered successfully');
        });
    }

    /**
     * Send customer registration OTP to email/Gmail.
     */
    public function requestRegistrationOtp(Request $request)
    {
        $validator = validator($request->all(), [
            'email' => 'required|email|max:120|unique:persons,email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = strtolower(trim($request->email));
        $otp = (string) random_int(100000, 999999);
        $cacheKey = 'registration-otp:' . sha1($email);

        Cache::put($cacheKey, [
            'otp' => Hash::make($otp),
            'attempts' => 0,
            'verified' => false,
            'email' => $email,
        ], now()->addMinutes(10));

        $this->sendOtpEmail($email, $otp, 'Dear Ba\'bs Catering Registration OTP');

        $payload = [
            'email' => $email,
            'expires_in_minutes' => 10,
        ];

        if (app()->environment(['local', 'development', 'testing'])) {
            $payload['debug_otp'] = $otp;
        }

        return $this->ok($payload, 'Registration OTP sent to email');
    }

    /**
     * Verify registration OTP before account creation.
     */
    public function verifyRegistrationOtp(Request $request)
    {
        $validator = validator($request->all(), [
            'email' => 'required|email|max:120',
            'otp_code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = strtolower(trim($request->email));
        $cacheKey = 'registration-otp:' . sha1($email);
        $record = Cache::get($cacheKey);

        if (!$record) {
            return $this->fail('Invalid or expired OTP', 422);
        }

        $attempts = (int) ($record['attempts'] ?? 0) + 1;
        if ($attempts > 5) {
            Cache::forget($cacheKey);
            return $this->fail('Too many OTP attempts. Please request a new code.', 429);
        }

        if (!Hash::check($request->otp_code, $record['otp'] ?? '')) {
            $record['attempts'] = $attempts;
            Cache::put($cacheKey, $record, now()->addMinutes(10));
            return $this->fail('Invalid or expired OTP', 422);
        }

        $record['verified'] = true;
        $record['verified_at'] = now()->toDateTimeString();
        Cache::put($cacheKey, $record, now()->addMinutes(20));

        return $this->ok(['email' => $email, 'verified' => true], 'Email OTP verified');
    }

    /**
     * Register a customer only after email OTP verification.
     */
    public function registerCustomerWithOtp(Request $request)
    {
        $validator = validator($request->all(), [
            'first_name' => 'required|string|max:80',
            'last_name' => 'required|string|max:80',
            'email' => 'required|email|max:120|unique:persons,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'otp_code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = strtolower(trim($request->email));
        $cacheKey = 'registration-otp:' . sha1($email);
        $record = Cache::get($cacheKey);

        if (!$record || !Hash::check($request->otp_code, $record['otp'] ?? '')) {
            return $this->fail('Invalid or expired OTP', 422);
        }

        return DB::transaction(function () use ($request, $cacheKey) {
            $person = Person::create([
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => strtolower(trim($request->email)),
                'phone' => $request->phone ?? null,
                'address_line_1' => $request->address ?? null,
                'country' => 'Philippines',
            ]);

            $user = User::create([
                'person_id' => $person->person_id,
                'username' => strtolower(trim($request->email)),
                'password' => Hash::make($request->password),
                'email_verified_at' => now(),
                'is_active' => true,
            ]);

            $role = Role::where('slug', 'customer')->first();
            if ($role) {
                $user->roles()->sync([$role->role_id]);
            }

            $customer = Customer::create([
                'person_id' => $person->person_id,
                'user_id' => $user->user_id,
                'customer_code' => 'CUS-' . str_pad($user->user_id, 5, '0', STR_PAD_LEFT),
                'is_active' => true,
            ]);

            Cache::forget($cacheKey);

            $token = $user->createToken('auth_token')->plainTextToken;

            return $this->ok([
                'token' => $token,
                'user' => $this->payload($user->load(['person', 'roles', 'customer'])),
                'customer' => $customer,
                'role' => 'customer',
            ], 'Customer registered and email verified successfully');
        });
    }

    /**
     * Send OTP for the currently authenticated user's email verification flow.
     */
    public function sendEmailOtp(Request $request)
    {
        $user = $request->user()?->loadMissing('person');
        if (!$user) {
            return $this->fail('Unauthenticated', 401);
        }

        $email = strtolower(trim($request->input('email') ?: ($user->person?->email ?? $user->username)));
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('A valid email address is required', 422);
        }

        $otp = (string) random_int(100000, 999999);
        $cacheKey = 'email-otp:' . sha1($user->user_id . '|' . $email);

        Cache::put($cacheKey, [
            'otp' => Hash::make($otp),
            'attempts' => 0,
            'email' => $email,
            'user_id' => $user->user_id,
        ], now()->addMinutes(10));

        $this->sendOtpEmail($email, $otp, 'Dear Ba\'bs Catering Email Verification OTP');

        $payload = [
            'email' => $email,
            'expires_in_minutes' => 10,
        ];

        if (app()->environment(['local', 'development', 'testing'])) {
            $payload['debug_otp'] = $otp;
        }

        return $this->ok($payload, 'Email OTP sent');
    }

    /**
     * Verify the current user's email OTP.
     */
    public function verifyEmailOtp(Request $request)
    {
        $validator = validator($request->all(), [
            'email' => 'nullable|email|max:120',
            'otp_code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user()?->loadMissing('person');
        if (!$user) {
            return $this->fail('Unauthenticated', 401);
        }

        $email = strtolower(trim($request->input('email') ?: ($user->person?->email ?? $user->username)));
        $cacheKey = 'email-otp:' . sha1($user->user_id . '|' . $email);
        $record = Cache::get($cacheKey);

        if (!$record) {
            return $this->fail('Invalid or expired OTP', 422);
        }

        $attempts = (int) ($record['attempts'] ?? 0) + 1;
        if ($attempts > 5) {
            Cache::forget($cacheKey);
            return $this->fail('Too many OTP attempts. Please request a new code.', 429);
        }

        if (!Hash::check($request->otp_code, $record['otp'] ?? '')) {
            $record['attempts'] = $attempts;
            Cache::put($cacheKey, $record, now()->addMinutes(10));
            return $this->fail('Invalid or expired OTP', 422);
        }

        $user->forceFill(['email_verified_at' => now()])->save();
        Cache::forget($cacheKey);

        return $this->ok([
            'email' => $email,
            'verified' => true,
            'user' => $this->payload($user->fresh(['person', 'roles', 'customer'])),
        ], 'Email OTP verified');
    }

    /**
     * Forgot password - validates that the email belongs to the selected account.
     * If the email does not match, no OTP is created and no OTP modal should open.
     */
    public function forgotPassword(Request $request)
    {
        $validator = validator($request->all(), [
            'user_id' => 'required|string',
            'email' => 'required|email|max:120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = trim((string) $request->input('user_id'));
        $providedEmail = strtolower(trim((string) $request->input('email')));

        $user = User::with(['person'])
            ->where('username', $identifier)
            ->orWhereHas('person', function ($query) use ($identifier) {
                $query->where('email', $identifier);
            })
            ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User account not found. Please check your Username or Email.',
                'errors' => [
                    'user_id' => ['No account found with this Username or Email.']
                ]
            ], 404);
        }

        $registeredEmail = strtolower(trim((string) ($user->person?->email ?? $user->username)));

        if (!$registeredEmail || !filter_var($registeredEmail, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'success' => false,
                'message' => 'This account has no valid registered email. Please contact administrator.',
                'errors' => [
                    'email' => ['No valid registered email found for this account.']
                ]
            ], 422);
        }

        if ($providedEmail !== $registeredEmail) {
            return response()->json([
                'success' => false,
                'message' => 'Your email not match email registed',
                'errors' => [
                    'email' => ['Your email not match email registed']
                ]
            ], 422);
        }

        $otp = (string) random_int(100000, 999999);
        Cache::put('password-reset-otp:' . $user->user_id, Hash::make($otp), now()->addMinutes(10));

        $this->sendOtpEmail($registeredEmail, $otp, 'Dear Ba\'bs Catering Password Reset OTP');

        $payload = [
            'user_id' => $user->username,
            'email' => $registeredEmail,
            'expires_in_minutes' => 10,
        ];

        if (app()->environment(['local', 'development', 'testing'])) {
            $payload['debug_otp'] = $otp;
        }

        return response()->json([
            'success' => true,
            'message' => 'Password reset OTP sent to your registered email.',
            'data' => $payload
        ], 200);
    }

    /**
     * Verify OTP
     */
    public function verifyResetOtp(Request $request)
    {
        $validator = validator($request->all(), [
            'user_id' => 'required|string',
            'otp_code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = $request->user_id;

        $user = User::where('username', $identifier)
            ->orWhereHas('person', function ($query) use ($identifier) {
                $query->where('email', $identifier);
            })
            ->first();

        $cachedOtp = Cache::get('password-reset-otp:' . $user?->user_id);

        if (!$user || !$cachedOtp || !Hash::check($request->otp_code, $cachedOtp)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired OTP. Please request a new code.',
                'errors' => [
                    'otp_code' => ['Invalid or expired OTP code.']
                ]
            ], 422);
        }

        $resetToken = Str::random(64);
        Cache::put('password-reset-token:' . $user->user_id, $resetToken, now()->addMinutes(15));

        return response()->json([
            'success' => true,
            'message' => 'OTP verified successfully.',
            'data' => ['reset_token' => $resetToken]
        ], 200);
    }

    /**
     * Resend OTP
     */
    public function resendResetOtp(Request $request)
    {
        return $this->forgotPassword($request);
    }

    /**
     * Reset password
     */
    public function resetPassword(Request $request)
    {
        $validator = validator($request->all(), [
            'user_id' => 'required|string',
            'new_password' => 'required|string|min:8',
            'password_confirmation' => 'required|same:new_password',
            'reset_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = $request->user_id;

        $user = User::where('username', $identifier)
            ->orWhereHas('person', function ($query) use ($identifier) {
                $query->where('email', $identifier);
            })
            ->first();

        if (!$user || Cache::get('password-reset-token:' . $user->user_id) !== $request->reset_token) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired password reset token.',
                'errors' => [
                    'reset_token' => ['Invalid or expired token.']
                ]
            ], 422);
        }

        $user->update(['password' => Hash::make($request->new_password)]);
        
        Cache::forget('password-reset-otp:' . $user->user_id);
        Cache::forget('password-reset-token:' . $user->user_id);

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. You can now login with your new password.'
        ], 200);
    }

    /**
     * Get current user
     */
    public function user(Request $request)
    {
        $user = $request->user()->load(['person', 'roles', 'customer', 'employee']);
        return $this->ok(['user' => $this->payload($user)]);
    }

    /**
     * Get profile
     */
    public function profile(Request $request)
    {
        return $this->user($request);
    }

    /**
     * Update profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user()->load('person');
        $person = $user->person;

        if (!$person) {
            return $this->fail('Person record not found', 404);
        }

        $validated = $request->validate([
            'full_name' => ['nullable', 'string', 'max:160'],
            'first_name' => ['nullable', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:120', 'unique:persons,email,' . $person->person_id . ',person_id'],
            'phone' => ['nullable', 'string', 'max:30'],
            'phone_number' => ['nullable', 'string', 'max:30'],
            'bio' => ['nullable', 'string', 'max:1000'],
            'address' => ['nullable', 'string'],
            'address_line_1' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'province' => ['nullable', 'string', 'max:80'],
        ]);

        $personData = [];

        if ($request->filled('full_name')) {
            $parts = explode(' ', trim($request->full_name), 2);
            $personData['first_name'] = $parts[0] ?? $person->first_name;
            $personData['last_name'] = $parts[1] ?? $person->last_name;
        }

        if ($request->filled('first_name')) {
            $personData['first_name'] = $request->first_name;
        }

        if ($request->filled('last_name')) {
            $personData['last_name'] = $request->last_name;
        }

        if ($request->filled('email')) {
            $personData['email'] = $request->email;
        }

        if ($request->filled('phone')) {
            $personData['phone'] = $request->phone;
        }

        if ($request->filled('phone_number')) {
            $personData['phone'] = $request->phone_number;
        }

        if ($request->filled('address')) {
            $personData['address_line_1'] = $request->address;
        }

        if ($request->filled('address_line_1')) {
            $personData['address_line_1'] = $request->address_line_1;
        }

        if ($request->filled('city')) {
            $personData['city'] = $request->city;
        }

        if ($request->filled('province')) {
            $personData['province'] = $request->province;
        }

        if (!empty($personData)) {
            $person->update($personData);
        }

        if (array_key_exists('bio', $validated)) {
            Setting::setValue('user_profile', 'user_' . $user->user_id . '_bio', $validated['bio'] ?? '', 'string');
        }

        return $this->user($request);
    }

    /**
     * Update profile photo
     */
    public function updateProfilePhoto(Request $request)
    {
        $user = $request->user();
        $person = $user->person;

        if (!$person) {
            return $this->fail('Person record not found', 404);
        }

        $request->validate([
            'profile_photo' => 'required|image|max:2048',
        ]);

        $path = $request->file('profile_photo')->store('profile-photos', 'public');
        $person->update(['profile_photo' => $path]);

        return $this->ok([
            'user' => $this->payload($user->fresh(['person', 'roles', 'customer', 'employee'])),
        ], 'Profile photo updated successfully');
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $validator = validator($request->all(), [
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return $this->fail('Current password is incorrect', 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return $this->ok(null, 'Password changed successfully');
    }

    /**
     * Remove profile photo
     */
    public function removeProfilePhoto(Request $request)
    {
        $user = $request->user();
        $person = $user->person;

        if ($person && $person->profile_photo) {
            if (file_exists(public_path('storage/' . $person->profile_photo))) {
                unlink(public_path('storage/' . $person->profile_photo));
            }
            $person->update(['profile_photo' => null]);
        }

        return $this->ok(null, 'Profile photo removed');
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        if ($request->user()) {
            AuditLog::log('user_logout', 'auth', $request->user()->user_id, null, [
                'email' => $request->user()->person?->email ?? $request->user()->username,
            ]);
        }
        $request->user()->currentAccessToken()?->delete();
        return $this->ok(null, 'Logged out successfully');
    }

    /**
     * ============================================================
     * 🔐 OTP EMAIL SENDING - WORKS WITH ANY EMAIL PROVIDER
     * ============================================================
     */
    private function sendOtpEmail(string $email, string $otp, string $subject = 'Your OTP Code'): void
    {
        try {
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Log::error('Invalid email format: ' . $email);
                return;
            }

            // Get user name if available for personalization
            $name = 'User';
            $user = User::whereHas('person', function ($query) use ($email) {
                $query->where('email', $email);
            })->first();
            
            if ($user && $user->person) {
                $name = $user->person->first_name ?: 'User';
            }

            // Send using the HTML email template
            Mail::to($email)->send(new OTPMail($otp, $name, $subject));
            
            Log::info('OTP email sent successfully to: ' . $email, [
                'subject' => $subject,
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to send OTP email to ' . $email . ': ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            // Fallback: Try using raw mail if HTML template fails
            try {
                Mail::raw("Your OTP code is {$otp}. This code expires in 10 minutes. If you did not request this code, please ignore this email.", function ($message) use ($email, $subject) {
                    $message->to($email)->subject($subject);
                });
                Log::info('OTP email sent via fallback raw method to: ' . $email);
            } catch (\Exception $fallbackError) {
                Log::error('Fallback OTP email also failed: ' . $fallbackError->getMessage());
                // Don't re-throw - we don't want to break the flow
            }
        }
    }

    /**
     * ============================================================
     * LOGIN OTP VERIFICATION - PRESERVED
     * ============================================================
     */
    private function verifyOrSendLoginOtp(User $user, string $otpCode)
    {
        $cacheKey = 'login-otp:' . $user->user_id;

        if ($otpCode !== '') {
            $cachedOtp = Cache::get($cacheKey);
            if (!$cachedOtp || !Hash::check($otpCode, $cachedOtp)) {
                return $this->fail('Invalid or expired login OTP', 422);
            }

            Cache::forget($cacheKey);
            return true;
        }

        $otp = (string) random_int(100000, 999999);
        Cache::put($cacheKey, Hash::make($otp), now()->addMinutes(10));
        
        $email = $user->person?->email ?? $user->username;
        $this->sendOtpEmail($email, $otp, 'Dear Ba\'bs Catering Login OTP');

        $payload = [
            'requires_otp' => true,
            'user_id' => $user->username,
            'email' => $email,
            'expires_in_minutes' => 10,
        ];

        if (app()->environment(['local', 'development', 'testing'])) {
            $payload['debug_otp'] = $otp;
        }

        return response()->json([
            'success' => true,
            'message' => 'Login OTP sent to your registered email.',
            'data' => $payload,
        ], 202);
    }

    private function primaryRole(User $user): string
    {
        $slugs = $user->roles->pluck('slug')->map(fn ($slug) => strtolower((string) $slug))->all();

        if (array_intersect($slugs, ['super-admin', 'super_admin', 'superadmin'])) {
            return 'super-admin';
        }

        if (array_intersect($slugs, ['admin', 'administrator', 'owner'])) {
            return 'admin';
        }

        if (in_array('cashier', $slugs, true) || in_array('finance-staff', $slugs, true)) {
            return 'cashier';
        }

        if (in_array('head-chef', $slugs, true) || in_array('head_chef', $slugs, true)) {
            return 'head-chef';
        }

        if (in_array('staff-manager', $slugs, true) || in_array('staff_manager', $slugs, true)) {
            return 'staff-manager';
        }

        if (in_array('inventory-manager', $slugs, true) || in_array('inventory_manager', $slugs, true)) {
            return 'inventory-manager';
        }

        $employee = $user->employee;
        if ($employee) {
            $employee->loadMissing('position');
            $positionTitle = strtolower((string) ($employee->position?->title ?? $employee->position?->name ?? ''));
            if (str_contains($positionTitle, 'cashier')) {
                return 'cashier';
            }

            return 'employee';
        }

        return 'customer';
    }

    private function recordLogin(User $user, Request $request): void
    {
        try {
            AuditLog::log('user_login', 'auth', $user->user_id, null, [
                'email' => $user->person?->email ?? $user->username,
                'ip_address' => $request->ip(),
            ]);
            Cache::forget('failed_login_' . md5(($user->person?->email ?? $user->username) . '|' . $request->ip()));
        } catch (\Throwable $e) {
            // Audit log should never block login.
        }
    }

    private function recordFailedLogin(string $identifier, Request $request): void
    {
        try {
            AuditLog::log('failed_login_attempt', 'auth', null, null, [
                'identifier' => $identifier,
                'ip_address' => $request->ip(),
            ]);

            $cacheKey = 'failed_login_' . md5($identifier . '|' . $request->ip());
            $attempts = (int) Cache::get($cacheKey, 0) + 1;
            Cache::put($cacheKey, $attempts, now()->addMinutes(30));

            if ($attempts >= 3) {
                app(NotificationService::class)->failedLoginAttempt($identifier, $request->ip(), $attempts);
                AuditLog::log('multiple_failed_login_attempts', 'security', null, null, [
                    'identifier' => $identifier,
                    'ip_address' => $request->ip(),
                    'attempts' => $attempts,
                ]);
            }
        } catch (\Throwable $e) {
            // Failed-login monitoring should never block the response.
        }
    }

    /**
     * Format user payload
     */
    private function payload(User $user): array
    {
        $person = $user->person;
        
        $customerId = null;
        if ($user->customer) {
            $id = (int) $user->customer->customer_id;
            $customerId = str_pad($id, 4, '0', STR_PAD_LEFT);
        }
        
        $primaryRole = $this->primaryRole($user);
        $bio = Setting::getValue('user_profile', 'user_' . $user->user_id . '_bio', '');
        
        return [
            'id' => $user->user_id,
            'user_id' => $user->user_id,
            'username' => $user->username,
            'full_name' => trim(($person->first_name ?? '') . ' ' . ($person->last_name ?? '')),
            'first_name' => $person->first_name ?? null,
            'last_name' => $person->last_name ?? null,
            'email' => $person->email ?? null,
            'phone_number' => $person->phone ?? null,
            'phone' => $person->phone ?? null,
            'bio' => $bio,
            'country_code' => '+63',
            'role' => $primaryRole,
            'primary_role' => $primaryRole,
            'roles' => $user->roles->pluck('slug')->toArray(),
            'is_verified' => (bool) $user->email_verified_at,
            'is_active' => (bool) $user->is_active,
            'profile_photo' => $person->profile_photo ?? null,
            'profile_photo_url' => $person->profile_photo_url ?? null,
            'customer_id' => $customerId,
            'employee_id' => $user->employee?->employee_id,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}