<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Distinguishes products created one-at-a-time through the normal form from ones
            // created via the Excel bulk-upload tool — plain string (not enum) so a future
            // source doesn't need another ALTER TABLE MODIFY.
            $table->string('source', 20)->default('manual')->after('is_draft');
            // Groups every row from the same bulk-upload spreadsheet so an admin can find and
            // review "this batch" after uploading. Null for manually-created products.
            $table->string('bulk_upload_batch', 64)->nullable()->after('source');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['source', 'bulk_upload_batch']);
        });
    }
};
