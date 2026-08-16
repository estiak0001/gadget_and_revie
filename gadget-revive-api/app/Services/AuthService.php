<?php

namespace App\Services;

use App\Models\RegistrationLead;
use App\Models\User;
use App\Models\VendorProfile;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthService
{
    /** Every OTP this service issues — registration or password reset — is valid for this long,
     *  and a resend is only allowed once that window has passed. */
    private const OTP_TTL_MINUTES = 5;

    public function __construct(protected SmsService $sms) {}

    /**
     * Is OTP / phone verification required for registration and password reset? Single source of
     * truth is the SMS Center's OTP tab (sms_otp_enabled + an active connection assigned) — the
     * same switch that turns actual OTP delivery on/off, so there's no separate toggle that can
     * drift out of sync with whether an OTP would actually be sendable. Turning it off there
     * makes registration skip straight to an active, logged-in account ("direct" signup) and
     * makes password reset unavailable (there's no other verified channel to reset it through).
     */
    public function isOtpVerificationEnabled(): bool
    {
        return $this->sms->shouldSendOtp();
    }

    public function registerCustomer(array $data): User
    {
        $otpEnabled = $this->isOtpVerificationEnabled();
        $otp = $otpEnabled ? $this->generatePhoneOtp() : null;

        $user = User::create([
            'name'                          => $data['name'],
            'email'                         => $data['email'] ?? null,
            'phone'                         => $data['phone'],
            'password'                      => Hash::make($data['password']),
            'role'                          => 'customer',
            // If OTP is disabled the account is immediately active & verified
            'status'                        => $otpEnabled ? 'pending' : 'active',
            'email_verified_at'             => $otpEnabled ? null : now(),
            'phone_verification_code'       => $otp,
            'phone_verification_expires_at' => $otp ? now()->addMinutes(self::OTP_TTL_MINUTES) : null,
        ]);

        // Previously the code was generated and stored but never actually sent anywhere —
        // "please verify your phone" with no way to receive the code it expects back. Only
        // attempts the send when the SMS gateway's own "send OTP" toggle is on (independent of
        // otp_verification_enabled — the phone-required-at-signup rule and the SMS delivery
        // channel for it are configured separately, see SmsService::shouldSendOtp()).
        if ($otp && $this->sms->shouldSendOtp()) {
            $this->sms->sendOtp($user->phone, $otp);
        }

        // This phone number just became a real account — any lead captured while they were
        // typing it into the form is done being "just a lead".
        RegistrationLead::where('phone', $user->phone)->whereNull('converted_user_id')
            ->update(['converted_user_id' => $user->id]);

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
     * Login by phone (primary) or email (fallback). Never asks for an OTP — a verified account
     * logs in with just its password, every time; OTP only ever gates registration and password
     * reset.
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

    /**
     * Re-issues and re-sends the registration OTP — but only once the current one has actually
     * expired (or none was ever sent). Without this, "Resend" could be smashed indefinitely,
     * burning through SMS credit and making the 5-minute validity window meaningless.
     *
     * @return array{ok: bool, retry_after?: int} retry_after (seconds) is present only when ok is
     *         false — how much longer until a resend is actually allowed.
     */
    public function resendPhoneOtp(User $user): array
    {
        if ($user->phone_verification_expires_at && now()->lt($user->phone_verification_expires_at)) {
            return ['ok' => false, 'retry_after' => (int) ceil(now()->diffInSeconds($user->phone_verification_expires_at))];
        }

        $otp = $this->generatePhoneOtp();
        $user->update([
            'phone_verification_code'       => $otp,
            'phone_verification_expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
        ]);

        if ($this->sms->shouldSendOtp()) {
            $this->sms->sendOtp($user->phone, $otp);
        }

        return ['ok' => true];
    }

    public function verifyPhone(User $user, string $otp): bool
    {
        if ($user->phone_verification_code !== $otp) {
            return false;
        }

        if ($user->phone_verification_expires_at && now()->gt($user->phone_verification_expires_at)) {
            return false;
        }

        $user->update([
            'phone_verified_at'             => now(),
            'phone_verification_code'       => null,
            'phone_verification_expires_at' => null,
            'email_verified_at'             => $user->email_verified_at ?? now(), // also mark as verified
            'status'                        => 'active',
        ]);

        AuditLog::log($user, 'verify_phone', 'User', $user->id, null, null, 'Phone verified');

        return true;
    }

    /**
     * Password reset step 1 — sends an OTP to the account's own phone number. Deliberately phone-
     * based rather than the previous email-link flow (Laravel's password-reset broker): this app
     * is phone-primary throughout, email is optional on the account, and phone/SMS is the only
     * delivery channel that's actually wired up and working end to end.
     */
    public function sendPasswordResetOtp(User $user): void
    {
        $otp = $this->generatePhoneOtp();
        $user->update([
            'password_reset_otp'            => $otp,
            'password_reset_otp_expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
        ]);

        if ($this->sms->shouldSendOtp()) {
            $this->sms->sendOtp(
                $user->phone,
                $otp,
                'sms_password_reset_template',
                'Your {app} password reset code is {otp}. It will expire in 5 minutes.'
            );
        }
    }

    /** Same 5-minutes-then-resend rule as the registration OTP — see resendPhoneOtp(). */
    public function resendPasswordResetOtp(User $user): array
    {
        if ($user->password_reset_otp_expires_at && now()->lt($user->password_reset_otp_expires_at)) {
            return ['ok' => false, 'retry_after' => (int) ceil(now()->diffInSeconds($user->password_reset_otp_expires_at))];
        }

        $this->sendPasswordResetOtp($user);

        return ['ok' => true];
    }

    /**
     * Password reset step 2 — verifies the OTP and, only when it's valid, applies the new
     * password in the same call rather than as a separate "verify" step, so there's no window
     * where a checked-but-not-yet-consumed OTP could be replayed against a different password.
     */
    public function resetPasswordWithOtp(User $user, string $otp, string $newPassword): bool
    {
        if ($user->password_reset_otp !== $otp) {
            return false;
        }

        if ($user->password_reset_otp_expires_at && now()->gt($user->password_reset_otp_expires_at)) {
            return false;
        }

        $user->update([
            'password'                      => Hash::make($newPassword),
            'password_reset_otp'            => null,
            'password_reset_otp_expires_at' => null,
        ]);

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::log($user, 'reset_password', 'User', $user->id, null, null, 'Password reset via OTP');

        return true;
    }

    /** Used by admin-initiated resets and the logged-in "change password" flow — no OTP involved,
     *  the caller has already established who they are some other way. */
    public function resetPassword(User $user, string $newPassword): void
    {
        $user->update([
            'password' => Hash::make($newPassword),
        ]);

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::log($user, 'reset_password', 'User', $user->id, null, null, 'Password reset');
    }

    /**
     * Captures a phone number (and whatever else has been typed alongside it) the moment someone
     * starts filling in the storefront registration form — independent of whether they ever
     * actually submit, and even if the eventual registration attempt fails validation (duplicate
     * phone, weak password, etc). Upserts by phone so correcting a typo doesn't create duplicate
     * leads, and is a no-op once that phone has already converted to a real account.
     */
    public function captureRegistrationLead(string $phone, ?string $name = null, ?string $email = null): void
    {
        RegistrationLead::updateOrCreate(
            ['phone' => $phone, 'converted_user_id' => null],
            array_filter(['name' => $name, 'email' => $email], fn ($v) => $v !== null && $v !== '')
        );
    }
}
