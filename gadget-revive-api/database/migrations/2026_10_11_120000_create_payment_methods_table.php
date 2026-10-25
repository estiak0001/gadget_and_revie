<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A payment method is a real place money sits — Cash, a bank account, a mobile banking merchant
 * account — each linked 1:1 to its own Chart of Accounts entry (see PaymentMethodController) so
 * the ledger can tell them apart, instead of every payment regardless of method landing in the
 * single Cash account like it does today (see Order::recordPayment()). `code` is the stable
 * string that keeps living on orders.payment_method and anywhere else that references a method by
 * value rather than by this table's numeric id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->enum('type', ['cash', 'bank', 'mobile_banking', 'card', 'other'])->default('other');
            $table->foreignId('chart_of_account_id')->constrained('chart_of_accounts');
            $table->string('account_holder_name')->nullable();
            $table->string('account_number')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('branch_name')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            // The 4 methods the app shipped with (cash, bkash, nagad, bank_transfer) — protected
            // from deletion the same way ChartOfAccount.is_system protects the seeded accounts,
            // since removing one out from under existing orders would orphan their payment_method.
            $table->boolean('is_system')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_methods');
    }
};
