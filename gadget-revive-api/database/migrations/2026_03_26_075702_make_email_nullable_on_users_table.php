<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make email nullable on users table.
 *
 * Phone number is now the primary identifier. Email is optional so users
 * who only provide a phone number can still register successfully.
 * The unique constraint is kept but updated to allow nulls (multiple nulls are
 * allowed in a nullable unique column in MySQL/PostgreSQL).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }
};
