<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `email_verified_at` was missing from User::$fillable until today, so every attempt to set
     * it via mass assignment (registerCustomer()'s auto-verify-when-OTP-disabled path, and
     * verifyPhone()'s "also mark as verified" step) was silently dropped — the account still
     * ended up 'active', just without email_verified_at ever actually being persisted. That was
     * harmless while OTP enforcement had no consistent single source of truth to actually turn
     * on, but now that login checks isVerified() (which reads email_verified_at) whenever OTP is
     * enabled, every one of those pre-existing active accounts would suddenly be locked out —
     * accounts that were already legitimately active have to be backfilled as verified, or this
     * fix regresses login for real existing customers instead of only gating new signups.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('status', 'active')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        // Not reversible — there's no way to distinguish "verified for real" from "backfilled"
        // after the fact, and reversing would re-introduce the lockout this fixes.
    }
};
