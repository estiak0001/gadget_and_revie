<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');
            $table->enum('role', ['customer', 'vendor', 'admin'])->default('customer')->after('password');
            $table->enum('status', ['active', 'inactive', 'pending', 'suspended'])->default('pending')->after('role');
            $table->string('phone_verification_code')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->string('avatar')->nullable();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone', 'role', 'status', 'phone_verification_code', 
                'phone_verified_at', 'avatar'
            ]);
            $table->dropSoftDeletes();
        });
    }
};
