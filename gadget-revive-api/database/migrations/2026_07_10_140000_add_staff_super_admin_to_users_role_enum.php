<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('customer', 'vendor', 'admin', 'staff', 'super_admin') DEFAULT 'customer'");
    }

    public function down(): void
    {
        DB::statement("UPDATE users SET role = 'admin' WHERE role IN ('staff', 'super_admin')");
        DB::statement("ALTER TABLE users MODIFY role ENUM('customer', 'vendor', 'admin') DEFAULT 'customer'");
    }
};
