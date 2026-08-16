<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Running total of how much of this PO's supplier-refund-due has actually been
            // collected back in cash (as opposed to still sitting as an Accounts Receivable
            // promise). Set via returnToSupplier()'s collect_refund_now flag, and unwound by
            // restockReturn() if a cash-collected return is later undone. Needed because
            // PurchaseOrder::getRefundDueFromSupplierAttribute() otherwise has no way to tell
            // "the supplier still owes us this" apart from "we already got it back" — both look
            // identical from received_value/returned_value/paid_amount alone.
            $table->decimal('refund_received_amount', 12, 2)->default(0)->after('paid_amount');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('refund_received_amount');
        });
    }
};
