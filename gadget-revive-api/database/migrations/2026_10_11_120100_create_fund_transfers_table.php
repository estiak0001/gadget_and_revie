<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A log of money moved between two payment methods (e.g. Cash drawer -> Bank), kept separate from
 * a generic manual journal entry so there's a dedicated, readable "Transfers" history instead of
 * having to pick transfers back out of the full journal by reference_type. The actual double-entry
 * posting still goes through JournalEntry::post() like everything else — journal_entry_id links
 * back to it once posted (see AccountingController::transfer()).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fund_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_payment_method_id')->constrained('payment_methods');
            $table->foreignId('to_payment_method_id')->constrained('payment_methods');
            $table->decimal('amount', 14, 2);
            $table->date('transfer_date');
            $table->string('description')->nullable();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('transfer_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fund_transfers');
    }
};
