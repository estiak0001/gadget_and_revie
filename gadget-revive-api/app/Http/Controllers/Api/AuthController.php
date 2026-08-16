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

    public function resendOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|exists:users,phone',
        ]);

        $user = User::where('phone', $request->phone)->first();

        if ($user->isVerified()) {
            return $this->error('Phone is already verified', 400);
        }

        $result = $this->authService->resendPhoneOtp($user);

        if (!$result['ok']) {
            return $this->error(
                "Please wait before requesting another code (available in {$result['retry_after']}s).",
                429,
                ['retry_after' => $result['retry_after']]
            );
        }

        return $this->success(null, 'A new verification code has been sent.');
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

    /**
     * Password reset step 1 — send an OTP to the account's phone. Phone-based rather than the
     * previous email-link flow: this app is phone-primary throughout and email is optional on
     * the account, so phone/SMS is the only reset channel every customer actually has.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        if (!$this->authService->isOtpVerificationEnabled()) {
            return $this->error('Password reset is currently unavailable. Please contact support.', 422);
        }

        $request->validate([
            'phone' => 'required|string|exists:users,phone',
        ]);

        $user = User::where('phone', $request->phone)->first();

        $this->authService->sendPasswordResetOtp($user);

        return $this->success(null, 'A password reset code has been sent to your phone.');
    }

    public function resendResetOtp(Request $request): JsonResponse
    {
        if (!$this->authService->isOtpVerificationEnabled()) {
            return $this->error('Password reset is currently unavailable. Please contact support.', 422);
        }

        $request->validate([
            'phone' => 'required|string|exists:users,phone',
        ]);

        $user = User::where('phone', $request->phone)->first();
        $result = $this->authService->resendPasswordResetOtp($user);

        if (!$result['ok']) {
            return $this->error(
                "Please wait before requesting another code (available in {$result['retry_after']}s).",
                429,
                ['retry_after' => $result['retry_after']]
            );
        }

        return $this->success(null, 'A new reset code has been sent.');
    }

    /** Password reset step 2 — verify the OTP and set the new password in one call. */
    public function resetPassword(Request $request): JsonResponse
    {
        if (!$this->authService->isOtpVerificationEnabled()) {
            return $this->error('Password reset is currently unavailable. Please contact support.', 422);
        }

        $request->validate([
            'phone' => 'required|string|exists:users,phone',
            'otp' => 'required|string|size:6',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (!$this->authService->resetPasswordWithOtp($user, $request->otp, $request->password)) {
            return $this->error('Invalid or expired reset code', 400);
        }

        return $this->success(null, 'Password reset successfully. Please sign in with your new password.');
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

    /**
     * Captures whatever's been typed into the registration form (phone number is the only field
     * that actually matters) the moment it looks like a real attempt — independent of whether
     * registration is ever completed or errors out. Public, unauthenticated, and deliberately
     * never fails loudly: this is a side-channel for lead recovery, not part of the registration
     * flow itself, so a bad/incomplete payload just gets validated away rather than surfaced as
     * an error the storefront would need to handle.
     */
    public function captureLead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|min:6|max:20',
            'name'  => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        $this->authService->captureRegistrationLead(
            $validated['phone'],
            $validated['name'] ?? null,
            $validated['email'] ?? null
        );

        return $this->success(null, 'ok');
    }
}
