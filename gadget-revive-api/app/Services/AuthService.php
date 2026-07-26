<?php

namespace App\Services;

use App\Models\SiteSetting;
use App\Models\User;
use App\Models\VendorProfile;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthService
{
    /**
     * Is OTP / phone verification required (controlled by admin setting)?
     */
    public function isOtpVerificationEnabled(): bool
    {
        return (bool) SiteSetting::get('otp_verification_enabled', false);
    }

    public function registerCustomer(array $data): User
    {
        $otpEnabled = $this->isOtpVerificationEnabled();

        $user = User::create([
            'name'              => $data['name'],
            'email'             => $data['email'] ?? null,
            'phone'             => $data['phone'],
            'password'          => Hash::make($data['password']),
            'role'              => 'customer',
            // If OTP is disabled the account is immediately active & verified
            'status'            => $otpEnabled ? 'pending' : 'active',
            'email_verified_at' => $otpEnabled ? null : now(),
        ]);

        AuditLog::log($user, 'register', 'User', $user->id, null, [
            'name'  => $user->name,
            'phone' => $user->phone,
            'role'  => 'customer',
        ], 'Customer registered');

        return $user;
    }

    public function registerVendor(array $data): User
    {
        $user = User::create([
            'name'     => $data['owner_name'],
            'email'    => $data['email'],
            'phone'    => $data['phone'],
            'password' => Hash::make($data['password']),
            'role'     => 'vendor',
            'status'   => 'pending',
        ]);

        $vendorProfile = VendorProfile::create([
            'user_id'             => $user->id,
            'business_name'       => $data['business_name'],
            'owner_name'          => $data['owner_name'],
            'description'         => $data['description'] ?? null,
            'address'             => $data['address'] ?? null,
            'google_maps_link'    => $data['google_maps_link'] ?? null,
            'division_id'         => $data['division_id'] ?? null,
            'district_id'         => $data['district_id'] ?? null,
            'area_id'             => $data['area_id'] ?? null,
            'bkash_number'        => $data['bkash_number'] ?? null,
            'nagad_number'        => $data['nagad_number'] ?? null,
            'bank_account_name'   => $data['bank_account_name'] ?? null,
            'bank_name'           => $data['bank_name'] ?? null,
            'bank_account_number' => $data['bank_account_number'] ?? null,
            'bank_branch'         => $data['bank_branch'] ?? null,
            'payment_instructions'=> $data['payment_instructions'] ?? null,
            'trade_license'       => $data['trade_license'] ?? null,
            'nid_number'          => $data['nid_number'] ?? null,
            'status'              => 'pending',
        ]);

        // Attach service categories if provided
        if (!empty($data['service_category_ids'])) {
            $vendorProfile->serviceCategories()->attach($data['service_category_ids']);
        }

        AuditLog::log($user, 'register', 'VendorProfile', $vendorProfile->id, null, [
            'business_name' => $vendorProfile->business_name,
            'owner_name'    => $vendorProfile->owner_name,
        ], 'Vendor onboarding submitted');

        return $user;
    }

    /**
     * Login by phone (primary) or email (fallback).
     *
     * @param  string  $phoneOrEmail  The value submitted as phone_or_email
     */
    public function login(string $phoneOrEmail, string $password): ?array
    {
        // Determine whether this looks like an email
        $isEmail = filter_var($phoneOrEmail, FILTER_VALIDATE_EMAIL);

        if ($isEmail) {
            $user = User::where('email', $phoneOrEmail)->first();
        } else {
            // Try phone first, then fall back to email
            $user = User::where('phone', $phoneOrEmail)->first()
                ?? User::where('email', $phoneOrEmail)->first();
        }

        if (!$user || !Hash::check($password, $user->password)) {
            return null;
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        AuditLog::log($user, 'login', 'User', $user->id, null, null, 'User logged in');

        return [
            'user'  => $user,
            'token' => $token,
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
        AuditLog::log($user, 'logout', 'User', $user->id, null, null, 'User logged out');
    }

    public function verifyEmail(User $user): void
    {
        $user->update([
            'email_verified_at' => now(),
            'status'            => 'active',
        ]);

        AuditLog::log($user, 'verify_email', 'User', $user->id, null, null, 'Email verified');
    }

    public function generateVerificationToken(): string
    {
        return Str::random(64);
    }

    public function generatePhoneOtp(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public function verifyPhone(User $user, string $otp): bool
    {
        if ($user->phone_verification_code !== $otp) {
            return false;
        }

        $user->update([
            'phone_verified_at'       => now(),
            'phone_verification_code' => null,
            'email_verified_at'       => $user->email_verified_at ?? now(), // also mark as verified
            'status'                  => 'active',
        ]);

        AuditLog::log($user, 'verify_phone', 'User', $user->id, null, null, 'Phone verified');

        return true;
    }

    public function resetPassword(User $user, string $newPassword): void
    {
        $user->update([
            'password' => Hash::make($newPassword),
        ]);

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::log($user, 'reset_password', 'User', $user->id, null, null, 'Password reset');
    }
}
