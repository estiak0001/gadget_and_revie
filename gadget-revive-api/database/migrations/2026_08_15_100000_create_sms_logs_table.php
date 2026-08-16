<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->string('phone');
            $table->text('message');
            // What triggered this send — lets the admin filter the log by purpose instead of
            // guessing from the message text. 'test' is the admin's own "Send Test SMS" action.
            $table->enum('purpose', ['otp', 'order_placed', 'order_status', 'test', 'other'])->default('other');
            $table->enum('status', ['sent', 'failed'])->default('failed');
            // Raw gateway response (or the exception message on failure) — the only real way to
            // debug a misconfigured provider without SSHing in to read the Laravel log.
            $table->text('response')->nullable();
            $table->unsignedBigInteger('related_id')->nullable(); // order id / user id, depending on purpose
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['purpose', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_logs');
    }
};
