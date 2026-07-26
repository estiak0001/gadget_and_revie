<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Service intake = the goods-received voucher created when a customer
     * drops off a device for service, BEFORE any order exists. A receipt is
     * printed from this record; once the work/quote is agreed it can be
     * converted into a service order (linked via order_id).
     */
    public function up(): void
    {
        Schema::create('service_intakes', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number')->unique();

            // Customer (optional link to a registered user; always store snapshot fields)
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_email')->nullable();
            $table->text('customer_address')->nullable();

            // Location
            $table->foreignId('branch_location_id')->nullable()->constrained('branch_locations')->nullOnDelete();
            $table->foreignId('division_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('district_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();

            // Lifecycle
            $table->enum('status', ['received', 'in_progress', 'ready', 'converted', 'delivered', 'cancelled'])
                ->default('received');
            $table->decimal('estimated_cost', 10, 2)->nullable();
            $table->timestamp('received_at')->nullable();
            $table->date('expected_delivery_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->text('notes')->nullable();
            $table->text('admin_notes')->nullable();

            // Set once the intake is converted into a service order
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'received_at']);
            $table->index('customer_phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_intakes');
    }
};
