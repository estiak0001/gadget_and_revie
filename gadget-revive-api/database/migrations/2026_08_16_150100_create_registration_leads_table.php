<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Captures a phone number the moment someone types it into the storefront registration
        // form — before they ever submit, and independent of whether the eventual registration
        // attempt succeeds, fails validation, or errors out. This is the only field that matters
        // here: a lead with no phone number isn't actionable, so phone is the one required column.
        Schema::create('registration_leads', function (Blueprint $table) {
            $table->id();
            $table->string('phone');
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            // Set once this phone number actually completes registration, so a lead list can
            // filter down to "still just a lead" vs. "became a real customer" instead of double
            // -counting every signup as both.
            $table->foreignId('converted_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_leads');
    }
};
