<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reusable, named snippets of Notes / Terms & Conditions text an admin can save once and
     * reuse across quotations — separate from the free-text `notes`/`terms` columns already on
     * `quotations` itself, which stay a per-quotation snapshot (picking a template just copies
     * its `content` into that quotation's field at the time; editing the template afterward
     * never retroactively changes any quotation that already used it).
     */
    public function up(): void
    {
        Schema::create('quotation_templates', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['notes', 'terms']);
            $table->string('title');
            $table->text('content');
            // At most one default per type — auto-filled into brand-new quotations so a repeat
            // boilerplate (e.g. the standard terms) doesn't have to be picked by hand every time.
            $table->boolean('is_default')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['type', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_templates');
    }
};
