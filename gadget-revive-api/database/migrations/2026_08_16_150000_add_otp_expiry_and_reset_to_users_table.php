<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // The registration OTP (phone_verification_code) never expired before — it was valid
            // forever until used, and resend had no cooldown. This timestamp is the single source
            // of truth for both: a code is only accepted while now() is before it, and a resend is
            // only allowed once now() is past it (or none has ever been sent).
            $table->timestamp('phone_verification_expires_at')->nullable()->after('phone_verification_code');

            // Password reset gets its own OTP slot, deliberately separate from
            // phone_verification_code — sharing one column would let an in-flight password-reset
            // code double as a phone-verification code (or vice versa) for the same user, which is
            // never intended.
            $table->string('password_reset_otp', 6)->nullable()->after('phone_verified_at');
            $table->timestamp('password_reset_otp_expires_at')->nullable()->after('password_reset_otp');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone_verification_expires_at', 'password_reset_otp', 'password_reset_otp_expires_at']);
        });
    }
};
