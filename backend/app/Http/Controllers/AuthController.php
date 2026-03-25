<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\OtpVerification;
use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class AuthController extends Controller
{
    /**
     * Send OTP for phone verification
     */
    public function sendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone_number' => 'required|string|size:10',
            'country_code' => 'required|string|in:+63',
            'type' => 'required|in:registration,login,password_reset'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $fullPhoneNumber = $request->country_code . $request->phone_number;

        // Check for existing verified user in registration
        if ($request->type === 'registration') {
            $existingUser = User::where('phone_number', $request->phone_number)
                ->where('country_code', $request->country_code)
                ->first();

            if ($existingUser && $existingUser->is_verified) {
                return response()->json([
                    'success' => false,
                    'message' => 'This phone number is already registered. Please login instead.'
                ], 400);
            }
        }

        try {
            // Delete old OTPs
            OtpVerification::where('phone_number', $request->phone_number)
                ->where('status', 'pending')
                ->update(['status' => 'expired']);

            // Generate OTP (6 digits)
            $otpCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            // Create new OTP
            $otp = OtpVerification::create([
                'phone_number' => $request->phone_number,
                'country_code' => $request->country_code,
                'otp_code' => $otpCode,
                'type' => $request->type,
                'expires_at' => Carbon::now()->addMinutes(10),
                'status' => 'pending'
            ]);

            // Log OTP for development
            \Log::info("OTP for {$fullPhoneNumber}: {$otpCode}");

            return response()->json([
                'success' => true,
                'message' => 'OTP sent successfully',
                'data' => [
                    'otp_id' => $otp->id,
                    'expires_at' => $otp->expires_at,
                    'debug_otp' => app()->environment('local') ? $otpCode : null
                ]
            ], 200);
        } catch (\Exception $e) {
            \Log::error('OTP sending error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send OTP. Please try again.'
            ], 500);
        }
    }

    /**
     * Verify OTP
     */
    public function verifyOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone_number' => 'required|string|size:10',
            'country_code' => 'required|string|in:+63',
            'otp_code' => 'required|string|size:6',
            'type' => 'required|in:registration,login,password_reset'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $otp = OtpVerification::where('phone_number', $request->phone_number)
            ->where('country_code', $request->country_code)
            ->where('otp_code', $request->otp_code)
            ->where('type', $request->type)
            ->where('status', 'pending')
            ->latest()
            ->first();

        if (!$otp) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid OTP code'
            ], 400);
        }

        if ($otp->isExpired()) {
            $otp->update(['status' => 'expired']);
            return response()->json([
                'success' => false,
                'message' => 'OTP has expired'
            ], 400);
        }

        if ($otp->attempts >= 5) {
            $otp->update(['status' => 'expired']);
            return response()->json([
                'success' => false,
                'message' => 'Too many failed attempts. Please request a new OTP.'
            ], 400);
        }

        // Mark as verified
        $otp->markAsVerified();

        // Generate verification token
        $verificationToken = Str::random(60);

        return response()->json([
            'success' => true,
            'message' => 'OTP verified successfully',
            'data' => [
                'verified' => true,
                'verification_token' => $verificationToken,
                'phone_number' => $request->phone_number
            ]
        ], 200);
    }

    /**
     * Resend OTP
     */
    public function resendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone_number' => 'required|string|size:10',
            'country_code' => 'required|string|in:+63',
            'type' => 'required|in:registration,login,password_reset'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check rate limiting
        $lastOtp = OtpVerification::where('phone_number', $request->phone_number)
            ->where('type', $request->type)
            ->latest()
            ->first();

        if ($lastOtp && $lastOtp->created_at->diffInSeconds(now()) < 60) {
            return response()->json([
                'success' => false,
                'message' => 'Please wait 60 seconds before requesting another OTP'
            ], 429);
        }

        return $this->sendOtp($request);
    }

    /**
     * Register new user
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|min:2|max:100',
            'email' => 'required|email|unique:users,email',
            'phone_number' => 'required|string|size:10|unique:users,phone_number',
            'country_code' => 'required|string|in:+63',
            'user_id' => 'required|string|min:3|max:50|unique:users,user_id|regex:/^[a-zA-Z0-9_.-]+$/',
            'password' => 'required|string|min:8|confirmed',
            'verification_token' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify that phone was OTP verified
        $verifiedOtp = OtpVerification::where('phone_number', $request->phone_number)
            ->where('country_code', $request->country_code)
            ->where('type', 'registration')
            ->where('status', 'verified')
            ->latest()
            ->first();

        if (!$verifiedOtp) {
            return response()->json([
                'success' => false,
                'message' => 'Phone number not verified. Please complete OTP verification first.'
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Create user
            $user = User::create([
                'user_id' => $request->user_id,
                'full_name' => $request->full_name,
                'email' => $request->email,
                'phone_number' => $request->phone_number,
                'country_code' => $request->country_code,
                'password' => Hash::make($request->password),
                'is_verified' => true,
                'phone_verified_at' => now(),
                'status' => 'active',
                'role' => 'user'
            ]);

            // Create API token
            $token = $user->createToken('auth_token')->plainTextToken;

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Registration successful',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'user_id' => $user->user_id,
                        'full_name' => $user->full_name,
                        'email' => $user->email,
                        'phone_number' => $user->phone_number,
                        'country_code' => $user->country_code,
                        'is_verified' => $user->is_verified,
                        'role' => $user->role
                    ],
                    'token' => $token
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Registration error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again.'
            ], 500);
        }
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        \Log::info('Login attempt:', [
            'userId' => $request->userId,
            'remember_me' => $request->remember_me
        ]);

        $validator = Validator::make($request->all(), [
            'userId' => 'required|string',
            'password' => 'required|string',
            'remember_me' => 'boolean'
        ]);

        if ($validator->fails()) {
            \Log::error('Login validation failed:', $validator->errors()->toArray());
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Find user by user_id or email
        $user = User::where('user_id', $request->userId)
            ->orWhere('email', $request->userId)
            ->first();

        \Log::info('User found:', ['user' => $user ? $user->toArray() : null]);

        if (!$user) {
            \Log::warning('User not found with userId/email: ' . $request->userId);
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        \Log::info('Password check:', [
            'input_password' => $request->password,
            'hashed_password' => $user->password,
            'matches' => Hash::check($request->password, $user->password)
        ]);

        if (!Hash::check($request->password, $user->password)) {
            \Log::warning('Password mismatch for user: ' . $user->user_id);
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if ($user->status !== 'active') {
            \Log::warning('User not active: ' . $user->status);
            return response()->json([
                'success' => false,
                'message' => 'Your account is ' . $user->status . '. Please contact support.'
            ], 403);
        }

        try {
            // Create API token
            $token = $user->createToken(
                'auth_token',
                ['*'],
                $request->remember_me ? now()->addDays(30) : now()->addDays(1)
            )->plainTextToken;

            // Update last login
            $user->last_login_at = now();
            $user->save();

            \Log::info('Login successful for user: ' . $user->user_id);

            return response()->json([
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'user_id' => $user->user_id,
                        'full_name' => $user->full_name,
                        'email' => $user->email,
                        'phone_number' => $user->phone_number,
                        'country_code' => $user->country_code,
                        'is_verified' => $user->is_verified,
                        'role' => $user->role
                    ],
                    'token' => $token
                ]
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Login failed. Please try again.'
            ], 500);
        }
    }
    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        try {
            // Revoke current token
            $request->user()->currentAccessToken()->delete();

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully'
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Logout error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Logout failed'
            ], 500);
        }
    }

    /**
     * Get authenticated user
     */
    public function user(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'user' => $request->user()
            ]
        ]);
    }
}
