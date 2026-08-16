<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_connections', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // admin-given label, e.g. "Alpha SMS - Primary"
            $table->string('provider_name')->nullable();
            $table->text('api_url');
            $table->string('method', 10)->default('GET');
            $table->string('api_key')->nullable();
            $table->string('sender_id')->nullable();
            $table->string('phone_format', 20)->default('as_is'); // 'as_is' | 'bd_880'
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Carry forward whatever was already configured as the single flat sms_* SiteSetting rows
        // (built and tested against Alpha SMS in the previous pass) as this install's first named
        // connection, instead of losing it now that connections are a proper multi-row resource.
        $get = fn (string $key) => DB::table('site_settings')->where('key', $key)->value('value');
        $apiUrl = $get('sms_api_url');

        if ($apiUrl) {
            $connectionId = DB::table('sms_connections')->insertGetId([
                'name' => $get('sms_provider_name') ?: 'Default SMS Connection',
                'provider_name' => $get('sms_provider_name'),
                'api_url' => $apiUrl,
                'method' => $get('sms_method') ?: 'GET',
                'api_key' => $get('sms_api_key'),
                'sender_id' => $get('sms_sender_id'),
                'phone_format' => $get('sms_phone_format') ?: 'as_is',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Point OTP/order sending at this same connection, and carry over whether each was
            // enabled — otherwise this migration would silently turn SMS sending off for an
            // install that already had it working.
            $otpEnabled = filter_var($get('sms_enabled') ?: 'false', FILTER_VALIDATE_BOOLEAN)
                && filter_var($get('sms_send_otp') ?: 'true', FILTER_VALIDATE_BOOLEAN);
            $orderEnabled = filter_var($get('sms_enabled') ?: 'false', FILTER_VALIDATE_BOOLEAN)
                && filter_var($get('sms_send_order_updates') ?: 'true', FILTER_VALIDATE_BOOLEAN);

            // Deliberately a different group from the connections themselves ('sms_config', not
            // 'sms') — Settings > SMS is being scoped to connection build/test only, this
            // purpose-routing config (which connection handles OTP vs order SMS, message
            // templates) lives on the dedicated SMS Center page instead, with its own custom UI
            // rather than the generic key-value settings renderer.
            $upsert = function (string $key, string $value, string $type = 'text') {
                DB::table('site_settings')->updateOrInsert(
                    ['key' => $key],
                    ['value' => $value, 'type' => $type, 'group' => 'sms_config', 'is_public' => false, 'updated_at' => now(), 'created_at' => now()]
                );
            };
            $upsert('sms_otp_connection_id', (string) $connectionId);
            $upsert('sms_otp_enabled', $otpEnabled ? 'true' : 'false', 'boolean');
            $upsert('sms_order_connection_id', (string) $connectionId);
            $upsert('sms_order_enabled', $orderEnabled ? 'true' : 'false', 'boolean');
            $upsert('sms_campaign_connection_id', (string) $connectionId);
        }

        // The old flat single-connection settings are superseded by sms_connections rows —
        // remove them so the (now-repurposed) Settings > SMS tab doesn't show stale duplicate
        // fields alongside the new connection manager.
        DB::table('site_settings')->whereIn('key', [
            'sms_enabled', 'sms_send_otp', 'sms_send_order_updates', 'sms_provider_name',
            'sms_api_url', 'sms_method', 'sms_api_key', 'sms_sender_id', 'sms_phone_format',
        ])->delete();
    }

    public function down(): void
    {
        DB::table('site_settings')->whereIn('key', [
            'sms_otp_connection_id', 'sms_otp_enabled', 'sms_order_connection_id',
            'sms_order_enabled', 'sms_campaign_connection_id',
        ])->delete();
        Schema::dropIfExists('sms_connections');
    }
};
