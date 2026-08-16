<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_connections', function (Blueprint $table) {
            // Both optional, same {api_key}/{sender_id}/{phone}/{message} template convention as
            // api_url — most providers won't have one or either, so a blank value just means
            // "balance/cost isn't checkable for this connection" rather than an error.
            $table->string('balance_url', 2000)->nullable()->after('api_url');
            // report_url additionally supports a {request_id} placeholder, filled from the
            // request_id captured off the send response — used to look up the per-message charge
            // after the fact (Alpha SMS doesn't return cost on the send call itself, only on its
            // report endpoint).
            $table->string('report_url', 2000)->nullable()->after('balance_url');
        });

        Schema::table('sms_logs', function (Blueprint $table) {
            $table->string('provider_request_id')->nullable()->after('response');
            $table->decimal('cost', 10, 4)->nullable()->after('provider_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('sms_connections', function (Blueprint $table) {
            $table->dropColumn(['balance_url', 'report_url']);
        });

        Schema::table('sms_logs', function (Blueprint $table) {
            $table->dropColumn(['provider_request_id', 'cost']);
        });
    }
};
