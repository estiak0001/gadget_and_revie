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
        Schema::table('reviews', function (Blueprint $table) {
            // Drop old unique constraint
            $table->dropUnique(['order_id', 'customer_id']);
            
            // Rename customer_id to user_id
            $table->renameColumn('customer_id', 'user_id');

            // Drop old boolean columns (and the index that references them)
            $table->dropIndex(['vendor_profile_id', 'is_approved', 'is_visible']);
            $table->dropColumn(['is_approved', 'is_visible']);
            
            // Add new columns
            $table->string('status', 50)->default('pending')->after('vendor_responded_at');
            $table->json('images')->nullable()->after('review');
            $table->integer('helpful_count')->default(0)->after('status');
            
            // Add new unique constraint
            $table->unique(['order_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            // Drop new unique constraint
            $table->dropUnique(['order_id', 'user_id']);
            
            // Rename user_id back to customer_id
            $table->renameColumn('user_id', 'customer_id');
            
            // Drop new columns
            $table->dropColumn(['status', 'images', 'helpful_count']);
            
            // Re-add old boolean columns
            $table->boolean('is_approved')->default(true)->after('vendor_responded_at');
            $table->boolean('is_visible')->default(true)->after('is_approved');
            $table->index(['vendor_profile_id', 'is_approved', 'is_visible']);

            // Add old unique constraint
            $table->unique(['order_id', 'customer_id']);
        });
    }
};
