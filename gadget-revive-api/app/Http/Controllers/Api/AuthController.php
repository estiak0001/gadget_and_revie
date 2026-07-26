<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterCustomerRequest;
use App\Http\Requests\Auth\RegisterVendorRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends BaseController
{
    public function __construct(
        protected AuthService $authService
    ) {}

    public function registerCustomer(RegisterCustomerRequest $request): JsonResponse
    {
        $user = $this->authService->registerCustomer($request->validated());
        $otpEnabled = $this->authService->isOtpVerificationEnabled();

        if ($otpEnabled) {
            // OTP flow – user stays pending; front-end should prompt for verification
            return $this->created([
                'user'    => new UserResource($user),
                'message' => 'Registration successful. Please verify your phone number.',
            ], 'Customer registered successfully');
        }

        // OTP disabled – auto-login and return token immediately
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->created([
            'user'    => new UserResource($user),
            'token'   => $token,
            'message' => 'Registration successful. Welcome!',
        ], 'Customer registered successfully');
    }

    public function registerVendor(RegisterVendorRequest $request): JsonResponse
    {
        $user = $this->authService->registerVendor($request->validated());

        // TODO: Send verification email

        return $this->created([
            'user' => new UserResource($user->load('vendorProfile')),
            'message' => 'Vendor onboarding submitted. Please verify your email and wait for admin approval.',
        ], 'Vendor onboarding submitted successfully');
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            $request->phone_or_email,
            $request->password
        );

        if (!$result) {
            return $this->unauthorized('Invalid credentials. Please check your phone/email and password.');
        }

        $user = $result['user'];
        $otpEnabled = $this->authService->isOtpVerificationEnabled();

        // Only enforce verification when OTP is enabled
        if ($otpEnabled && !$user->isVerified()) {
            return $this->error('Please verify your phone number first.', 403);
        }

        // Check if user is active
        if (!$user->isActive()) {
            return $this->error('Your account is not active. Please contact support.', 403);
        }

        // For vendors, check if approved
        if ($user->isVendor() && $user->vendorProfile) {
            if ($user->vendorProfile->status !== 'approved') {
                return $this->success([
                    'user'          => new UserResource($user->load('vendorProfile')),
                    'token'         => $result['token'],
                    'vendor_status' => $user->vendorProfile->status,
                    'message'       => 'Your vendor account is pending approval.',
                ], 'Login successful but vendor not yet approved');
            }
        }

        return $this->success([
            'user'  => new UserResource($user->load('vendorProfile')),
            'token' => $result['token'],
        ], 'Login successful');
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return $this->success(null, 'Logged out successfully');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('vendorProfile.serviceCategories');

        return $this->success(new UserResource($user));
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $user = User::where('remember_token', $request->token)->first();

        if (!$user) {
            return $this->error('Invalid verification token', 400);
        }

        $this->authService->verifyEmail($user);
        $user->update(['remember_token' => null]);

        return $this->success(null, 'Email verified successfully');
    }

    public function verifyPhone(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|exists:users,phone',
            'otp'   => 'required|string|size:6',
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (!$user) {
            return $this->error('User not found', 404);
        }

        if (!$this->authService->verifyPhone($user, $request->otp)) {
            return $this->error('Invalid or expired OTP code', 400);
        }

        // Auto-login after successful OTP verification
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->success([
            'user'  => new UserResource($user),
            'token' => $token,
        ], 'Phone verified successfully. Welcome!');
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->first();

        if ($user->isVerified()) {
            return $this->error('Email is already verified', 400);
        }

        // Generate new token
        $token = $this->authService->generateVerificationToken();
        $user->update(['remember_token' => $token]);

        // TODO: Send verification email with token

        return $this->success(null, 'Verification email sent');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        // TODO: Send password reset email
        // For now, we'll use Laravel's built-in password reset
        $status = Password::sendResetLink($request->only('email'));

        return $status === Password::RESET_LINK_SENT
            ? $this->success(null, 'Password reset link sent to your email')
            : $this->error('Unable to send password reset link', 500);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email|exists:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $this->authService->resetPassword($user, $password);
            }
        );

        return $status === Password::PASSWORD_RESET
            ? $this->success(null, 'Password reset successfully')
            : $this->error('Invalid or expired reset token', 400);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'name'  => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'sometimes|nullable|string|max:20',
            'avatar' => 'sometimes|nullable|image|max:2048',
        ]);

        $data = $request->only(['name', 'email', 'phone']);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('avatars', 'public');
            $data['avatar'] = $path;
        }

        $user->update($data);

        return $this->success(new UserResource($user), 'Profile updated successfully');
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string|current_password',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $this->authService->resetPassword($request->user(), $request->password);

        // Create new token after password change
        $token = $request->user()->createToken('auth-token')->plainTextToken;

        return $this->success([
            'token' => $token,
        ], 'Password changed successfully');
    }
}
