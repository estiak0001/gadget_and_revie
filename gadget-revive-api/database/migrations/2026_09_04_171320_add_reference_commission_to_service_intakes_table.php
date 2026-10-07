<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Some customers are brought in by a reference person (another customer, a shop, an
     * employee's contact, etc.) who then needs a commission cut of this service job.
     * Both fields are optional -- most intakes have neither.
     */
    public function up(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->string('reference_name')->nullable()->after('non_refundable_reason');
            $table->decimal('commission_amount', 10, 2)->nullable()->after('reference_name');
        });
    }

    public function down(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->dropColumn(['reference_name', 'commission_amount']);
        });
    }
};
