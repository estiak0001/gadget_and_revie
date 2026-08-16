<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE products RENAME COLUMN average_cost TO current_cost');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE products RENAME COLUMN current_cost TO average_cost');
    }
};
