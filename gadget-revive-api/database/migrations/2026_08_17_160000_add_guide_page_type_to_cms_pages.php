<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds 'guide' to cms_pages.page_type — reusing the existing CMS pages system as the
     * storefront's buying-guide / repair-advice content section (SEO Phase 3) instead of
     * standing up a whole new content type. A guide is just a CmsPage with page_type='guide',
     * listed at /guides and rendered at /guides/{slug} on the storefront.
     */
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE cms_pages MODIFY COLUMN page_type ".
            "ENUM('page','faq','terms','privacy','about','contact','guide') NOT NULL DEFAULT 'page'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE cms_pages MODIFY COLUMN page_type ".
            "ENUM('page','faq','terms','privacy','about','contact') NOT NULL DEFAULT 'page'"
        );
    }
};
