<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            AdminTierSeeder::class,
            SalesFinancePermissionSeeder::class,
            ChartOfAccountSeeder::class,
            LocationSeeder::class,
            CategorySeeder::class,
            ServiceCatalogSeeder::class,
            SiteSettingSeeder::class,
            CmsSettingsSeeder::class,
            DataRecoveryCmsSeeder::class,
            AboutCmsSeeder::class,
            BannerSeeder::class,
            AdminUserSeeder::class,
        ]);
    }
}
