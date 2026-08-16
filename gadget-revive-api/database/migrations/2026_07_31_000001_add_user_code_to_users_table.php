<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Human-friendly customer/staff identifier (e.g. "USR-00001") shown on printed
            // documents (receipts/invoices) alongside a person's name, distinct from the
            // internal auto-increment id. Nullable so the column can be added before backfilling.
            $table->string('user_code')->nullable()->unique()->after('id');
        });

        // Backfill every existing account (including soft-deleted, so no id is reused/skipped)
        // with a code derived from its id — new accounts get theirs via User::boot().
        DB::table('users')->select('id')->whereNull('user_code')
            ->chunkById(500, function ($users) {
                foreach ($users as $user) {
                    DB::table('users')->where('id', $user->id)->update([
                        'user_code' => 'USR-' . str_pad((string) $user->id, 5, '0', STR_PAD_LEFT),
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('user_code');
        });
    }
};
