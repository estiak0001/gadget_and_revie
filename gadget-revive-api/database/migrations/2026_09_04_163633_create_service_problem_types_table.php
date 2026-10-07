<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The "Problem Type" dropdown's options (e.g. Recovery, Repair) -- a small managed lookup list
 * an admin can add/rename/delete from the Service Intake form itself, same shape as
 * ExpenseCategory: name + slug (auto-derived) + is_active + soft deletes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_problem_types', function (Blueprint $table) {
            $table->id();
            // Not a DB-level unique() -- combined with softDeletes() that would block reusing a
            // deleted type's name forever (the DB constraint doesn't know about deleted_at).
            // Uniqueness among *live* rows is enforced app-side instead (see the controller).
            $table->string('name', 100);
            $table->string('slug', 120);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_problem_types');
    }
};
