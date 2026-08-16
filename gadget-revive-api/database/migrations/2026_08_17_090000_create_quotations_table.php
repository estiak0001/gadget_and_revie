<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A quotation is deliberately standalone — not tied to an Order the way CustomInvoice is
     * (see resources/views/invoices/custom_order.blade.php) — since it's a pre-sale offer that
     * may never become a real order at all. `items` is a JSON snapshot (name/sku/description/
     * qty/price), same pattern as custom_invoices.items: each row optionally carries a
     * `product_id` for traceability back to the catalog item it was copied from, but the row
     * itself is independent afterward — editing a quotation never touches the live product, and
     * a later price change on that product never retroactively changes an already-issued quote.
     */
    public function up(): void
    {
        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('quotation_number')->unique();
            $table->date('quotation_date');
            $table->date('valid_until')->nullable();

            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->string('customer_address', 500)->nullable();

            $table->json('items');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('shipping', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);

            $table->text('notes')->nullable();
            $table->text('terms')->nullable();
            $table->enum('status', ['draft', 'sent', 'accepted', 'rejected', 'expired'])->default('draft');

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotations');
    }
};
