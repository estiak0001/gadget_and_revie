<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            // Deleting an expense now always reverses its journal entry rather than
            // optionally discarding the ledger trail — these columns record that it
            // happened so the admin UI can filter for and audit reversed expenses,
            // independent of the soft-delete timestamp itself.
            $table->boolean('is_reversed')->default(false)->after('reference');
            $table->timestamp('reversed_at')->nullable()->after('is_reversed');
            $table->foreignId('reversed_by')->nullable()->after('reversed_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reversed_by');
            $table->dropColumn(['is_reversed', 'reversed_at']);
        });
    }
};
