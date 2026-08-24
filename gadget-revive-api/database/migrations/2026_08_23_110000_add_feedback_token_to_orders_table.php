<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Mirrors invoice_token exactly — a short opaque token backing the public,
            // no-login feedback link sent via SMS (Order::getOrCreateFeedbackToken()).
            $table->string('feedback_token', 12)->nullable()->unique()->after('invoice_token');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('feedback_token');
        });
    }
};
